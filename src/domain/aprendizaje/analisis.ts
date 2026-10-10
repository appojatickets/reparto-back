import { fechaEnChile, minutosEnChile } from '../shared/fechas.js';
import { distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { SERVICIO_POR_DEFECTO_MIN } from '../ruteo/parametros.js';
import { armarProblema } from '../ruteo/armar-problema.js';
import { optimizar } from '../ruteo/optimizador.js';
import { crearTiemposHaversine } from '../ruteo/tiempos.js';
import { N_CONFIABLE, ritmoChofer, ritmoObservado, servicioNuevo, confianzaHorario, type TramoObservado } from './ritmo.js';

/**
 * Lo que el sistema aprende de lo que ya pasó. Todo es estadística simple sobre datos guardados (medianas, promedios con valor de
 * respaldo cuando hay pocas observaciones): se explica fácil, no necesita IA y mejora solo a medida que se usa.
 */

export type ClaveParametro = 'ritmo' | 'servicio_min' | 'capacidad_paradas' | 'duracion_jornada_min';

export type ParametroAprendido = {
  readonly clave: ClaveParametro;
  /** `global`, `camion:<id>`, `local:<id>` o `comuna:<nombre>`. */
  readonly ambito: string;
  readonly valor: number;
  readonly muestras: number;
  /** 0 a 1: cuánto pesa lo observado frente al valor de respaldo. */
  readonly confianza: number;
};

export type EventoObs = {
  readonly facturaId: string;
  readonly localId: string;
  readonly camionId?: string;
  readonly usuarioId?: string;
  readonly tipo: 'llegada' | 'entregado' | 'cerrado' | 'espera' | 'no_entregado' | 'vuelve_mas_tarde';
  readonly motivo?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly precisionM?: number;
  readonly creadoEn: Date;
};

export type LocalObs = { readonly id: string; readonly comuna: string; readonly lat?: number; readonly lng?: number; readonly pinFuente?: string; readonly pinVerificado?: boolean };

/** Un punto del recorrido del camión. */
export type PosicionObs = { readonly camionId: string; readonly lat: number; readonly lng: number; readonly precisionM?: number; readonly tomadoEn: Date };

export type OperacionObs = {
  readonly camionId: string;
  readonly fecha: string;
  readonly tipo: string;
  readonly modo: 'sugerida' | 'manual' | 'carga';
  readonly orden: readonly string[];
  readonly creadoEn: Date;
};

export type JornadaObs = { readonly id: string; readonly camionId: string; readonly fecha: string; readonly desde: Date; readonly hasta?: Date };

const ms = (d: Date): number => d.getTime();
const redondear = (x: number, decimales = 3): number => Math.round(x * 10 ** decimales) / 10 ** decimales;

export const mediana = (valores: readonly number[]): number | undefined => {
  if (valores.length === 0) return undefined;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? o[m] : ((o[m - 1] ?? 0) + (o[m] ?? 0)) / 2;
};

const porClave = <T>(items: readonly T[], clave: (t: T) => string | undefined): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = clave(it);
    if (k === undefined) continue;
    const l = m.get(k) ?? [];
    l.push(it);
    m.set(k, l);
  }
  return m;
};

const TERMINALES = new Set<EventoObs['tipo']>(['entregado', 'no_entregado', 'cerrado']);

// ---------------------------------------------------------------- tiempo de atención por local

export type Atencion = { readonly localId: string; readonly facturaId: string; readonly minutos: number; readonly cuando: Date };
const ATENCION_MAXIMA_MIN = 60;
/** Menos que esto es un aviso apretado al llegar, no una atención. */
const ATENCION_MINIMA_MIN = 0.5;
/** Con menos observaciones que esto no se publica el tiempo de un local. */
export const MINIMO_ATENCIONES_LOCAL = 2;
const PESO_RESPALDO_SERVICIO = 4;

/**
 * Minutos que el camión estuvo en el local: desde que llegó hasta que se fue (si se conoce por el recorrido) o, si no, hasta que se
 * avisó la entrega. Solo entregas exitosas: un local cerrado no mide cuánto cuesta atender.
 */
