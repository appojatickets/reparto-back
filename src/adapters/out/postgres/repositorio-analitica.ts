import { sql } from 'kysely';
import type { AnaliticaRepository, CalidadDeRuta, Cobertura, DiaDeTrabajo, EtiquetaLocal } from '../../../application/ports/out/analitica.js';
import type { Db } from './client.js';

const n = (x: unknown): number => Number(x ?? 0);

export class PostgresAnaliticaRepository implements AnaliticaRepository {
  constructor(private readonly db: Db) {}

  async cobertura(empresaId: string, desde: Date): Promise<Cobertura> {
    const [jornadas, avisos, paradas, gps, ops] = await Promise.all([
      this.db.selectFrom('jornada').select([sql<string>`count(*)`.as('total'), sql<string>`count(hasta)`.as('terminadas')]).where('empresa_id', '=', empresaId).where('desde', '>=', desde).executeTakeFirst(),
      this.db.selectFrom('entrega_evento').select([sql<string>`count(*)`.as('total'), sql<string>`count(lat)`.as('con_gps'), sql<string>`count(*) filter (where origen = 'auto')`.as('auto')]).where('empresa_id', '=', empresaId).where('creado_en', '>=', desde).executeTakeFirst(),
      this.db.selectFrom('entrega_evento').select([
        sql<string>`count(distinct factura_id) filter (where tipo = 'llegada')`.as('con_llegada'),
        sql<string>`count(distinct factura_id) filter (where tipo in ('entregado', 'no_entregado'))`.as('resueltas'),
      ]).where('empresa_id', '=', empresaId).where('creado_en', '>=', desde).executeTakeFirst(),
      this.db.selectFrom('posicion_camion').select([sql<string>`count(*)`.as('total'), sql<Date | null>`max(tomado_en)`.as('ultimo')]).where('empresa_id', '=', empresaId).where('tomado_en', '>=', desde).executeTakeFirst(),
      this.db.selectFrom('ruta_operacion').select([sql<string>`count(*)`.as('total'), sql<string>`count(*) filter (where tipo in ('subir', 'bajar', 'mover', 'primero', 'despues', 'quitar'))`.as('manuales')]).where('empresa_id', '=', empresaId).where('creado_en', '>=', desde).executeTakeFirst(),
    ]);
    return {
      jornadas: n(jornadas?.total), jornadasTerminadas: n(jornadas?.terminadas),
      avisos: n(avisos?.total), avisosConGps: n(avisos?.con_gps), avisosAutomaticos: n(avisos?.auto),
      paradasConLlegada: n(paradas?.con_llegada), paradasResueltas: n(paradas?.resueltas),
      puntosGps: n(gps?.total), ...(gps?.ultimo ? { ultimoPuntoGps: new Date(gps.ultimo) } : {}),
      operacionesRuta: n(ops?.total), correccionesManuales: n(ops?.manuales),
    };
  }

  async porDia(empresaId: string, desde: Date): Promise<readonly DiaDeTrabajo[]> {
    const filas = await this.db
      .selectFrom('jornada_resumen')
      .select([sql<string>`to_char(fecha_reparto, 'YYYY-MM-DD')`.as('fecha'), sql<string>`count(*)`.as('jornadas'), sql<string>`sum(entregadas + no_entregadas)`.as('atendidas'), sql<string>`sum(sin_hacer)`.as('sin_hacer')])
      .where('empresa_id', '=', empresaId)
      .where('creado_en', '>=', desde)
      .groupBy('fecha_reparto')
      .orderBy('fecha_reparto', 'desc')
      .limit(30)
      .execute();
    return filas.map((f): DiaDeTrabajo => ({ fecha: f.fecha, jornadas: n(f.jornadas), atendidas: n(f.atendidas), sinHacer: n(f.sin_hacer) }));
  }

  async calidad(empresaId: string, desde: Date, limite: number): Promise<readonly CalidadDeRuta[]> {
    const filas = await this.db
      .selectFrom('jornada_resumen')
      .select([sql<string>`to_char(fecha_reparto, 'YYYY-MM-DD')`.as('fecha'), 'camion_id', 'dist_sugerida_m', 'dist_real_m', 'inversiones'])
      .where('empresa_id', '=', empresaId)
      .where('creado_en', '>=', desde)
      .where('dist_sugerida_m', 'is not', null)
      .orderBy('fecha_reparto', 'desc')
      .limit(limite)
      .execute();
    return filas.flatMap((f) => (f.dist_sugerida_m !== null && f.dist_real_m !== null && f.inversiones !== null ? [{ fecha: f.fecha, camionId: f.camion_id, distSugeridaM: f.dist_sugerida_m, distRealM: f.dist_real_m, inversiones: f.inversiones }] : []));
  }

  async etiquetasDeLocales(empresaId: string, ids: readonly string[]): Promise<ReadonlyMap<string, EtiquetaLocal>> {
    if (ids.length === 0) return new Map();
    const filas = await this.db
      .selectFrom('local as l')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .select(['l.id', 'c.razon_social', 'l.direccion', 'l.comuna'])
      .where('l.empresa_id', '=', empresaId)
      .where('l.id', 'in', [...ids])
      .execute();
    return new Map(filas.map((f) => [f.id, { razonSocial: f.razon_social, direccion: f.direccion, comuna: f.comuna }]));
  }
}
