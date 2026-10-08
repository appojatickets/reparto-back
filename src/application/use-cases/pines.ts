import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { EstadoPropuesta, PropuestaPin, PropuestaPinRepository } from '../ports/out/pines.js';

export const crearListarPropuestasPin = ({ pines }: { pines: PropuestaPinRepository }) =>
  (actor: Usuario, estado: EstadoPropuesta, limite = 100): Promise<readonly PropuestaPin[]> =>
    pines.listar(actor.empresaId, estado, Math.min(Math.max(limite, 1), 500));

export const crearResolverPropuestaPin = ({ pines, clock }: { pines: PropuestaPinRepository; clock: { now(): Date } }) =>
  async (actor: Usuario, id: string, accion: 'aceptar' | 'rechazar'): Promise<Result<void, ErrorApp>> => {
    const r = await pines.resolver(actor.empresaId, id, actor.id, accion === 'aceptar', clock.now());
    if (r.ok) return ok(undefined);
    switch (r.error) {
      case 'NO_ENCONTRADA':
        return err(errorApp('NO_ENCONTRADO', 'La propuesta no existe.'));
      case 'YA_RESUELTA':
        return err(errorApp('CONFLICTO', 'La propuesta ya fue resuelta.'));
      case 'SIN_LOCAL':
        return err(errorApp('VALIDACION', 'La propuesta no corresponde a ningún local; no se puede aceptar.'));
    }
  };