export const atenciones = (eventos: readonly EventoObs[], salidas: ReadonlyMap<string, Date> = new Map()): readonly Atencion[] => {
  const salida: Atencion[] = [];
  for (const [facturaId, evs] of porClave(eventos, (e) => e.facturaId)) {
    const ordenados = [...evs].sort((a, b) => ms(a.creadoEn) - ms(b.creadoEn));
    const llegada = ordenados.find((e) => e.tipo === 'llegada');
    const entrega = ordenados.find((e) => e.tipo === 'entregado');
    if (!llegada || !entrega) continue;
    const fin = salidas.get(facturaId) ?? entrega.creadoEn;
    const minutos = (ms(fin) - ms(llegada.creadoEn)) / 60_000;
    if (minutos < ATENCION_MINIMA_MIN || minutos > ATENCION_MAXIMA_MIN) continue;
    salida.push({ localId: entrega.localId, facturaId, minutos, cuando: entrega.creadoEn });
  }
  return salida;
};

/** Por local: se parte del tiempo por defecto y cada observación lo corre (promedio móvil); además la mediana de todos los locales. */
export const servicioAprendido = (obs: readonly Atencion[]): readonly ParametroAprendido[] => {
  const salida: ParametroAprendido[] = [];
  for (const [localId, lista] of porClave(obs, (o) => o.localId)) {
    if (lista.length < MINIMO_ATENCIONES_LOCAL) continue;
    const valor = [...lista].sort((a, b) => ms(a.cuando) - ms(b.cuando)).reduce((v, o) => servicioNuevo(o.minutos, v), SERVICIO_POR_DEFECTO_MIN);
    salida.push({ clave: 'servicio_min', ambito: `local:${localId}`, valor: redondear(valor, 2), muestras: lista.length, confianza: redondear(lista.length / (lista.length + PESO_RESPALDO_SERVICIO)) });
  }
  const global = mediana(obs.map((o) => o.minutos));
  if (global !== undefined && obs.length >= 5) {
    salida.push({ clave: 'servicio_min', ambito: 'global', valor: redondear(global, 2), muestras: obs.length, confianza: redondear(obs.length / (obs.length + 10)) });
  }
  return salida;
};

// ---------------------------------------------------------------- ritmo de viaje

export type TramoDeViaje = TramoObservado & { readonly camionId: string; readonly comunaDestino: string };
const dia = (d: Date): string => fechaEnChile(d);

/**
 * Los tramos reales entre una parada y la siguiente: desde que el camión se fue de la anterior (o, si no se sabe, su último aviso) hasta la llegada a la siguiente, comparados con
 * lo que el motor había calculado para ese mismo trayecto. Exige pin en las dos paradas.
 */
export const tramosDeViaje = (eventos: readonly EventoObs[], locales: ReadonlyMap<string, LocalObs>, salidas: ReadonlyMap<string, Date> = new Map()): readonly TramoDeViaje[] => {
  const salida: TramoDeViaje[] = [];
  const grupos = porClave(eventos, (e) => (e.camionId !== undefined ? `${e.camionId}|${dia(e.creadoEn)}` : undefined));
  for (const [, evs] of grupos) {
    const paradas = [...porClave(evs, (e) => e.facturaId).entries()].flatMap(([, lista]) => {
      const llegada = lista.filter((e) => e.tipo === 'llegada').sort((a, b) => ms(a.creadoEn) - ms(b.creadoEn))[0];
      const aviso = lista.filter((e) => TERMINALES.has(e.tipo)).sort((a, b) => ms(b.creadoEn) - ms(a.creadoEn))[0];
      const fin = salidas.get(lista[0]?.facturaId ?? '') ?? aviso?.creadoEn;
      const local = locales.get(lista[0]?.localId ?? '');
      const camionId = lista[0]?.camionId;
      return llegada && fin && local && camionId !== undefined && local.lat !== undefined && local.lng !== undefined
        ? [{ llegada: llegada.creadoEn, fin, local, camionId }]
        : [];
    });
    paradas.sort((a, b) => ms(a.fin) - ms(b.fin));
    for (let i = 0; i + 1 < paradas.length; i += 1) {
      const a = paradas[i];
      const b = paradas[i + 1];
      if (!a || !b || a.local.lat === undefined || a.local.lng === undefined || b.local.lat === undefined || b.local.lng === undefined) continue;
      const minutosReales = (ms(b.llegada) - ms(a.fin)) / 60_000;
      if (minutosReales <= 0) continue;
      const tiempos = crearTiemposHaversine(new Map<string, Coordenada>([['a', { lat: a.local.lat, lng: a.local.lng }], ['b', { lat: b.local.lat, lng: b.local.lng }]]));
      salida.push({ minutosReales, minutosPlanificados: tiempos.tiempo('a', 'b', minutosEnChile(a.fin)), camionId: a.camionId, comunaDestino: b.local.comuna });
    }
  }
  return salida;
};

