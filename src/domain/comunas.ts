import { normalizarTexto } from './entidades/local.js';

/** Las 52 comunas de la Región Metropolitana de Santiago. */
export const COMUNAS_RM: readonly string[] = [
  'Santiago', 'Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba', 'Independencia',
  'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes', 'Lo Barnechea', 'Lo Espejo',
  'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa', 'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Quilicura',
  'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquín', 'San Miguel', 'San Ramón', 'Vitacura', 'Puente Alto', 'Pirque',
  'San José de Maipo', 'Colina', 'Lampa', 'Tiltil', 'San Bernardo', 'Buin', 'Calera de Tango', 'Paine', 'Melipilla',
  'Alhué', 'Curacaví', 'María Pinto', 'San Pedro', 'Talagante', 'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor',
];

const POR_NORMALIZADA = new Map(COMUNAS_RM.map((c) => [normalizarTexto(c), c]));

/** Devuelve el nombre oficial de la comuna ignorando tildes, mayúsculas y espacios; undefined si no es de la RM. */
export const resolverComuna = (texto: string): string | undefined => POR_NORMALIZADA.get(normalizarTexto(texto));

/** Centro aproximado de cada comuna: solo sirve para ordenar una ruta mientras un local no tiene pin (no es una dirección). */
const CENTROS: Readonly<Record<string, readonly [number, number]>> = {
  'Alhué': [-34.04, -71.09], Buin: [-33.73, -70.74], 'Calera de Tango': [-33.63, -70.78], Cerrillos: [-33.5, -70.72], 'Cerro Navia': [-33.42, -70.74],
  Colina: [-33.2, -70.67], 'Conchalí': [-33.38, -70.68], 'Curacaví': [-33.4, -71.14], 'El Bosque': [-33.56, -70.68], 'El Monte': [-33.68, -70.98],
  'Estación Central': [-33.46, -70.68], Huechuraba: [-33.36, -70.64], Independencia: [-33.42, -70.66], 'Isla de Maipo': [-33.75, -70.9],
  'La Cisterna': [-33.53, -70.66], 'La Florida': [-33.52, -70.58], 'La Granja': [-33.54, -70.63], 'La Pintana': [-33.59, -70.63], 'La Reina': [-33.44, -70.54],
  Lampa: [-33.29, -70.88], 'Las Condes': [-33.41, -70.57], 'Lo Barnechea': [-33.35, -70.52], 'Lo Espejo': [-33.52, -70.69], 'Lo Prado': [-33.44, -70.72],
  Macul: [-33.49, -70.6], 'Maipú': [-33.51, -70.76], 'María Pinto': [-33.52, -71.12], Melipilla: [-33.69, -71.21], 'Ñuñoa': [-33.46, -70.6],
  'Padre Hurtado': [-33.57, -70.82], Paine: [-33.81, -70.74], 'Pedro Aguirre Cerda': [-33.49, -70.67], 'Peñaflor': [-33.61, -70.88], 'Peñalolén': [-33.49, -70.53],
  Pirque: [-33.67, -70.58], Providencia: [-33.43, -70.61], Pudahuel: [-33.44, -70.76], 'Puente Alto': [-33.61, -70.58], Quilicura: [-33.36, -70.73],
  'Quinta Normal': [-33.43, -70.7], Recoleta: [-33.4, -70.64], Renca: [-33.4, -70.72], 'San Bernardo': [-33.59, -70.7], 'San Joaquín': [-33.5, -70.62],
  'San José de Maipo': [-33.64, -70.35], 'San Miguel': [-33.5, -70.65], 'San Pedro': [-33.9, -71.46], 'San Ramón': [-33.54, -70.64], Santiago: [-33.45, -70.66],
  Talagante: [-33.66, -70.93], Tiltil: [-33.08, -70.93], Vitacura: [-33.38, -70.57],
};

export const centroDeComuna = (comuna: string): { readonly lat: number; readonly lng: number } | undefined => {
  const oficial = resolverComuna(comuna);
  const c = oficial === undefined ? undefined : CENTROS[oficial];
  return c ? { lat: c[0], lng: c[1] } : undefined;
};
