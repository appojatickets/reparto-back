import { fechaEnChile } from '../shared/fechas.js';
import { distanciaKm } from '../valor/coordenada.js';
import { mediana, type EventoObs, type LocalObs, type PosicionObs } from './analisis.js';

/**
 * ¿Se puede saber que un local estaba cerrado solo por el recorrido del camión, sin que el chofer toque CERRADO? (ADR 0046)
 * Las visitas breves y los reintentos son candidatos a revisión, no evidencia de cierre. Aquí no se decide nada
 * en la ruta: se junta lo que dice el GPS y se compara con lo que dicen los botones para saber si la hipótesis se sostiene.
 */

/** A cuántos metros del pin se considera que el camión estaba en el local. */
export const RADIO_CIERRE_M = 80;
const PRECISION_MAXIMA_M = 60;
/** Umbral histórico de visita breve para revisión, nunca una clasificación de cerrado. */
export const PERMANENCIA_CIERRE_MAX_MIN = 5;
/** Entre dos puntos más separados que esto no se sabe qué pasó (la app estuvo cerrada). */
const HUECO_MAXIMO_MIN = 10;
/** Entre una visita y la siguiente debe haber estado lejos al menos esto: si no, es la misma visita con un punto malo. */
const SEPARACION_VISITAS_MIN = 5;
/** Margen alrededor de la visita para atribuirle un aviso del chofer (los botones se tocan antes de bajar o ya al subir). */
const MARGEN_AVISO_MIN = 2;
/** Por encima de esta velocidad (m/s ≈ 14 km/h) el camión va en marcha, no detenido. */
const VELOCIDAD_DETENIDO_MS = 4;
const MAX_CASOS = 20;

const ms = (d: Date): number => d.getTime();
const min = (a: number, b: number): number => (a - b) / 60_000;

type Tramo = { readonly llegada: Date; readonly salida: Date; readonly minutos: number };

/** Los tramos seguidos del recorrido junto al pin en que el camión estuvo detenido (no los que solo pasó de largo). */
const tramosJuntoAlPin = (recorrido: readonly PosicionObs[], pin: { readonly lat: number; readonly lng: number }): Tramo[] => {
  const cerca = recorrido.map((p) => (p.precisionM === undefined || p.precisionM <= PRECISION_MAXIMA_M) && distanciaKm(p, pin) * 1000 <= RADIO_CIERRE_M);
  const salida: Tramo[] = [];
  for (let i = 0; i < recorrido.length; i += 1) {
    if (!cerca[i]) continue;
    let j = i;
    while (j + 1 < recorrido.length && cerca[j + 1] && ms(recorrido[j + 1]?.tomadoEn ?? new Date(0)) - ms(recorrido[j]?.tomadoEn ?? new Date(0)) <= HUECO_MAXIMO_MIN * 60_000) j += 1;
    const puntos = recorrido.slice(i, j + 1);
    const primero = recorrido[i];
    const ultimo = recorrido[j];
    const enMarcha = puntos.every((p) => p.velocidadMs !== undefined && p.velocidadMs > VELOCIDAD_DETENIDO_MS);
    if (primero && ultimo && !enMarcha) {
      const antes = recorrido[i - 1];
      const despues = recorrido[j + 1];
      const llegada = antes && min(ms(primero.tomadoEn), ms(antes.tomadoEn)) <= HUECO_MAXIMO_MIN ? new Date((ms(antes.tomadoEn) + ms(primero.tomadoEn)) / 2) : primero.tomadoEn;
      const fueSalida = despues && min(ms(despues.tomadoEn), ms(ultimo.tomadoEn)) <= HUECO_MAXIMO_MIN ? new Date((ms(ultimo.tomadoEn) + ms(despues.tomadoEn)) / 2) : ultimo.tomadoEn;
      salida.push({ llegada, salida: fueSalida, minutos: Math.max(0, min(ms(fueSalida), ms(llegada))) });
    }
    i = j;
  }
  // Dos tramos separados por muy poco tiempo son la misma visita con un punto malo en medio.
  return salida.reduce<Tramo[]>((acc, t) => {
    const previo = acc[acc.length - 1];
    if (previo && min(ms(t.llegada), ms(previo.salida)) < SEPARACION_VISITAS_MIN) {
      acc[acc.length - 1] = { llegada: previo.llegada, salida: t.salida, minutos: min(ms(t.salida), ms(previo.llegada)) };
    } else acc.push(t);
    return acc;
  }, []);
};