const RITMO_MIN = 0.5;
const RITMO_MAX = 2.5;
export const MINIMO_TRAMOS_RITMO = 5;

const ritmoDe = (tramos: readonly TramoObservado[], ambito: string): ParametroAprendido | undefined => {
  const r = ritmoObservado(tramos);
  if (!r || r.n < MINIMO_TRAMOS_RITMO) return undefined;
  const valor = Math.min(RITMO_MAX, Math.max(RITMO_MIN, ritmoChofer(r.ritmoObs, r.n)));
  return { clave: 'ritmo', ambito, valor: redondear(valor), muestras: r.n, confianza: redondear(Math.min(1, r.n / N_CONFIABLE)) };
};

/** Cuánto más (o menos) demora el camión que lo calculado: global, por camión y por comuna de destino. Con pocos datos se queda cerca de 1,0. */
export const ritmoAprendido = (tramos: readonly TramoDeViaje[]): readonly ParametroAprendido[] => {
  const lista: (ParametroAprendido | undefined)[] = [ritmoDe(tramos, 'global')];
  for (const [camion, ts] of porClave(tramos, (t) => t.camionId)) lista.push(ritmoDe(ts, `camion:${camion}`));
  for (const [comuna, ts] of porClave(tramos, (t) => t.comunaDestino)) lista.push(ritmoDe(ts, `comuna:${comuna}`));
  return lista.filter((p): p is ParametroAprendido => p !== undefined);
};

// ---------------------------------------------------------------- capacidad del camión

export type ResumenObs = { readonly camionId: string; readonly fecha: string; readonly atendidas: number; readonly duracionMin?: number };
export const MINIMO_JORNADAS_CAPACIDAD = 3;
/** Una jornada de menos minutos que esto (alguien eligió camión y terminó enseguida) no cuenta como tiempo trabajado. */
const DURACION_MINIMA_MIN = 5;
/** Un día con menos entregas que esto no dice cuántas caben. */
const ENTREGAS_MINIMAS_DEL_DIA = 3;

/**
 * Lo que hizo cada camión cada día, sacado de los avisos: cuántas entregas atendió y cuánto pasó entre la primera y la última. Es más
 * confiable que los resúmenes de jornada (un día puede tener varias jornadas y cada una cuenta solo lo suyo).
 */
export const resumenesDelDia = (eventos: readonly EventoObs[]): readonly ResumenObs[] => {
  const dias = new Map<string, { camionId: string; fecha: string; facturas: Set<string>; primero: number; ultimo: number }>();
  for (const e of eventos) {
    if (e.camionId === undefined) continue;
    const k = `${e.camionId}|${dia(e.creadoEn)}`;
    const d = dias.get(k) ?? { camionId: e.camionId, fecha: dia(e.creadoEn), facturas: new Set<string>(), primero: Infinity, ultimo: -Infinity };
    if (e.tipo === 'entregado' || e.tipo === 'no_entregado') d.facturas.add(e.facturaId);
    d.primero = Math.min(d.primero, ms(e.creadoEn));
    d.ultimo = Math.max(d.ultimo, ms(e.creadoEn));
    dias.set(k, d);
  }
  return [...dias.values()].map((d) => ({ camionId: d.camionId, fecha: d.fecha, atendidas: d.facturas.size, duracionMin: Math.round((d.ultimo - d.primero) / 60_000) }));
};

/**
 * Cuántas entregas se alcanzan a hacer en un día y cuánto trabaja el camión, por camión y en general (mediana: no la mueve un día raro).
 * Un chofer puede cerrar y abrir la ruta varias veces en el día (cargas por tandas): se suma por camión y día, no por jornada.
 */
