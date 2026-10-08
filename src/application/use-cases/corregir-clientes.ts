import { limpiarTexto } from '../../domain/importacion/fila-cliente.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { AlmacenArchivos } from '../ports/out/archivos.js';
import type { ClienteRepository } from '../ports/out/clientes.js';

const MAX_RAZON_SOCIAL = 200;

/** Corregir un error de tipeo en el nombre del cliente (razón social). Lo puede el admin, el despachador y el chofer o ayudante con permiso de editor. */
export const crearCambiarRazonSocial = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, clienteId: string, razonSocial: string): Promise<Result<void, ErrorApp>> => {
    const nombre = limpiarTexto(razonSocial);
    if (nombre === '') return err(errorApp('VALIDACION', 'Falta la razón social.'));
    if (nombre.length > MAX_RAZON_SOCIAL) return err(errorApp('VALIDACION', `La razón social supera ${MAX_RAZON_SOCIAL} caracteres.`));
    const existe = await clientes.renombrarCliente(actor.empresaId, clienteId, nombre);
    return existe ? ok(undefined) : err(errorApp('NO_ENCONTRADO', 'El cliente no existe.'));
  };

/**
 * Eliminar una dirección cargada por error (con sus facturas pendientes; el cliente también si se queda sin direcciones). Si ya tiene
 * entregas hechas no se puede: se protege el historial. La foto se borra del almacenamiento (si eso falla, la dirección igual queda eliminada).
 */
export const crearEliminarLocal = ({ clientes, almacen }: { clientes: ClienteRepository; almacen: AlmacenArchivos }) =>
  async (actor: Usuario, localId: string): Promise<Result<void, ErrorApp>> => {
    const local = await clientes.obtenerLocal(actor.empresaId, localId);
    if (!local) return err(errorApp('NO_ENCONTRADO', 'La dirección no existe.'));
    const r = await clientes.eliminarLocal(actor.empresaId, localId);
    if (r === 'NO_ENCONTRADO') return err(errorApp('NO_ENCONTRADO', 'La dirección no existe.'));
    if (r === 'CON_ENTREGAS') return err(errorApp('CONFLICTO', 'Esta dirección ya tiene entregas hechas: no se puede eliminar para no perder el historial.'));
    if (local.fotoPath !== undefined) await almacen.eliminar(local.fotoPath);
    return ok(undefined);
  };
