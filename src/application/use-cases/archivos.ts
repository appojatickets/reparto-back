import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { AlmacenArchivos } from '../ports/out/archivos.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { IdGenerator } from '../ports/out/id-generator.js';

export type TipoFoto = 'webp' | 'jpeg';
const SEGUNDOS_LECTURA = 300;

/** Ruta donde vive una foto: `{empresa}/{local}/{uuid}.{ext}`. La empresa y el local salen del servidor, nunca del cliente. */
const patronPath = (empresaId: string, localId: string): RegExp =>
  new RegExp(`^${empresaId}/${localId}/[0-9a-f-]{36}\\.(webp|jpeg)$`);

export const crearSolicitarUrlSubida = ({ clientes, almacen, ids }: { clientes: ClienteRepository; almacen: AlmacenArchivos; ids: IdGenerator }) =>
  async (actor: Usuario, entrada: { localId: string; tipo: TipoFoto }): Promise<Result<{ path: string; url: string }, ErrorApp>> => {
    const local = await clientes.obtenerLocal(actor.empresaId, entrada.localId);
    if (!local) return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
    const path = `${actor.empresaId}/${local.id}/${ids.uuid()}.${entrada.tipo}`;
    const r = await almacen.crearUrlSubida(path);
    return r.ok ? ok({ path, url: r.value.url }) : err(errorApp('SERVICIO_EXTERNO', 'No se pudo preparar la subida. Intenta de nuevo.'));
  };

/** Después de subir, el cliente avisa el path; solo se acepta uno de este local y de esta empresa. */
export const crearRegistrarFotoLocal = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, localId: string, path: string): Promise<Result<void, ErrorApp>> => {
    if (!patronPath(actor.empresaId, localId).test(path)) return err(errorApp('VALIDACION', 'La ruta de la foto no es válida.'));
    const existe = await clientes.actualizarLocal(actor.empresaId, localId, { fotoPath: path });
    return existe ? ok(undefined) : err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
  };

export const crearObtenerUrlFoto = ({ clientes, almacen }: { clientes: ClienteRepository; almacen: AlmacenArchivos }) =>
  async (actor: Usuario, localId: string): Promise<Result<{ url: string; expiraEnSegundos: number }, ErrorApp>> => {
    const local = await clientes.obtenerLocal(actor.empresaId, localId);
    if (!local?.fotoPath) return err(errorApp('NO_ENCONTRADO', 'El local no tiene foto.'));
    const r = await almacen.crearUrlLectura(local.fotoPath, SEGUNDOS_LECTURA);
    return r.ok ? ok({ url: r.value.url, expiraEnSegundos: SEGUNDOS_LECTURA }) : err(errorApp('SERVICIO_EXTERNO', 'No se pudo obtener la foto.'));
  };
