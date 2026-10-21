import { centroDeComuna, resolverComuna } from '../comunas.js';
import type { Coordenada } from '../valor/coordenada.js';

/** Un punto de una calle cuya ubicación se conoce de verdad (pin exacto), con el número de la puerta si se sabe. */
export type AnclaDeCalle = { readonly comuna: string; readonly calle: string; readonly numero?: number; readonly coordenada: Coordenada };

/** Una parada del día cuya calle se reconoció. Con `coordenada` y sin `aproximada` es un pin exacto; si no, hay que estimar dónde está. */
export type ParadaPorUbicar = {
  readonly id: string;
  readonly comuna: string;
  readonly calle: string;
  readonly numero?: number;
  /** Lugar en el orden de carga (para cuando nada de su calle tiene ubicación conocida). */
  readonly orden: number;
  readonly coordenada?: Coordenada;
  /** El pin lo halló el buscador solo hasta la calle: sirve de punto de partida, no de dirección. */
  readonly aproximada?: boolean;
};

/** Cuánto se avanza por la calle por cada número de puerta (en Chile una cuadra de 100 números mide ~100 m). */
export const METROS_POR_NUMERO = 1;
/** Hasta dónde se estira una calle más allá de lo conocido: pasado esto el número ya no dice nada del lugar. */
const MAX_ESTIRADA_M = 1500;
const M_POR_GRADO_LAT = 111_320;

const claveDeCalle = (comuna: string, calle: string): string => `${resolverComuna(comuna) ?? comuna.trim().toLowerCase()}|${calle}`;

const mediana = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

const promedio = (cs: readonly Coordenada[]): Coordenada => ({
  lat: cs.reduce((a, c) => a + c.lat, 0) / cs.length,
  lng: cs.reduce((a, c) => a + c.lng, 0) / cs.length,
});

/** Corre un punto `metrosEste` hacia el este y `metrosNorte` hacia el norte. */
const correr = (c: Coordenada, metrosEste: number, metrosNorte: number): Coordenada => ({
  lat: c.lat + metrosNorte / M_POR_GRADO_LAT,
  lng: c.lng + metrosEste / (M_POR_GRADO_LAT * Math.cos((c.lat * Math.PI) / 180)),
});

/** Metros hacia el este y el norte de `b` respecto de `a`. */
const metrosEntre = (a: Coordenada, b: Coordenada): { readonly este: number; readonly norte: number } => ({
  este: (b.lng - a.lng) * M_POR_GRADO_LAT * Math.cos((a.lat * Math.PI) / 180),
  norte: (b.lat - a.lat) * M_POR_GRADO_LAT,
});

/** Dónde cae un número de puerta entre las puertas conocidas de esa calle. */
const sobreLaCalle = (numero: number | undefined, anclas: readonly AnclaDeCalle[]): Coordenada => {
  const numeradas = anclas
    .flatMap((a) => (a.numero !== undefined ? [{ numero: a.numero, coordenada: a.coordenada }] : []))
    .sort((a, b) => a.numero - b.numero);
  if (numero === undefined || numeradas.length === 0) return promedio(anclas.map((a) => a.coordenada));

  let antes: (typeof numeradas)[number] | undefined;
  let despues: (typeof numeradas)[number] | undefined;
  for (const a of numeradas) {
    if (a.numero <= numero) antes = a;
    if (a.numero >= numero && despues === undefined) despues = a;
  }
  if (antes && despues) {
    if (antes.numero === despues.numero) return antes.coordenada;
    const f = (numero - antes.numero) / (despues.numero - antes.numero);
    return { lat: antes.coordenada.lat + f * (despues.coordenada.lat - antes.coordenada.lat), lng: antes.coordenada.lng + f * (despues.coordenada.lng - antes.coordenada.lng) };
  }

  // Fuera de lo conocido: se sigue la calle en la dirección que llevan las dos puertas más cercanas (de la segunda a la primera).
  const cercana = antes ?? despues;
  if (!cercana) return promedio(anclas.map((a) => a.coordenada));
  const indice = numeradas.indexOf(cercana);
  const otra = antes ? numeradas[indice - 1] : numeradas[indice + 1];
  const distancia = Math.min(Math.abs(numero - cercana.numero) * METROS_POR_NUMERO, MAX_ESTIRADA_M);
  const sentido = otra ? metrosEntre(otra.coordenada, cercana.coordenada) : { este: 0, norte: 0 };
  const largo = Math.hypot(sentido.este, sentido.norte);
  // Con una sola puerta conocida no se sabe hacia dónde corre la calle: se sigue el eje este-oeste, para que al menos queden en orden.
  if (largo === 0) return correr(cercana.coordenada, (numero > cercana.numero ? 1 : -1) * distancia, 0);
  return correr(cercana.coordenada, (distancia * sentido.este) / largo, (distancia * sentido.norte) / largo);
};

