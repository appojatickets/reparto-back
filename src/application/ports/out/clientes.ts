import type { ClienteImportable } from '../../../domain/importacion/fila-cliente.js';
import type { Result } from '../../../domain/shared/result.js';

export type EstadoPin = 'pendiente' | 'sugerido' | 'validado';
export type FuentePin = 'geocodificador' | 'manual' | 'importado' | 'aprendido' | 'chofer';

export type ResultadoBusqueda = {
  readonly localId: string;
  readonly clienteId: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly pinEstado: EstadoPin;
  readonly fotoPath?: string;
  readonly streetviewRumbo?: number;
  readonly nota?: string;
  readonly score: number;
};

/** `rutDigitos`: búsqueda por RUT (prefijo, sin puntos ni guion); en ese caso `texto` va vacío. */
export type ConsultaBusqueda = { readonly texto: string; readonly rutDigitos?: string; readonly comuna?: string; readonly limite: number };

export type NuevoClienteConLocal = {
  readonly rut?: string;
  readonly razonSocial: string;
  readonly giro?: string;
  readonly estado: 'nuevo' | 'activo';
  readonly local: {
    readonly direccion: string;
    readonly comuna: string;
    readonly lat?: number;
    readonly lng?: number;
    readonly nota?: string;
    readonly pinEstado: EstadoPin;
    readonly pinFuente?: FuentePin;
  };
};

export type ResumenImportacion = {
  readonly clientesCreados: number;
  readonly clientesActualizados: number;
  readonly localesCreados: number;
  readonly localesActualizados: number;
};

export type LocalDetalle = {
  readonly id: string;
  readonly clienteId: string;
  readonly razonSocial: string;
  readonly rut?: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly pinEstado: EstadoPin;
  readonly fotoPath?: string;
  readonly streetviewRumbo?: number;
  readonly nota?: string;
};

export type CambiosLocal = {
  readonly nota?: string;
  readonly streetviewRumbo?: number;
  readonly fotoPath?: string;
  readonly pin?: { readonly lat: number; readonly lng: number; readonly estado: EstadoPin; readonly fuente: FuentePin };
};

export type CoincidenciaLocal = { readonly localId: string; readonly lat?: number; readonly lng?: number };

export interface ClienteRepository {
  buscar(empresaId: string, consulta: ConsultaBusqueda): Promise<readonly ResultadoBusqueda[]>;
  crearConLocal(empresaId: string, datos: NuevoClienteConLocal): Promise<Result<{ clienteId: string; localId: string }, 'DUPLICADO'>>;
  /** Cada cliente y cada local del lote vienen una sola vez (el caso de uso los consolida antes). */
  importar(empresaId: string, clientes: readonly ClienteImportable[]): Promise<ResumenImportacion>;
  obtenerLocal(empresaId: string, localId: string): Promise<LocalDetalle | undefined>;
  /** Devuelve false si el local no existe en esa empresa. */
  actualizarLocal(empresaId: string, localId: string, cambios: CambiosLocal): Promise<boolean>;
  /** Colaborativo: fija el pin solo si el local todavía no tiene (como «sugerido», fuente chofer). Devuelve si lo fijó. */
  fijarPinSiFalta(empresaId: string, localId: string, lat: number, lng: number): Promise<boolean>;
  /** Con RUT busca ese cliente; sin RUT solo hay coincidencia si la dirección identifica un único local. */
  coincidenciaDeDireccion(empresaId: string, rut: string | undefined, direccion: string): Promise<CoincidenciaLocal | undefined>;
}
