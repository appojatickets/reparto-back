import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { Clock } from '../ports/out/clock.js';

/**
 * Una persona confirma que el pin del local está bien: desde ahí ya no se mueve solo con las entregas. Sin verificar queda «por verificar»
 * y cada ENTREGADO con buen GPS lo va ajustando. Se puede quitar la verificación para que vuelva a ajustarse.
 */
export const crearVerificarPin = ({ clientes, clock }: { clientes: ClienteRepository; clock: Clock }) =>
  async (actor: Usuario, localId: string, verificado: boolean): Promise<Result<void, ErrorApp>> => {
    const r = await clientes.verificarPin(actor.empresaId, localId, verificado ? { por: actor.id, en: clock.now() } : undefined);
    if (r === 'NO_ENCONTRADO') return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
    if (r === 'SIN_PIN') return err(errorApp('CONFLICTO', 'Este local todavía no tiene pin: no hay nada que verificar.'));
    return ok(undefined);
  };
