import { distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { respaldoDelPin, type RespaldoDelPin, type VisitaConGps } from './respaldo-del-pin.js';

export type PuntoDetencion = Coordenada & { readonly precisionM: number; readonly velocidadMs?: number; readonly en: Date };
export type EntregaParaPin = VisitaConGps & { readonly facturaId: string; readonly puntos: readonly PuntoDetencion[] };
const metros = (a: Coordenada, b: Coordenada) => distanciaKm(a, b) * 1000;
const mediana = (xs: readonly number[]) => {
  const orden = [...xs].sort((a, b) => a - b), m = Math.floor(orden.length / 2);
  return orden.length % 2 ? (orden[m] ?? 0) : ((orden[m - 1] ?? 0) + (orden[m] ?? 0)) / 2;
};

/** Evidencia de una visita: entrega y al menos un minuto detenido, GPS ≤30 m y junto al lugar del aviso. */
export const visitaDetenida = (entrega: EntregaParaPin): VisitaConGps | undefined => {
  if (entrega.precisionM < 0 || entrega.precisionM > 30) return undefined;
  const puntos = entrega.puntos.filter(p => Number.isFinite(p.precisionM) && p.precisionM >= 0 && p.precisionM <= 30 && (p.velocidadMs === undefined || p.velocidadMs <= 1.5) && metros(p, entrega) <= 60 && p.en.getTime() >= entrega.en.getTime() - 10 * 60_000 && p.en.getTime() <= entrega.en.getTime() + 2 * 60_000).sort((a, b) => a.en.getTime() - b.en.getTime());
  for (let fin = puntos.length - 1; fin >= 1; fin--) {
    const ultimo = puntos[fin];
    if (!ultimo) continue;
    const grupo = [ultimo];
    for (let inicio = fin - 1; inicio >= 0; inicio--) {
      const p = puntos[inicio], siguiente = puntos[inicio + 1];
      if (!p || !siguiente || siguiente.en.getTime() - p.en.getTime() > 120_000 || grupo.some(q => metros(p, q) > 30)) break;
      grupo.push(p);
      if (ultimo.en.getTime() - p.en.getTime() >= 60_000) {
        return { lat: mediana(grupo.map(q => q.lat)), lng: mediana(grupo.map(q => q.lng)), precisionM: Math.max(...grupo.map(q => q.precisionM)), en: entrega.en };
      }
    }
  }
  return undefined;
};

/** Dos facturas juntas no son dos visitas: separa al menos media hora y elimina repeticiones de factura. */
export const visitasIndependientes = (entregas: readonly EntregaParaPin[]): readonly VisitaConGps[] => {
  const salida: VisitaConGps[] = [], facturas = new Set<string>();
  for (const e of [...entregas].sort((a, b) => b.en.getTime() - a.en.getTime())) {
    if (facturas.has(e.facturaId)) continue;
    facturas.add(e.facturaId);
    const visita = visitaDetenida(e);
    if (visita && salida.every(v => Math.abs(v.en.getTime() - visita.en.getTime()) >= 30 * 60_000)) salida.push(visita);
  }
  return salida;
};

export const respaldoGemini = (pin: Coordenada, verificado: boolean, visitas: readonly VisitaConGps[]): RespaldoDelPin => {
  const r = respaldoDelPin(pin, verificado, visitas);
  if (verificado || r.nivel !== 'respaldado') return r;
  // Ambas visitas deben quedar a ≤60 m del pin y entre sí, no solo su promedio.
  const junto = visitas.filter(v => v.precisionM <= 30 && metros(pin, v) <= 60);
  for (let i = 0; i < junto.length; i++) {
    const a = junto[i];
    if (a && junto.slice(i + 1).some(b => Math.abs(a.en.getTime() - b.en.getTime()) >= 30 * 60_000 && metros(a, b) <= 60)) return respaldoDelPin(pin, false, junto);
  }
  return { ...r, nivel: (r.distanciaM ?? Infinity) > 60 ? 'en_conflicto' : 'sin_respaldo' };
};

/** Una propuesta para revisión, nunca un movimiento automático del pin. */
export const correccionGemini = (pin: Coordenada, visitas: readonly VisitaConGps[]): Coordenada | undefined => {
  for (const a of visitas) {
    const grupo = visitas.filter(b => metros(a, b) <= 60);
    if (grupo.length < 2 || grupo.some(b => grupo.some(c => metros(b, c) > 60))) continue;
    const punto = { lat: mediana(grupo.map(b => b.lat)), lng: mediana(grupo.map(b => b.lng)) };
    if (metros(pin, punto) > 60) return punto;
  }
  return undefined;
};
