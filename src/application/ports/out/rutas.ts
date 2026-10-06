import type { HorarioLocal } from '../../../domain/entidades/horario.js';
import type { Result } from '../../../domain/shared/result.js';

/** `sugerida`: el sistema ordena y reordena; `manual`: la persona acomodó y el sistema solo evalúa (hasta que pida ordenar). */
export type ModoRuta = 'sugerida' | 'manual';

export type RutaGuardada = {
  readonly id: string;
  readonly camionId: string;
  readonly fecha: string;
  readonly salidaMin: number;
  readonly modo: ModoRuta;
  readonly version: number;
  /** Ids de factura en el orden de visita. */
  readonly orden: readonly string[];
  /** Las que encabezan la ruta fijadas por una persona («ir primero»). */
  readonly fijas: readonly string[];
};

export type FacturaParaRuta = {
  readonly facturaId: string;
  readonly folio?: string;
  readonly localId: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  /** El pin lo halló el buscador por la dirección con poca precisión (calle, no número): sirve para ordenar, pero es aproximado. */
  readonly pinAproximado?: boolean;
  /** El local tiene foto de la fachada (la subió alguien del equipo). */
  readonly tieneFoto?: boolean;
  readonly antesDeMin?: number;
  readonly urgente: boolean;
  readonly nota?: string;
  readonly total?: number;
  readonly horarios: readonly HorarioLocal[];
};

export type GuardarRuta = {
  readonly camionId: string;
  readonly fecha: string;
  readonly salidaMin: number;
  readonly modo: ModoRuta;
  readonly orden: readonly string[];
  readonly fijas: readonly string[];
  readonly usuarioId: string;
  /** Si se indica, solo se guarda cuando la ruta sigue en esa versión (nadie la cambió mientras tanto). */
  readonly versionEsperada?: number;
};

export interface RutaRepository {
  obtener(empresaId: string, camionId: string, fecha: string): Promise<RutaGuardada | undefined>;
  /** Facturas `pendiente` del camión ese día, con el horario de su local. */
  facturasPendientes(empresaId: string, camionId: string, fecha: string): Promise<readonly FacturaParaRuta[]>;
  guardar(empresaId: string, datos: GuardarRuta): Promise<Result<RutaGuardada, 'VERSION_DESACTUALIZADA'>>;
  /** La ruta se arma cada día: borra la guardada de ese camión y día (no sirve guardar rutas, nunca se repiten). */
  borrar(empresaId: string, camionId: string, fecha: string): Promise<void>;
  /** Borra todas las rutas guardadas de días anteriores a `fecha`. */
  borrarAnteriores(empresaId: string, fecha: string): Promise<void>;
}
