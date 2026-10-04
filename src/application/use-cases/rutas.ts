import type { ConfigEmpresa, Deposito } from '../../domain/entidades/config-empresa.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { esFechaValida } from '../../domain/shared/fechas.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { armarProblema, type EntradaParada } from '../../domain/ruteo/armar-problema.js';
import { insertarNuevas, moverAlFrente, moverParada, ordenarPendientes, posponer, type EstadoRuta, type ResultadoOperacion } from '../../domain/ruteo/operaciones.js';
import { evaluarOrden, optimizar } from '../../domain/ruteo/optimizador.js';
import type { Motivo, ProblemaRuta, Solucion, Sugerencia } from '../../domain/ruteo/tipos.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { CamionRepository } from '../ports/out/camiones.js';
import type { Clock } from '../ports/out/clock.js';
import type { EmpresaRepository } from '../ports/out/empresa.js';
import type { FacturaRepository } from '../ports/out/facturas.js';
import type { FacturaParaRuta, ModoRuta, RutaGuardada, RutaRepository } from '../ports/out/rutas.js';
import type { ResolverCamion } from './jornada.js';

/** Tiempo máximo de cómputo del optimizador por pedido (válvula de seguridad; con ~50 paradas toma una fracción). */
const LIMITE_OPTIMIZACION_MS = 2500;

export type ItemVista = {
  readonly facturaId: string;
  readonly folio: string;
  readonly localId: string;
  readonly cliente: string;
  readonly direccion: string;
  readonly comuna: string;
  /** Pin del local, para abrir la navegación (Waze, Google Maps). */
  readonly lat?: number;
  readonly lng?: number;
  readonly urgente: boolean;
  readonly antesDeMin?: number;
  readonly nota?: string;
};

export type ParadaVista = ItemVista & {
  readonly posicion: number;
  readonly llegada: number;
  readonly inicioServicio: number;
  readonly salida: number;
  readonly espera: number;
  readonly atraso: number;
  readonly motivos: readonly Motivo[];
  readonly fijada: boolean;
};

export type VistaRuta = {
  readonly camionId: string;
  readonly fecha: string;
  readonly planificada: boolean;
  readonly modo?: ModoRuta;
  readonly version?: number;
  readonly salidaMin: number;
  readonly horaLimiteRegresoMin: number;
  readonly regreso?: number;
  readonly regresoTardio?: boolean;
  readonly paradas: readonly ParadaVista[];
  /** Pendientes del camión con pin que todavía no tienen lugar en la ruta. */
  readonly nuevas: readonly ItemVista[];
  /** Pendientes sin pin: no se pueden ubicar hasta que alguien fije el pin del local. */
  readonly sinPin: readonly ItemVista[];
  readonly noAtendidas: readonly (ItemVista & { readonly conflictos: readonly string[] })[];
  readonly enRiesgo: readonly (ItemVista & { readonly cierre: number; readonly conflictos: readonly string[]; readonly sugerencias: readonly Sugerencia[] })[];
};

export type Operacion =
  | { readonly tipo: 'subir' | 'bajar' | 'primero' | 'despues' | 'quitar'; readonly facturaId: string }
  | { readonly tipo: 'ordenar' | 'insertar' }
  | { readonly tipo: 'salida'; readonly salidaMin: number };

type Dependencias = {
  readonly rutas: RutaRepository;
  readonly empresas: EmpresaRepository;
  readonly camiones: CamionRepository;
  readonly facturas: FacturaRepository;
  readonly clock: Clock;
  readonly resolverCamion: ResolverCamion;
};

type Contexto = {
  readonly config: ConfigEmpresa;
  readonly deposito: Deposito;
  readonly items: readonly FacturaParaRuta[];
  readonly guardada: RutaGuardada | undefined;
};

const itemDe = (f: FacturaParaRuta): ItemVista => ({
  facturaId: f.facturaId,
  folio: f.folio,
  localId: f.localId,
  cliente: f.razonSocial,
  direccion: f.direccion,
  comuna: f.comuna,
  ...(f.lat !== undefined && f.lng !== undefined ? { lat: f.lat, lng: f.lng } : {}),
  urgente: f.urgente,
  ...(f.antesDeMin !== undefined ? { antesDeMin: f.antesDeMin } : {}),
  ...(f.nota !== undefined ? { nota: f.nota } : {}),
});

