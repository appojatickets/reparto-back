import { sql } from 'kysely';
import type { CacheDeViajes, ViajeGuardado } from '../../../application/ports/out/viajes.js';
import type { Db } from './client.js';

const LOTE = 1500;

export class PostgresCacheDeViajes implements CacheDeViajes {
  constructor(private readonly db: Db) {}

  async leer(desde: readonly string[], hacia: readonly string[]): Promise<readonly ViajeGuardado[]> {
    if (desde.length === 0 || hacia.length === 0) return [];
    const filas = await this.db.selectFrom('viaje_par').select(['desde', 'hasta', 'segundos', 'metros']).where('desde', 'in', [...desde]).where('hasta', 'in', [...hacia]).execute();
    return filas.map((f) => ({ desde: f.desde, hasta: f.hasta, segundos: f.segundos, metros: f.metros }));
  }

  async guardar(viajes: readonly ViajeGuardado[]): Promise<void> {
    for (let i = 0; i < viajes.length; i += LOTE) {
      const lote = viajes.slice(i, i + LOTE);
      await this.db
        .insertInto('viaje_par')
        .values(lote.map((v) => ({ desde: v.desde, hasta: v.hasta, segundos: v.segundos, metros: v.metros })))
        .onConflict((oc) => oc.columns(['desde', 'hasta']).doUpdateSet((eb) => ({ segundos: eb.ref('excluded.segundos'), metros: eb.ref('excluded.metros'), consultado_en: sql<Date>`now()` })))
        .execute();
    }
  }
}
