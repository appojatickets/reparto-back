import type { Coordenada } from '../valor/coordenada.js';

export type EstadoPin = 'pendiente' | 'sugerido' | 'validado';

export type Local = {
  readonly id: string;
  readonly clienteId: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly coordenada?: Coordenada;
  readonly pin: { readonly estado: EstadoPin; readonly fuente?: string; readonly confianza?: number };
  /** Lo captura el chofer una vez; nunca se calcula (no hay geometría de calles). */
  readonly ladoHabitual?: 'derecha' | 'izquierda';
  readonly servicioMin?: number;
  readonly nota?: string;
};

/** Minúsculas, sin tildes ni puntuación y con espacios simples: misma regla que `norm()` en la base. */
export const normalizarTexto = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Clave de negocio de un local: RUT + dirección normalizada. */
export const claveNegocioLocal = (rutNormalizado: string | undefined, direccion: string): string =>
  `${rutNormalizado ?? 'sin-rut'}|${normalizarTexto(direccion)}`;