export const capacidadAprendida = (resumenesDeJornadas: readonly ResumenObs[]): readonly ParametroAprendido[] => {
  const salida: ParametroAprendido[] = [];
  const dias = new Map<string, { camionId: string; fecha: string; atendidas: number; duracionMin: number }>();
  for (const r of resumenesDeJornadas) {
    const k = `${r.camionId}|${r.fecha}`;
    const d = dias.get(k) ?? { camionId: r.camionId, fecha: r.fecha, atendidas: 0, duracionMin: 0 };
    d.atendidas += r.atendidas;
    if (r.duracionMin !== undefined && r.duracionMin >= DURACION_MINIMA_MIN) d.duracionMin += r.duracionMin;
    dias.set(k, d);
  }
  const resumenes: ResumenObs[] = [...dias.values()].filter((d) => d.atendidas >= ENTREGAS_MINIMAS_DEL_DIA).map((d) => ({ camionId: d.camionId, fecha: d.fecha, atendidas: d.atendidas, ...(d.duracionMin > 0 ? { duracionMin: d.duracionMin } : {}) }));
  const agregar = (ambito: string, rs: readonly ResumenObs[]): void => {
    if (rs.length < MINIMO_JORNADAS_CAPACIDAD) return;
    const confianza = redondear(rs.length / (rs.length + 5));
    const paradas = mediana(rs.map((r) => r.atendidas));
    const duracion = mediana(rs.flatMap((r) => (r.duracionMin !== undefined && r.duracionMin > 0 ? [r.duracionMin] : [])));
    if (paradas !== undefined) salida.push({ clave: 'capacidad_paradas', ambito, valor: paradas, muestras: rs.length, confianza });
    if (duracion !== undefined) salida.push({ clave: 'duracion_jornada_min', ambito, valor: Math.round(duracion), muestras: rs.length, confianza });
  };
  agregar('global', resumenes);
  for (const [camion, rs] of porClave(resumenes, (r) => r.camionId)) agregar(`camion:${camion}`, rs);
  return salida;
};

// ---------------------------------------------------------------- calidad de la ruta: sugerida vs. manejada

export type CalidadJornada = {
  readonly jornadaId: string;
  readonly comparadas: number;
  /** Largo de la ruta (depósito → paradas → depósito, línea recta) en el orden que sugirió el sistema y en el que se manejó. */
  readonly distSugeridaM: number;
  readonly distRealM: number;
  /** Pares de paradas que se hicieron en distinto orden que el sugerido. */
  readonly inversiones: number;
  /**
   * `sistema`: el orden lo calculó el sistema y se compara con lo que se manejó. `chofer`: el día se armó en orden manual («las agrego en orden»),
   * así que el orden es la experiencia del chofer y se compara con lo que el sistema habría sugerido con las mismas paradas.
   */
  readonly origen: 'sistema' | 'chofer';
  /** Cuántas veces una persona movió paradas a mano ese día (subir, bajar, arrastrar, ir primero). 0 = nadie corrigió nada. */
  readonly cambios: number;
};

const MOVIMIENTOS_A_MANO = new Set(['subir', 'bajar', 'mover', 'primero']);
const LIMITE_REGRESO_ESTIMADO_MIN = 23 * 60 + 59;

/** Lo que el sistema habría sugerido con estas paradas (solo por distancia: sin horarios ni facturas urgentes, que aquí no se conocen). */
const ordenQueSugeriaElSistema = (ids: readonly string[], coord: ReadonlyMap<string, Coordenada>, fecha: string, deposito: Coordenada, salidaMs: number): readonly string[] => {
  const { problema } = armarProblema({
    fecha,
    deposito,
    salida: minutosEnChile(new Date(salidaMs)),
    horaLimiteRegresoMin: LIMITE_REGRESO_ESTIMADO_MIN,
    entradas: ids.map((id) => ({ id, nombre: id, ...(coord.get(id) ? { coordenada: coord.get(id) as Coordenada } : {}), horarios: [], urgente: false })),
  });
  return optimizar(problema).orden;
};

const largoM = (orden: readonly string[], coord: ReadonlyMap<string, Coordenada>, deposito: Coordenada): number => {
  let total = 0;
  let previo = deposito;
  for (const id of orden) {
    const c = coord.get(id);
    if (!c) continue;
    total += distanciaKm(previo, c);
    previo = c;
  }
  return Math.round((total + distanciaKm(previo, deposito)) * 1000);
};

