import { sql } from 'kysely';
import type { ClienteImportable } from '../../../domain/importacion/fila-cliente.js';
import { normalizarTexto } from '../../../domain/entidades/local.js';
import { err, ok, type Result } from '../../../domain/shared/result.js';
import type {
  CambiosLocal,
  ClienteRepository,
  CoincidenciaLocal,
  ConsultaBusqueda,
  EstadoPin,
  LocalDetalle,
  NuevoClienteConLocal,
  ResultadoBusqueda,
  ResumenImportacion,
} from '../../../application/ports/out/clientes.js';
import type { Db } from './client.js';

const escaparLike = (t: string): string => t.replace(/[\\%_]/g, (c) => `\\${c}`);
const sinNulos = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;
const esViolacionUnica = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';

type FilaBusqueda = {
  local_id: string;
  cliente_id: string;
  razon_social: string;
  direccion: string;
  comuna: string;
  lat: number | null;
  lng: number | null;
  pin_estado: EstadoPin;
  foto_path: string | null;
  streetview_rumbo: number | null;
  nota: string | null;
  score: number;
};

export class PostgresClienteRepository implements ClienteRepository {
  constructor(private readonly db: Db) {}

  /**
   * Autocompletado: ILIKE (lo acelera el índice trigram) para «rabe» → «Rabelo»; `<%` (word_similarity) tolera errores
   * de dictado. No se usa `%` porque una palabra corta contra una razón social larga da una similitud baja.
   */
  async buscar(empresaId: string, { texto, rutDigitos, comuna, limite }: ConsultaBusqueda): Promise<readonly ResultadoBusqueda[]> {
    const patron = `%${escaparLike(texto)}%`;
    const filtroComuna = comuna === undefined ? sql`` : sql`and l.comuna = ${comuna}`;
    const filtroTexto = rutDigitos === undefined
      ? sql`(c.razon_social_norm ilike ${patron} or l.direccion_norm ilike ${patron}
             or ${texto}::text <% c.razon_social_norm or ${texto}::text <% l.direccion_norm)`
      : sql`replace(c.rut, '-', '') like ${`${rutDigitos}%`}`;
    const r = await sql<FilaBusqueda>`
      select l.id as local_id, c.id as cliente_id, c.razon_social, l.direccion, l.comuna, l.lat, l.lng, l.pin_estado,
             l.foto_path, l.streetview_rumbo, l.nota,
             ${rutDigitos === undefined ? sql`greatest(word_similarity(${texto}::text, c.razon_social_norm), word_similarity(${texto}::text, l.direccion_norm))::float8` : sql`1::float8`} as score
      from "local" l
      join cliente c on c.id = l.cliente_id
      where l.empresa_id = ${empresaId} and c.estado in ('nuevo', 'activo') ${filtroComuna}
        and ${filtroTexto}
      order by score desc, c.razon_social, l.direccion
      limit ${limite}`.execute(this.db);
    return r.rows.map((f) => ({
      localId: f.local_id,
      clienteId: f.cliente_id,
      razonSocial: f.razon_social,
      direccion: f.direccion,
      comuna: f.comuna,
      ...(f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng } : {}),
      pinEstado: f.pin_estado,
      ...(f.foto_path !== null ? { fotoPath: f.foto_path } : {}),
      ...(f.streetview_rumbo !== null ? { streetviewRumbo: f.streetview_rumbo } : {}),
      ...(f.nota !== null ? { nota: f.nota } : {}),
      score: f.score,
    }));
  }

  async crearConLocal(empresaId: string, d: NuevoClienteConLocal): Promise<Result<{ clienteId: string; localId: string }, 'DUPLICADO'>> {
    const direccionNorm = normalizarTexto(d.local.direccion);
    try {
      return await this.db.transaction().execute(async (trx) => {
        // Con RUT el cliente es único: se reutiliza y solo se agrega la dirección nueva. Sin RUT se crea siempre uno nuevo.
        let clienteId =
          d.rut === undefined
            ? undefined
            : (await trx.selectFrom('cliente').select('id').where('empresa_id', '=', empresaId).where('rut', '=', d.rut).executeTakeFirst())?.id;

        if (clienteId === undefined) {
          const igual = await sql`
            select 1 from cliente c join "local" l on l.cliente_id = c.id
            where c.empresa_id = ${empresaId} and c.rut is null and c.razon_social_norm = ${normalizarTexto(d.razonSocial)} and l.direccion_norm = ${direccionNorm}
            limit 1`.execute(trx);
          if (igual.rows.length > 0) return err('DUPLICADO' as const);
          clienteId = (
            await trx
              .insertInto('cliente')
              .values({ empresa_id: empresaId, rut: d.rut ?? null, razon_social: d.razonSocial, giro: d.giro ?? null, estado: d.estado })
              .returning('id')
              .executeTakeFirstOrThrow()
          ).id;
        } else {
          const existe = await trx.selectFrom('local').select('id').where('cliente_id', '=', clienteId).where('direccion_norm', '=', direccionNorm).executeTakeFirst();
          if (existe) return err('DUPLICADO' as const);
        }

        const l = d.local;
        const local = await trx
          .insertInto('local')
          .values({
            empresa_id: empresaId,
            cliente_id: clienteId,
            direccion: l.direccion,
            comuna: l.comuna,
            lat: l.lat ?? null,
            lng: l.lng ?? null,
            pin_estado: l.pinEstado,
            pin_fuente: l.pinFuente ?? null,
            pin_confianza: null,
            foto_path: null,
            streetview_rumbo: null,
            nota: l.nota ?? null,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        return ok({ clienteId, localId: local.id });
      });
    } catch (e) {
      if (esViolacionUnica(e)) return err('DUPLICADO');
      throw e;
    }
  }

  /** Un lote = una transacción: o entra completo o no entra. El caso de uso garantiza claves únicas dentro del lote. */
  async importar(empresaId: string, clientes: readonly ClienteImportable[]): Promise<ResumenImportacion> {
    return this.db.transaction().execute(async (trx) => {
      const idPorClave = new Map<string, string>();
      let clientesCreados = 0;

      // 1) Clientes con RUT: un solo upsert. `xmax = 0` distingue lo insertado de lo actualizado.
      const conRut = clientes.filter((c) => c.rut !== undefined);
      if (conRut.length > 0) {
        const filas = await trx
          .insertInto('cliente')
          .values(conRut.map((c) => ({ empresa_id: empresaId, rut: c.rut ?? null, razon_social: c.razonSocial, giro: c.giro ?? null, estado: 'activo' as const })))
          .onConflict((oc) =>
            oc
              .columns(['empresa_id', 'rut'])
              .where('rut', 'is not', null)
              .doUpdateSet({ razon_social: sql`excluded.razon_social`, giro: sql`coalesce(excluded.giro, cliente.giro)` }),
          )
          .returning(['id', 'rut', sql<boolean>`(xmax = 0)`.as('creado')])
          .execute();
        const idPorRut = new Map(filas.map((f) => [f.rut, f.id]));
        for (const c of conRut) {
          const id = idPorRut.get(c.rut ?? '');
          if (id) idPorClave.set(c.claveCliente, id);
        }
        clientesCreados += filas.filter((f) => f.creado).length;
      }

      // 2) Clientes sin RUT: se reconocen por razón social + alguna dirección ya registrada (o por ser el único con ese nombre).
      const sinRut = clientes.filter((c) => c.rut === undefined);
      if (sinRut.length > 0) {
        const normas = [...new Set(sinRut.map((c) => normalizarTexto(c.razonSocial)))];
        const existentes = await sql<{ id: string; razon_social_norm: string; direccion_norm: string | null }>`
          select c.id, c.razon_social_norm, l.direccion_norm
          from cliente c left join "local" l on l.cliente_id = c.id
          where c.empresa_id = ${empresaId} and c.rut is null and c.razon_social_norm = any(${normas}::text[])`.execute(trx);
        const porNorma = new Map<string, Map<string, Set<string>>>();
        for (const f of existentes.rows) {
          const clientesDeNorma = porNorma.get(f.razon_social_norm) ?? new Map<string, Set<string>>();
          const direcciones = clientesDeNorma.get(f.id) ?? new Set<string>();
          if (f.direccion_norm !== null) direcciones.add(f.direccion_norm);
          clientesDeNorma.set(f.id, direcciones);
          porNorma.set(f.razon_social_norm, clientesDeNorma);
        }
        const nuevos: ClienteImportable[] = [];
        for (const c of sinRut) {
          const candidatos = porNorma.get(normalizarTexto(c.razonSocial));
          const porDireccion = [...(candidatos?.entries() ?? [])].find(([, dirs]) => c.locales.some((l) => dirs.has(normalizarTexto(l.direccion))));
          const unico = candidatos?.size === 1 ? [...candidatos.keys()][0] : undefined;
          const id = porDireccion?.[0] ?? unico;
          if (id) idPorClave.set(c.claveCliente, id);
          else nuevos.push(c);
        }
        if (nuevos.length > 0) {
          const filas = await trx
            .insertInto('cliente')
            .values(nuevos.map((c) => ({ empresa_id: empresaId, rut: null, razon_social: c.razonSocial, giro: c.giro ?? null, estado: 'activo' as const })))
            .returning('id')
            .execute();
          nuevos.forEach((c, i) => {
            const id = filas[i]?.id;
            if (id) idPorClave.set(c.claveCliente, id);
          });
          clientesCreados += nuevos.length;
        }
      }

      // 3) Locales: un solo upsert. Un pin ya validado nunca se pisa; uno nuevo entra como «sugerido».
      const filasLocal = clientes.flatMap((c) => {
        const clienteId = idPorClave.get(c.claveCliente);
        return clienteId
          ? c.locales.map((l) => ({
              empresa_id: empresaId,
              cliente_id: clienteId,
              direccion: l.direccion,
              comuna: l.comuna,
              lat: l.lat ?? null,
              lng: l.lng ?? null,
              pin_estado: l.lat !== undefined ? ('sugerido' as const) : ('pendiente' as const),
              pin_fuente: l.lat !== undefined ? ('importado' as const) : null,
              pin_confianza: null,
              foto_path: null,
              streetview_rumbo: null,
              nota: l.nota ?? null,
            }))
          : [];
      });
      let localesCreados = 0;
      let localesActualizados = 0;
      if (filasLocal.length > 0) {
        const validado = sql`"local".pin_estado = 'validado'`;
        const filas = await trx
          .insertInto('local')
          .values(filasLocal)
          .onConflict((oc) =>
            oc.columns(['cliente_id', 'direccion_norm']).doUpdateSet({
              comuna: sql`excluded.comuna`,
              nota: sql`coalesce(excluded.nota, "local".nota)`,
              lat: sql`case when ${validado} then "local".lat else coalesce(excluded.lat, "local".lat) end`,
              lng: sql`case when ${validado} then "local".lng else coalesce(excluded.lng, "local".lng) end`,
              pin_estado: sql`case when ${validado} then "local".pin_estado when excluded.lat is not null then 'sugerido' else "local".pin_estado end`,
              pin_fuente: sql`case when ${validado} then "local".pin_fuente when excluded.lat is not null then 'importado' else "local".pin_fuente end`,
            }),
          )
          .returning(sql<boolean>`(xmax = 0)`.as('creado'))
          .execute();
        localesCreados = filas.filter((f) => f.creado).length;
        localesActualizados = filas.length - localesCreados;
      }

      return { clientesCreados, clientesActualizados: clientes.length - clientesCreados, localesCreados, localesActualizados };
    });
  }

  async obtenerLocal(empresaId: string, localId: string): Promise<LocalDetalle | undefined> {
    const f = await this.db
      .selectFrom('local as l')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .select(['l.id', 'l.cliente_id', 'c.razon_social', 'c.rut', 'l.direccion', 'l.comuna', 'l.lat', 'l.lng', 'l.pin_estado', 'l.foto_path', 'l.streetview_rumbo', 'l.nota'])
      .where('l.id', '=', localId)
      .where('l.empresa_id', '=', empresaId)
      .executeTakeFirst();
    if (!f) return undefined;
    return {
      id: f.id,
      clienteId: f.cliente_id,
      razonSocial: f.razon_social,
      ...(f.rut !== null ? { rut: f.rut } : {}),
      direccion: f.direccion,
      comuna: f.comuna,
      ...(f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng } : {}),
      pinEstado: f.pin_estado,
      ...(f.foto_path !== null ? { fotoPath: f.foto_path } : {}),
      ...(f.streetview_rumbo !== null ? { streetviewRumbo: f.streetview_rumbo } : {}),
      ...(f.nota !== null ? { nota: f.nota } : {}),
    };
  }

  async actualizarLocal(empresaId: string, localId: string, c: CambiosLocal): Promise<boolean> {
    const cambios = sinNulos({
      nota: c.nota,
      streetview_rumbo: c.streetviewRumbo,
      foto_path: c.fotoPath,
      lat: c.pin?.lat,
      lng: c.pin?.lng,
      pin_estado: c.pin?.estado,
      pin_fuente: c.pin?.fuente,
    });
    if (Object.keys(cambios).length === 0) {
      const existe = await this.db.selectFrom('local').select('id').where('id', '=', localId).where('empresa_id', '=', empresaId).executeTakeFirst();
      return existe !== undefined;
    }
    const r = await this.db.updateTable('local').set(cambios).where('id', '=', localId).where('empresa_id', '=', empresaId).executeTakeFirst();
    return r.numUpdatedRows > 0n;
  }

  async fijarPinSiFalta(empresaId: string, localId: string, lat: number, lng: number): Promise<boolean> {
    const r = await this.db
      .updateTable('local')
      .set({ lat, lng, pin_estado: 'sugerido', pin_fuente: 'chofer' })
      .where('id', '=', localId)
      .where('empresa_id', '=', empresaId)
      .where('lat', 'is', null)
      .executeTakeFirst();
    return r.numUpdatedRows > 0n;
  }

  async coincidenciaDeDireccion(empresaId: string, rut: string | undefined, direccion: string): Promise<CoincidenciaLocal | undefined> {
    const norma = normalizarTexto(direccion);
    let consulta = this.db
      .selectFrom('local as l')
      .innerJoin('cliente as c', 'c.id', 'l.cliente_id')
      .select(['l.id', 'l.lat', 'l.lng'])
      .where('l.empresa_id', '=', empresaId)
      .where('l.direccion_norm', '=', norma)
      .limit(2);
    if (rut !== undefined) consulta = consulta.where('c.rut', '=', rut);
    const filas = await consulta.execute();
    // Sin RUT solo vale si la dirección identifica a un único local; si hay dos, se deja «sin local» para revisión humana.
    const f = rut === undefined && filas.length > 1 ? undefined : filas[0];
    return f ? { localId: f.id, ...(f.lat !== null && f.lng !== null ? { lat: f.lat, lng: f.lng } : {}) } : undefined;
  }
}
