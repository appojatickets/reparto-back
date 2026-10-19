import { distanciaKm } from '../valor/coordenada.js';
import { detectarLlegada, type PuntoGps } from './llegada.js';
export type PinPendiente = { readonly facturaId: string; readonly localId: string; readonly lat: number; readonly lng: number };
/** Un punto no se atribuye si dos locales distintos están prácticamente igual de cerca. */
export const puntosDelPin = (puntos: readonly PuntoGps[], destino: PinPendiente, pines: readonly PinPendiente[]): readonly PuntoGps[] => puntos.map(p=>{
 if(p.precisionM === undefined || p.precisionM > 50)return {...p,precisionM:Infinity};
 const distancia=distanciaKm(p,destino)*1000;
 const ambiguo=distancia<=60&&pines.some(otro=>otro.localId!==destino.localId && distanciaKm(p,otro)*1000 < distancia+20);
 return ambiguo?{...p,precisionM:Infinity}:p;
});
export const visitaObservada = (puntos: readonly PuntoGps[], pin: PinPendiente, pines: readonly PinPendiente[]) => {
 const asignados=puntosDelPin(puntos,pin,pines);
 const llegada=detectarLlegada(asignados,pin);if(!llegada)return undefined;
 // Para salida hacen falta dos puntos posteriores lejos, separados y sin hueco de señal grande.
 const lejos=puntos.filter(p=>p.tomadoEn>llegada.tomadoEn&&p.precisionM!==undefined&&p.precisionM<=50&&distanciaKm(p,pin)*1000>100);
 const salio=lejos.some((p,i)=>{const anterior=lejos[i-1];return anterior!==undefined && p.tomadoEn.getTime()-anterior.tomadoEn.getTime()>=15_000&&p.tomadoEn.getTime()-anterior.tomadoEn.getTime()<=120_000;});
 return { llegada:llegada.tomadoEn, estado:salio?'sin_confirmar' as const:'en_local' as const };
};
