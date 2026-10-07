import { sql } from 'kysely';
import type { EntregaRepository, NuevoEvento, PosicionConocida } from '../../../application/ports/out/entregas.js';
import type { Db } from './client.js';

export class PostgresEntregaRepository implements EntregaRepository {
  constructor(private readonly db: Db) {}

  async registrar(empresaId: string, e: NuevoEvento): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('entrega_evento')
        .values({
          empresa_id: empresaId,
          factura_id: e.facturaId,
          local_id: e.localId,
          camion_id: e.camionId ?? null,
          usuario_id: e.usuarioId,
          tipo: e.tipo,
          motivo: e.motivo ?? null,
          minutos: e.minutos ?? null,
          lat: e.lat ?? null,
          lng: e.lng ?? null,
          precision_m: e.precisionM ?? null,
          origen: e.origen ?? 'manual',
          posicion_en_ruta: e.posicionEnRuta ?? null,
          paradas_en_ruta: e.paradasEnRuta ?? null,
        })
        .execute();
      if (e.nuevoEstado !== undefined) {
        await trx.updateTable('factura').set({ estado: e.nuevoEstado, actualizado_en: sql<Date>`now()` }).where('id', '=', e.facturaId).where('empresa_id', '=', empresaId).execute();
      }
    });
  }

  async ultimaPosicion(empresaId: string, camionId: string, fecha: string): Promise<PosicionConocida | undefined> {
    const f = await this.db
      .selectFrom('entrega_evento')
      .select(['lat', 'lng', 'creado_en'])
      .where('empresa_id', '=', empresaId)
      .where('camion_id', '=', camionId)
      .where('lat', 'is not', null)
      .where(sql<boolean>`(creado_en at time zone 'America/Santiago')::date = ${fecha}::date`)
      .orderBy('creado_en', 'desc')
      .limit(1)
      .executeTakeFirst();
    return f && f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng, en: f.creado_en } : undefined;
  }

  async conLlegada(empresaId: string, facturaIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (facturaIds.length === 0) return new Set();
    const filas = await this.db.selectFrom('entrega_evento').select('factura_id').where('empresa_id', '=', empresaId).where('tipo', '=', 'llegada').where('factura_id', 'in', [...facturaIds]).execute();
    return new Set(filas.map((f) => f.factura_id));
  }

  async posicionesDeEntrega(empresaId: string, localId: string, limite: number): Promise<readonly { readonly lat: number; readonly lng: number; readonly precisionM: number }[]> {
    const filas = await this.db
      .selectFrom('entrega_evento')
      .select(['lat', 'lng', 'precision_m'])
      .where('empresa_id', '=', empresaId)
      .where('local_id', '=', localId)
      .where('tipo', '=', 'entregado')
      .where('lat', 'is not', null)
      .where('precision_m', 'is not', null)
      .orderBy('creado_en', 'desc')
      .limit(limite)
      .execute();
    return filas.flatMap((f) => (f.lat !== null && f.lng !== null && f.precision_m !== null ? [{ lat: f.lat, lng: f.lng, precisionM: f.precision_m }] : []));
  }
}
