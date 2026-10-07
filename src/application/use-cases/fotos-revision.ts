import { validarReporteFoto, type ReporteFotoCrudo } from '../../domain/entidades/foto-reporte.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { AlmacenArchivos } from '../ports/out/archivos.js';
import type { Clock } from '../ports/out/clock.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { FotoReporteRepository, FotoSubida, FotoVerificada, ReporteFoto } from '../ports/out/fotos.js';

const MAX_REPORTADAS = 100;
const MAX_POR_VERIFICAR = 100;
const MAX_VERIFICADAS = 30;

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

/**
 * Lo que el admin revisa: las fotos reportadas y las subidas en dos listas, las que faltan por verificar (con quién y cuándo las subió)
 * y las que ya verificó. Verificar una foto la saca de «por verificar», así cada día solo se mira lo nuevo.
 */
export const crearFotosParaRevision = ({ reportes }: { reportes: FotoReporteRepository }) =>
  async (actor: Usuario): Promise<{ readonly reportadas: readonly ReporteFoto[]; readonly porVerificar: readonly FotoSubida[]; readonly verificadas: readonly FotoVerificada[] }> => {
    const [reportadas, porVerificar, verificadas] = await Promise.all([
      reportes.abiertos(actor.empresaId, MAX_REPORTADAS),
      reportes.porVerificar(actor.empresaId, MAX_POR_VERIFICAR),
      reportes.verificadas(actor.empresaId, MAX_VERIFICADAS),
    ]);
    return { reportadas, porVerificar, verificadas };
  };

/**
 * El admin da por buena la foto que vio (`verificada: true`) o la devuelve a «por verificar». Se identifica por la foto (`fotoPath`), no solo por el
 * local: si mientras tanto la cambiaron, no se verifica una foto que nadie vio (CONFLICTO). Repetir la decisión no falla.
 */
export const crearVerificarFoto = ({ clientes, clock }: { clientes: ClienteRepository; clock: Clock }) =>
  async (actor: Usuario, localId: string, entrada: { readonly fotoPath: string; readonly verificada: boolean }): Promise<Result<void, ErrorApp>> => {
    if (!(await clientes.obtenerLocal(actor.empresaId, localId))) return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
    const aplicada = await clientes.marcarFotoVerificada(actor.empresaId, localId, entrada.fotoPath, entrada.verificada ? { por: actor.id, en: clock.now() } : undefined);
    return aplicada ? ok(undefined) : err(errorApp('CONFLICTO', 'Esa foto cambió o ya no existe. Actualiza la lista para ver la foto actual.'));
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
      // Dejarla es haberla mirado y dado por buena: no vuelve a salir en «por verificar» (si ya cambiaron la foto, no aplica).
      await clientes.marcarFotoVerificada(actor.empresaId, r.localId, r.fotoPath, { por: actor.id, en: ahora });
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
