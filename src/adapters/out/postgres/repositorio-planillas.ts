import type { AsignacionDia, NuevaAsignacion, PersonaDeCamion, PlanillaRepository } from '../../../application/ports/out/planillas.js';
import type { Vendedor } from '../../../application/ports/out/vendedores.js';
import type { Db } from './client.js';

const persona = (nombre: string | null, usuarioId: string | null): PersonaDeCamion | undefined =>
  nombre === null ? undefined : { nombre, ...(usuarioId !== null ? { usuarioId } : {}) };

export class PostgresPlanillaRepository implements PlanillaRepository {
  constructor(private readonly db: Db) {}

  async guardar(empresaId: string, fecha: string, filas: readonly NuevaAsignacion[], creadoPor: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      for (const f of filas) {
        await trx.deleteFrom('asignacion_dia').where('empresa_id', '=', empresaId).where('fecha_reparto', '=', fecha).where('camion_id', '=', f.camionId).execute();
        const a = await trx
          .insertInto('asignacion_dia')
          .values({
            empresa_id: empresaId,
            fecha_reparto: fecha,
            camion_id: f.camionId,
            chofer_usuario_id: f.chofer?.usuarioId ?? null,
            chofer_nombre: f.chofer?.nombre ?? null,
            ayudante_usuario_id: f.ayudante?.usuarioId ?? null,
            ayudante_nombre: f.ayudante?.nombre ?? null,
            comunas: [...f.comunas],
            creado_por: creadoPor,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (f.vendedorIds.length > 0) await trx.insertInto('asignacion_vendedor').values(f.vendedorIds.map((v) => ({ asignacion_id: a.id, vendedor_id: v }))).execute();
      }
    });
  }

  private async leer(empresaId: string, fecha: string, camionId?: string): Promise<readonly AsignacionDia[]> {
    let q = this.db
      .selectFrom('asignacion_dia as a')
      .innerJoin('camion as k', 'k.id', 'a.camion_id')
      .select(['a.id', 'k.id as camion_id', 'k.patente', 'k.alias', 'a.chofer_nombre', 'a.chofer_usuario_id', 'a.ayudante_nombre', 'a.ayudante_usuario_id', 'a.comunas'])
      .where('a.empresa_id', '=', empresaId)
      .where('a.fecha_reparto', '=', fecha)
      .orderBy('k.patente');
    if (camionId !== undefined) q = q.where('a.camion_id', '=', camionId);
    const filas = await q.execute();
    if (filas.length === 0) return [];
    const vs = await this.db
      .selectFrom('asignacion_vendedor as av')
      .innerJoin('vendedor as v', 'v.id', 'av.vendedor_id')
      .select(['av.asignacion_id', 'v.id', 'v.codigo', 'v.nombre', 'v.celular', 'v.activo'])
      .where('av.asignacion_id', 'in', filas.map((f) => f.id))
      .orderBy('v.codigo')
      .execute();
    const porAsignacion = new Map<string, Vendedor[]>();
    for (const v of vs) {
      const lista = porAsignacion.get(v.asignacion_id) ?? [];
      lista.push({ id: v.id, codigo: v.codigo, nombre: v.nombre, ...(v.celular !== null ? { celular: v.celular } : {}), activo: v.activo });
      porAsignacion.set(v.asignacion_id, lista);
    }
    return filas.map((f) => {
      const chofer = persona(f.chofer_nombre, f.chofer_usuario_id);
      const ayudante = persona(f.ayudante_nombre, f.ayudante_usuario_id);
      return {
        fecha,
        camion: { id: f.camion_id, patente: f.patente, ...(f.alias !== null ? { alias: f.alias } : {}) },
        ...(chofer ? { chofer } : {}),
        ...(ayudante ? { ayudante } : {}),
        comunas: f.comunas,
        vendedores: porAsignacion.get(f.id) ?? [],
      };
    });
  }

  obtener(empresaId: string, fecha: string): Promise<readonly AsignacionDia[]> {
    return this.leer(empresaId, fecha);
  }

  async deCamion(empresaId: string, fecha: string, camionId: string): Promise<AsignacionDia | undefined> {
    return (await this.leer(empresaId, fecha, camionId))[0];
  }
}
