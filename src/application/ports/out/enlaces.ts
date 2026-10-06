/** Lo que se encontró al abrir un enlace compartido: la dirección larga a la que llevó y, si esa dirección no trae el punto, el texto de la página. */
export type EnlaceAbierto = { readonly url: string; readonly cuerpo?: string };

/** Abre un enlace corto compartido (maps.app.goo.gl, waze.com/ul/…) siguiendo sus redirecciones. */
export interface ResolvedorEnlaces {
  /** undefined si no se pudo abrir o no es de un mapa. */
  resolver(url: string): Promise<EnlaceAbierto | undefined>;
}
