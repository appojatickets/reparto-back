import { validarReporteFoto, type ReporteFotoCrudo } from '../../domain/entidades/foto-reporte.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { AlmacenArchivos } from '../ports/out/archivos.js';
import type { Clock } from '../ports/out/clock.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { FotoReciente, FotoReporteRepository, ReporteFoto } from '../ports/out/fotos.js';

const MAX_REPORTADAS = 100;
const MAX_RECIENTES = 30;

/** Cualquiera que ve una foto mal tomada (no es la fachada, se ven personas, borrosa…) la reporta; el admin la revisa. */
export const crearReportarFoto = ({ clientes, reportes }: { clientes: ClienteRepository; reportes: FotoReporteRepository }) =>
  async (actor: Usuario, localId: string, entrada: ReporteFotoCrudo): Promise<Result<void, ErrorApp>> => {
    const v = validarReporteFoto(entrada);
    if (!v.ok) return err(errorApp('VALIDACION', v.error.map((e) => e.mensaje).join(' '), { errores: v.error }));
    const local = await clientes.obtenerLocal(actor.empresaId, localId);
    if (!local?.fotoPath) return err(errorApp('NO_ENCONTRADO', 'El local no tiene foto.'));
    await reportes.crear(actor.empresaId, { localId, fotoPath: local.fotoPath, motivo: v.value.motivo, ...(v.value.detalle !== undefined ? { detalle: v.value.detalle } : {}), reportadoPor: actor.id });
    return ok(undefined);
  };

/** Lo que el admin revisa: las fotos reportadas y las subidas hace poco (con quién y cuándo). */
export const crearFotosParaRevision = ({ reportes }: { reportes: FotoReporteRepository }) =>
  async (actor: Usuario): Promise<{ readonly reportadas: readonly ReporteFoto[]; readonly recientes: readonly FotoReciente[] }> => {
    const [reportadas, recientes] = await Promise.all([reportes.abiertos(actor.empresaId, MAX_REPORTADAS), reportes.recientes(actor.empresaId, MAX_RECIENTES)]);
    return { reportadas, recientes };
  };

/**
 * El admin decide: ELIMINAR (la foto se borra del local y del almacenamiento y se cierran todos los reportes de esa foto) o DEJAR
 * (el reporte se descarta y la foto queda). Repetir la decisión no falla.
 */
export const crearResolverReporteFoto = ({ clientes, reportes, almacen, clock }: { clientes: ClienteRepository; reportes: FotoReporteRepository; almacen: AlmacenArchivos; clock: Clock }) =>
  async (actor: Usuario, reporteId: string, accion: 'eliminar' | 'descartar'): Promise<Result<void, ErrorApp>> => {
    const r = await reportes.obtener(actor.empresaId, reporteId);
    if (!r) return err(errorApp('NO_ENCONTRADO', 'El reporte no existe.'));
    if (!r.abierto) return ok(undefined);
    const ahora = clock.now();
    if (accion === 'descartar') {
      await reportes.resolver(actor.empresaId, r.id, actor.id, 'descartada', ahora);
      return ok(undefined);
    }
    const local = await clientes.obtenerLocal(actor.empresaId, r.localId);
    if (local?.fotoPath === r.fotoPath) {
      await clientes.quitarFoto(actor.empresaId, r.localId);
      await almacen.eliminar(r.fotoPath);
    }
    await reportes.resolverDeFoto(actor.empresaId, r.localId, r.fotoPath, actor.id, ahora);
    return ok(undefined);
  };