export type CasoCierre = {
  /** `solo_gps`: el GPS dice cerrado y nadie tocó el botón. `solo_boton`: el chofer tocó CERRADO pero el camión se quedó más de lo esperado. */
  readonly tipo: 'solo_gps' | 'solo_boton';
  readonly facturaId: string;
  readonly localId: string;
  readonly camionId: string;
  readonly fecha: string;
  readonly minutos: number;
  /** La factura se entregó después de esa visita (respalda que estaba cerrado). */
  readonly entregadaDespues: boolean;
};

export type ValidacionCierres = {
  /** Visitas al pin reconstruidas del recorrido (para facturas con aviso). */
  readonly visitas: number;
  readonly atendidas: number;
  /** Corta, sin entrega y con un segundo intento después: lo que el GPS llama «cerrado». */
  readonly cerradoDeducido: number;
  /** Sin entrega y sin segundo intento (todavía): no se puede juzgar. */
  readonly sinDesenlace: number;
  /** Visitas en que el chofer tocó CERRADO (o no entregó por cerrado) y hay recorrido junto al pin. */
  readonly botonCerrado: number;
  /** Avisos de cerrado sin recorrido GPS junto al pin: mide cuánto del GPS se está perdiendo. */
  readonly botonSinRecorrido: number;
  readonly botonSinDesenlace: number;
  /** El GPS y el botón dicen cerrado. */
  readonly coinciden: number;
  readonly soloGps: number;
  /** De los «solo GPS», cuántos se entregaron después (respalda la hipótesis). */
  readonly soloGpsConfirmados: number;
  readonly soloBoton: number;
  readonly medianaMinCerradoBoton?: number;
  readonly medianaMinAtendidas?: number;
  /** Los casos más recientes en que GPS y botón no coinciden, para revisarlos a mano. */
  readonly casos: readonly CasoCierre[];
};

const esAvisoDeCerrado = (e: EventoObs): boolean => e.tipo === 'cerrado' || (e.tipo === 'no_entregado' && e.motivo === 'cerrado');

