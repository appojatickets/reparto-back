import type { Usuario } from '../../domain/entidades/usuario.js';
import { esDeCamion } from '../../domain/permisos.js';
import { fechaEnChile } from '../../domain/shared/fechas.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { Clock } from '../ports/out/clock.js';
import type { FacturaRepository } from '../ports/out/facturas.js';
import type { Jornada, JornadaRepository } from '../ports/out/jornadas.js';
import type { RutaRepository } from '../ports/out/rutas.js';

type Deps = { readonly jornadas: JornadaRepository; readonly clock: Clock };

/** Al empezar el día se barren las rutas guardadas de días anteriores: la ruta se arma cada día y no se reutiliza. */
export const crearIniciarJornada = ({ jornadas, rutas, clock }: Deps & { readonly rutas: RutaRepository }) =>
  async (actor: Usuario, camionId: string): Promise<Result<Jornada, ErrorApp>> => {
    const ahora = clock.now();
    const fecha = fechaEnChile(ahora);
    await rutas.borrarAnteriores(actor.empresaId, fecha);
    const r = await jornadas.iniciar(actor.empresaId, actor.id, camionId, fecha, ahora);
    return r.ok ? ok(r.value) : err(errorApp('NO_ENCONTRADO', 'El camión no existe o está fuera de servicio.'));
  };

/** La jornada de hoy del usuario, o `undefined` si todavía no eligió camión. */
export const crearMiJornada = ({ jornadas, clock }: Deps) =>
  (actor: Usuario): Promise<Jornada | undefined> => jornadas.activa(actor.empresaId, actor.id, fechaEnChile(clock.now()));

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
export const crearTerminarJornada = ({ jornadas, facturas, rutas, clock }: Deps & { readonly facturas: FacturaRepository; readonly rutas: RutaRepository }) =>
  async (actor: Usuario): Promise<ResumenJornada | undefined> => {
    const ahora = clock.now();
    const j = await jornadas.activa(actor.empresaId, actor.id, fechaEnChile(ahora));
    await jornadas.terminar(actor.empresaId, actor.id, ahora);
    if (!j) return undefined;
    const del = await facturas.listar(actor.empresaId, { fecha: j.fecha, camionId: j.camion.id, incluirHechas: true });
    const contar = (estado: 'entregada' | 'no_entregada' | 'pendiente'): number => del.filter((f) => f.estado === estado).length;
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
