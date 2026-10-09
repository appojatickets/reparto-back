export type PuntoGeo = { readonly lat: number; readonly lng: number };

/** Tiempos (segundos) y distancias (metros) de manejar entre puntos, de un servicio de rutas por calles. */
export type MatrizDeCalles = { readonly segundos: readonly (readonly number[])[]; readonly metros: readonly (readonly number[])[] };

export interface ProveedorDeViajes {
  /**
   * Matriz de manejar entre `puntos`: filas = `desde` (índices de `puntos`), columnas = `hacia`. `undefined` si el servicio no responde o
   * el límite diario se acabó: quien llama sigue con lo que tenga.
   */
  matriz(puntos: readonly PuntoGeo[], desde: readonly number[], hacia: readonly number[]): Promise<MatrizDeCalles | undefined>;
}

/** Un tramo ya consultado. Las claves son coordenadas redondeadas (~11 m): un pin que se corrige apenas sigue usando lo consultado. */
export type ViajeGuardado = { readonly desde: string; readonly hasta: string; readonly segundos: number; readonly metros: number };

export interface CacheDeViajes {
  leer(desde: readonly string[], hacia: readonly string[]): Promise<readonly ViajeGuardado[]>;
  guardar(viajes: readonly ViajeGuardado[]): Promise<void>;
}
