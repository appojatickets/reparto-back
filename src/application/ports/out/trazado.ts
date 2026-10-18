import type { PuntoGeo } from './viajes.js';

export type TramoMapa = { readonly coordenadas: readonly (readonly [number, number])[]; readonly porCalles: boolean };
export type TrazadoMapa = { readonly tramos: readonly TramoMapa[]; readonly perfil: string };
export interface ProveedorTrazado {
  trazar(puntos: readonly PuntoGeo[]): Promise<TrazadoMapa>;
}
