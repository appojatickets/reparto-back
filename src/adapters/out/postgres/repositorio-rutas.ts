import { sql } from 'kysely';
import type { DiaSemana, HorarioLocal } from '../../../domain/entidades/horario.js';
import { err, ok, type Result } from '../../../domain/shared/result.js';
import type { FacturaParaRuta, GuardarRuta, RutaGuardada, RutaRepository } from '../../../application/ports/out/rutas.js';
import type { Db } from './client.js';

/** '08:30:00' → 510 */
const minutosDeHora = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export class PostgresRutaRepository implements RutaRepository {
  constructor(private readonly db: Db) {}

  async obtener(empresaId: string, camionId: string, fecha: string): Promise<RutaGuardada | undefined> {
    const r = await this.db
      .selectFrom('ruta')
      .select(['id', 'camion_id', 'salida_min', 'modo', 'version'])
      .where('empresa_id', '=', empresaId)
      .where('camion_id', '=', camionId)
      .where('fecha_reparto', '=', fecha)
      .executeTakeFirst();
    if (!r) return undefined;
    const paradas = await this.db.selectFrom('parada_ruta').select(['factura_id', 'fijada']).where('ruta_id', '=', r.id).orderBy('orden').execute();
    return {
      id: r.id,
      camionId: r.camion_id,
      fecha,
      salidaMin: r.salida_min,
      modo: r.modo,
      version: r.version,
      orden: paradas.map((p) => p.factura_id),
      fijas: paradas.filter((p) => p.fijada).map((p) => p.factura_id),
    };
  }

  async facturasPendientes(empresaId: string, camionId: string, fecha: string): Promise<readonly FacturaParaRuta[]> {
    const filas = await this.db
      .selectFrom('factura as f')
      .innerJoin('local as l', 'l.id', 'f.local_id')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .select(['f.id', 'f.folio', 'f.antes_de_min', 'f.urgente', 'f.nota', 'f.total', 'l.id as local_id', 'c.razon_social', 'l.direccion', 'l.comuna', 'l.lat', 'l.lng', 'l.pin_fuente', 'l.pin_confianza'])
      .where('f.empresa_id', '=', empresaId)
      .where('f.camion_id', '=', camionId)
      .where('f.fecha_reparto', '=', fecha)
      .where('f.estado', '=', 'pendiente')
      .orderBy('f.creado_en')
      .orderBy('f.id')
      .execute();
    const localIds = [...new Set(filas.map((f) => f.local_id))];
    const horarios = localIds.length === 0
      ? []
      : await this.db.selectFrom('horario_local').select(['local_id', 'dias', 'desde', 'hasta', 'fuente', 'confianza']).where('empresa_id', '=', empresaId).where('local_id', 'in', localIds).execute();
    const porLocal = new Map<string, HorarioLocal[]>();
    for (const h of horarios) {
      const lista = porLocal.get(h.local_id) ?? [];
      lista.push({
        dias: h.dias as DiaSemana[],
        tramos: h.desde !== null && h.hasta !== null ? [{ apertura: minutosDeHora(h.desde), cierre: minutosDeHora(h.hasta) }] : [],
        fuente: h.fuente,
        confianza: h.confianza,
      });
      porLocal.set(h.local_id, lista);
    }
    return filas.map((f) => ({
      facturaId: f.id,
      ...(f.folio !== null ? { folio: f.folio } : {}),
      localId: f.local_id,
      razonSocial: f.razon_social,
      direccion: f.direccion,
      comuna: f.comuna,
      ...(f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng } : {}),
      ...(f.lat !== null && f.pin_fuente === 'geocodificador' && (f.pin_confianza ?? 0) < 0.7 ? { pinAproximado: true } : {}),
      ...(f.antes_de_min !== null ? { antesDeMin: f.antes_de_min } : {}),
      urgente: f.urgente,
      ...(f.nota !== null ? { nota: f.nota } : {}),
      ...(f.total !== null ? { total: f.total } : {}),
      horarios: porLocal.get(f.local_id) ?? [],
    }));
  }

  async guardar(empresaId: string, d: GuardarRuta): Promise<Result<RutaGuardada, 'VERSION_DESACTUALIZADA'>> {
    return this.db.transaction().execute(async (trx) => {
      const existente = await trx
        .selectFrom('ruta')
        .select(['id', 'version'])
        .where('empresa_id', '=', empresaId)
        .where('camion_id', '=', d.camionId)
        .where('fecha_reparto', '=', d.fecha)
        .forUpdate()
        .executeTakeFirst();

      let id: string;
      let version: number;
      if (existente) {
        if (d.versionEsperada !== undefined && existente.version !== d.versionEsperada) return err('VERSION_DESACTUALIZADA' as const);
        version = existente.version + 1;
        id = existente.id;
        await trx.updateTable('ruta').set({ salida_min: d.salidaMin, modo: d.modo, version, actualizado_en: sql<Date>`now()` }).where('id', '=', id).execute();
        await trx.deleteFrom('parada_ruta').where('ruta_id', '=', id).execute();
      } else {
        if (d.versionEsperada !== undefined) return err('VERSION_DESACTUALIZADA' as const);
        version = 1;
        id = (
          await trx
            .insertInto('ruta')
            .values({ empresa_id: empresaId, camion_id: d.camionId, fecha_reparto: d.fecha, salida_min: d.salidaMin, modo: d.modo, creado_por: d.usuarioId })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;
      }
      if (d.orden.length > 0) {
        const fijas = new Set(d.fijas);
        await trx.insertInto('parada_ruta').values(d.orden.map((facturaId, orden) => ({ ruta_id: id, factura_id: facturaId, orden, fijada: fijas.has(facturaId) }))).execute();
      }
      return ok({ id, camionId: d.camionId, fecha: d.fecha, salidaMin: d.salidaMin, modo: d.modo, version, orden: d.orden, fijas: d.fijas });
    });
  }
}
