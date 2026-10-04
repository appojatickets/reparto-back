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
