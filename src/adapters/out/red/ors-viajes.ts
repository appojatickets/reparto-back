import type { MatrizDeCalles, ProveedorDeViajes } from '../../../application/ports/out/viajes.js';

const URL_MATRIZ = 'https://api.openrouteservice.org/v2/matrix/driving-car';
const ESPERA_MS = 8000;
/** Tope del plan gratuito de OpenRouteService: filas × columnas por consulta. */
export const MAX_TRAMOS_POR_CONSULTA = 3500;

const esNumeroONulo = (x: unknown): x is number | null => x === null || (typeof x === 'number' && Number.isFinite(x));
const esMatriz = (m: unknown): m is (number | null)[][] => Array.isArray(m) && m.every((fila) => Array.isArray(fila) && fila.every(esNumeroONulo));
/** Un tramo sin camino (null) queda como NaN: quien lo usa lo descarta y esa parte sigue en línea recta. */
const aNumeros = (m: (number | null)[][]): number[][] => m.map((fila) => fila.map((x) => x ?? Number.NaN));

/**
 * Tiempos y distancias por calles de OpenRouteService (datos de OpenStreetMap, plan gratuito con clave; 500 consultas de matriz al día).
 * Cualquier falla (sin clave válida, límite diario, red, respuesta rara) devuelve `undefined`: la ruta sigue en línea recta.
 */
export const crearProveedorOrs = (clave: string, buscar: typeof fetch = fetch): ProveedorDeViajes => ({
  async matriz(puntos, desde, hacia): Promise<MatrizDeCalles | undefined> {
    if (puntos.length < 2 || desde.length === 0 || hacia.length === 0 || desde.length * hacia.length > MAX_TRAMOS_POR_CONSULTA) return undefined;
    let respuesta: Response;
    try {
      respuesta = await buscar(URL_MATRIZ, {
        method: 'POST',
        headers: { authorization: clave, 'content-type': 'application/json; charset=utf-8', accept: 'application/json' },
        body: JSON.stringify({ locations: puntos.map((p) => [p.lng, p.lat]), sources: [...desde], destinations: [...hacia], metrics: ['duration', 'distance'], units: 'm' }),
        signal: AbortSignal.timeout(ESPERA_MS),
      });
    } catch {
      return undefined;
    }
    if (!respuesta.ok) {
      void respuesta.body?.cancel().catch(() => undefined);
      return undefined;
    }
    let cuerpo: unknown;
    try {
      cuerpo = await respuesta.json();
    } catch {
      return undefined;
    }
    if (typeof cuerpo !== 'object' || cuerpo === null) return undefined;
    const { durations, distances } = cuerpo as { durations?: unknown; distances?: unknown };
    if (!esMatriz(durations) || !esMatriz(distances) || durations.length !== desde.length || distances.length !== desde.length) return undefined;
    if (durations.some((f) => f.length !== hacia.length) || distances.some((f) => f.length !== hacia.length)) return undefined;
    return { segundos: aNumeros(durations), metros: aNumeros(distances) };
  },
});
