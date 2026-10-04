import { sql, type Kysely } from 'kysely';
import { err, ok, type Result } from '../../../domain/shared/result.js';
import type { CambiosFactura, FacturaDetallada, FacturaRepository, FiltroFacturas, NuevaFactura } from '../../../application/ports/out/facturas.js';
import type { Db } from './client.js';
import type { Tabla } from './db-types.js';

const esDuplicado = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';

type FilaDetallada = {
  id: string; folio: string; fecha: string; estado: 'pendiente' | 'anulada'; total: number | null; antes_de_min: number | null;
  urgente: boolean; nota: string | null; camion_id: string | null; patente: string | null; camion_alias: string | null;
  local_id: string; razon_social: string; direccion: string; comuna: string; tiene_pin: boolean;
};

const aFactura = (f: FilaDetallada): FacturaDetallada => ({
  id: f.id,
  folio: f.folio,
  fecha: f.fecha,
  estado: f.estado,
  ...(f.total !== null ? { total: f.total } : {}),
  ...(f.antes_de_min !== null ? { antesDeMin: f.antes_de_min } : {}),
  urgente: f.urgente,
  ...(f.nota !== null ? { nota: f.nota } : {}),
  ...(f.camion_id !== null && f.patente !== null ? { camion: { id: f.camion_id, patente: f.patente, ...(f.camion_alias !== null ? { alias: f.camion_alias } : {}) } } : {}),
  local: { id: f.local_id, razonSocial: f.razon_social, direccion: f.direccion, comuna: f.comuna, tienePin: f.tiene_pin },
});

/** La consulta de detalle (factura + local + cliente + camión). `where` se agrega por quien llama. */
const detalle = (db: Kysely<Tabla>, empresaId: string) =>
  db
    .selectFrom('factura as f')
    .innerJoin('local as l', 'l.id', 'f.local_id')
    .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
    .leftJoin('camion as k', 'k.id', 'f.camion_id')
    .select([
      'f.id', 'f.folio', sql<string>`to_char(f.fecha_reparto, 'YYYY-MM-DD')`.as('fecha'), 'f.estado', 'f.total', 'f.antes_de_min', 'f.urgente', 'f.nota',
      'f.camion_id', 'k.patente', 'k.alias as camion_alias', 'l.id as local_id', 'c.razon_social', 'l.direccion', 'l.comuna',
      sql<boolean>`(l.lat is not null)`.as('tiene_pin'),
    ])
    .where('f.empresa_id', '=', empresaId);

export class PostgresFacturaRepository implements FacturaRepository {
  constructor(private readonly db: Db) {}

  private async camionDisponible(empresaId: string, camionId: string): Promise<boolean> {
    const k = await this.db.selectFrom('camion').select('id').where('id', '=', camionId).where('empresa_id', '=', empresaId).where('activo', '=', true).executeTakeFirst();
    return k !== undefined;
  }

  private async porId(empresaId: string, id: string): Promise<FacturaDetallada | undefined> {
    const f = await detalle(this.db, empresaId).where('f.id', '=', id).executeTakeFirst();
    return f && aFactura(f);
  }

  async crear(empresaId: string, n: NuevaFactura): Promise<Result<FacturaDetallada, 'FOLIO_DUPLICADO' | 'LOCAL_NO_EXISTE' | 'CAMION_NO_DISPONIBLE'>> {
    const local = await this.db.selectFrom('local').select('id').where('id', '=', n.localId).where('empresa_id', '=', empresaId).executeTakeFirst();
    if (!local) return err('LOCAL_NO_EXISTE');
    if (n.camionId !== undefined && !(await this.camionDisponible(empresaId, n.camionId))) return err('CAMION_NO_DISPONIBLE');
    try {
      const { id } = await this.db
        .insertInto('factura')
        .values({
          empresa_id: empresaId, folio: n.folio, local_id: n.localId, camion_id: n.camionId ?? null, fecha_reparto: n.fecha, total: n.total ?? null,
          antes_de_min: n.antesDeMin ?? null, urgente: n.urgente, nota: n.nota ?? null, creado_por: n.creadoPor,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const f = await this.porId(empresaId, id);
      if (!f) throw new Error('La factura recién creada no se encontró');
      return ok(f);
    } catch (e) {
      if (esDuplicado(e)) return err('FOLIO_DUPLICADO');
      throw e;
    }
  }

  async listar(empresaId: string, filtro: FiltroFacturas): Promise<readonly FacturaDetallada[]> {
    let q = detalle(this.db, empresaId).where('f.fecha_reparto', '=', filtro.fecha);
    if (!filtro.incluirAnuladas) q = q.where('f.estado', '=', 'pendiente');
    if (filtro.camionId !== undefined) q = q.where('f.camion_id', '=', filtro.camionId);
    if (filtro.sinCamion) q = q.where('f.camion_id', 'is', null);
    return (await q.orderBy('f.creado_en').orderBy('f.folio').execute()).map(aFactura);
  }

  async actualizar(empresaId: string, id: string, c: CambiosFactura): Promise<Result<FacturaDetallada, 'NO_ENCONTRADA' | 'CAMION_NO_DISPONIBLE'>> {
    if (!(await this.porId(empresaId, id))) return err('NO_ENCONTRADA');
    if (typeof c.camionId === 'string' && !(await this.camionDisponible(empresaId, c.camionId))) return err('CAMION_NO_DISPONIBLE');
    await this.db
      .updateTable('factura')
      .set({
        ...(c.camionId !== undefined ? { camion_id: c.camionId } : {}),
        ...(c.fecha !== undefined ? { fecha_reparto: c.fecha } : {}),
        ...(c.total !== undefined ? { total: c.total } : {}),
        ...(c.antesDeMin !== undefined ? { antes_de_min: c.antesDeMin } : {}),
        ...(c.urgente !== undefined ? { urgente: c.urgente } : {}),
        ...(c.nota !== undefined ? { nota: c.nota } : {}),
        ...(c.estado !== undefined ? { estado: c.estado } : {}),
        actualizado_en: sql<Date>`now()`,
      })
      .where('id', '=', id)
      .where('empresa_id', '=', empresaId)
      .execute();
    const f = await this.porId(empresaId, id);
    return f ? ok(f) : err('NO_ENCONTRADA');
  }
}
