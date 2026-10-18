import { fechaEnChile } from '../shared/fechas.js';
import { distanciaKm, type Coordenada } from '../valor/coordenada.js';

type Punto = Coordenada & { readonly camionId: string; readonly precisionM?: number; readonly tomadoEn: Date };
type Evento = { readonly camionId?: string; readonly facturaId: string; readonly localId: string; readonly tipo: string; readonly motivo?: string; readonly creadoEn: Date };
type Jornada = { readonly camionId: string; readonly fecha: string; readonly desde: Date; readonly hasta?: Date };
export type JornadaObservada = {
  readonly camionId: string; readonly fecha: string;
  readonly inicioGps: string; readonly ultimoGps: string;
  readonly inicioRegistrado?: string; readonly finRegistrado?: string;
  readonly salidaDeposito?: string; readonly regresoDeposito?: string;
  readonly puntos: number; readonly minutosObservados: number; readonly minutosSinSenal: number;
  readonly kmObservados: number; readonly cobertura: number;
  readonly visitasSinResultado: number; readonly entregadas: number; readonly visitasCerrado: number; readonly jornadaCerrada: boolean;
};
const MAX_HUECO_MS = 5 * 60_000;
const RADIO_DEPOSITO_KM = 0.15;
const redondear = (n: number): number => Math.round(n * 100) / 100;

/** Observaciones GPS, no horas laborales certificadas ni cierre automático de la jornada. */
export const jornadasObservadas = (posiciones: readonly Punto[], eventos: readonly Evento[], jornadas: readonly Jornada[], deposito?: Coordenada): readonly JornadaObservada[] => {
  const grupos = new Map<string, Punto[]>();
  for (const p of posiciones) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !Number.isFinite(p.tomadoEn.getTime()) || p.precisionM === undefined || p.precisionM < 0 || p.precisionM > 60) continue;
    const key = `${p.camionId}|${fechaEnChile(p.tomadoEn)}`;
    const lista = grupos.get(key) ?? [];
    lista.push(p); grupos.set(key, lista);
  }
  const salida: JornadaObservada[] = [];
  for (const puntos of grupos.values()) {
    const ordenados = [...new Map(puntos.map((p) => [p.tomadoEn.getTime(), p])).values()].sort((a, b) => a.tomadoEn.getTime() - b.tomadoEn.getTime());
    const primero = ordenados[0], ultimo = ordenados[ordenados.length - 1];
    if (!primero || !ultimo || ordenados.length < 2) continue;
    const fecha = fechaEnChile(primero.tomadoEn), camionId = primero.camionId;
    let cubierto = 0, km = 0;
    let salidaDeposito: string | undefined, regresoDeposito: string | undefined;
    for (let i = 1; i < ordenados.length; i++) {
      const a = ordenados[i - 1], b = ordenados[i];
      if (!a || !b) continue;
      const dt = b.tomadoEn.getTime() - a.tomadoEn.getTime();
      const distancia = distanciaKm(a, b);
      if (dt <= 0 || dt > MAX_HUECO_MS || distancia / (dt / 3_600_000) > 120) continue;
      cubierto += dt;
      // La oscilación de GPS estando detenido no debe acumular kilómetros ficticios.
      if (distancia * 1000 > Math.max(20, (a.precisionM ?? 0) + (b.precisionM ?? 0))) km += distancia;
      if (deposito) {
        const dentroA = distanciaKm(a, deposito) <= RADIO_DEPOSITO_KM;
        const dentroB = distanciaKm(b, deposito) <= RADIO_DEPOSITO_KM;
        if (dentroA && !dentroB && !salidaDeposito) salidaDeposito = b.tomadoEn.toISOString();
        if (!dentroA && dentroB && salidaDeposito) regresoDeposito = b.tomadoEn.toISOString();
        if (!dentroB) regresoDeposito = undefined; // Volvió a salir: todavía no es el regreso final observado.
      }
    }
    const span = ultimo.tomadoEn.getTime() - primero.tomadoEn.getTime();
    const ventanas = jornadas.filter((j) => j.camionId === camionId && j.fecha === fecha);
    const inicios = ventanas.map((j) => j.desde.getTime());
    const cerrada = ventanas.length > 0 && ventanas.every((j) => j.hasta !== undefined);
    const finales = ventanas.flatMap((j) => j.hasta ? [j.hasta.getTime()] : []);
    const evs = eventos.filter((e) => e.camionId === camionId && fechaEnChile(e.creadoEn) === fecha).sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());
    const entregadas = new Set(evs.filter((e) => e.tipo === 'entregado').map((e) => e.facturaId));
    const conResultado = new Set(evs.filter((e) => ['entregado', 'cerrado', 'no_entregado'].includes(e.tipo)).map((e) => e.facturaId));
    const sinResultado = new Set(evs.filter((e) => e.tipo === 'llegada' && !conResultado.has(e.facturaId)).map((e) => e.facturaId));
    const ultimosCierres = new Map<string, number>();
    let visitasCerrado = 0;
    for (const e of evs) {
      if (e.tipo !== 'cerrado' && !(e.tipo === 'no_entregado' && e.motivo === 'cerrado')) continue;
      const previo = ultimosCierres.get(e.localId);
      if (previo === undefined || e.creadoEn.getTime() - previo >= 30 * 60_000) visitasCerrado++;
      ultimosCierres.set(e.localId, e.creadoEn.getTime());
    }
    salida.push({ camionId, fecha, inicioGps: primero.tomadoEn.toISOString(), ultimoGps: ultimo.tomadoEn.toISOString(),
      ...(inicios.length ? { inicioRegistrado: new Date(Math.min(...inicios)).toISOString() } : {}),
      ...(cerrada && finales.length ? { finRegistrado: new Date(Math.max(...finales)).toISOString() } : {}),
      ...(salidaDeposito ? { salidaDeposito } : {}), ...(regresoDeposito ? { regresoDeposito } : {}),
      puntos: ordenados.length, minutosObservados: redondear(cubierto / 60_000), minutosSinSenal: redondear(Math.max(0, span - cubierto) / 60_000),
      kmObservados: redondear(km), cobertura: span > 0 ? redondear(cubierto / span) : 0,
      visitasSinResultado: sinResultado.size, entregadas: entregadas.size, visitasCerrado, jornadaCerrada: cerrada });
  }
  return salida.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.camionId.localeCompare(b.camionId));
};
