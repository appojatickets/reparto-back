import type { Usuario } from '../../domain/entidades/usuario.js';
import { validarFilaCliente, type FilaClienteCruda } from '../../domain/importacion/fila-cliente.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository } from '../ports/out/clientes.js';

/**
 * Alta de un cliente con su primer local. Quien lo crea lo deja con el pin validado (puso el pin él mismo);
 * un cliente creado por un despachador queda «nuevo» hasta que el admin lo revise.
 */
export const crearCrearClienteNuevo = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, entrada: FilaClienteCruda): Promise<Result<{ clienteId: string; localId: string }, ErrorApp>> => {
    const fila = validarFilaCliente(entrada);
    if (!fila.ok) return err(errorApp('VALIDACION', 'Hay datos inválidos.', { errores: fila.error }));
    const v = fila.value;
    const conPin = v.lat !== undefined && v.lng !== undefined;

    const r = await clientes.crearConLocal(actor.empresaId, {
      ...(v.rut !== undefined ? { rut: v.rut } : {}),
      razonSocial: v.razonSocial,
      ...(v.giro !== undefined ? { giro: v.giro } : {}),
      estado: actor.rol === 'admin' ? 'activo' : 'nuevo',
      local: {
        direccion: v.direccion,
        comuna: v.comuna,
        ...(conPin ? { lat: v.lat, lng: v.lng, pinFuente: 'manual' as const } : {}),
        ...(v.nota !== undefined ? { nota: v.nota } : {}),
        pinEstado: conPin ? 'validado' : 'pendiente',
      },
    });
    return r.ok ? ok(r.value) : err(errorApp('CONFLICTO', 'Ya existe ese cliente con esa dirección.'));
  };
