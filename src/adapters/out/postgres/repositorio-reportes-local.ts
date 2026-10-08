import type { TipoReporteLocal } from '../../../domain/entidades/reporte-local.js';
import type { ReporteLocal, ReporteLocalRepository, ResolucionReporteLocal } from '../../../application/ports/out/reportes-local.js';
import type { Db } from './client.js';

/** Dos coordenadas son «la misma» si difieren menos de ~1 m. */
const igual = (a: number | null, b: number | null): boolean => (a === null || b === null ? a === b : Math.abs(a - b) < 0.00001);

export class PostgresReporteLocalRepository implements ReporteLocalRepository {
  constructor(private readonly db: Db) {}

  async crear(empresaId: string, r: { localId: string; tipo: TipoReporteLocal; detalle?: string; sugerido?: string; reportadoPor: string }): Promise<void> {
    const l = await this.db
      .selectFrom('local as l')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .select(['c.razon_social', 'l.lat', 'l.lng'])
      .where('l.id', '=', r.localId)
      .where('l.empresa_id', '=', empresaId)
      .executeTakeFirst();
    if (!l) return;
    await this.db
      .insertInto('reporte_local')
      .values({
        empresa_id: empresaId, local_id: r.localId, tipo: r.tipo, detalle: r.detalle ?? null, sugerido: r.sugerido ?? null,
        razon_social_al_reportar: l.razon_social, lat_al_reportar: l.lat, lng_al_reportar: l.lng, reportado_por: r.reportadoPor,
      })
      .onConflict((oc) => oc.columns(['local_id', 'tipo', 'reportado_por']).where('resuelto_en', 'is', null).doNothing())
      .execute();
  }

  async abiertos(empresaId: string, limite: number): Promise<readonly ReporteLocal[]> {
    const filas = await this.db
      .selectFrom('reporte_local as r')
      .innerJoin('local as l', 'l.id', 'r.local_id')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .leftJoin('usuario as u', 'u.id', 'r.reportado_por')
      .select(['r.id', 'r.tipo', 'r.local_id', 'c.razon_social', 'l.direccion', 'l.comuna', 'l.lat', 'l.lng', 'r.detalle', 'r.sugerido', 'u.nombre as reportado_por', 'r.creado_en', 'r.razon_social_al_reportar', 'r.lat_al_reportar', 'r.lng_al_reportar'])
      .where('r.empresa_id', '=', empresaId)
      .where('r.resuelto_en', 'is', null)
      .orderBy('r.creado_en', 'desc')
      .limit(limite)
      .execute();
    return filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      localId: f.local_id,
      razonSocial: f.razon_social,
      direccion: f.direccion,
      comuna: f.comuna,
      ...(f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng } : {}),
      ...(f.detalle !== null ? { detalle: f.detalle } : {}),
      ...(f.sugerido !== null ? { sugerido: f.sugerido } : {}),
      ...(f.reportado_por !== null ? { reportadoPor: f.reportado_por } : {}),
      reportadoEn: f.creado_en,
      cambioDesdeElReporte: f.tipo === 'nombre' ? f.razon_social !== f.razon_social_al_reportar : !igual(f.lat, f.lat_al_reportar) || !igual(f.lng, f.lng_al_reportar),
    }));
  }

  async obtener(empresaId: string, id: string): Promise<{ id: string; localId: string; tipo: TipoReporteLocal; abierto: boolean } | undefined> {
    const f = await this.db.selectFrom('reporte_local').select(['id', 'local_id', 'tipo', 'resuelto_en']).where('id', '=', id).where('empresa_id', '=', empresaId).executeTakeFirst();
    return f ? { id: f.id, localId: f.local_id, tipo: f.tipo, abierto: f.resuelto_en === null } : undefined;
  }

  async resolver(empresaId: string, id: string, usuarioId: string, resolucion: ResolucionReporteLocal, ahora: Date): Promise<void> {
    await this.db.updateTable('reporte_local').set({ resuelto_en: ahora, resuelto_por: usuarioId, resolucion }).where('id', '=', id).where('empresa_id', '=', empresaId).where('resuelto_en', 'is', null).execute();
  }
}
