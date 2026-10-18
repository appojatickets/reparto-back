import type { ProveedorTrazado, TrazadoMapa } from '../../../application/ports/out/trazado.js';
import type { PuntoGeo } from '../../../application/ports/out/viajes.js';

const esPunto = (p: unknown): p is [number, number] => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number' && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

/** Caché acotada por perfil y coordenadas, deduplicación de consultas simultáneas. La clave nunca sale al navegador. */
export const crearTrazadoOrs = (clave: string | undefined, perfil: 'driving-car' | 'driving-hgv', reloj: () => number, buscar: typeof fetch = fetch): ProveedorTrazado => {
  const cache = new Map<string, { hasta: number; valor: TrazadoMapa }>();
  const pendientes = new Map<string, Promise<TrazadoMapa>>();
  const resolver = async (puntos: readonly PuntoGeo[]): Promise<TrazadoMapa> => {
    const respaldo: TrazadoMapa = { perfil, tramos: puntos.slice(1).map((p, i) => ({ coordenadas: [[puntos[i]?.lng ?? p.lng, puntos[i]?.lat ?? p.lat], [p.lng, p.lat]], porCalles: false })) };
    if (!clave || puntos.length < 2 || puntos.length > 50) return respaldo;
    try {
      const r = await buscar(`https://api.openrouteservice.org/v2/directions/${perfil}/geojson`, {
        method: 'POST', headers: { authorization: clave, 'content-type': 'application/json' },
        body: JSON.stringify({ coordinates: puntos.map((p) => [p.lng, p.lat]), instructions: false }), signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) { await r.body?.cancel(); return respaldo; }
      const cuerpo: unknown = await r.json();
      if (typeof cuerpo !== 'object' || cuerpo === null || !('features' in cuerpo) || !Array.isArray(cuerpo.features)) return respaldo;
      const feature: unknown = cuerpo.features[0];
      if (typeof feature !== 'object' || feature === null || !('geometry' in feature)) return respaldo;
      const g = feature.geometry;
      if (typeof g !== 'object' || g === null || !('type' in g) || g.type !== 'LineString' || !('coordinates' in g) || !Array.isArray(g.coordinates) || g.coordinates.length < 2 || !g.coordinates.every(esPunto)) return respaldo;
      if (!('properties' in feature) || typeof feature.properties !== 'object' || feature.properties === null || !('way_points' in feature.properties)) return respaldo;
      const indices = feature.properties.way_points;
      const total = g.coordinates.length;
      if (!Array.isArray(indices) || indices.length !== puntos.length || !indices.every((x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < total)) return respaldo;
      const coordenadas = g.coordinates.map((p) => [p[0], p[1]] as const);
      const tramos = puntos.slice(1).map((_, i) => {
        const desde: unknown = indices[i]; const hasta: unknown = indices[i + 1];
        if (typeof desde !== 'number' || typeof hasta !== 'number' || hasta < desde) return { coordenadas: [], porCalles: false };
        return { coordenadas: coordenadas.slice(desde, hasta + 1), porCalles: true };
      });
      return { perfil, tramos };
    } catch { return respaldo; }
  };
  return { trazar: async (puntos) => {
    const k = `${perfil}:${puntos.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')}`;
    const guardado = cache.get(k);
    if (guardado && guardado.hasta > reloj()) return guardado.valor;
    const pendiente = pendientes.get(k);
    if (pendiente) return pendiente;
    const pedido = resolver(puntos).then((valor) => {
      if (cache.size >= 500) { const primero = cache.keys().next().value; if (primero !== undefined) cache.delete(primero); }
      cache.set(k, { valor, hasta: reloj() + (valor.tramos.every((t) => t.porCalles) ? 30 * 86400000 : 60000) });
      return valor;
    }).finally(() => { pendientes.delete(k); });
    pendientes.set(k, pedido);
    return pedido;
  } };
};
