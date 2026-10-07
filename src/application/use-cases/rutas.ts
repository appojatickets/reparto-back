import type { ConfigEmpresa, Deposito } from '../../domain/entidades/config-empresa.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { esFechaValida, fechaEnChile, minutosEnChile } from '../../domain/shared/fechas.js';
import type { Coordenada } from '../../domain/valor/coordenada.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { armarProblema, type EntradaParada } from '../../domain/ruteo/armar-problema.js';
import { insertarNuevas, moverAlFrente, moverParada, ordenarPendientes, posponer, type EstadoRuta, type ResultadoOperacion } from '../../domain/ruteo/operaciones.js';
import { evaluarOrden, optimizar } from '../../domain/ruteo/optimizador.js';
import type { Motivo, ProblemaRuta, Solucion, Sugerencia } from '../../domain/ruteo/tipos.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { CamionRepository } from '../ports/out/camiones.js';
import { centroDeComuna } from '../../domain/comunas.js';
import type { Clock } from '../ports/out/clock.js';
import type { EmpresaRepository } from '../ports/out/empresa.js';
import type { EntregaRepository } from '../ports/out/entregas.js';
import type { FacturaRepository } from '../ports/out/facturas.js';
import type { JornadaRepository } from '../ports/out/jornadas.js';
import type { ViajesDeLaRuta, ViajesPorCalle } from './viajes-por-calle.js';
import { aprendidoParaRuta, SIN_APRENDIZAJE, type AprendidoParaRuta } from '../../domain/aprendizaje/uso.js';
import type { AprendizajeRepository } from '../ports/out/aprendizaje.js';
import { DEPOSITO, ORIGEN } from '../../domain/ruteo/tiempos.js';
import type { RegistroAprendizajeRepository, TipoOperacionRuta } from '../ports/out/registro-aprendizaje.js';
import type { FacturaParaRuta, ModoRuta, RutaGuardada, RutaRepository } from '../ports/out/rutas.js';
import type { ResolverCamion } from './jornada.js';

/** Tiempo máximo de cómputo del optimizador por pedido (válvula de seguridad; con ~50 paradas toma una fracción). */
const LIMITE_OPTIMIZACION_MS = 2500;

export type ItemVista = {
  readonly facturaId: string;
  readonly folio?: string;
  readonly localId: string;
  readonly cliente: string;
  readonly direccion: string;
  readonly comuna: string;
  /** Pin del local, para abrir la navegación (Waze, Google Maps). */
  readonly lat?: number;
  readonly lng?: number;
  /** El local no tiene pin todavía: la ruta lo ubica por el centro de su comuna (se afina al fijar el pin o con la primera entrega). */
  readonly ubicacionAproximada?: boolean;
  /** El local tiene foto de la fachada (se pide aparte, con URL firmada). */
  readonly tieneFoto?: boolean;
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
  /** Si la ruta es de hoy y ya pasó la hora de salida (o el camión ya hizo paradas), desde cuándo se calculan las horas. */
  readonly calculadaDesdeMin?: number;
  readonly horaLimiteRegresoMin: number;
  /** De dónde sale y adónde vuelve el camión: la app avisa que la ruta termina al llegar aquí. */
  readonly deposito: { readonly lat: number; readonly lng: number; readonly nombre?: string };
  readonly regreso?: number;
  readonly regresoTardio?: boolean;
  readonly paradas: readonly ParadaVista[];
  /** Pendientes del camión con pin que todavía no tienen lugar en la ruta. */
  readonly nuevas: readonly ItemVista[];
  /** Lo que ya se hizo hoy en este camión: entregado o no entregado. */
  readonly hechas: readonly (ItemVista & { readonly estado: 'entregada' | 'no_entregada' })[];
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
  readonly entregas: EntregaRepository;
  readonly jornadas: JornadaRepository;
  /** Cada cálculo o movimiento de la ruta queda guardado (el sistema aprende de lo que sugirió y de lo que la gente corrigió). */
  readonly registro: RegistroAprendizajeRepository;
  /** Lo que el analizador aprendió (ritmo del camión, tiempo de atención por local). Sin esto la ruta usa sus valores de respaldo. */
  readonly aprendizaje?: Pick<AprendizajeRepository, 'parametros'>;
  /** Tiempos de manejar por calles (si hay servicio de rutas configurado); sin esto, o si falla, la ruta mide en línea recta. */
  readonly viajes?: ViajesPorCalle;
  readonly clock: Clock;
  readonly resolverCamion: ResolverCamion;
  /** Pide buscar el pin de estos locales por su dirección (en segundo plano; la ruta no espera). */
  readonly programarPines?: (empresaId: string, localIds: readonly string[]) => void;
};

