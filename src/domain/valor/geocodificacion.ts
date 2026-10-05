import { resolverComuna } from '../comunas.js';
import { dentroDeRegionMetropolitana } from './coordenada.js';

export type GeocodificacionCruda = { readonly lat: number; readonly lng: number; readonly precision: 'exacta' | 'calle' | 'zona'; readonly comuna?: string | undefined };

/** Por debajo de esta confianza el pin se considera aproximado: la ruta lo avisa y el GPS de la primera entrega lo reemplaza. */
export const CONFIANZA_PIN_PRECISO = 0.7;
export const CONFIANZA_EXACTA = 0.85;
export const CONFIANZA_CALLE = 0.6;

/**
 * Decide si un punto que devolvió el mapa sirve como pin del local. Se descarta lo que cae fuera de la Región Metropolitana, lo que
 * solo ubica una zona (no una dirección) y lo que el mapa pone en otra comuna que la del local (casi seguro otra calle del mismo nombre).
 */
export const evaluarGeocodificacion = (g: GeocodificacionCruda, comunaDelLocal: string): { readonly confianza: number } | undefined => {
  if (!dentroDeRegionMetropolitana({ lat: g.lat, lng: g.lng })) return undefined;
  if (g.precision === 'zona') return undefined;
  const esperada = resolverComuna(comunaDelLocal);
  if (g.comuna !== undefined && esperada !== undefined && g.comuna !== esperada) return undefined;
  return { confianza: g.precision === 'exacta' ? CONFIANZA_EXACTA : CONFIANZA_CALLE };
};
