/** Abre un enlace corto compartido (maps.app.goo.gl, waze.com/ul/…) y devuelve la dirección larga que sí trae el punto. */
export interface ResolvedorEnlaces {
  /** undefined si no se pudo abrir, no es de un mapa o no llegó a una dirección con coordenadas. */
  resolver(url: string): Promise<string | undefined>;
}
