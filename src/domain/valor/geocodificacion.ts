import { resolverComuna } from '../comunas.js';
import { centroDeComuna } from '../comunas.js';
import { dentroDeRegionMetropolitana, distanciaKm, type Coordenada } from './coordenada.js';

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

/** Confianza de un punto que propuso un modelo de lenguaje (no un mapa): siempre aproximado, nunca preciso; la primera entrega con GPS lo reemplaza. */
export const CONFIANZA_PUNTO_DE_MODELO = 0.3;

const COMUNAS_GRANDES: ReadonlySet<string> = new Set(['Melipilla', 'San José de Maipo', 'Colina', 'Lampa', 'Tiltil', 'Paine', 'Buin', 'Pirque', 'San Pedro', 'Alhué', 'Curacaví', 'María Pinto', 'Talagante', 'El Monte', 'Isla de Maipo', 'Peñaflor', 'Padre Hurtado', 'Calera de Tango', 'Lo Barnechea', 'Puente Alto', 'Maipú', 'San Bernardo']);
const RADIO_COMUNA_URBANA_KM = 9;
const RADIO_COMUNA_GRANDE_KM = 30;

/**
 * Decide si un punto que escribió un modelo de lenguaje es creíble como ubicación aproximada de un local de esa comuna: dentro de la Región
 * Metropolitana y no más lejos del centro de su comuna de lo que cabe en ella. Un modelo no consulta un mapa: puede equivocarse con toda
 * seguridad, así que solo se acepta algo plausible y siempre como aproximado (nunca como pin preciso). Mejor que dejarla en el centro de la comuna.
 */
export const evaluarPuntoDeModelo = (punto: Coordenada, comunaDelLocal: string): { readonly confianza: number } | undefined => {
  if (!Number.isFinite(punto.lat) || !Number.isFinite(punto.lng) || !dentroDeRegionMetropolitana(punto)) return undefined;
  const oficial = resolverComuna(comunaDelLocal);
  const centro = centroDeComuna(comunaDelLocal);
  if (oficial === undefined || centro === undefined) return undefined;
  const radio = COMUNAS_GRANDES.has(oficial) ? RADIO_COMUNA_GRANDE_KM : RADIO_COMUNA_URBANA_KM;
  return distanciaKm(punto, centro) <= radio ? { confianza: CONFIANZA_PUNTO_DE_MODELO } : undefined;
};
