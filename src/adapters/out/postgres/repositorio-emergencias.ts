import { sql } from 'kysely';
import type { EmergenciaRegistrada, EmergenciaRepository, NuevaEmergencia } from '../../../application/ports/out/emergencias.js';
import type { Db } from './client.js';

type Fila = { id: string; camion_id: string; usuario_id: string | null; tipo: 'mecanico' | 'vulcanizacion' | 'otro'; texto: string | null; lat: number | null; lng: number | null; precision_m: number | null; creado_en: Date };

const aEmergencia = (f: Fila): EmergenciaRegistrada => ({
  id: f.id,
  camionId: f.camion_id,
  tipo: f.tipo,
  creadoEn: f.creado_en,
  ...(f.usuario_id !== null ? { usuarioId: f.usuario_id } : {}),
  ...(f.texto !== null ? { texto: f.texto } : {}),
  ...(f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng } : {}),
  ...(f.precision_m !== null ? { precisionM: f.precision_m } : {}),
});

export class PostgresEmergenciaRepository implements EmergenciaRepository {
  constructor(private readonly db: Db) {}

  async registrar(empresaId: string, e: NuevaEmergencia): Promise<EmergenciaRegistrada> {
    const f = await this.db
      .insertInto('parada_emergencia')
      .values({ empresa_id: empresaId, camion_id: e.camionId, usuario_id: e.usuarioId, tipo: e.tipo, texto: e.texto ?? null, lat: e.lat ?? null, lng: e.lng ?? null, precision_m: e.precisionM ?? null })
      .returning(['id', 'camion_id', 'usuario_id', 'tipo', 'texto', 'lat', 'lng', 'precision_m', 'creado_en'])
      .executeTakeFirstOrThrow();
    return aEmergencia(f);
  }

  async delDia(empresaId: string, fecha: string, camionId?: string): Promise<readonly EmergenciaRegistrada[]> {
    let q = this.db
      .selectFrom('parada_emergencia')
      .select(['id', 'camion_id', 'usuario_id', 'tipo', 'texto', 'lat', 'lng', 'precision_m', 'creado_en'])
      .where('empresa_id', '=', empresaId)
      .where(sql<boolean>`(creado_en at time zone 'America/Santiago')::date = ${fecha}::date`);
    if (camionId !== undefined) q = q.where('camion_id', '=', camionId);
    return (await q.orderBy('creado_en').execute()).map(aEmergencia);
  }
}