/** Compara lo que el sistema sugirió para salir (su último cálculo automático antes del primer aviso, incluido «ir primero», que el sistema recalcula) con el orden en que se hicieron las paradas. */
export const calidadDeJornada = (j: JornadaObs, eventos: readonly EventoObs[], operaciones: readonly OperacionObs[], locales: ReadonlyMap<string, LocalObs>, deposito: Coordenada): CalidadJornada | undefined => {
  const fin = ms(j.hasta ?? new Date(ms(j.desde) + 20 * 3_600_000));
  const evs = eventos.filter((e) => e.camionId === j.camionId && ms(e.creadoEn) >= ms(j.desde) && ms(e.creadoEn) <= fin);
  const primeros = new Map<string, number>();
  const localDe = new Map<string, string>();
  for (const e of evs) {
    primeros.set(e.facturaId, Math.min(primeros.get(e.facturaId) ?? Infinity, ms(e.creadoEn)));
    localDe.set(e.facturaId, e.localId);
  }
  if (primeros.size < 3) return undefined;
  const salida = Math.min(...primeros.values());
  const ops = operaciones.filter((o) => o.camionId === j.camionId && o.fecha === j.fecha).sort((a, b) => ms(a.creadoEn) - ms(b.creadoEn));
  const calculos = ops.filter((o) => (o.tipo === 'planificar' || o.tipo === 'ordenar' || (o.tipo === 'primero' && o.modo === 'sugerida')) && ms(o.creadoEn) <= salida);
  const sugerida = calculos[calculos.length - 1] ?? ops[0];
  if (!sugerida) return undefined;
  const cambios = ops.filter((o) => MOVIMIENTOS_A_MANO.has(o.tipo)).length;

  const coord = new Map<string, Coordenada>();
  for (const [facturaId, localId] of localDe) {
    const l = locales.get(localId);
    if (l?.lat !== undefined && l.lng !== undefined) coord.set(facturaId, { lat: l.lat, lng: l.lng });
  }
  const manejado = [...primeros.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id).filter((id) => coord.has(id));
  const comunes = new Set(manejado.filter((id) => sugerida.orden.includes(id)));
  if (comunes.size < 3) return undefined;
  // Un día en orden manual no tiene ruta sugerida contra la cual medirse: la experiencia del chofer se mide con lo que el sistema habría hecho.
  const delChofer = sugerida.modo === 'carga';
  const base = delChofer ? ordenQueSugeriaElSistema(sugerida.orden.filter((id) => coord.has(id)), coord, j.fecha, deposito, salida) : sugerida.orden;
  const ordenS = base.filter((id) => comunes.has(id));
  const ordenD = manejado.filter((id) => comunes.has(id));
  const rangoD = new Map(ordenD.map((id, i) => [id, i]));
  let inversiones = 0;
  for (let a = 0; a < ordenS.length; a += 1) {
    for (let b = a + 1; b < ordenS.length; b += 1) {
      if ((rangoD.get(ordenS[a] ?? '') ?? 0) > (rangoD.get(ordenS[b] ?? '') ?? 0)) inversiones += 1;
    }
  }
  return { jornadaId: j.id, comparadas: comunes.size, distSugeridaM: largoM(ordenS, coord, deposito), distRealM: largoM(ordenD, coord, deposito), inversiones, origen: delChofer ? 'chofer' : 'sistema', cambios };
};

// ---------------------------------------------------------------- pines corregidos por las visitas

export type PinSugerido = { readonly localId: string; readonly lat: number; readonly lng: number; readonly desplazamientoM: number; readonly visitas: number; readonly usuarioId?: string };
export const RADIO_PIN_COHERENTE_M = 40;
export const DESPLAZAMIENTO_PIN_MINIMO_M = 100;
export const MINIMO_VISITAS_PIN = 3;
const PRECISION_VISITA_M = 50;

/**
 * Si el camión llegó varias veces (en días distintos) al mismo lugar con buen GPS, y ese lugar queda lejos del pin del local, el pin
 * probablemente está mal. Solo propone: lo revisa una persona.
 */
