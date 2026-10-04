import type { Usuario } from '../../domain/entidades/usuario.js';
import {
  agruparPorCliente,
  consolidarFilas,
  validarFilaCliente,
  type FilaClienteCruda,
  type FilaClienteValida,
} from '../../domain/importacion/fila-cliente.js';
import type { ErrorDominio } from '../../domain/shared/errores.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository, ResumenImportacion } from '../ports/out/clientes.js';

export const MAX_FILAS_IMPORTACION = 1000;

export type ErrorFila = { readonly fila: number; readonly errores: readonly ErrorDominio[] };
export type ResultadoImportacion = { readonly totalFilas: number; readonly validas: number; readonly errores: readonly ErrorFila[]; readonly resumen: ResumenImportacion };

/**
 * Importación desde planilla, por lotes (el front manda hasta 1.000 filas por vez). Las filas inválidas no detienen
 * el lote: se informan con su número (la fila 1 es la primera de datos). Reimportar es seguro: actualiza sin duplicar.
 */
export const crearImportarClientes = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, filas: readonly FilaClienteCruda[]): Promise<Result<ResultadoImportacion, ErrorApp>> => {
    if (filas.length === 0) return err(errorApp('VALIDACION', 'No hay filas para importar.'));
    if (filas.length > MAX_FILAS_IMPORTACION) {
      return err(errorApp('VALIDACION', `Máximo ${MAX_FILAS_IMPORTACION} filas por lote.`));
    }

    const validas: FilaClienteValida[] = [];
    const errores: ErrorFila[] = [];
    filas.forEach((cruda, i) => {
      const r = validarFilaCliente(cruda);
      if (r.ok) validas.push(r.value);
      else errores.push({ fila: i + 1, errores: r.error });
    });

    const resumen: ResumenImportacion =
      validas.length === 0
        ? { clientesCreados: 0, clientesActualizados: 0, localesCreados: 0, localesActualizados: 0 }
        : await clientes.importar(actor.empresaId, agruparPorCliente(consolidarFilas(validas)));
    return ok({ totalFilas: filas.length, validas: validas.length, errores, resumen });
  };
