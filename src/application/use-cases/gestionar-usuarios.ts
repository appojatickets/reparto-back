import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { validarPin } from '../../domain/valor/pin.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ProveedorIdentidad } from '../ports/out/identidad.js';
import type { IntentosLoginRepository, UsuarioRepository } from '../ports/out/usuarios.js';

export const crearListarUsuarios = ({ usuarios }: { usuarios: UsuarioRepository }) =>
  (actor: Usuario): Promise<readonly Usuario[]> => usuarios.listar(actor.empresaId);

const enEmpresa = async (usuarios: UsuarioRepository, actor: Usuario, id: string): Promise<Usuario | undefined> => {
  const u = await usuarios.porId(id);
  return u?.empresaId === actor.empresaId ? u : undefined;
};

export const crearResetearPin = ({ identidad, usuarios, intentos }: { identidad: ProveedorIdentidad; usuarios: UsuarioRepository; intentos: IntentosLoginRepository }) =>
  async (actor: Usuario, usuarioId: string, pinNuevo: string): Promise<Result<void, ErrorApp>> => {
    const pin = validarPin(pinNuevo);
    if (!pin.ok) return err(errorApp('VALIDACION', pin.error.mensaje, { codigo: pin.error.codigo }));
    const objetivo = await enEmpresa(usuarios, actor, usuarioId);
    if (!objetivo) return err(errorApp('NO_ENCONTRADO', 'El usuario no existe.'));

    const r = await identidad.cambiarClave(objetivo.id, pin.value);
    if (!r.ok) return err(errorApp('SERVICIO_EXTERNO', 'No se pudo cambiar la clave. Intenta de nuevo.'));
    await intentos.reiniciar(objetivo.id); // también levanta un bloqueo por intentos fallidos
    return ok(undefined);
  };

export const crearCambiarEstadoUsuario = ({ usuarios }: { usuarios: UsuarioRepository }) =>
  async (actor: Usuario, usuarioId: string, activo: boolean): Promise<Result<void, ErrorApp>> => {
    if (usuarioId === actor.id && !activo) return err(errorApp('VALIDACION', 'No puedes desactivar tu propia cuenta.'));
    const existe = await usuarios.cambiarActivo(actor.empresaId, usuarioId, activo);
    return existe ? ok(undefined) : err(errorApp('NO_ENCONTRADO', 'El usuario no existe.'));
  };
