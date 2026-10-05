import type { Result } from '../../../domain/shared/result.js';

/** exacta: el número de la calle · calle: la calle o el camino · zona: solo un barrio, localidad o comuna (no sirve para fijar un pin). */
export type PrecisionGeocodificacion = 'exacta' | 'calle' | 'zona';
export type Geocodificacion = { readonly lat: number; readonly lng: number; readonly precision: PrecisionGeocodificacion; readonly comuna?: string };
export type ErrorGeocodificador = 'RED' | 'LIMITE' | 'SIN_RESULTADO';

/** Busca una dirección en un mapa y devuelve el punto. El servicio gratuito (OpenStreetMap) permite una consulta por segundo. */
export interface Geocodificador {
  buscar(consulta: string): Promise<Result<Geocodificacion, ErrorGeocodificador>>;
}
