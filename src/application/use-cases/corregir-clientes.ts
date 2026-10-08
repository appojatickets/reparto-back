import { limpiarTexto } from '../../domain/importacion/fila-cliente.js';
import { normalizarRut, parsearRut } from '../../domain/valor/rut.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { AlmacenArchivos } from '../ports/out/archivos.js';
import type { CambiosCliente, ClienteRepository } from '../ports/out/clientes.js';

const MAX_RAZON_SOCIAL = 200;
const MAX_GIRO = 100;

export type CorreccionCliente = { readonly razonSocial?: string | undefined; readonly rut?: string | undefined; readonly giro?: string | undefined };

/**
 * Corregir los datos del cliente: razón social (error de tipeo), RUT y giro. Un RUT o un giro vacío los borra. Lo puede el admin, el
 * despachador y el chofer o ayudante con permiso de editor.
 */
export const crearCorregirCliente = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, clienteId: string, entrada: CorreccionCliente): Promise<Result<void, ErrorApp>> => {
    const cambios: { -readonly [K in keyof CambiosCliente]: CambiosCliente[K] } = {};

    if (entrada.razonSocial !== undefined) {
      const nombre = limpiarTexto(entrada.razonSocial);
      if (nombre === '') return err(errorApp('VALIDACION', 'Falta la razón social.'));
      if (nombre.length > MAX_RAZON_SOCIAL) return err(errorApp('VALIDACION', `La razón social supera ${MAX_RAZON_SOCIAL} caracteres.`));
      cambios.razonSocial = nombre;
    }
    if (entrada.rut !== undefined) {
      if (limpiarTexto(entrada.rut) === '') cambios.rut = null;
      else {
        const r = parsearRut(entrada.rut);
        if (!r.ok) return err(errorApp('VALIDACION', `RUT inválido: ${r.error.mensaje}`, { codigo: r.error.codigo }));
        cambios.rut = normalizarRut(r.value);
      }
    }
    if (entrada.giro !== undefined) {
      const giro = limpiarTexto(entrada.giro);
      if (giro.length > MAX_GIRO) return err(errorApp('VALIDACION', `El giro supera ${MAX_GIRO} caracteres.`));
      cambios.giro = giro === '' ? null : giro;
    }
    if (Object.keys(cambios).length === 0) return err(errorApp('VALIDACION', 'No hay nada que corregir.'));

    const r = await clientes.corregirCliente(actor.empresaId, clienteId, cambios);
    if (r === 'NO_ENCONTRADO') return err(errorApp('NO_ENCONTRADO', 'El cliente no existe.'));
    if (r === 'RUT_DUPLICADO') return err(errorApp('CONFLICTO', 'Ya existe otro cliente con ese RUT.'));
    return ok(undefined);
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
