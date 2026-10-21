/** Propone una escritura alternativa; nunca devuelve coordenadas ni decide el orden de la ruta. */
export interface NormalizadorDirecciones {
  normalizar(direccion: string, comuna: string): Promise<string | undefined>;
}
