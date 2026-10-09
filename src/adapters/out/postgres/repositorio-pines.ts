import { sql } from 'kysely';
import { err, ok, type Result } from '../../../domain/shared/result.js';
import type {
  ErrorResolucion,
  EstadoPropuesta,
  NuevaPropuestaPin,
  PropuestaPin,
  PropuestaPinRepository,
} from '../../../application/ports/out/pines.js';
import type { Db } from './client.js';

export class PostgresPropuestaPinRepository implements PropuestaPinRepository {
  constructor(private readonly db: Db) {}

  async crearLote(empresaId: string, proponenteId: string, propuestas: readonly NuevaPropuestaPin[]): Promise<number> {
    if (propuestas.length === 0) return 0;
    await this.db
      .insertInto('propuesta_pin')
      .values(
        propuestas.map((p) => ({
          empresa_id: empresaId,
          local_id: p.localId ?? null,
          rut: p.rut ?? null,
          direccion: p.direccion,
          lat: p.lat,
          lng: p.lng,
          distancia_actual_m: p.distanciaActualM ?? null,
          estado: p.estado,
          propuesto_por: proponenteId,
          resuelto_por: null,
          resuelto_en: null,
        })),
      )
      .execute();
    return propuestas.length;
  }

  /** Primero las que más se alejan del pin actual: son las que más cambian la ruta. */
  async listar(empresaId: string, estado: EstadoPropuesta, limite: number): Promise<readonly PropuestaPin[]> {
    const filas = await this.db
      .selectFrom('propuesta_pin as p')
      .leftJoin('local as l', 'l.id', 'p.local_id')
      .leftJoin('cliente as c', 'c.id', 'l.cliente_id')
      .select(['p.id', 'p.local_id', 'p.rut', 'p.direccion', 'p.lat', 'p.lng', 'p.distancia_actual_m', 'p.estado', 'p.propuesto_por', 'p.creado_en', 'c.razon_social', 'l.comuna', 'l.lat as pin_lat', 'l.lng as pin_lng'])
      .where('p.empresa_id', '=', empresaId)
      .where('p.estado', '=', estado)
      .orderBy(sql`p.distancia_actual_m desc nulls last`)
      .orderBy('p.creado_en')
      .limit(limite)
      .execute();
    return filas.map((f) => ({
      id: f.id,
      ...(f.local_id !== null ? { localId: f.local_id } : {}),
      ...(f.rut !== null ? { rut: f.rut } : {}),
      direccion: f.direccion,
      lat: f.lat,
      lng: f.lng,
      ...(f.distancia_actual_m !== null ? { distanciaActualM: f.distancia_actual_m } : {}),
      estado: f.estado,
      proponenteId: f.propuesto_por,
      creadaEn: f.creado_en,
      ...(f.razon_social !== null ? { razonSocial: f.razon_social } : {}),
      ...(f.comuna !== null ? { comuna: f.comuna } : {}),
      ...(f.pin_lat !== null && f.pin_lng !== null ? { pinActual: { lat: f.pin_lat, lng: f.pin_lng } } : {}),
    }));
  }

  async resolver(empresaId: string, id: string, resolutorId: string, aceptar: boolean, ahora: Date): Promise<Result<void, ErrorResolucion>> {
    return this.db.transaction().execute(async (trx) => {
      const p = await trx.selectFrom('propuesta_pin').selectAll().where('id', '=', id).where('empresa_id', '=', empresaId).forUpdate().executeTakeFirst();
      if (!p) return err('NO_ENCONTRADA' as const);
      if (p.estado !== 'pendiente' && p.estado !== 'sin_local') return err('YA_RESUELTA' as const);
      if (aceptar && (p.estado === 'sin_local' || p.local_id === null)) return err('SIN_LOCAL' as const);

      if (aceptar && p.local_id !== null) {
        await trx
          .updateTable('local')
          .set({ lat: p.lat, lng: p.lng, pin_estado: 'validado', pin_fuente: 'importado', pin_verificado_por: resolutorId, pin_verificado_en: ahora })
          .where('id', '=', p.local_id)
          .where('empresa_id', '=', empresaId)
          .execute();
      }
      await trx
        .updateTable('propuesta_pin')
        .set({ estado: aceptar ? 'aceptada' : 'rechazada', resuelto_por: resolutorId, resuelto_en: ahora })
        .where('id', '=', id)
        .execute();
      return ok(undefined);
    });
  }
}
