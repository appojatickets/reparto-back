import type { Result } from '../../../domain/shared/result.js';

export type ErrorAlmacen = { readonly detalle: string };

/** La API nunca recibe los bytes de una foto: entrega URLs firmadas y el navegador sube/lee directo del almacenamiento. */
export interface AlmacenArchivos {
  crearUrlSubida(path: string): Promise<Result<{ readonly url: string }, ErrorAlmacen>>;
  crearUrlLectura(path: string, expiraEnSegundos: number): Promise<Result<{ readonly url: string }, ErrorAlmacen>>;
  /** Borra un archivo del almacenamiento (una foto reemplazada o quitada). Si ya no existe, no es un error. */
  eliminar(path: string): Promise<Result<void, ErrorAlmacen>>;
}