/**
 * Dónde está, aproximadamente, cada parada que no tiene un pin exacto, usando su calle y el número de la puerta (en vez de dejarla en el
 * centro de la comuna, donde todas quedaban a distancia cero y la ruta las intercalaba con otras calles):
 *  1. Si en esa calle hay puertas con ubicación conocida (pin exacto de otra factura, entregas del día o locales ya ubicados), cae entre
 *     las dos puertas vecinas según su número; fuera de lo conocido, se sigue la calle un tramo.
 *  2. Si nada de la calle se conoce, todas las facturas de la calle quedan juntas, en el punto donde el orden de carga ubica a la calle
 *     (`porCarga`, con el lugar mediano de sus facturas) o, si tampoco se sabe, en el centro de la comuna, y ordenadas entre sí por número.
 * Solo devuelve las paradas que había que ubicar (sin pin o con pin aproximado).
 */
export const ubicarPorCalle = (
  paradas: readonly ParadaPorUbicar[],
  anclasExternas: readonly AnclaDeCalle[],
  porCarga: (comuna: string, orden: number) => Coordenada | undefined,
): ReadonlyMap<string, Coordenada> => {
  const grupos = new Map<string, ParadaPorUbicar[]>();
  const anclasPor = new Map<string, AnclaDeCalle[]>();
  const agregarAncla = (a: AnclaDeCalle): void => {
    const k = claveDeCalle(a.comuna, a.calle);
    anclasPor.set(k, [...(anclasPor.get(k) ?? []), a]);
  };
  anclasExternas.forEach(agregarAncla);
  for (const p of paradas) {
    if (p.coordenada && p.aproximada !== true) {
      agregarAncla({ comuna: p.comuna, calle: p.calle, ...(p.numero !== undefined ? { numero: p.numero } : {}), coordenada: p.coordenada });
    } else {
      const k = claveDeCalle(p.comuna, p.calle);
      grupos.set(k, [...(grupos.get(k) ?? []), p]);
    }
  }

  const salida = new Map<string, Coordenada>();
  for (const [k, miembros] of grupos) {
    const anclas = anclasPor.get(k) ?? [];
    if (anclas.length > 0) {
      for (const p of miembros) salida.set(p.id, sobreLaCalle(p.numero, anclas));
      continue;
    }
    const primero = miembros[0];
    if (!primero) continue;
    const propios = miembros.flatMap((p) => (p.coordenada ? [p.coordenada] : []));
    const base = propios.length > 0 ? promedio(propios) : (porCarga(primero.comuna, mediana(miembros.map((p) => p.orden))) ?? centroDeComuna(primero.comuna));
    if (!base) continue;
    const numeros = miembros.flatMap((p) => (p.numero !== undefined ? [p.numero] : []));
    const referencia = numeros.length > 0 ? mediana(numeros) : 0;
    for (const p of miembros) {
      const dif = p.numero !== undefined ? p.numero - referencia : 0;
      const metros = Math.max(-MAX_ESTIRADA_M, Math.min(MAX_ESTIRADA_M, dif * METROS_POR_NUMERO));
      salida.set(p.id, correr(base, metros, 0));
    }
  }
  return salida;
};
