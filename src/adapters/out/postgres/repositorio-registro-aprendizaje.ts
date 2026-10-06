import { sql } from 'kysely';
import type { OperacionRuta, PuntoPosicion, RegistroAprendizajeRepository, ResumenDeJornada } from '../../../application/ports/out/registro-aprendizaje.js';
import type { Db } from './client.js';

export class PostgresRegistroAprendizajeRepository implements RegistroAprendizajeRepository {
  constructor(private readonly db: Db) {}

  async registrarOperacion(empresaId: string, op: OperacionRuta): Promise<void> {
    await this.db
      .insertInto('ruta_operacion')
      .values({
        empresa_id: empresaId, camion_id: op.camionId, fecha_reparto: op.fecha, usuario_id: op.usuarioId, tipo: op.tipo, factura_id: op.facturaId ?? null,
        modo: op.modo, version: op.version, orden: [...op.orden],
      })
      .execute();
  }

  async registrarPosiciones(empresaId: string, camionId: string, usuarioId: string, puntos: readonly PuntoPosicion[]): Promise<void> {
    if (puntos.length === 0) return;
    await this.db
      .insertInto('posicion_camion')
      .values(puntos.map((p) => ({ empresa_id: empresaId, camion_id: camionId, usuario_id: usuarioId, lat: p.lat, lng: p.lng, precision_m: p.precisionM ?? null, velocidad_ms: p.velocidadMs ?? null, tomado_en: p.tomadoEn })))
      .execute();
  }

  async posicionesDesde(empresaId: string, camionId: string, desde: Date): Promise<readonly PuntoPosicion[]> {
    const filas = await this.db
      .selectFrom('posicion_camion')
      .select(['lat', 'lng', 'precision_m', 'velocidad_ms', 'tomado_en'])
      .where('empresa_id', '=', empresaId)
      .where('camion_id', '=', camionId)
      .where('tomado_en', '>=', desde)
      .orderBy('tomado_en')
      .execute();
    return filas.map((f) => ({ lat: f.lat, lng: f.lng, ...(f.precision_m !== null ? { precisionM: f.precision_m } : {}), ...(f.velocidad_ms !== null ? { velocidadMs: f.velocidad_ms } : {}), tomadoEn: f.tomado_en }));
  }

  async guardarResumenDeJornada(empresaId: string, r: ResumenDeJornada): Promise<void> {
    const valores = {
      empresa_id: empresaId, camion_id: r.camionId, fecha_reparto: r.fecha, paradas: r.paradas, entregadas: r.entregadas, no_entregadas: r.noEntregadas,
      sin_hacer: r.sinHacer, sin_hacer_ids: [...r.sinHacerIds], duracion_min: r.duracionMin,
    };
    await this.db
      .insertInto('jornada_resumen')
      .values({ jornada_id: r.jornadaId, ...valores })
      .onConflict((oc) => oc.column('jornada_id').doUpdateSet({ ...valores, analizado_en: sql<null>`null` }))
      .execute();
  }
}