export const pinesSugeridos = (eventos: readonly EventoObs[], locales: ReadonlyMap<string, LocalObs>): readonly PinSugerido[] => {
  const salida: PinSugerido[] = [];
  const llegadas = eventos.filter((e) => (e.tipo === 'llegada' || e.tipo === 'entregado') && e.lat !== undefined && e.lng !== undefined && (e.precisionM === undefined || e.precisionM <= PRECISION_VISITA_M));
  for (const [localId, evs] of porClave(llegadas, (e) => e.localId)) {
    const l = locales.get(localId);
    // Un pin por verificar se ajusta solo con las entregas; solo se propone mover uno que una persona verificó.
    if (!l?.lat || !l.lng || l.pinVerificado !== true) continue;
    const dias = new Set(evs.map((e) => dia(e.creadoEn)));
    if (evs.length < MINIMO_VISITAS_PIN || dias.size < 2) continue;
    const lat = mediana(evs.map((e) => e.lat ?? 0));
    const lng = mediana(evs.map((e) => e.lng ?? 0));
    if (lat === undefined || lng === undefined) continue;
    const centro = { lat, lng };
    const dentro = evs.filter((e) => distanciaKm(centro, { lat: e.lat ?? 0, lng: e.lng ?? 0 }) * 1000 <= RADIO_PIN_COHERENTE_M);
    if (dentro.length < MINIMO_VISITAS_PIN || dentro.length / evs.length < 0.8) continue;
    const desplazamiento = distanciaKm(centro, { lat: l.lat, lng: l.lng }) * 1000;
    if (desplazamiento < DESPLAZAMIENTO_PIN_MINIMO_M) continue;
    const ultimo = [...evs].sort((a, b) => ms(b.creadoEn) - ms(a.creadoEn))[0];
    salida.push({ localId, lat: redondear(lat, 6), lng: redondear(lng, 6), desplazamientoM: Math.round(desplazamiento), visitas: dentro.length, ...(ultimo?.usuarioId !== undefined ? { usuarioId: ultimo.usuarioId } : {}) });
  }
  return salida;
};

// ---------------------------------------------------------------- locales que se encuentran cerrados

export type CierreFrecuente = { readonly localId: string; readonly cerrados: number; readonly intentos: number; readonly confianzaAbierto: number; readonly horasCerrado: readonly number[] };
const horaChile = (d: Date): number => Math.floor(minutosEnChile(d) / 60);

/** Locales encontrados cerrados más de una vez, con las horas en que pasó: base para aprender horarios de atención reales. */
export const cierresFrecuentes = (eventos: readonly EventoObs[]): readonly CierreFrecuente[] => {
  const salida: CierreFrecuente[] = [];
  const relevantes = eventos.filter((e) => e.tipo === 'entregado' || e.tipo === 'cerrado' || (e.tipo === 'no_entregado' && e.motivo === 'cerrado'));
  for (const [localId, evs] of porClave(relevantes, (e) => e.localId)) {
    const cierres = evs.filter((e) => e.tipo !== 'entregado');
    if (cierres.length < 2) continue;
    salida.push({
      localId, cerrados: cierres.length, intentos: evs.length, confianzaAbierto: redondear(confianzaHorario(evs.length - cierres.length, evs.length)),
      horasCerrado: [...new Set(cierres.map((e) => horaChile(e.creadoEn)))].sort((a, b) => a - b),
    });
  }
  return salida.sort((a, b) => b.cerrados - a.cerrados);
};

// ---------------------------------------------------------------- visitas que se deducen del recorrido

/** A cuántos metros del pin se considera que el camión estaba en el local. */
export const RADIO_VISITA_M = 80;
const PRECISION_VISITA_DEDUCIDA_M = 60;
const VENTANA_VISITA_MIN = 40;
/** Entre dos puntos del recorrido, más separados que esto no se sabe qué pasó (la app estuvo cerrada). */
const HUECO_MAXIMO_MIN = 10;

export type VisitaDeducida = { readonly facturaId: string; readonly localId: string; readonly camionId: string; readonly llegada: Date; readonly salida: Date };

const mitad = (a: Date, b: Date): Date => new Date((ms(a) + ms(b)) / 2);

/**
 * Los choferes avisan ENTREGADO apenas llegan y casi nunca LLEGUÉ: ni la atención ni el viaje se pueden medir con los avisos. Se miden con
 * el recorrido del camión: la visita es el tramo seguido en que estuvo junto al pin. Llegó a mitad de camino entre el último punto lejos
 * y el primero cerca; se fue a mitad de camino entre el último cerca y el primero lejos (así el error no se acumula hacia un lado).
 * Solo para entregas con pin y recorrido; no se guarda, se recalcula siempre.
 */
