import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository, LocalDetalle } from '../ports/out/clientes.js';

export const crearObtenerLocal = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, localId: string): Promise<Result<LocalDetalle, ErrorApp>> => {
    const local = await clientes.obtenerLocal(actor.empresaId, localId);
    return local ? ok(local) : err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
  };
