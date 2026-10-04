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
}