export const visitasDeducidas = (eventos: readonly EventoObs[], locales: ReadonlyMap<string, LocalObs>, posiciones: readonly PosicionObs[]): readonly VisitaDeducida[] => {
  const porCamion = new Map<string, PosicionObs[]>();
  for (const [camionId, lista] of porClave(posiciones, (p) => p.camionId)) porCamion.set(camionId, [...lista].sort((a, b) => ms(a.tomadoEn) - ms(b.tomadoEn)));
  const salida: VisitaDeducida[] = [];
  for (const e of eventos) {
    if (e.tipo !== 'entregado' || e.camionId === undefined) continue;
    const l = locales.get(e.localId);
    const recorrido = porCamion.get(e.camionId);
    if (l?.lat === undefined || l.lng === undefined || !recorrido) continue;
    const pin = { lat: l.lat, lng: l.lng };
    const cerca = recorrido.map((p) => (p.precisionM === undefined || p.precisionM <= PRECISION_VISITA_DEDUCIDA_M) && distanciaKm(p, pin) * 1000 <= RADIO_VISITA_M);
    const entrega = ms(e.creadoEn);
    // El último tramo junto al pin que empezó antes de avisar la entrega (y no mucho antes).
    let desde = -1;
    let hasta = -1;
    for (let i = 0; i < recorrido.length; i += 1) {
      if (!cerca[i]) continue;
      let j = i;
      while (j + 1 < recorrido.length && cerca[j + 1]) j += 1;
      const inicio = ms(recorrido[i]?.tomadoEn ?? new Date(0));
      const fin = ms(recorrido[j]?.tomadoEn ?? new Date(0));
      if (inicio <= entrega + 60_000 && fin >= entrega - VENTANA_VISITA_MIN * 60_000) {
        desde = i;
        hasta = j;
      }
      i = j;
    }
    const primero = recorrido[desde];
    const ultimo = recorrido[hasta];
    if (!primero || !ultimo) continue;
    const antes = recorrido[desde - 1];
    const despues = recorrido[hasta + 1];
    const llegada = antes && ms(primero.tomadoEn) - ms(antes.tomadoEn) <= HUECO_MAXIMO_MIN * 60_000 ? mitad(antes.tomadoEn, primero.tomadoEn) : primero.tomadoEn;
    const fueSalida = despues && ms(despues.tomadoEn) - ms(ultimo.tomadoEn) <= HUECO_MAXIMO_MIN * 60_000 ? mitad(ultimo.tomadoEn, despues.tomadoEn) : ultimo.tomadoEn;
    if (ms(fueSalida) <= ms(llegada)) continue;
    salida.push({ facturaId: e.facturaId, localId: e.localId, camionId: e.camionId, llegada, salida: fueSalida });
  }
  return salida;
};

/** Los avisos de llegada que faltan (la mayoría) y la hora en que el camión se fue de cada parada, listos para medir atención y viaje. */
export const completarConVisitas = (eventos: readonly EventoObs[], visitas: readonly VisitaDeducida[]): { readonly eventos: readonly EventoObs[]; readonly salidas: ReadonlyMap<string, Date>; readonly llegadasDeducidas: number } => {
  const conLlegada = new Set(eventos.filter((e) => e.tipo === 'llegada').map((e) => e.facturaId));
  const nuevas: EventoObs[] = visitas
    .filter((v) => !conLlegada.has(v.facturaId))
    .map((v) => ({ facturaId: v.facturaId, localId: v.localId, camionId: v.camionId, tipo: 'llegada' as const, creadoEn: v.llegada }));
  return { eventos: [...eventos, ...nuevas], salidas: new Map(visitas.map((v) => [v.facturaId, v.salida])), llegadasDeducidas: nuevas.length };
};

// ---------------------------------------------------------------- entregas avisadas lejos del pin

export type PinDudoso = { readonly localId: string; readonly distanciaM: number; readonly visitas: number; readonly fuente?: string };
export const DISTANCIA_PIN_DUDOSO_M = 150;
const PRECISION_PIN_DUDOSO_M = 50;

/**
 * Locales con pin verificado donde se avisó ENTREGADO con buen GPS lejos de ese pin: o el pin está mal, o se avisó desde otro lado.
 * Es lo primero que conviene revisar; con ≥ 3 visitas coherentes el sistema además propone el pin nuevo.
 */
