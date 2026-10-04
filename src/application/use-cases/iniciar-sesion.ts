import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { Clock } from '../ports/out/clock.js';
import type { ProveedorIdentidad, Sesion } from '../ports/out/identidad.js';
import type { IntentosLoginRepository, UsuarioRepository } from '../ports/out/usuarios.js';

export type IniciarSesionDeps = {
  readonly identidad: ProveedorIdentidad;
  readonly usuarios: UsuarioRepository;
  readonly intentos: IntentosLoginRepository;
  readonly clock: Clock;
  /** Dominio del correo sintético con que se crean las cuentas (`jperez@<dominio>`). */
  readonly dominioCorreo: string;
  readonly maxIntentos?: number;
  readonly bloqueoMinutos?: number;
};

export const correoDe = (username: string, dominio: string): string => `${username}@${dominio}`;

export const crearIniciarSesion = ({ identidad, usuarios, intentos, clock, dominioCorreo, maxIntentos = 5, bloqueoMinutos = 15 }: IniciarSesionDeps) =>
  async (entrada: { username: string; pin: string }): Promise<Result<{ sesion: Sesion; usuario: Usuario }, ErrorApp>> => {
    const username = entrada.username.trim().toLowerCase();
    const credencialesMalas = errorApp('CREDENCIALES_INVALIDAS', 'Usuario o clave incorrectos.');

    // Un usuario que no existe no deja rastro (si no, cualquiera podría llenar la tabla de intentos).
    const usuario = await usuarios.porUsername(username);
    if (!usuario) return err(credencialesMalas);
    if (!usuario.activo) return err(errorApp('USUARIO_INACTIVO', 'Tu cuenta está desactivada. Avisa a administración.'));

    const ahora = clock.now();
    const estado = await intentos.obtener(usuario.id);
    if (estado.bloqueadoHasta && estado.bloqueadoHasta > ahora) {
      const minutos = Math.ceil((estado.bloqueadoHasta.getTime() - ahora.getTime()) / 60_000);
      return err(errorApp('CUENTA_BLOQUEADA', `Cuenta bloqueada por ${minutos} minutos. Avisa a administración.`, { minutos }));
    }

    const r = await identidad.iniciarSesion(correoDe(username, dominioCorreo), entrada.pin);
    if (r.ok) {
      await intentos.reiniciar(usuario.id);
      return ok({ sesion: r.value, usuario });
    }
    if (r.error.kind === 'NO_DISPONIBLE') return err(errorApp('SERVICIO_EXTERNO', 'No se pudo iniciar sesión. Intenta de nuevo.'));

    const nuevo = await intentos.registrarFallo(usuario.id, ahora, maxIntentos, bloqueoMinutos * 60_000);
    if (nuevo.bloqueadoHasta && nuevo.bloqueadoHasta > ahora) {
      return err(errorApp('CUENTA_BLOQUEADA', `Cuenta bloqueada por ${bloqueoMinutos} minutos. Avisa a administración.`, { minutos: bloqueoMinutos }));
    }
    const restantes = Math.max(0, maxIntentos - nuevo.intentos);
    return err(errorApp('CREDENCIALES_INVALIDAS', `Usuario o clave incorrectos. Te quedan ${restantes} intentos.`, { intentosRestantes: restantes }));
  };
