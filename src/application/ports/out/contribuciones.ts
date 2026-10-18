import type { DatosContribucion } from '../../../domain/entidades/contribuciones.js';

export interface ContribucionesRepository {
  /** Lo registrado de un local que sirve para saber quiénes aportaron (foto, pin y entregas). `undefined` si el local no existe en esa empresa. */
  datosDelLocal(empresaId: string, localId: string): Promise<DatosContribucion | undefined>;
}