const entradaDe = (f: FacturaParaRuta): EntradaParada => ({
  id: f.facturaId,
  nombre: f.razonSocial,
  comuna: f.comuna,
  ...(f.lat !== undefined && f.lng !== undefined ? { coordenada: { lat: f.lat, lng: f.lng } } : {}),
  horarios: f.horarios,
  ...(f.antesDeMin !== undefined ? { antesDeMin: f.antesDeMin } : {}),
  urgente: f.urgente,
});

export const crearServiciosDeRuta = ({ rutas, empresas, camiones, facturas, clock, resolverCamion }: Dependencias) => {
  const presupuesto = () => ({ reloj: () => clock.now().getTime(), limiteMs: LIMITE_OPTIMIZACION_MS });

  const cargar = async (actor: Usuario, camionId: string, fecha: string): Promise<Result<Contexto, ErrorApp>> => {
    if (!esFechaValida(fecha)) return err(errorApp('VALIDACION', 'La fecha no es válida.'));
    const propio = await resolverCamion(actor, camionId);
    if (!propio.ok) return propio;
    const [cams, config] = await Promise.all([camiones.listar(actor.empresaId, {}), empresas.obtenerConfig(actor.empresaId)]);
    if (!cams.some((c) => c.id === camionId)) return err(errorApp('NO_ENCONTRADO', 'El camión no existe.'));
    if (!config?.deposito) return err(errorApp('VALIDACION', 'Primero configura el depósito (de dónde salen los camiones).', { codigo: 'SIN_DEPOSITO' }));
    const [items, guardada] = await Promise.all([rutas.facturasPendientes(actor.empresaId, camionId, fecha), rutas.obtener(actor.empresaId, camionId, fecha)]);
    return ok({ config, deposito: config.deposito, items, guardada });
  };

  const problemaDe = (ctx: Contexto, fecha: string, salida: number, fijas: readonly string[]) =>
    armarProblema({ fecha, deposito: ctx.deposito, salida, horaLimiteRegresoMin: ctx.config.horaLimiteRegresoMin, entradas: ctx.items.map(entradaDe), fijas });

  const vistaDe = (
    ctx: Contexto,
    camionId: string,
    fecha: string,
    salidaMin: number,
    sinPin: readonly EntradaParada[],
    plan?: { readonly solucion: Solucion; readonly problema: ProblemaRuta; readonly modo: ModoRuta; readonly version: number },
  ): VistaRuta => {
    const porId = new Map(ctx.items.map((f) => [f.facturaId, f]));
    const item = (id: string): ItemVista => {
      const f = porId.get(id);
      return f ? itemDe(f) : { facturaId: id, folio: '', localId: '', cliente: '', direccion: '', comuna: '', urgente: false };
    };
    const sinPinIds = new Set(sinPin.map((e) => e.id));
    const enLaRuta = new Set(plan?.solucion.orden ?? []);
    const noAtendidasIds = new Set(plan?.solucion.noAtendidas.map((n) => n.paradaId) ?? []);
    const fijas = new Set(plan?.problema.fijas ?? []);
    const nuevas = ctx.items.filter((f) => !sinPinIds.has(f.facturaId) && !enLaRuta.has(f.facturaId) && !noAtendidasIds.has(f.facturaId)).map(itemDe);
    return {
      camionId,
      fecha,
      planificada: plan !== undefined,
      ...(plan ? { modo: plan.modo, version: plan.version, regreso: plan.solucion.regreso, regresoTardio: plan.solucion.regresoTardio } : {}),
      salidaMin,
      horaLimiteRegresoMin: ctx.config.horaLimiteRegresoMin,
      paradas: (plan?.solucion.detalle ?? []).map((d) => ({
        ...item(d.id),
        posicion: d.posicion,
        llegada: d.llegada,
        inicioServicio: d.inicioServicio,
        salida: d.salida,
        espera: d.espera,
        atraso: d.atraso,
        motivos: d.motivos,
        fijada: fijas.has(d.id),
      })),
      nuevas,
      sinPin: ctx.items.filter((f) => sinPinIds.has(f.facturaId)).map(itemDe),
      noAtendidas: (plan?.solucion.noAtendidas ?? []).map((n) => ({ ...item(n.paradaId), conflictos: n.conflictos })),
      enRiesgo: (plan?.solucion.enRiesgo ?? []).map((r) => ({ ...item(r.paradaId), cierre: r.cierre, conflictos: r.conflictos, sugerencias: r.sugerencias })),
    };
  };

  const guardarYVer = async (
    actor: Usuario,
    ctx: Contexto,
    camionId: string,
    fecha: string,
    estado: { readonly problema: ProblemaRuta; readonly solucion: Solucion; readonly modo: ModoRuta },
    sinPin: readonly EntradaParada[],
    versionEsperada?: number,
  ): Promise<Result<VistaRuta, ErrorApp>> => {
    const g = await rutas.guardar(actor.empresaId, {
      camionId,
      fecha,
      salidaMin: estado.problema.salida,
      modo: estado.modo,
      orden: estado.solucion.orden,
      fijas: estado.problema.fijas,
      usuarioId: actor.id,
      ...(versionEsperada !== undefined ? { versionEsperada } : {}),
    });
    if (!g.ok) return err(errorApp('CONFLICTO', 'Otra persona cambió esta ruta. Se cargó la versión nueva; vuelve a intentar.', { codigo: 'RUTA_DESACTUALIZADA' }));
    return ok(vistaDe(ctx, camionId, fecha, estado.problema.salida, sinPin, { solucion: estado.solucion, problema: estado.problema, modo: estado.modo, version: g.value.version }));
  };

  /** Lo que hay hoy para ese camión y día: la ruta guardada evaluada de nuevo (nada se recalcula si nadie lo pidió). */
  const ver = async (actor: Usuario, entrada: { camionId: string; fecha: string }): Promise<Result<VistaRuta, ErrorApp>> => {
    const ctx = await cargar(actor, entrada.camionId, entrada.fecha);
    if (!ctx.ok) return ctx;
    const { guardada } = ctx.value;
    const salida = guardada?.salidaMin ?? ctx.value.config.salidaPorDefectoMin;
    const { problema, sinPin } = problemaDe(ctx.value, entrada.fecha, salida, guardada?.fijas ?? []);
    if (!guardada) return ok(vistaDe(ctx.value, entrada.camionId, entrada.fecha, salida, sinPin));
    const solucion = evaluarOrden(problema, guardada.orden);
    return ok(vistaDe(ctx.value, entrada.camionId, entrada.fecha, salida, sinPin, { solucion, problema, modo: guardada.modo, version: guardada.version }));
  };

  /** Calcula la ruta sugerida desde cero (reemplaza la anterior, incluso si estaba acomodada a mano). */
  const planificar = async (actor: Usuario, entrada: { camionId: string; fecha: string; salidaMin?: number | undefined }): Promise<Result<VistaRuta, ErrorApp>> => {
    const ctx = await cargar(actor, entrada.camionId, entrada.fecha);
    if (!ctx.ok) return ctx;
    const salida = entrada.salidaMin ?? ctx.value.guardada?.salidaMin ?? ctx.value.config.salidaPorDefectoMin;
    if (!Number.isInteger(salida) || salida < 0 || salida > 1439) return err(errorApp('VALIDACION', 'La hora de salida no es válida.'));
    const { problema, sinPin } = problemaDe(ctx.value, entrada.fecha, salida, []);
    const solucion = optimizar(problema, { presupuesto: presupuesto() });
    return guardarYVer(actor, ctx.value, entrada.camionId, entrada.fecha, { problema, solucion, modo: 'sugerida' }, sinPin);
  };

  const operar = async (actor: Usuario, entrada: { camionId: string; fecha: string; version: number; operacion: Operacion }): Promise<Result<VistaRuta, ErrorApp>> => {
    const ctx = await cargar(actor, entrada.camionId, entrada.fecha);
    if (!ctx.ok) return ctx;
    const { guardada } = ctx.value;
    if (!guardada) return err(errorApp('NO_ENCONTRADO', 'Primero planifica la ruta de este camión.'));
    if (guardada.version !== entrada.version) {
      return err(errorApp('CONFLICTO', 'Otra persona cambió esta ruta. Recarga para ver la versión nueva.', { codigo: 'RUTA_DESACTUALIZADA' }));
    }
    const op = entrada.operacion;
    const salida = op.tipo === 'salida' ? op.salidaMin : guardada.salidaMin;
    if (op.tipo === 'salida' && !(Number.isInteger(salida) && salida >= 0 && salida <= 1439)) return err(errorApp('VALIDACION', 'La hora de salida no es válida.'));

    let items = ctx.value.items;
    if ('facturaId' in op) {
      if (op.tipo === 'quitar') {
        if (!items.some((f) => f.facturaId === op.facturaId)) return err(errorApp('NO_ENCONTRADO', 'La factura no está en este camión.'));
      } else if (!guardada.orden.includes(op.facturaId)) {
        return err(errorApp('NO_ENCONTRADO', 'La factura no está en la ruta.'));
      }
    }
    if (op.tipo === 'quitar') {
      // Quitar de la ruta = sacar la factura de este camión; queda «sin camión» para asignarla a otro.
      const q = await facturas.actualizar(actor.empresaId, op.facturaId, { camionId: null });
      if (!q.ok) return err(errorApp('NO_ENCONTRADO', 'La factura no existe.'));
      items = items.filter((f) => f.facturaId !== op.facturaId);
    }
    const ctx2: Contexto = { ...ctx.value, items };
    const { problema, sinPin } = problemaDe(ctx2, entrada.fecha, salida, guardada.fijas);
    const orden = guardada.orden.filter((id) => op.tipo !== 'quitar' || id !== op.facturaId);
    const estado: EstadoRuta = { problema, orden };
    const opciones = { presupuesto: presupuesto() };
    const manual = guardada.modo === 'manual';

    const aplicar = (): Result<ResultadoOperacion & { modo: ModoRuta }, ErrorApp> => {
      switch (op.tipo) {
        case 'subir':
        case 'bajar': {
          const r = moverParada(estado, op.facturaId, op.tipo === 'subir' ? -1 : 1);
          return r.ok ? ok({ ...r.value, modo: 'manual' }) : err(errorApp('NO_ENCONTRADO', r.error.mensaje));
        }
        case 'primero': {
          if (!manual) {
            const r = moverAlFrente(estado, op.facturaId, opciones);
            return r.ok ? ok({ ...r.value, modo: guardada.modo }) : err(errorApp('NO_ENCONTRADO', r.error.mensaje));
          }
          // A mano: solo pasa al frente, sin reordenar el resto.
          const p: ProblemaRuta = { ...problema, fijas: [op.facturaId, ...problema.fijas.filter((x) => x !== op.facturaId)] };
          return ok({ problema: p, solucion: evaluarOrden(p, [op.facturaId, ...orden.filter((x) => x !== op.facturaId)]), modo: 'manual' });
        }
        case 'despues': {
          const r = posponer(estado, op.facturaId);
          return r.ok ? ok({ ...r.value, modo: guardada.modo }) : err(errorApp('NO_ENCONTRADO', r.error.mensaje));
        }
        case 'quitar':
          return ok({ problema, solucion: manual ? evaluarOrden(problema, orden) : optimizar(problema, { ...opciones, ordenInicial: orden }), modo: guardada.modo });
        case 'ordenar':
          return ok({ ...ordenarPendientes(estado, opciones), modo: 'sugerida' });
        case 'insertar':
          return ok({ ...insertarNuevas(estado), modo: guardada.modo });
        case 'salida':
          return ok({ problema, solucion: manual ? evaluarOrden(problema, orden) : optimizar(problema, { ...opciones, ordenInicial: orden }), modo: guardada.modo });
      }
    };
    const r = aplicar();
    if (!r.ok) return r;
    return guardarYVer(actor, ctx2, entrada.camionId, entrada.fecha, r.value, sinPin, entrada.version);
  };

  return { ver, planificar, operar };
};
