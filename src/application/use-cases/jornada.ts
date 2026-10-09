import type { Usuario } from '../../domain/entidades/usuario.js';
import { esDeCamion } from '../../domain/permisos.js';
import { fechaEnChile } from '../../domain/shared/fechas.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { Clock } from '../ports/out/clock.js';
import type { FacturaRepository } from '../ports/out/facturas.js';
import type { Jornada, JornadaRepository } from '../ports/out/jornadas.js';
import type { AsignacionDia, PlanillaRepository } from '../ports/out/planillas.js';
import type { RegistroAprendizajeRepository } from '../ports/out/registro-aprendizaje.js';
import type { RutaRepository } from '../ports/out/rutas.js';

type Deps = { readonly jornadas: JornadaRepository; readonly clock: Clock };

/** La jornada con lo que dice la planilla de hoy de ese camión (quiénes van, vendedores y comunas), si la hay. */
export type JornadaConAsignacion = Jornada & { readonly asignacion?: AsignacionDia };

const conAsignacion = async (planillas: PlanillaRepository, empresaId: string, j: Jornada): Promise<JornadaConAsignacion> => {
  const a = await planillas.deCamion(empresaId, j.fecha, j.camion.id);
  return a ? { ...j, asignacion: a } : j;
};

/** Al empezar el día se barren las rutas guardadas de días anteriores: la ruta se arma cada día y no se reutiliza. */
export const crearIniciarJornada = ({ jornadas, rutas, planillas, clock }: Deps & { readonly rutas: RutaRepository; readonly planillas: PlanillaRepository }) =>
  async (actor: Usuario, camionId: string): Promise<Result<JornadaConAsignacion, ErrorApp>> => {
    const ahora = clock.now();
    const fecha = fechaEnChile(ahora);
    await rutas.borrarAnteriores(actor.empresaId, fecha);
    const r = await jornadas.iniciar(actor.empresaId, actor.id, camionId, fecha, ahora);
    return r.ok ? ok(await conAsignacion(planillas, actor.empresaId, r.value)) : err(errorApp('NO_ENCONTRADO', 'El camión no existe o está fuera de servicio.'));
  };

/** La jornada de hoy del usuario, o `undefined` si todavía no eligió camión. */
export const crearMiJornada = ({ jornadas, planillas, clock }: Deps & { readonly planillas: PlanillaRepository }) =>
  async (actor: Usuario): Promise<JornadaConAsignacion | undefined> => {
    const j = await jornadas.activa(actor.empresaId, actor.id, fechaEnChile(clock.now()));
    return j ? conAsignacion(planillas, actor.empresaId, j) : undefined;
  };

/** Lo que quedó del día de un camión al terminar la ruta: queda registrado con la hora de inicio y de término (para los cálculos internos). */
export type ResumenJornada = {
  readonly fecha: string;
  readonly camionId: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly entregadas: number;
  readonly noEntregadas: number;
  /** Las que no se alcanzaron a hacer: se sueltan del camión y quedan «sin camión» en su día (no pasan solas al siguiente). */
  readonly pendientes: number;
};

/**
 * Termina la ruta de hoy: cierra la jornada (con la hora de término), devuelve el resumen del día de ese camión y deja la lista limpia
 * al instante: se borra la ruta guardada, lo hecho queda registrado fuera de la lista y lo pendiente se suelta del camión.
 * Si no había jornada de hoy, cierra lo que hubiera abierto y no devuelve resumen.
 */
export const crearTerminarJornada = ({ jornadas, facturas, rutas, registro, clock }: Deps & { readonly facturas: FacturaRepository; readonly rutas: RutaRepository; readonly registro: RegistroAprendizajeRepository }) =>
  async (actor: Usuario): Promise<ResumenJornada | undefined> => {
    const ahora = clock.now();
    const j = await jornadas.activa(actor.empresaId, actor.id, fechaEnChile(ahora));
    await jornadas.terminar(actor.empresaId, actor.id, ahora);
    if (!j) return undefined;
    // Solo lo hecho desde que empezó esta jornada: lo de una jornada anterior del mismo día ya quedó contado en su resumen.
    const del = await facturas.listar(actor.empresaId, { fecha: j.fecha, camionId: j.camion.id, incluirHechas: true, hechasDesde: j.desde });
    const contar = (estado: 'entregada' | 'no_entregada' | 'pendiente'): number => del.filter((f) => f.estado === estado).length;
    // Antes de soltar lo pendiente se anota qué no se alcanzó: es lo que dice cuántas paradas caben en un día.
    await registro.guardarResumenDeJornada(actor.empresaId, {
      jornadaId: j.id, camionId: j.camion.id, fecha: j.fecha, paradas: del.length, entregadas: contar('entregada'), noEntregadas: contar('no_entregada'),
      sinHacer: contar('pendiente'), sinHacerIds: del.filter((f) => f.estado === 'pendiente').map((f) => f.id), duracionMin: Math.max(0, Math.round((ahora.getTime() - j.desde.getTime()) / 60_000)),
    });
    await facturas.soltarPendientesDelCamion(actor.empresaId, j.camion.id, j.fecha);
    await rutas.borrar(actor.empresaId, j.camion.id, j.fecha);
    await rutas.borrarAnteriores(actor.empresaId, fechaEnChile(ahora));
    return { fecha: j.fecha, camionId: j.camion.id, desde: j.desde, hasta: ahora, entregadas: contar('entregada'), noEntregadas: contar('no_entregada'), pendientes: contar('pendiente') };
  };

/**
 * Un chofer solo puede tocar el camión de su jornada de hoy (ADR 0012). Devuelve el camión que corresponde usar:
 * para él, el de su jornada (y rechaza otro); para despachador y admin, el pedido tal cual.
 */
export const crearResolverCamion = ({ jornadas, clock }: Deps) =>
  async (actor: Usuario, pedido: string | undefined): Promise<Result<string | undefined, ErrorApp>> => {
    if (!esDeCamion(actor.rol)) return ok(pedido);
    const j = await jornadas.activa(actor.empresaId, actor.id, fechaEnChile(clock.now()));
    if (!j) return err(errorApp('VALIDACION', 'Primero elige el camión que manejas hoy.', { codigo: 'SIN_JORNADA' }));
    if (pedido !== undefined && pedido !== j.camion.id) return err(errorApp('SIN_PERMISO', 'Ese no es el camión que manejas hoy.'));
    return ok(j.camion.id);
  };

export type ResolverCamion = ReturnType<typeof crearResolverCamion>;
