import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ProveedorIdentidad, Sesion } from '../ports/out/identidad.js';

export const crearRefrescarSesion = ({ identidad }: { identidad: ProveedorIdentidad }) =>
  async (refreshToken: string): Promise<Result<Sesion, ErrorApp>> => {
    const r = await identidad.refrescarSesion(refreshToken);
    if (r.ok) return ok(r.value);
    return err(
      r.error.kind === 'NO_DISPONIBLE'
        ? errorApp('SERVICIO_EXTERNO', 'No se pudo renovar la sesión. Intenta de nuevo.')
        : errorApp('NO_AUTENTICADO', 'Tu sesión venció. Entra de nuevo.'),
    );
  };
