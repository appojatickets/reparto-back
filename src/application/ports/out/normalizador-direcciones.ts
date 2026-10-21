import type { Result } from '../../../domain/shared/result.js';

/** Una dirección ya limpia: la calle (o camino) sin abreviaturas ni complementos, y el número de la puerta si lo trae. */
export type DireccionNormalizada = { readonly calle: string; readonly numero?: number };

/** LIMITE: se acabó el cupo (se vuelve a probar más tarde) · FALLO: no respondió o respondió algo inservible · SIN_RESULTADO: no pudo reconocer una calle. */
export type ErrorNormalizador = 'LIMITE' | 'FALLO' | 'SIN_RESULTADO';

/**
 * Entiende una dirección mal escrita («Pje Los Olmos 88 depto 3, Sn Bdo»). Solo ordena texto: nunca devuelve coordenadas, el punto lo sigue
 * poniendo un buscador de mapas. Es una ayuda opcional que puede fallar: quien la usa debe seguir sin ella.
 */
export interface NormalizadorDeDirecciones {
  normalizar(direccion: string, comuna: string): Promise<Result<DireccionNormalizada, ErrorNormalizador>>;
}
