import { resolverComuna } from '../../../domain/comunas.js';
import { err, ok } from '../../../domain/shared/result.js';
import type { Geocodificador, Geocodificacion, PrecisionGeocodificacion } from '../../../application/ports/out/geocodificador.js';

type Resultado = { lat?: unknown; lon?: unknown; addresstype?: string; type?: string; address?: unknown };

const PRECISION: Readonly<Record<string, PrecisionGeocodificacion>> = {
  house: 'exacta', building: 'exacta', shop: 'exacta', amenity: 'exacta', office: 'exacta', craft: 'exacta', tourism: 'exacta', leisure: 'exacta',
  road: 'calle', highway: 'calle', residential: 'calle', tertiary: 'calle', secondary: 'calle', primary: 'calle', unclassified: 'calle', service: 'calle', track: 'calle', path: 'calle', footway: 'calle',
};

const precisionDe = (r: Resultado): PrecisionGeocodificacion => PRECISION[r.addresstype ?? ''] ?? PRECISION[r.type ?? ''] ?? 'zona';

const comunaDe = (direccion: unknown): string | undefined => {
  if (typeof direccion !== 'object' || direccion === null) return undefined;
  const d = direccion as Record<string, unknown>;
  for (const clave of ['municipality', 'city', 'town', 'village', 'suburb', 'county']) {
    const v = d[clave];
    const c = typeof v === 'string' ? resolverComuna(v.replace(/^comuna de /i, '')) : undefined;
    if (c !== undefined) return c;
  }
  return undefined;
};

const aGeocodificacion = (r: Resultado): Geocodificacion | undefined => {
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const comuna = comunaDe(r.address);
  return { lat, lng, precision: precisionDe(r), ...(comuna !== undefined ? { comuna } : {}) };
};

/**
 * Geocodificador con Nominatim (OpenStreetMap), gratuito. Su política pide una consulta por segundo como máximo (lo cuida la cola),
 * un User-Agent que identifique la aplicación y no abusar: por eso se guarda cada resultado y no se repite una búsqueda sin éxito.
 */
export const crearNominatimGeocodificador = (userAgent: string, buscar: typeof fetch = (...a) => fetch(...a), tiempoMs = 8000): Geocodificador => ({
  async buscar(consulta) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&countrycodes=cl&accept-language=es&q=${encodeURIComponent(consulta)}`;
    let respuesta: Response;
    try {
      respuesta = await buscar(url, { signal: AbortSignal.timeout(tiempoMs), headers: { 'user-agent': userAgent, accept: 'application/json' } });
    } catch {
      return err('RED');
    }
    if (respuesta.status === 429 || respuesta.status === 403) return err('LIMITE');
    if (!respuesta.ok) return err('RED');
    let cuerpo: unknown;
    try {
      cuerpo = await respuesta.json();
    } catch {
      return err('RED');
    }
    if (!Array.isArray(cuerpo)) return err('SIN_RESULTADO');
    const candidatos = (cuerpo as Resultado[]).flatMap((r) => {
      const g = aGeocodificacion(r);
      return g ? [g] : [];
    });
    // El más preciso primero; entre iguales, el que Nominatim puso antes.
    const orden: Readonly<Record<PrecisionGeocodificacion, number>> = { exacta: 0, calle: 1, zona: 2 };
    const mejor = [...candidatos].sort((a, b) => orden[a.precision] - orden[b.precision])[0];
    return mejor ? ok(mejor) : err('SIN_RESULTADO');
  },
});