type Contexto = {
  readonly config: ConfigEmpresa;
  readonly deposito: Deposito;
  readonly items: readonly FacturaParaRuta[];
  readonly guardada: RutaGuardada | undefined;
  readonly aprendido: AprendidoParaRuta;
  readonly viajes: ViajesDeLaRuta;
  /** Solo si la ruta es de hoy: la hora actual (la ruta no puede empezar antes) y la última posición del camión. */
  readonly ahoraMin?: number;
  readonly origen?: Coordenada;
  readonly hechas: readonly (ItemVista & { readonly estado: 'entregada' | 'no_entregada' })[];
};

const itemDe = (f: FacturaParaRuta): ItemVista => ({
  facturaId: f.facturaId,
  ...(f.folio !== undefined ? { folio: f.folio } : {}),
  localId: f.localId,
  cliente: f.razonSocial,
  direccion: f.direccion,
  comuna: f.comuna,
  ...(f.lat !== undefined && f.lng !== undefined ? { lat: f.lat, lng: f.lng, ...(f.pinAproximado ? { ubicacionAproximada: true } : {}) } : centroDeComuna(f.comuna) !== undefined ? { ubicacionAproximada: true } : {}),
  ...(f.tieneFoto ? { tieneFoto: true } : {}),
  urgente: f.urgente,
  ...(f.antesDeMin !== undefined ? { antesDeMin: f.antesDeMin } : {}),
  ...(f.nota !== undefined ? { nota: f.nota } : {}),
});

const entradaDe = (f: FacturaParaRuta, servicioMin?: number): EntradaParada => {
  // Sin pin la ruta no se detiene: se ubica por el centro de la comuna hasta que haya un pin mejor.
  const coordenada = f.lat !== undefined && f.lng !== undefined ? { lat: f.lat, lng: f.lng } : centroDeComuna(f.comuna);
  return {
    id: f.facturaId,
    nombre: f.razonSocial,
    comuna: f.comuna,
    ...(coordenada ? { coordenada } : {}),
    horarios: f.horarios,
    ...(f.antesDeMin !== undefined ? { antesDeMin: f.antesDeMin } : {}),
    urgente: f.urgente,
    ...(servicioMin !== undefined ? { servicioMin } : {}),
  };
};