export const pinesDudosos = (eventos: readonly EventoObs[], locales: ReadonlyMap<string, LocalObs>): readonly PinDudoso[] => {
  const salida: PinDudoso[] = [];
  const entregas = eventos.filter((e) => e.tipo === 'entregado' && e.lat !== undefined && e.lng !== undefined && (e.precisionM === undefined || e.precisionM <= PRECISION_PIN_DUDOSO_M));
  for (const [localId, evs] of porClave(entregas, (e) => e.localId)) {
    const l = locales.get(localId);
    // Los pines por verificar ya se corrigen solos con cada entrega: aquí solo importan los verificados.
    if (l?.lat === undefined || l.lng === undefined || l.pinVerificado !== true) continue;
    const distancias = evs.map((e) => distanciaKm({ lat: e.lat ?? 0, lng: e.lng ?? 0 }, { lat: l.lat ?? 0, lng: l.lng ?? 0 }) * 1000);
    const lejos = distancias.filter((d) => d > DISTANCIA_PIN_DUDOSO_M);
    if (lejos.length === 0) continue;
    salida.push({ localId, distanciaM: Math.round(mediana(lejos) ?? 0), visitas: evs.length, ...(l.pinFuente !== undefined ? { fuente: l.pinFuente } : {}) });
  }
  return salida.sort((a, b) => b.distanciaM - a.distanciaM);
};

// ---------------------------------------------------------------- ¿se siguió lo que mostraba la ruta?

export type SeguimientoRuta = {
  /** Entregas que estaban en la ruta que se veía al hacerlas. */
  readonly entregas: number;
  /** En cuántas la entrega fue la primera de las que quedaban en la lista (la siguiente parada que mostraba la ruta). */
  readonly primeraDeLaLista: number;
  /** De las entregas hechas con la ruta tal como la ordenó el sistema (sin que una persona la hubiera movido)… */
  readonly conRutaDelSistema: number;
  /** …en cuántas fue la primera de la lista. */
  readonly primeraDeLaRutaDelSistema: number;
};

/**
 * Qué tanto se hace lo que la ruta muestra: en cada entrega, la ruta que se veía (la última guardada antes) y cuál era su siguiente parada.
 * Si la persona la movió a mano, la lista ya refleja lo que quería; por eso aparte se cuenta cuánto se siguió mientras la ruta era la del sistema.
 * Es el indicador de cuánto hay que corregir a mano: lo que se hace manda sobre lo sugerido.
 */
export const seguimientoDeLaRuta = (eventos: readonly EventoObs[], operaciones: readonly OperacionObs[]): SeguimientoRuta => {
  const primerasEntregas = new Map<string, EventoObs>();
  for (const e of [...eventos].sort((a, b) => ms(a.creadoEn) - ms(b.creadoEn))) {
    if (e.tipo === 'entregado' && e.camionId !== undefined && !primerasEntregas.has(e.facturaId)) primerasEntregas.set(e.facturaId, e);
  }
  const opsPorDia = porClave(operaciones, (o) => `${o.camionId}|${o.fecha}`);
  for (const lista of opsPorDia.values()) lista.sort((a, b) => ms(a.creadoEn) - ms(b.creadoEn));
  const entregasPorDia = porClave([...primerasEntregas.values()], (e) => `${e.camionId ?? ''}|${dia(e.creadoEn)}`);

  let entregas = 0, primeraDeLaLista = 0, conRutaDelSistema = 0, primeraDeLaRutaDelSistema = 0;
  for (const [clave, lista] of entregasPorDia) {
    const ops = opsPorDia.get(clave) ?? [];
    const hechas = new Set<string>();
    for (const e of [...lista].sort((a, b) => ms(a.creadoEn) - ms(b.creadoEn))) {
      const vista = [...ops].reverse().find((o) => ms(o.creadoEn) <= ms(e.creadoEn));
      const quedaban = vista?.orden.filter((id) => !hechas.has(id)) ?? [];
      if (vista && quedaban.includes(e.facturaId)) {
        entregas += 1;
        const primera = quedaban[0] === e.facturaId;
        if (primera) primeraDeLaLista += 1;
        if (vista.modo === 'sugerida') {
          conRutaDelSistema += 1;
          if (primera) primeraDeLaRutaDelSistema += 1;
        }
      }
      hechas.add(e.facturaId);
    }
  }
  return { entregas, primeraDeLaLista, conRutaDelSistema, primeraDeLaRutaDelSistema };
};
