import { err, ok, type Result } from '../../../domain/shared/result.js';
import type { Camion, CamionRepository } from '../../../application/ports/out/camiones.js';
import type { Db } from './client.js';

const esDuplicado = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
type Fila = { id: string; patente: string; alias: string | null; activo: boolean };
const aCamion = (f: Fila): Camion => ({ id: f.id, patente: f.patente, ...(f.alias !== null ? { alias: f.alias } : {}), activo: f.activo });
const COLUMNAS = ['id', 'patente', 'alias', 'activo'] as const;

export class PostgresCamionRepository implements CamionRepository {
  constructor(private readonly db: Db) {}

  async listar(empresaId: string, { soloActivos }: { soloActivos?: boolean }): Promise<readonly Camion[]> {
    let q = this.db.selectFrom('camion').select(COLUMNAS).where('empresa_id', '=', empresaId).orderBy('patente');
    if (soloActivos) q = q.where('activo', '=', true);
    return (await q.execute()).map(aCamion);
  }

  async crear(empresaId: string, d: { patente: string; alias?: string }): Promise<Result<Camion, 'PATENTE_DUPLICADA'>> {
    try {
      const f = await this.db.insertInto('camion').values({ empresa_id: empresaId, patente: d.patente, alias: d.alias ?? null }).returning(COLUMNAS).executeTakeFirstOrThrow();
      return ok(aCamion(f));
    } catch (e) {
      if (esDuplicado(e)) return err('PATENTE_DUPLICADA');
      throw e;
    }
  }

  async actualizar(empresaId: string, id: string, c: { alias?: string | null; activo?: boolean }): Promise<Camion | undefined> {
    const f = await this.db
      .updateTable('camion')
      .set({ ...(c.alias !== undefined ? { alias: c.alias } : {}), ...(c.activo !== undefined ? { activo: c.activo } : {}) })
      .where('id', '=', id)
      .where('empresa_id', '=', empresaId)
      .returning(COLUMNAS)
      .executeTakeFirst();
    return f && aCamion(f);
  }
}
