import type { ClienteImportable } from '../../../domain/importacion/fila-cliente.js';
import type { Result } from '../../../domain/shared/result.js';

export type EstadoPin = 'pendiente' | 'sugerido' | 'validado';
export type FuentePin = 'geocodificador' | 'manual' | 'importado' | 'aprendido' | 'chofer' | 'enlace';

export type ResultadoBusqueda = {
  readonly localId: string;
  readonly clienteId: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly pinEstado: EstadoPin;
  /** Alguien verificó el pin (una persona o las entregas): ya no se mueve solo. */
  readonly pinVerificado?: boolean;
  readonly fotoPath?: string;
  /** El admin revisó y dio por buena la foto que tiene hoy el local. */
  readonly fotoVerificada?: boolean;
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
  readonly pinFuente?: FuentePin;
  /** Una persona confirmó este pin: ya no se mueve solo. Mientras no, está «por verificar» y las entregas lo van ajustando. */
  readonly pinVerificado: boolean;
  /** Quién lo verificó: una persona, o el sistema solo porque las entregas lo confirmaron (ADR 0032). */
  readonly pinVerificacion?: 'persona' | 'entregas';
  readonly fotoPath?: string;
  readonly fotoVerificada?: boolean;
  readonly streetviewRumbo?: number;
  readonly nota?: string;
};

/** Un local con pin, para la pantalla de revisión de pines. */
export type LocalConPin = {
  readonly id: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat: number;
  readonly lng: number;
  readonly pinFuente?: FuentePin;
  readonly pinVerificacion?: 'persona' | 'entregas';
  readonly verificadoEn?: Date;
};

export type CambiosLocal = {
  readonly nota?: string;
  readonly streetviewRumbo?: number;
  readonly fotoPath?: string;
  /** Quién subió la foto y cuándo (para que el admin la revise). */
  readonly fotoPor?: string;
  readonly fotoEn?: Date;
  readonly pin?: { readonly lat: number; readonly lng: number; readonly estado: EstadoPin; readonly fuente: FuentePin };
};

/** Una fila de la exportación de datos: un local con los datos de su cliente. */
export type FilaExportacion = {
  readonly localId: string;
  readonly clienteId: string;
  readonly razonSocial: string;
  readonly rut?: string;
  readonly giro?: string;
  readonly estadoCliente: 'nuevo' | 'activo' | 'inactivo' | 'cerrado' | 'archivado';
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly pinEstado: EstadoPin;
  readonly pinFuente?: FuentePin;
  readonly pinConfianza?: number;
  readonly nota?: string;
  readonly tieneFoto: boolean;
  readonly creadoEn: string;
};

export type FiltroExportacion = {
  readonly comunas?: readonly string[];
  /** con: tiene pin · sin: no tiene · aproximado: el pin lo halló el buscador con poca precisión. */
  readonly pin?: 'con' | 'sin' | 'aproximado';
  readonly foto?: 'con' | 'sin';
  readonly texto?: string;
};

/** Una fila de la sección «Locales»: todo lo que se ve y se edita de un local, con lo entregado por él. */
export type LocalParaLista = {
  readonly localId: string;
  readonly clienteId: string;
  readonly razonSocial: string;
  readonly rut?: string;
  readonly giro?: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly pinFuente?: FuentePin;
  readonly pinVerificado: boolean;
  readonly pinVerificacion?: 'persona' | 'entregas';
  readonly nota?: string;
  readonly streetviewRumbo?: number;
  readonly tieneFoto: boolean;
  /** Facturas ya entregadas a este local. */
  readonly entregas: number;
};

export type ResumenComuna = { readonly comuna: string; readonly total: number; readonly verificados: number; readonly sinPin: number };

/** `null` borra el dato (RUT o giro); sin la clave, no se toca. */
export type CambiosCliente = { readonly razonSocial?: string; readonly rut?: string | null; readonly giro?: string | null };

export type LocalSinPin = { readonly id: string; readonly direccion: string; readonly comuna: string };

