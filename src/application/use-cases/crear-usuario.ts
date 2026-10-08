import type { Usuario } from '../../domain/entidades/usuario.js';
import type { Rol } from '../../domain/permisos.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { validarPin } from '../../domain/valor/pin.js';
import { generarUsername } from '../../domain/valor/username.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ProveedorIdentidad } from '../ports/out/identidad.js';
import type { UsuarioRepository } from '../ports/out/usuarios.js';
import { correoDe } from './iniciar-sesion.js';

export type EntradaCrearUsuario = {
  readonly nombre: string;
  readonly apellidoPaterno: string;
  readonly apellidoMaterno?: string | undefined;
  readonly rol: Rol;
  readonly pin: string;
};

export const crearCrearUsuario = ({ identidad, usuarios, dominioCorreo }: { identidad: ProveedorIdentidad; usuarios: UsuarioRepository; dominioCorreo: string }) =>
  async (actor: Usuario, entrada: EntradaCrearUsuario): Promise<Result<Usuario, ErrorApp>> => {
    const nombre = entrada.nombre.trim();
    const paterno = entrada.apellidoPaterno.trim();
    if (nombre === '' || paterno === '') return err(errorApp('VALIDACION', 'Faltan el nombre o el apellido.'));

    const pin = validarPin(entrada.pin);
    if (!pin.ok) return err(errorApp('VALIDACION', pin.error.mensaje, { codigo: pin.error.codigo }));

    const existentes = await usuarios.usernamesDeEmpresa(actor.empresaId);
    const username = generarUsername(nombre, paterno, entrada.apellidoMaterno?.trim(), existentes);

    const cuenta = await identidad.crearCuenta(correoDe(username, dominioCorreo), pin.value);
    if (!cuenta.ok) {
      switch (cuenta.error.kind) {
        case 'YA_EXISTE':
          return err(errorApp('CONFLICTO', 'Ya existe una cuenta con ese usuario. Intenta de nuevo.'));
        case 'RECHAZADO':
          return err(errorApp('VALIDACION', 'El proveedor de cuentas rechazó los datos.', { detalle: cuenta.error.detalle }));
        default:
          return err(errorApp('SERVICIO_EXTERNO', 'No se pudo crear la cuenta. Intenta de nuevo.'));
      }
    }

    const usuario: Usuario = { id: cuenta.value.usuarioId, empresaId: actor.empresaId, rol: entrada.rol, username, nombre: `${nombre} ${paterno}`, activo: true, editor: false };
    try {
      await usuarios.crear(usuario);
    } catch (e) {
      // No dejar una cuenta huérfana que ocupe el nombre de usuario.
      await identidad.eliminarCuenta(usuario.id);
      throw e;
    }
    return ok(usuario);
  };
