import type { Geocodificacion } from './geocodificador.js';

/** La IA elige un resultado de búsquedas ejecutadas por el servidor; nunca inventa coordenadas. */
export interface BuscadorPinIA {
  buscar(direccion: string, comuna: string, mapa: (direccion: string) => Promise<Geocodificacion | undefined>): Promise<Geocodificacion | undefined>;
}
