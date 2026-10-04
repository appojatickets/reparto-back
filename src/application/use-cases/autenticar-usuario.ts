import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { Clock } from '../ports/out/clock.js';
import type { ProveedorIdentidad } from '../ports/out/identidad.js';
import type { UsuarioRepository } from '../ports/out/usuarios.js';

export type AutenticarUsuarioDeps = {
  readonly identidad: ProveedorIdentidad;
  readonly usuarios: UsuarioRepository;
  readonly clock: Clock;
  /** Tiempo que se recuerda un token ya verificado (evita una llamada a Supabase y a la base por cada petición). */
  readonly ttlMs?: number;
};

const MAX_ENTRADAS = 500;

/**
 * Token → usuario del sistema. Un usuario desactivado o sin perfil queda fuera aunque su cuenta de Supabase siga
 * viva; por la caché, un cambio de estado tarda como máximo `ttlMs` en notarse.
 */
export const crearAutenticarUsuario = ({ identidad, usuarios, clock, ttlMs = 30_000 }: AutenticarUsuarioDeps) => {
  const cache = new Map<string, { usuario: Usuario; expira: number }>();

  return async (token: string): Promise<Result<Usuario, ErrorApp>> => {
    const ahora = clock.now().getTime();
    const guardado = cache.get(token);
    if (guardado && guardado.expira > ahora) return ok(guardado.usuario);
    cache.delete(token);

    const verificado = await identidad.verificarToken(token);
    if (!verificado.ok) {
      return err(
        verificado.error.kind === 'NO_DISPONIBLE'
          ? errorApp('SERVICIO_EXTERNO', 'No se pudo verificar la sesión. Intenta de nuevo.')
          : errorApp('NO_AUTENTICADO', 'Tu sesión no es válida. Entra de nuevo.'),
      );
    }
    const usuario = await usuarios.porId(verificado.value.usuarioId);
    if (!usuario) return err(errorApp('SIN_PERMISO', 'Tu cuenta no tiene un perfil en el sistema.'));
    if (!usuario.activo) return err(errorApp('USUARIO_INACTIVO', 'Tu cuenta está desactivada. Avisa a administración.'));

    if (cache.size >= MAX_ENTRADAS) cache.clear();
    cache.set(token, { usuario, expira: ahora + ttlMs });
    return ok(usuario);
  };
};
