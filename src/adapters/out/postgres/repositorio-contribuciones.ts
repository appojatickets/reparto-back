import { sql } from 'kysely';
import type { DatosContribucion } from '../../../domain/entidades/contribuciones.js';
import type { ContribucionesRepository } from '../../../application/ports/out/contribuciones.js';
import type { Db } from './client.js';

export class PostgresContribucionesRepository implements ContribucionesRepository {
  constructor(private readonly db: Db) {}

  async datosDelLocal(empresaId: string, localId: string): Promise<DatosContribucion | undefined> {
    const l = await this.db
      .selectFrom('local')
      .select(['foto_path', 'foto_por', 'lat', 'lng', 'pin_verificado_en', 'pin_verificado_por'])
      .where('id', '=', localId)
      .where('empresa_id', '=', empresaId)
      .executeTakeFirst();
    if (!l) return undefined;
    // Entregas distintas por persona (deshacer y volver a entregar la misma factura cuenta una vez).
    const entregas = await this.db
      .selectFrom('entrega_evento')
      .select(['usuario_id', sql<string>`count(distinct factura_id)`.as('entregas')])
      .where('empresa_id', '=', empresaId)
      .where('local_id', '=', localId)
      .where('tipo', '=', 'entregado')
      .where('usuario_id', 'is not', null)
      .groupBy('usuario_id')
      .execute();
    return {
      tieneFoto: l.foto_path !== null,
      tienePin: l.lat !== null && l.lng !== null,
      pinVerificado: l.pin_verificado_en !== null,
      ...(l.foto_por !== null ? { fotoPor: l.foto_por } : {}),
      ...(l.pin_verificado_por !== null ? { pinVerificadoPor: l.pin_verificado_por } : {}),
      entregasPor: entregas.flatMap((e) => (e.usuario_id !== null ? [{ usuarioId: e.usuario_id, entregas: Number(e.entregas) }] : [])),
    };
  }
}