export const validarCierresPorGps = (eventos: readonly EventoObs[], locales: ReadonlyMap<string, LocalObs>, posiciones: readonly PosicionObs[]): ValidacionCierres => {
  const recorridos = new Map<string, PosicionObs[]>();
  for (const p of posiciones) {
    const clave = `${p.camionId}|${fechaEnChile(p.tomadoEn)}`;
    const lista = recorridos.get(clave) ?? [];
    lista.push(p); recorridos.set(clave, lista);
  }
  for (const r of recorridos.values()) r.sort((a, b) => ms(a.tomadoEn) - ms(b.tomadoEn));

  const porFactura = new Map<string, EventoObs[]>();
  for (const e of eventos) porFactura.set(e.facturaId, [...(porFactura.get(e.facturaId) ?? []), e]);

  let visitas = 0, atendidas = 0, cerradoDeducido = 0, sinDesenlace = 0, botonCerrado = 0, botonSinRecorrido = 0, botonSinDesenlace = 0;
  let coinciden = 0, soloGps = 0, soloGpsConfirmados = 0, soloBoton = 0;
  const minCerradoBoton: number[] = [];
  const minAtendidas: number[] = [];
  const casos: (CasoCierre & { readonly llegada: number })[] = [];

  for (const [facturaId, evs] of porFactura) {
    const camionId = evs.find((e) => e.camionId !== undefined)?.camionId;
    const local = locales.get(evs[0]?.localId ?? '');
    const dias = new Set(evs.map((e) => fechaEnChile(e.creadoEn)));
    const recorrido = camionId !== undefined ? [...dias].flatMap((dia) => recorridos.get(`${camionId}|${dia}`) ?? []).sort((a, b) => ms(a.tomadoEn) - ms(b.tomadoEn)) : undefined;
    const tramos = camionId !== undefined && local?.lat !== undefined && local.lng !== undefined && recorrido
      ? tramosJuntoAlPin(recorrido, { lat: local.lat, lng: local.lng }).filter((t) => dias.has(fechaEnChile(t.llegada)))
      : [];
    const entregas = evs.filter((e) => e.tipo === 'entregado');
    const dentro = (e: EventoObs, t: Tramo): boolean => ms(e.creadoEn) >= ms(t.llegada) - MARGEN_AVISO_MIN * 60_000 && ms(e.creadoEn) <= ms(t.salida) + MARGEN_AVISO_MIN * 60_000;

    // Avisos de cerrado que no caen en ninguna visita reconstruida: el GPS no lo vio.
    botonSinRecorrido += evs.filter((e) => esAvisoDeCerrado(e) && !tramos.some((t) => dentro(e, t))).length;

    tramos.forEach((t, i) => {
      visitas += 1;
      const entregoAqui = entregas.some((e) => dentro(e, t));
      const avisos = evs.filter((e) => e.tipo !== 'llegada' && e.tipo !== 'entregado' && dentro(e, t));
      const conBotonCerrado = avisos.some(esAvisoDeCerrado);
      const conOtroAviso = avisos.length > 0 && !conBotonCerrado;
      const entregadaDespues = entregas.some((e) => ms(e.creadoEn) > ms(t.salida) + MARGEN_AVISO_MIN * 60_000);
      const volvio = tramos.slice(i + 1).length > 0;
      const desenlace = entregadaDespues || volvio;
      const base = { facturaId, localId: evs[0]?.localId ?? '', camionId: camionId ?? '', fecha: fechaEnChile(t.llegada), minutos: Math.round(t.minutos * 10) / 10, entregadaDespues, llegada: ms(t.llegada) };

      if (conBotonCerrado) {
        botonCerrado += 1;
        minCerradoBoton.push(t.minutos);
      }
      if (entregoAqui) {
        atendidas += 1;
        minAtendidas.push(t.minutos);
        return;
      }
      if (!desenlace) {
        sinDesenlace += 1;
        if (conBotonCerrado) botonSinDesenlace += 1;
        return;
      }
      if (t.minutos <= PERMANENCIA_CIERRE_MAX_MIN) {
        cerradoDeducido += 1;
        if (conBotonCerrado) coinciden += 1;
        else if (!conOtroAviso) {
          soloGps += 1;
          if (entregadaDespues) soloGpsConfirmados += 1;
          casos.push({ tipo: 'solo_gps', ...base });
        }
      } else if (conBotonCerrado) {
        soloBoton += 1;
        casos.push({ tipo: 'solo_boton', ...base });
      }
    });
  }

  const m1 = mediana(minCerradoBoton);
  const m2 = mediana(minAtendidas);
  return {
    visitas, atendidas, cerradoDeducido, sinDesenlace, botonCerrado, botonSinRecorrido, botonSinDesenlace, coinciden, soloGps, soloGpsConfirmados, soloBoton,
    ...(m1 !== undefined ? { medianaMinCerradoBoton: Math.round(m1 * 10) / 10 } : {}),
    ...(m2 !== undefined ? { medianaMinAtendidas: Math.round(m2 * 10) / 10 } : {}),
    casos: casos.sort((a, b) => b.llegada - a.llegada).slice(0, MAX_CASOS).map((c) => ({ tipo: c.tipo, facturaId: c.facturaId, localId: c.localId, camionId: c.camionId, fecha: c.fecha, minutos: c.minutos, entregadaDespues: c.entregadaDespues })),
  };
};
