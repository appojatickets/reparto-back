import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { AlmacenArchivos } from '../ports/out/archivos.js';
import type { Clock } from '../ports/out/clock.js';
import type { IdGenerator } from '../ports/out/id-generator.js';
import type { UsuarioRepository } from '../ports/out/usuarios.js';
import type { TipoFoto } from './archivos.js';

const SEGUNDOS_LECTURA = 300;

/** Dónde vive la foto de perfil de alguien: `{empresa}/perfil/{usuario}/{uuid}.{ext}`. Empresa y usuario salen del servidor, nunca del cliente. */
const patronPath = (actor: Usuario): RegExp => new RegExp(`^${actor.empresaId}/perfil/${actor.id}/[0-9a-f-]{36}\\.(webp|jpeg)$`);

/** Cada persona sube su propia foto: la API solo entrega la URL firmada y el navegador sube directo al almacenamiento. */
export const crearSolicitarUrlSubidaPerfil = ({ almacen, ids }: { almacen: AlmacenArchivos; ids: IdGenerator }) =>
  async (actor: Usuario, entrada: { tipo: TipoFoto }): Promise<Result<{ path: string; url: string }, ErrorApp>> => {
    const path = `${actor.empresaId}/perfil/${actor.id}/${ids.uuid()}.${entrada.tipo}`;
    const r = await almacen.crearUrlSubida(path);
    return r.ok ? ok({ path, url: r.value.url }) : err(errorApp('SERVICIO_EXTERNO', 'No se pudo preparar la subida. Intenta de nuevo.'));
  };

/** Después de subir, el cliente avisa el path; solo se acepta uno de la carpeta de esta persona. La foto anterior se borra. */
export const crearRegistrarFotoPerfil = ({ usuarios, almacen, clock }: { usuarios: UsuarioRepository; almacen: AlmacenArchivos; clock: Clock }) =>
  async (actor: Usuario, path: string): Promise<Result<void, ErrorApp>> => {
    if (!patronPath(actor).test(path)) return err(errorApp('VALIDACION', 'La ruta de la foto no es válida.'));
    const anterior = (await usuarios.porId(actor.id))?.fotoPath;
    const existe = await usuarios.cambiarFoto(actor.empresaId, actor.id, { path, en: clock.now() });
    if (!existe) return err(errorApp('NO_ENCONTRADO', 'El usuario no existe.'));
    // Si falla el borrado no importa: la nueva ya quedó.
    if (anterior !== undefined && anterior !== path) await almacen.eliminar(anterior);
    return ok(undefined);
  };

/** Quita la foto de perfil de quien la pide y borra el archivo. Repetirlo no falla. */
export const crearQuitarFotoPerfil = ({ usuarios, almacen }: { usuarios: UsuarioRepository; almacen: AlmacenArchivos }) =>
  async (actor: Usuario): Promise<Result<void, ErrorApp>> => {
    const anterior = (await usuarios.porId(actor.id))?.fotoPath;
    if (anterior === undefined) return ok(undefined);
    await usuarios.cambiarFoto(actor.empresaId, actor.id, undefined);
    await almacen.eliminar(anterior);
    return ok(undefined);
  };

/** La foto de cualquier persona de la misma empresa, con una URL firmada de pocos minutos. */
export const crearObtenerUrlFotoUsuario = ({ usuarios, almacen }: { usuarios: UsuarioRepository; almacen: AlmacenArchivos }) =>
  async (actor: Usuario, usuarioId: string): Promise<Result<{ url: string; expiraEnSegundos: number }, ErrorApp>> => {
    const u = await usuarios.porId(usuarioId);
    if (u?.empresaId !== actor.empresaId || u.fotoPath === undefined) return err(errorApp('NO_ENCONTRADO', 'Esa persona no tiene foto.'));
    const r = await almacen.crearUrlLectura(u.fotoPath, SEGUNDOS_LECTURA);
    return r.ok ? ok({ url: r.value.url, expiraEnSegundos: SEGUNDOS_LECTURA }) : err(errorApp('SERVICIO_EXTERNO', 'No se pudo obtener la foto.'));
  };