export const crearServiciosDeRuta = ({ rutas, empresas, camiones, facturas, entregas, jornadas, registro, aprendizaje, viajes, clock, resolverCamion, programarPines }: Dependencias) => {
  const presupuesto = () => ({ reloj: () => clock.now().getTime(), limiteMs: LIMITE_OPTIMIZACION_MS });

  const cargar = async (actor: Usuario, camionId: string, fecha: string): Promise<Result<Contexto, ErrorApp>> => {
    if (!esFechaValida(fecha)) return err(errorApp('VALIDACION', 'La fecha no es válida.'));
    const propio = await resolverCamion(actor, camionId);
    if (!propio.ok) return propio;
    const [cams, config] = await Promise.all([camiones.listar(actor.empresaId, {}), empresas.obtenerConfig(actor.empresaId)]);
    if (!cams.some((c) => c.id === camionId)) return err(errorApp('NO_ENCONTRADO', 'El camión no existe.'));
    if (!config?.deposito) return err(errorApp('VALIDACION', 'Primero configura el depósito (de dónde salen los camiones).', { codigo: 'SIN_DEPOSITO' }));
    const esHoy = fecha === fechaEnChile(clock.now());
    // Lo aprendido nunca bloquea la ruta: si no se puede leer, se usan los valores de respaldo.
    const aprendido = aprendizaje ? aprendidoParaRuta(await aprendizaje.parametros(actor.empresaId).catch(() => []), camionId) : SIN_APRENDIZAJE;
    // Lo hecho solo cuenta desde que empezó la jornada vigente (o desde que terminó la última): al terminar la ruta la lista queda limpia.
    const jornada = await jornadas.ultimaDelCamion(actor.empresaId, camionId, fecha);
    const hechasDesde = jornada ? (jornada.hasta ?? jornada.desde) : undefined;
    const [items, guardada, todas, ultima] = await Promise.all([
      rutas.facturasPendientes(actor.empresaId, camionId, fecha),
      rutas.obtener(actor.empresaId, camionId, fecha),
      facturas.listar(actor.empresaId, { fecha, camionId, incluirHechas: true, ...(hechasDesde ? { hechasDesde } : {}) }),
      esHoy ? entregas.ultimaPosicion(actor.empresaId, camionId, fecha) : Promise.resolve(undefined),
    ]);
    const sinPinIds = [...new Set(items.filter((f) => f.lat === undefined).map((f) => f.localId))];
    if (sinPinIds.length > 0) programarPines?.(actor.empresaId, sinPinIds);
    const hechas = todas.flatMap((f) =>
      f.estado === 'entregada' || f.estado === 'no_entregada'
        ? [{ facturaId: f.id, ...(f.folio !== undefined ? { folio: f.folio } : {}), localId: f.local.id, cliente: f.local.razonSocial, direccion: f.local.direccion, comuna: f.local.comuna, urgente: f.urgente, estado: f.estado }]
        : [],
    );
    // Tiempos por calles entre el punto donde está el camión (o el depósito), las paradas con pin y el depósito; lo que falte queda en línea recta.
    const origenReal = ultima ? { lat: ultima.lat, lng: ultima.lng } : config.deposito;
    const viajesDeLaRuta: ViajesDeLaRuta = viajes
      ? await viajes([
          { id: ORIGEN, lat: origenReal.lat, lng: origenReal.lng, rol: 'origen' },
          { id: DEPOSITO, lat: config.deposito.lat, lng: config.deposito.lng, rol: 'deposito' },
          ...items.flatMap((f) => (f.lat !== undefined && f.lng !== undefined ? [{ id: f.facturaId, lat: f.lat, lng: f.lng, rol: 'parada' as const }] : [])),
        ]).catch((): ViajesDeLaRuta => ({ minutos: () => undefined, conCalles: false }))
      : { minutos: () => undefined, conCalles: false };
    return ok({
      config, deposito: config.deposito, items, guardada, hechas, aprendido, viajes: viajesDeLaRuta,
      ...(esHoy ? { ahoraMin: minutosEnChile(clock.now()) } : {}),
      ...(ultima ? { origen: { lat: ultima.lat, lng: ultima.lng } } : {}),
    });
  };

  /** `salida` es la planificada; el cálculo de hoy no puede empezar antes de «ahora» y parte de donde está el camión. */
  const problemaDe = (ctx: Contexto, fecha: string, salida: number, fijas: readonly string[]) =>
    armarProblema({
      fecha,
      deposito: ctx.deposito,
      ...(ctx.origen ? { origen: ctx.origen } : {}),
      salida: ctx.ahoraMin !== undefined ? Math.max(salida, ctx.ahoraMin) : salida,
      horaLimiteRegresoMin: ctx.config.horaLimiteRegresoMin,
      entradas: ctx.items.map((f) => entradaDe(f, ctx.aprendido.servicioMin(f.localId))),
      // Con tiempos por calles el ritmo aprendido (medido contra la línea recta) ya no aplica.
      ritmo: ctx.viajes.conCalles ? 1 : ctx.aprendido.ritmo,
      viajeMin: ctx.viajes.minutos,
      fijas,
    });

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
      return f ? itemDe(f) : { facturaId: id, localId: '', cliente: '', direccion: '', comuna: '', urgente: false };
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
      ...(plan && plan.problema.salida !== salidaMin ? { calculadaDesdeMin: plan.problema.salida } : {}),
      horaLimiteRegresoMin: ctx.config.horaLimiteRegresoMin,
      deposito: ctx.deposito,
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
      hechas: ctx.hechas,
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
    salidaPlan: number,
    estado: { readonly problema: ProblemaRuta; readonly solucion: Solucion; readonly modo: ModoRuta },
    sinPin: readonly EntradaParada[],
    operacion: { readonly tipo: TipoOperacionRuta; readonly facturaId?: string },
    versionEsperada?: number,
  ): Promise<Result<VistaRuta, ErrorApp>> => {
    const g = await rutas.guardar(actor.empresaId, {
      camionId,
      fecha,
      salidaMin: salidaPlan,
      modo: estado.modo,
      orden: estado.solucion.orden,
      fijas: estado.problema.fijas,
      usuarioId: actor.id,
      ...(versionEsperada !== undefined ? { versionEsperada } : {}),
    });
    if (!g.ok) return err(errorApp('CONFLICTO', 'Otra persona cambió esta ruta. Se cargó la versión nueva; vuelve a intentar.', { codigo: 'RUTA_DESACTUALIZADA' }));
    // Aprender nunca bloquea la ruta: si no se puede anotar, la ruta sigue igual.
    await registro
      .registrarOperacion(actor.empresaId, {
        camionId, fecha, usuarioId: actor.id, tipo: operacion.tipo, ...(operacion.facturaId !== undefined ? { facturaId: operacion.facturaId } : {}),
        modo: estado.modo, version: g.value.version, orden: estado.solucion.orden,
      })
      .catch(() => undefined);
    return ok(vistaDe(ctx, camionId, fecha, salidaPlan, sinPin, { solucion: estado.solucion, problema: estado.problema, modo: estado.modo, version: g.value.version }));
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
    return guardarYVer(actor, ctx.value, entrada.camionId, entrada.fecha, salida, { problema, solucion, modo: 'sugerida' }, sinPin, { tipo: 'planificar' });
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
    return guardarYVer(actor, ctx2, entrada.camionId, entrada.fecha, salida, r.value, sinPin, { tipo: op.tipo, ...('facturaId' in op ? { facturaId: op.facturaId } : {}) }, entrada.version);
  };

  return { ver, planificar, operar };
};
