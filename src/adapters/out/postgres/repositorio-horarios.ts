import type { Insertable } from 'kysely';
import type { DiaSemana } from '../../../domain/entidades/horario.js';
import { agruparDias, diasDeHorarios, type DiaHorario } from '../../../domain/entidades/horario-semanal.js';
import type { HorarioRepository } from '../../../application/ports/out/horarios.js';
import type { Db } from './client.js';
import type { Tabla } from './db-types.js';

const minutosDeHora = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const horaDeMinutos = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export class PostgresHorarioRepository implements HorarioRepository {
  constructor(private readonly db: Db) {}

  private async existeLocal(empresaId: string, localId: string): Promise<boolean> {
    return (await this.db.selectFrom('local').select('id').where('id', '=', localId).where('empresa_id', '=', empresaId).executeTakeFirst()) !== undefined;
  }

  async obtenerManual(empresaId: string, localId: string): Promise<readonly DiaHorario[] | undefined> {
    if (!(await this.existeLocal(empresaId, localId))) return undefined;
    const filas = await this.db
      .selectFrom('horario_local')
      .select(['dias', 'desde', 'hasta'])
      .where('empresa_id', '=', empresaId)
      .where('local_id', '=', localId)
      .where('fuente', '=', 'confirmado')
      .execute();
    return diasDeHorarios(
      filas.map((f) => ({
        dias: f.dias as DiaSemana[],
        tramos: f.desde !== null && f.hasta !== null ? [{ apertura: minutosDeHora(f.desde), cierre: minutosDeHora(f.hasta) }] : [],
      })),
    );
  }

  async reemplazarManual(empresaId: string, localId: string, dias: readonly DiaHorario[]): Promise<boolean> {
    if (!(await this.existeLocal(empresaId, localId))) return false;
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('horario_local').where('empresa_id', '=', empresaId).where('local_id', '=', localId).where('fuente', '=', 'confirmado').execute();
      const filas: Insertable<Tabla['horario_local']>[] = [];
      for (const g of agruparDias(dias)) {
        const base = { empresa_id: empresaId, local_id: localId, dias: [...g.dias], fuente: 'confirmado' as const, confianza: 1 };
        if (g.tramos.length === 0) filas.push({ ...base, desde: null, hasta: null, cerrado: true });
        for (const t of g.tramos) filas.push({ ...base, desde: horaDeMinutos(t.desde), hasta: horaDeMinutos(t.hasta), cerrado: false });
      }
      if (filas.length > 0) await trx.insertInto('horario_local').values(filas).execute();
    });
    return true;
  }
}
