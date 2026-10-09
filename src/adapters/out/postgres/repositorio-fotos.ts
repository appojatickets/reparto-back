import type { MotivoReporteFoto } from '../../../domain/entidades/foto-reporte.js';
import type { FotoReporteRepository, FotoSubida, FotoVerificada, ReporteFoto, ResolucionReporte } from '../../../application/ports/out/fotos.js';
import type { Db } from './client.js';

type FilaSubida = { local_id: string; razon_social: string; direccion: string; comuna: string; subida_por: string | null; foto_en: Date | null };

const fotoSubida = (f: FilaSubida, fotoPath: string): FotoSubida => ({
  localId: f.local_id,
  fotoPath,
  razonSocial: f.razon_social,
  direccion: f.direccion,
  comuna: f.comuna,
  ...(f.subida_por !== null ? { subidaPor: f.subida_por } : {}),
  ...(f.foto_en !== null ? { subidaEn: f.foto_en } : {}),
});

export class PostgresFotoReporteRepository implements FotoReporteRepository {
  constructor(private readonly db: Db) {}

  async crear(empresaId: string, r: { localId: string; fotoPath: string; motivo: MotivoReporteFoto; detalle?: string; reportadoPor: string }): Promise<void> {
    await this.db
      .insertInto('foto_reporte')
      .values({ empresa_id: empresaId, local_id: r.localId, foto_path: r.fotoPath, motivo: r.motivo, detalle: r.detalle ?? null, reportado_por: r.reportadoPor })
      .onConflict((oc) => oc.columns(['local_id', 'foto_path', 'reportado_por']).where('resuelto_en', 'is', null).doNothing())
      .execute();
  }

  async abiertos(empresaId: string, limite: number): Promise<readonly ReporteFoto[]> {
    const filas = await this.db
      .selectFrom('foto_reporte as r')
      .innerJoin('local as l', 'l.id', 'r.local_id')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .leftJoin('usuario as ur', 'ur.id', 'r.reportado_por')
      .leftJoin('usuario as us', 'us.id', 'l.foto_por')
      .select(['r.id', 'r.local_id', 'c.razon_social', 'l.direccion', 'l.comuna', 'r.motivo', 'r.detalle', 'ur.nombre as reportado_por', 'r.creado_en', 'us.nombre as subida_por', 'l.foto_en', 'l.foto_path as foto_actual', 'r.foto_path'])
      .where('r.empresa_id', '=', empresaId)
      .where('r.resuelto_en', 'is', null)
      .orderBy('r.creado_en', 'desc')
      .limit(limite)
      .execute();
    return filas.map((f) => ({
      id: f.id,
      localId: f.local_id,
      razonSocial: f.razon_social,
      direccion: f.direccion,
      comuna: f.comuna,
      motivo: f.motivo,
      ...(f.detalle !== null ? { detalle: f.detalle } : {}),
      ...(f.reportado_por !== null ? { reportadoPor: f.reportado_por } : {}),
      reportadoEn: f.creado_en,
      fotoReemplazada: f.foto_actual !== f.foto_path,
      // Quién subió la foto del local solo cuenta mientras sea la reportada: si ya la cambiaron, es de otra foto.
      ...(f.foto_actual === f.foto_path && f.subida_por !== null ? { subidaPor: f.subida_por } : {}),
      ...(f.foto_actual === f.foto_path && f.foto_en !== null ? { subidaEn: f.foto_en } : {}),
    }));
  }

  async porVerificar(empresaId: string, limite: number): Promise<readonly FotoSubida[]> {
    const filas = await this.db
      .selectFrom('local as l')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .leftJoin('usuario as us', 'us.id', 'l.foto_por')
      .select(['l.id as local_id', 'l.foto_path', 'c.razon_social', 'l.direccion', 'l.comuna', 'us.nombre as subida_por', 'l.foto_en'])
      .where('l.empresa_id', '=', empresaId)
      .where('l.foto_path', 'is not', null)
      .where('l.foto_verificada_en', 'is', null)
      .orderBy('l.foto_en', (ob) => ob.desc().nullsLast())
      .orderBy('l.id')
      .limit(limite)
      .execute();
    return filas.flatMap((f) => (f.foto_path === null ? [] : [fotoSubida(f, f.foto_path)]));
  }

  async verificadas(empresaId: string, limite: number): Promise<readonly FotoVerificada[]> {
    const filas = await this.db
      .selectFrom('local as l')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .leftJoin('usuario as us', 'us.id', 'l.foto_por')
      .leftJoin('usuario as uv', 'uv.id', 'l.foto_verificada_por')
      .select(['l.id as local_id', 'l.foto_path', 'c.razon_social', 'l.direccion', 'l.comuna', 'us.nombre as subida_por', 'l.foto_en', 'uv.nombre as verificada_por', 'l.foto_verificada_en'])
      .where('l.empresa_id', '=', empresaId)
      .where('l.foto_path', 'is not', null)
      .where('l.foto_verificada_en', 'is not', null)
      .orderBy('l.foto_verificada_en', 'desc')
      .orderBy('l.id')
      .limit(limite)
      .execute();
    return filas.flatMap((f) =>
      f.foto_path === null || f.foto_verificada_en === null ? [] : [{ ...fotoSubida(f, f.foto_path), ...(f.verificada_por !== null ? { verificadaPor: f.verificada_por } : {}), verificadaEn: f.foto_verificada_en }],
    );
  }

  async obtener(empresaId: string, id: string): Promise<{ id: string; localId: string; fotoPath: string; abierto: boolean } | undefined> {
    const f = await this.db.selectFrom('foto_reporte').select(['id', 'local_id', 'foto_path', 'resuelto_en']).where('id', '=', id).where('empresa_id', '=', empresaId).executeTakeFirst();
    return f && { id: f.id, localId: f.local_id, fotoPath: f.foto_path, abierto: f.resuelto_en === null };
  }

  async resolver(empresaId: string, id: string, usuarioId: string, resolucion: ResolucionReporte, ahora: Date): Promise<void> {
    await this.db.updateTable('foto_reporte').set({ resuelto_en: ahora, resuelto_por: usuarioId, resolucion }).where('id', '=', id).where('empresa_id', '=', empresaId).where('resuelto_en', 'is', null).execute();
  }

  async resolverDeFoto(empresaId: string, localId: string, fotoPath: string, usuarioId: string, ahora: Date): Promise<void> {
    await this.db
      .updateTable('foto_reporte')
      .set({ resuelto_en: ahora, resuelto_por: usuarioId, resolucion: 'eliminada' })
      .where('empresa_id', '=', empresaId)
      .where('local_id', '=', localId)
      .where('foto_path', '=', fotoPath)
      .where('resuelto_en', 'is', null)
      .execute();
  }
}
