import { err, ok, type Result } from '../../../domain/shared/result.js';
import type { Vendedor, VendedorRepository } from '../../../application/ports/out/vendedores.js';
import type { Db } from './client.js';

const esDuplicado = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
type Fila = { id: string; codigo: string; nombre: string; celular: string | null; activo: boolean };
const aVendedor = (f: Fila): Vendedor => ({ id: f.id, codigo: f.codigo, nombre: f.nombre, ...(f.celular !== null ? { celular: f.celular } : {}), activo: f.activo });
const COLUMNAS = ['id', 'codigo', 'nombre', 'celular', 'activo'] as const;

export class PostgresVendedorRepository implements VendedorRepository {
  constructor(private readonly db: Db) {}

  async listar(empresaId: string, { soloActivos }: { soloActivos?: boolean }): Promise<readonly Vendedor[]> {
    let q = this.db.selectFrom('vendedor').select(COLUMNAS).where('empresa_id', '=', empresaId).orderBy('codigo');
    if (soloActivos) q = q.where('activo', '=', true);
    return (await q.execute()).map(aVendedor);
  }

  async crear(empresaId: string, d: { codigo: string; nombre: string; celular?: string }): Promise<Result<Vendedor, 'CODIGO_DUPLICADO'>> {
    try {
      const f = await this.db
        .insertInto('vendedor')
        .values({ empresa_id: empresaId, codigo: d.codigo, nombre: d.nombre, celular: d.celular ?? null })
        .returning(COLUMNAS)
        .executeTakeFirstOrThrow();
      return ok(aVendedor(f));
    } catch (e) {
      if (esDuplicado(e)) return err('CODIGO_DUPLICADO');
      throw e;
    }
  }

  async actualizar(empresaId: string, id: string, c: { nombre?: string; celular?: string | null; activo?: boolean }): Promise<Vendedor | undefined> {
    const f = await this.db
      .updateTable('vendedor')
      .set({
        ...(c.nombre !== undefined ? { nombre: c.nombre } : {}),
        ...(c.celular !== undefined ? { celular: c.celular } : {}),
        ...(c.activo !== undefined ? { activo: c.activo } : {}),
      })
      .where('id', '=', id)
      .where('empresa_id', '=', empresaId)
      .returning(COLUMNAS)
      .executeTakeFirst();
    return f && aVendedor(f);
  }
}
