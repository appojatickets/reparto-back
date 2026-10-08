import { validarReporteLocal, type ReporteLocalCrudo, type TipoReporteLocal } from '../../domain/entidades/reporte-local.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { Clock } from '../ports/out/clock.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { FotoReporteRepository, ReporteFoto } from '../ports/out/fotos.js';
import type { ReporteLocal, ReporteLocalRepository } from '../ports/out/reportes-local.js';

const MAX_REPORTES = 200;

/**
 * Cualquiera del equipo reporta que el nombre del cliente o la ubicación (pin) de un local está mal; el admin lo revisa junto con las
 * fotos reportadas. Reportar la ubicación saca al pin de «verificado»: vuelve a «por verificar» y se sigue ajustando con las entregas.
 */
export const crearReportarLocal = ({ clientes, reportes }: { clientes: ClienteRepository; reportes: ReporteLocalRepository }) =>
  async (actor: Usuario, localId: string, entrada: ReporteLocalCrudo): Promise<Result<void, ErrorApp>> => {
    const v = validarReporteLocal(entrada);
    if (!v.ok) return err(errorApp('VALIDACION', v.error.map((e) => e.mensaje).join(' '), { errores: v.error }));
    const local = await clientes.obtenerLocal(actor.empresaId, localId);
    if (!local) return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
    if (v.value.tipo === 'ubicacion' && (local.lat === undefined || local.lng === undefined)) return err(errorApp('CONFLICTO', 'Este local todavía no tiene pin: no hay ubicación que reportar.'));
    await reportes.crear(actor.empresaId, { localId, tipo: v.value.tipo, ...(v.value.detalle !== undefined ? { detalle: v.value.detalle } : {}), ...(v.value.sugerido !== undefined ? { sugerido: v.value.sugerido } : {}), reportadoPor: actor.id });
    if (v.value.tipo === 'ubicacion' && local.pinVerificado) await clientes.verificarPin(actor.empresaId, localId, undefined);
    return ok(undefined);
  };

/** Un reporte, de lo que sea: el admin los ve juntos y ordenados del más nuevo al más antiguo. */
export type ReporteDelLocal = {
  readonly id: string;
  readonly tipo: 'foto' | TipoReporteLocal;
  readonly localId: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  /** Foto: el motivo (no_es_la_fachada, se_ven_personas, borrosa, otra). */
  readonly motivo?: string;
  readonly detalle?: string;
  readonly sugerido?: string;
  readonly reportadoPor?: string;
  readonly reportadoEn: Date;
  /** Foto: ya no es la que se reportó. Nombre o ubicación: ya cambió desde el reporte. */
  readonly yaCambio: boolean;
  readonly subidaPor?: string;
  readonly subidaEn?: Date;
};

const deFoto = (r: ReporteFoto): ReporteDelLocal => ({
  id: r.id, tipo: 'foto', localId: r.localId, razonSocial: r.razonSocial, direccion: r.direccion, comuna: r.comuna, motivo: r.motivo,
  ...(r.detalle !== undefined ? { detalle: r.detalle } : {}),
  ...(r.reportadoPor !== undefined ? { reportadoPor: r.reportadoPor } : {}),
  reportadoEn: r.reportadoEn, yaCambio: r.fotoReemplazada,
  ...(r.subidaPor !== undefined ? { subidaPor: r.subidaPor } : {}),
  ...(r.subidaEn !== undefined ? { subidaEn: r.subidaEn } : {}),
});
const deLocal = (r: ReporteLocal): ReporteDelLocal => ({
  id: r.id, tipo: r.tipo, localId: r.localId, razonSocial: r.razonSocial, direccion: r.direccion, comuna: r.comuna,
  ...(r.lat !== undefined && r.lng !== undefined ? { lat: r.lat, lng: r.lng } : {}),
  ...(r.detalle !== undefined ? { detalle: r.detalle } : {}),
  ...(r.sugerido !== undefined ? { sugerido: r.sugerido } : {}),
  ...(r.reportadoPor !== undefined ? { reportadoPor: r.reportadoPor } : {}),
  reportadoEn: r.reportadoEn, yaCambio: r.cambioDesdeElReporte,
});

/** Todo lo reportado y sin resolver: fotos, nombres y ubicaciones, juntos. */
export const crearVerReportes = ({ fotos, locales }: { fotos: FotoReporteRepository; locales: ReporteLocalRepository }) =>
  async (actor: Usuario): Promise<{ readonly total: number; readonly reportes: readonly ReporteDelLocal[] }> => {
    const [f, l] = await Promise.all([fotos.abiertos(actor.empresaId, MAX_REPORTES), locales.abiertos(actor.empresaId, MAX_REPORTES)]);
    const todos = [...f.map(deFoto), ...l.map(deLocal)].sort((a, b) => b.reportadoEn.getTime() - a.reportadoEn.getTime());
    return { total: todos.length, reportes: todos.slice(0, MAX_REPORTES) };
  };

export type AccionReporteLocal = 'verificar_pin' | 'corregido' | 'descartar';

/**
 * El admin cierra un reporte de nombre o ubicación: «corregido» (ya lo arregló), «descartar» (no hacía falta) o, en la ubicación,
 * «verificar_pin» (el pin está bien: queda verificado y el reporte cerrado). Repetir la decisión no falla.
 */
export const crearResolverReporteLocal = ({ clientes, reportes, clock }: { clientes: ClienteRepository; reportes: ReporteLocalRepository; clock: Clock }) =>
  async (actor: Usuario, reporteId: string, accion: AccionReporteLocal): Promise<Result<void, ErrorApp>> => {
    const r = await reportes.obtener(actor.empresaId, reporteId);
    if (!r) return err(errorApp('NO_ENCONTRADO', 'El reporte no existe.'));
    if (!r.abierto) return ok(undefined);
    const ahora = clock.now();
    if (accion === 'verificar_pin') {
      if (r.tipo !== 'ubicacion') return err(errorApp('VALIDACION', 'Solo se puede verificar el pin de un reporte de ubicación.'));
      const v = await clientes.verificarPin(actor.empresaId, r.localId, { por: actor.id, en: ahora });
      if (v === 'NO_ENCONTRADO') return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
      if (v === 'SIN_PIN') return err(errorApp('CONFLICTO', 'Este local todavía no tiene pin: no hay nada que verificar.'));
    }
    await reportes.resolver(actor.empresaId, reporteId, actor.id, accion === 'descartar' ? 'descartado' : 'corregido', ahora);
    return ok(undefined);
  };