export interface ClienteRepository {
  buscar(empresaId: string, consulta: ConsultaBusqueda): Promise<readonly ResultadoBusqueda[]>;
  /**
   * Crea el cliente con su local. Si ya existe el mismo cliente con esa dirección (por ejemplo cargado antes e incompleto), NO se rechaza:
   * se completa con lo que le faltaba (RUT, giro, nota, pin) sin pisar lo que ya tiene, y se devuelve el existente (`existente: true`).
   */
  crearConLocal(empresaId: string, datos: NuevoClienteConLocal): Promise<Result<{ clienteId: string; localId: string; existente: boolean }, 'DUPLICADO'>>;
  /** Cada cliente y cada local del lote vienen una sola vez (el caso de uso los consolida antes). */
  importar(empresaId: string, clientes: readonly ClienteImportable[]): Promise<ResumenImportacion>;
  obtenerLocal(empresaId: string, localId: string): Promise<LocalDetalle | undefined>;
  /** Devuelve false si el local no existe en esa empresa. */
  actualizarLocal(empresaId: string, localId: string, cambios: CambiosLocal): Promise<boolean>;
  /** Colaborativo: fija el pin solo si el local todavía no tiene (como «sugerido», fuente chofer). Devuelve si lo fijó. */
  fijarPinSiFalta(empresaId: string, localId: string, lat: number, lng: number): Promise<boolean>;
  /**
   * El lugar donde se entrega manda sobre el pin que hay, mientras el pin no esté verificado: lo deja en `punto` («sugerido», fuente chofer).
   * Devuelve si lo movió (no lo mueve si está verificado o si ya está a menos de ~10 m).
   */
  ajustarPinPorEntrega(empresaId: string, localId: string, punto: { readonly lat: number; readonly lng: number }): Promise<boolean>;
  /**
   * Marca (o, sin `verificacion`, desmarca) el pin del local como verificado por una persona.
   * `SIN_PIN`: no hay nada que verificar. `NO_ENCONTRADO`: el local no existe.
   */
  verificarPin(empresaId: string, localId: string, verificacion: { readonly por: string; readonly en: Date } | undefined): Promise<'OK' | 'SIN_PIN' | 'NO_ENCONTRADO'>;
  /**
   * Las entregas confirmaron el pin: queda verificado sin que lo mire nadie (no se mueve solo). Solo si tiene pin y todavía no está verificado.
   * Devuelve si lo verificó.
   */
  verificarPinPorEntregas(empresaId: string, localId: string, en: Date): Promise<boolean>;
  /** Locales con pin para revisar: los «por verificar» (en orden de comuna) o los «verificados» (los más recientes primero), hasta `limite`. */
  listarPinesParaRevisar(empresaId: string, estado: 'por_verificar' | 'verificados', limite: number): Promise<readonly LocalConPin[]>;
  /** Cuántos locales tienen pin verificado, pin por verificar y ningún pin. */
  contarPines(empresaId: string): Promise<{ readonly verificados: number; readonly porVerificar: number; readonly sinPin: number }>;
  /** Locales sin pin a los que todavía no se les buscó la dirección (o cuya última búsqueda fue antes de `intentadosAntesDe`). */
  /** Los locales de la empresa con los datos de su cliente, en orden de comuna y nombre (hasta `limite`). */
  exportarLocales(empresaId: string, filtro: FiltroExportacion, limite: number): Promise<readonly FilaExportacion[]>;
  /** Corrige datos del cliente (razón social, RUT, giro). `RUT_DUPLICADO`: ya hay otro cliente con ese RUT. */
  corregirCliente(empresaId: string, clienteId: string, cambios: CambiosCliente): Promise<'OK' | 'NO_ENCONTRADO' | 'RUT_DUPLICADO'>;
  /**
   * Corrige la dirección y la comuna del local. `DUPLICADO`: ese cliente ya tiene un local con esa dirección. Si el pin lo había puesto el
   * buscador por la dirección anterior y nadie lo verificó, se borra para que se busque de nuevo con la dirección corregida.
   */
  corregirDireccion(empresaId: string, localId: string, datos: { readonly direccion: string; readonly comuna: string }): Promise<'OK' | 'NO_ENCONTRADO' | 'DUPLICADO'>;
  /** Locales con los datos de su cliente y lo entregado, primero los de pin por verificar; `total` cuenta todos los que cumplen el filtro. */
  listarLocales(empresaId: string, filtro: { readonly comuna?: string; readonly texto?: string }, limite: number): Promise<{ readonly total: number; readonly locales: readonly LocalParaLista[] }>;
  /** Por comuna: cuántos locales hay, cuántos con pin verificado y cuántos sin pin. */
  resumenPorComuna(empresaId: string): Promise<readonly ResumenComuna[]>;
  /**
   * Elimina la dirección equivocada con sus facturas pendientes, y el cliente si se queda sin direcciones. Si la dirección ya tiene entregas
   * hechas no se toca nada (`CON_ENTREGAS`): el historial no se borra.
   */
  eliminarLocal(empresaId: string, localId: string): Promise<'ELIMINADO' | 'NO_ENCONTRADO' | 'CON_ENTREGAS'>;
  /** Deja el local sin foto (y sin verificación). Devuelve true si el local existe en esa empresa. */
  quitarFoto(empresaId: string, localId: string): Promise<boolean>;
  /**
   * Marca (o, sin `verificacion`, desmarca) como verificada la foto `fotoPath` del local. Devuelve false si el local ya no tiene esa foto
   * (la cambiaron o la quitaron): nunca se verifica una foto distinta de la que el admin vio. Cambiar la foto borra la verificación.
   */
  marcarFotoVerificada(empresaId: string, localId: string, fotoPath: string, verificacion: { readonly por: string; readonly en: Date } | undefined): Promise<boolean>;
  localesSinPin(empresaId: string, limite: number, intentadosAntesDe: Date): Promise<readonly LocalSinPin[]>;
  contarLocalesSinPin(empresaId: string): Promise<number>;
  /** Anota que se buscó la dirección de este local (con o sin éxito), para no repetir la búsqueda cada vez. */
  marcarIntentoGeocodificacion(empresaId: string, localId: string, ahora: Date): Promise<void>;
  /** Pin hallado por la dirección («sugerido», fuente geocodificador). Solo si el local no tiene un pin mejor. Devuelve si lo fijó. */
  fijarPinGeocodificado(empresaId: string, localId: string, lat: number, lng: number, confianza: number): Promise<boolean>;
}
