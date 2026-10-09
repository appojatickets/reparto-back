import { resolverComuna } from '../../../domain/comunas.js';
import { err, ok } from '../../../domain/shared/result.js';
import type { Geocodificacion, Geocodificador, PrecisionGeocodificacion } from '../../../application/ports/out/geocodificador.js';

const URL_BUSQUEDA = 'https://api.openrouteservice.org/geocode/search';

type Lugar = { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };

const PRECISION_ORDEN: Readonly<Record<PrecisionGeocodificacion, number>> = { exacta: 0, calle: 1, zona: 2 };

/** Un número de casa exacto vale como «exacta»; uno calculado entre dos números vecinos (interpolado) o solo la calle, como «calle»; lo demás es una zona. */
const precisionDe = (p: Record<string, unknown>): PrecisionGeocodificacion => {
  if ((p['layer'] === 'address' || p['layer'] === 'venue') && p['match_type'] === 'exact') return 'exacta';
  if (p['layer'] === 'address' || p['layer'] === 'street') return 'calle';
  return 'zona';
};

const comunaDe = (p: Record<string, unknown>): string | undefined => {
  for (const clave of ['localadmin', 'locality', 'county', 'borough']) {
    const v = p[clave];
    const c = typeof v === 'string' ? resolverComuna(v.replace(/^comuna de /i, '')) : undefined;
    if (c !== undefined) return c;
  }
  return undefined;
};

const aGeocodificacion = (l: Lugar): Geocodificacion | undefined => {
  const c = l.geometry?.coordinates;
  if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') return undefined;
  const [lng, lat] = c as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const propiedades = l.properties ?? {};
  const comuna = comunaDe(propiedades);
  return { lat, lng, precision: precisionDe(propiedades), ...(comuna !== undefined ? { comuna } : {}) };
};

/**
 * Segundo buscador de direcciones: el geocodificador de OpenRouteService (Pelias), gratis con la misma clave de las rutas por calles
 * (1.000 búsquedas al día). Se usa cuando Nominatim no encuentra la dirección. Una clave inválida o un límite agotado cuentan como LIMITE
 * (se deja de intentar por ahora); una caída de la red, como RED.
 */
export const crearOrsGeocodificador = (clave: string, buscar: typeof fetch = (...a) => fetch(...a), tiempoMs = 8000): Geocodificador => ({
  async buscar(consulta) {
    const url = `${URL_BUSQUEDA}?text=${encodeURIComponent(consulta)}&boundary.country=CL&size=3&lang=es`;
    let respuesta: Response;
    try {
      respuesta = await buscar(url, { signal: AbortSignal.timeout(tiempoMs), headers: { authorization: clave, accept: 'application/json' } });
    } catch {
      return err('RED');
    }
    if (respuesta.status === 429 || respuesta.status === 401 || respuesta.status === 403) {
      void respuesta.body?.cancel().catch(() => undefined);
      return err('LIMITE');
    }
    if (!respuesta.ok) {
      void respuesta.body?.cancel().catch(() => undefined);
      return err('RED');
    }
    let cuerpo: unknown;
    try {
      cuerpo = await respuesta.json();
    } catch {
      return err('RED');
    }
    const lugares = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as { features?: unknown }).features : undefined;
    if (!Array.isArray(lugares)) return err('SIN_RESULTADO');
    const candidatos = (lugares as Lugar[]).flatMap((l) => {
      const g = aGeocodificacion(l);
      return g ? [g] : [];
    });
    const mejor = [...candidatos].sort((a, b) => PRECISION_ORDEN[a.precision] - PRECISION_ORDEN[b.precision])[0];
    return mejor ? ok(mejor) : err('SIN_RESULTADO');
  },
});
