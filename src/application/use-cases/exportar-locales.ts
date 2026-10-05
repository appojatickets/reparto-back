import type { Usuario } from '../../domain/entidades/usuario.js';
import { resolverComuna } from '../../domain/comunas.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository, FilaExportacion, FiltroExportacion } from '../ports/out/clientes.js';

export const MAX_FILAS_EXPORTACION = 50_000;

export type EntradaExportacion = {
  readonly comunas?: readonly string[] | undefined;
  readonly pin?: 'con' | 'sin' | 'aproximado' | undefined;
  readonly foto?: 'con' | 'sin' | undefined;
  readonly texto?: string | undefined;
};

/**
 * Exportación de datos del admin: los locales con los datos de su cliente (razón social, RUT, dirección, comuna, pin, foto…), filtrables por
 * comuna, pin, foto y texto. Las columnas que se llevan las elige quien exporta: aquí van todas y la pantalla elige.
 */
export const crearExportarLocales = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, entrada: EntradaExportacion): Promise<Result<{ readonly total: number; readonly filas: readonly FilaExportacion[] }, ErrorApp>> => {
    const comunas = (entrada.comunas ?? []).map((c) => resolverComuna(c));
    if (comunas.some((c) => c === undefined)) return err(errorApp('VALIDACION', 'Hay una comuna que no es de la Región Metropolitana.'));
    const filtro: FiltroExportacion = {
      ...(comunas.length > 0 ? { comunas: comunas.filter((c): c is string => c !== undefined) } : {}),
      ...(entrada.pin !== undefined ? { pin: entrada.pin } : {}),
      ...(entrada.foto !== undefined ? { foto: entrada.foto } : {}),
      ...(entrada.texto !== undefined && entrada.texto.trim() !== '' ? { texto: entrada.texto.trim() } : {}),
    };
    const filas = await clientes.exportarLocales(actor.empresaId, filtro, MAX_FILAS_EXPORTACION);
    return ok({ total: filas.length, filas });
  };
