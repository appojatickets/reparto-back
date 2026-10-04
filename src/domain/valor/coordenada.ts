import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

export type Coordenada = { readonly lat: number; readonly lng: number };

export const crearCoordenada = (lat: number, lng: number): Result<Coordenada, ErrorDominio> => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return err(errorDominio('COORDENADA_INVALIDA', 'La coordenada está fuera de rango.'));
  }
  return ok(Object.freeze({ lat, lng }));
};

const RADIO_TIERRA_KM = 6371.0088;
const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

/** Distancia en línea recta sobre la esfera (haversine), en km. */
export const distanciaKm = (a: Coordenada, b: Coordenada): number => {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Caja aproximada de la Región Metropolitana; sirve para detectar pines absurdos, no como límite legal. */
export const dentroDeRegionMetropolitana = (c: Coordenada): boolean =>
  c.lat >= -34.3 && c.lat <= -32.9 && c.lng >= -71.75 && c.lng <= -69.8;
