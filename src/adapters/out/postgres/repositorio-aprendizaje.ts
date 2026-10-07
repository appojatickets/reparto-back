import { sql } from 'kysely';
import type { CalidadJornada, EventoObs, ParametroAprendido } from '../../../domain/aprendizaje/analisis.js';
import type { AprendizajeRepository, DatosAnalisis, EjecucionAnalisis, ResumenAnalisis } from '../../../application/ports/out/aprendizaje.js';
import type { Db } from './client.js';

export class PostgresAprendizajeRepository implements AprendizajeRepository {
  constructor(private readonly db: Db) {}

  async empresas(): Promise<readonly string[]> {
    return (await this.db.selectFrom('empresa').select('id').execute()).map((e) => e.id);
  }

  async datosParaAnalizar(empresaId: string, desde: Date): Promise<DatosAnalisis> {
    const fechaDesde = desde.toISOString().slice(0, 10);
    const [eventos, jornadas, resumenes, operaciones, posiciones] = await Promise.all([
      this.db.selectFrom('entrega_evento').selectAll().where('empresa_id', '=', empresaId).where('creado_en', '>=', desde).orderBy('creado_en').execute(),
      this.db.selectFrom('jornada').select(['id', 'camion_id', sql<string>`to_char(fecha_reparto, 'YYYY-MM-DD')`.as('fecha'), 'desde', 'hasta']).where('empresa_id', '=', empresaId).where('desde', '>=', desde).execute(),
      this.db.selectFrom('jornada_resumen').select(['jornada_id', 'camion_id', sql<string>`to_char(fecha_reparto, 'YYYY-MM-DD')`.as('fecha'), 'entregadas', 'no_entregadas', 'duracion_min']).where('empresa_id', '=', empresaId).where('fecha_reparto', '>=', fechaDesde).execute(),
      this.db.selectFrom('ruta_operacion').select(['camion_id', sql<string>`to_char(fecha_reparto, 'YYYY-MM-DD')`.as('fecha'), 'tipo', 'modo', 'orden', 'creado_en']).where('empresa_id', '=', empresaId).where('creado_en', '>=', desde).orderBy('creado_en').execute(),
      this.db.selectFrom('posicion_camion').select(['camion_id', 'lat', 'lng', 'precision_m', 'tomado_en']).where('empresa_id', '=', empresaId).where('tomado_en', '>=', desde).orderBy('tomado_en').execute(),
    ]);
    const localIds = [...new Set(eventos.map((e) => e.local_id))];
    const locales = localIds.length === 0
      ? []
      : await this.db.selectFrom('local as l').select(['l.id', 'l.comuna', 'l.direccion', 'l.lat', 'l.lng', 'l.pin_fuente', 'l.pin_verificado_en']).where('l.empresa_id', '=', empresaId).where('l.id', 'in', localIds).execute();
    return {
      eventos: eventos.map((e): EventoObs => ({
        facturaId: e.factura_id, localId: e.local_id, tipo: e.tipo, creadoEn: e.creado_en,
        ...(e.camion_id !== null ? { camionId: e.camion_id } : {}),
        ...(e.usuario_id !== null ? { usuarioId: e.usuario_id } : {}),
        ...(e.motivo !== null ? { motivo: e.motivo } : {}),
        ...(e.lat !== null && e.lng !== null ? { lat: e.lat, lng: e.lng } : {}),
        ...(e.precision_m !== null ? { precisionM: e.precision_m } : {}),
      })),
      locales: locales.map((l) => ({ id: l.id, comuna: l.comuna, direccion: l.direccion, ...(l.lat !== null && l.lng !== null ? { lat: l.lat, lng: l.lng } : {}), ...(l.pin_fuente !== null ? { pinFuente: l.pin_fuente } : {}), pinVerificado: l.pin_verificado_en !== null })),
      jornadas: jornadas.map((j) => ({ id: j.id, camionId: j.camion_id, fecha: j.fecha, desde: j.desde, ...(j.hasta !== null ? { hasta: j.hasta } : {}) })),
      resumenes: resumenes.map((r) => ({ jornadaId: r.jornada_id, camionId: r.camion_id, fecha: r.fecha, atendidas: r.entregadas + r.no_entregadas, ...(r.duracion_min !== null ? { duracionMin: r.duracion_min } : {}) })),
      posiciones: posiciones.map((p) => ({ camionId: p.camion_id, lat: p.lat, lng: p.lng, ...(p.precision_m !== null ? { precisionM: p.precision_m } : {}), tomadoEn: p.tomado_en })),
      operaciones: operaciones.map((o) => ({ camionId: o.camion_id, fecha: o.fecha, tipo: o.tipo, modo: o.modo, orden: o.orden, creadoEn: o.creado_en })),
    };
  }

  async parametros(empresaId: string): Promise<readonly ParametroAprendido[]> {
    const filas = await this.db.selectFrom('aprendizaje_parametro').selectAll().where('empresa_id', '=', empresaId).execute();
    return filas.map((f): ParametroAprendido => ({ clave: f.clave, ambito: f.ambito, valor: f.valor, muestras: f.muestras, confianza: f.confianza }));
  }

  async guardarParametros(empresaId: string, parametros: readonly ParametroAprendido[], ahora: Date): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('aprendizaje_parametro').where('empresa_id', '=', empresaId).execute();
      if (parametros.length === 0) return;
      await trx.insertInto('aprendizaje_parametro').values(parametros.map((p) => ({ empresa_id: empresaId, clave: p.clave, ambito: p.ambito, valor: p.valor, muestras: p.muestras, confianza: p.confianza, calculado_en: ahora }))).execute();
    });
  }

  async guardarCalidad(empresaId: string, calidad: readonly CalidadJornada[], ahora: Date): Promise<void> {
    for (const q of calidad) {
      await this.db
        .updateTable('jornada_resumen')
        .set({ dist_sugerida_m: q.distSugeridaM, dist_real_m: q.distRealM, inversiones: q.inversiones, analizado_en: ahora })
        .where('empresa_id', '=', empresaId)
        .where('jornada_id', '=', q.jornadaId)
        .execute();
    }
  }

  async registrarEjecucion(empresaId: string, e: EjecucionAnalisis): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.insertInto('aprendizaje_ejecucion').values({ empresa_id: empresaId, iniciado_en: e.iniciadoEn, terminado_en: e.terminadoEn, resumen: JSON.stringify(e.resumen) }).execute();
      // Solo interesan las últimas: se conservan 30.
      await trx
        .deleteFrom('aprendizaje_ejecucion')
        .where('empresa_id', '=', empresaId)
        .where('id', 'not in', trx.selectFrom('aprendizaje_ejecucion').select('id').where('empresa_id', '=', empresaId).orderBy('terminado_en', 'desc').limit(30))
        .execute();
    });
  }

  async ultimaEjecucion(empresaId: string): Promise<EjecucionAnalisis | undefined> {
    const f = await this.db.selectFrom('aprendizaje_ejecucion').selectAll().where('empresa_id', '=', empresaId).orderBy('terminado_en', 'desc').limit(1).executeTakeFirst();
    // Los análisis guardados antes de que existieran algunos campos no los traen.
    return f && { iniciadoEn: f.iniciado_en, terminadoEn: f.terminado_en, resumen: { ...(f.resumen as Partial<ResumenAnalisis>), llegadasDeducidas: (f.resumen as Partial<ResumenAnalisis>).llegadasDeducidas ?? 0, pinesDudosos: (f.resumen as Partial<ResumenAnalisis>).pinesDudosos ?? [] } as ResumenAnalisis };
  }
}
