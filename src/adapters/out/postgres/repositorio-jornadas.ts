import { sql } from 'kysely';
import { err, ok, type Result } from '../../../domain/shared/result.js';
import type { Jornada, JornadaRepository } from '../../../application/ports/out/jornadas.js';
import type { Db } from './client.js';

const aJornada = (f: { id: string; usuario_id: string; fecha: string; desde: Date; camion_id: string; patente: string; alias: string | null }): Jornada => ({
  id: f.id,
  usuarioId: f.usuario_id,
  fecha: f.fecha,
  desde: f.desde,
  camion: { id: f.camion_id, patente: f.patente, ...(f.alias !== null ? { alias: f.alias } : {}) },
});

export class PostgresJornadaRepository implements JornadaRepository {
  constructor(private readonly db: Db) {}

  async activa(empresaId: string, usuarioId: string, fecha: string): Promise<Jornada | undefined> {
    const f = await this.db
      .selectFrom('jornada as j')
      .innerJoin('camion as k', 'k.id', 'j.camion_id')
      .select(['j.id', 'j.usuario_id', sql<string>`to_char(j.fecha_reparto, 'YYYY-MM-DD')`.as('fecha'), 'j.desde', 'k.id as camion_id', 'k.patente', 'k.alias'])
      .where('j.empresa_id', '=', empresaId)
      .where('j.usuario_id', '=', usuarioId)
      .where('j.hasta', 'is', null)
      .where('j.fecha_reparto', '=', fecha)
      .executeTakeFirst();
    return f && aJornada(f);
  }

  async iniciar(empresaId: string, usuarioId: string, camionId: string, fecha: string, ahora: Date): Promise<Result<Jornada, 'CAMION_NO_DISPONIBLE'>> {
    const camion = await this.db.selectFrom('camion').select(['id', 'patente', 'alias']).where('id', '=', camionId).where('empresa_id', '=', empresaId).where('activo', '=', true).executeTakeFirst();
    if (!camion) return err('CAMION_NO_DISPONIBLE');
    const j = await this.db.transaction().execute(async (trx) => {
      await trx.updateTable('jornada').set({ hasta: ahora }).where('usuario_id', '=', usuarioId).where('hasta', 'is', null).execute();
      return trx.insertInto('jornada').values({ empresa_id: empresaId, usuario_id: usuarioId, camion_id: camionId, fecha_reparto: fecha, desde: ahora }).returning(['id', 'desde']).executeTakeFirstOrThrow();
    });
    return ok(aJornada({ id: j.id, usuario_id: usuarioId, fecha, desde: j.desde, camion_id: camion.id, patente: camion.patente, alias: camion.alias }));
  }

  async terminar(empresaId: string, usuarioId: string, ahora: Date): Promise<boolean> {
    const r = await this.db.updateTable('jornada').set({ hasta: ahora }).where('empresa_id', '=', empresaId).where('usuario_id', '=', usuarioId).where('hasta', 'is', null).executeTakeFirst();
    return r.numUpdatedRows > 0n;
  }
}
