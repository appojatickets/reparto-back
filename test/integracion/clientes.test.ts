import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ClienteImportable } from '../../src/domain/importacion/fila-cliente.js';
import { PostgresClienteRepository } from '../../src/adapters/out/postgres/repositorio-clientes.js';
import { abrirDb, crearEmpresa } from './utils.js';

const db = abrirDb();
const repo = new PostgresClienteRepository(db);
afterAll(() => db.destroy());

const cliente = (n: number, extra: Partial<ClienteImportable> = {}): ClienteImportable => ({
  claveCliente: `c${n}`,
  rut: `${10_000_000 + n}-9`,
  razonSocial: `Cliente ${n}`,
  locales: [{ claveLocal: `c${n}|calle ${n}`, direccion: `Calle ${n} 100`, comuna: 'Maipú', indices: [n] }],
  ...extra,
});

describe('búsqueda por trigramas con 5.000 clientes', () => {
  let empresa = '';
  beforeAll(async () => {
    empresa = await crearEmpresa(db, 'Carga');
    const tipos = ['Almacén', 'Minimarket', 'Botillería', 'Panadería', 'Ferretería', 'Kiosko', 'Supermercado', 'Abarrotes', 'Frutería', 'Carnicería'];
    const apellidos = ['Soto', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'González', 'Silva', 'Contreras', 'Fuentes', 'Vargas', 'Araya', 'Tapia'];
    const calles = ['Av. Pajaritos', 'Gran Avenida', 'Av. Providencia', 'Las Torres', 'Los Aromos', 'San Pablo', 'Vicuña Mackenna'];
    const todos: ClienteImportable[] = Array.from({ length: 4999 }, (_, i) => ({
      claveCliente: `k${i}`,
      ...(i % 3 === 0 ? {} : { rut: `${20_000_000 + i}-9` }),
      razonSocial: `${tipos[i % 10]} ${apellidos[i % 12]} ${i}`,
      locales: [{ claveLocal: `k${i}|d`, direccion: `${calles[i % 7]} ${i + 1}`, comuna: i % 2 ? 'Maipú' : 'Ñuñoa', indices: [i] }],
    }));
    todos.push({
      claveCliente: 'rabelo',
      rut: '76543210-3',
      razonSocial: 'Rabelo Mágica SpA',
      locales: [{ claveLocal: 'rabelo|d', direccion: 'Av. Providencia 2500', comuna: 'Providencia', indices: [5000] }],
    });
    for (let i = 0; i < todos.length; i += 500) await repo.importar(empresa, todos.slice(i, i + 500));
    await sql`analyze cliente`.execute(db);
    await sql`analyze "local"`.execute(db);
  });

  const medir = async (texto: string, comuna?: string) => {
    const t0 = performance.now();
    const r = await repo.buscar(empresa, { texto, limite: 8, ...(comuna ? { comuna } : {}) });
    return { r, ms: performance.now() - t0 };
  };

  it('«rabe» devuelve «Rabelo Mágica SpA» en menos de 300 ms (criterio de la fase)', async () => {
    await medir('rabe'); // calienta la conexión
    const tiempos: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { r, ms } = await medir('rabe');
      tiempos.push(ms);
      expect(r[0]?.razonSocial).toBe('Rabelo Mágica SpA');
    }
    console.log(`búsqueda «rabe» con 5.000 clientes: máx ${Math.max(...tiempos).toFixed(1)} ms, mediana ${[...tiempos].sort((a, b) => a - b)[5]?.toFixed(1)} ms`);
    expect(Math.max(...tiempos)).toBeLessThan(300);
  });

  it('encuentra por dirección, tolera errores de dictado y respeta el filtro de comuna', async () => {
    expect((await medir('providencia 2500')).r[0]?.razonSocial).toBe('Rabelo Mágica SpA');
    expect((await medir('rabello')).r.map((x) => x.razonSocial)).toContain('Rabelo Mágica SpA'); // error de dictado
    expect((await medir('rabe', 'Providencia')).r).toHaveLength(1);
    expect((await medir('rabe', 'Maipú')).r).toHaveLength(0);
  });

  it('el autocompletado típico (3 a 6 letras) responde rápido y respeta el límite', async () => {
    for (const q of ['alm', 'kios', 'panad', 'soto 1', 'gran av']) {
      const { r, ms } = await medir(q);
      expect(r.length).toBeGreaterThan(0);
      expect(r.length).toBeLessThanOrEqual(8);
      expect(ms).toBeLessThan(300);
    }
  });

  it('las filas traen lo que el front necesita y los caracteres especiales no rompen la consulta', async () => {
    const { r } = await medir('rabe');
    expect(r[0]).toMatchObject({ comuna: 'Providencia', pinEstado: 'pendiente' });
    for (const raro of ['100%', 'a_b', "o'higgins", '\\', '%%', 'a'.repeat(300)]) await expect(medir(raro)).resolves.toBeDefined();
  });
});

describe('importar', () => {
  it('crea, vuelve a importar sin duplicar y cuenta bien lo creado y lo actualizado', async () => {
    const e = await crearEmpresa(db);
    const sinRut: ClienteImportable = { claveCliente: 's3', razonSocial: 'Cliente 3', locales: [{ claveLocal: 's3|d', direccion: 'Calle 3 100', comuna: 'Maipú', indices: [3] }] };
    const lote = [cliente(1), cliente(2), sinRut];
    const a = await repo.importar(e, lote);
    expect(a).toEqual({ clientesCreados: 3, clientesActualizados: 0, localesCreados: 3, localesActualizados: 0 });
    const b = await repo.importar(e, [{ ...cliente(1), razonSocial: 'Cliente 1 renombrado' }, ...lote.slice(1)]);
    expect(b).toEqual({ clientesCreados: 0, clientesActualizados: 3, localesCreados: 0, localesActualizados: 3 });
    const filas = await db.selectFrom('cliente').select(['razon_social', 'estado']).where('empresa_id', '=', e).orderBy('razon_social').execute();
    expect(filas.map((f) => f.razon_social)).toEqual(['Cliente 1 renombrado', 'Cliente 2', 'Cliente 3']);
    expect(filas.every((f) => f.estado === 'activo')).toBe(true);
  });

  it('un cliente con varias direcciones queda con varios locales', async () => {
    const e = await crearEmpresa(db);
    const c = cliente(7, { locales: [
      { claveLocal: 'a', direccion: 'Calle A 1', comuna: 'Maipú', indices: [0] },
      { claveLocal: 'b', direccion: 'Calle B 2', comuna: 'Ñuñoa', indices: [1] },
    ] });
    expect(await repo.importar(e, [c])).toMatchObject({ clientesCreados: 1, localesCreados: 2 });
  });

  it('un pin importado entra «sugerido» y nunca pisa uno ya validado', async () => {
    const e = await crearEmpresa(db);
    const conPin = (lat: number): ClienteImportable => cliente(9, { locales: [{ claveLocal: 'x', direccion: 'Calle 9 100', comuna: 'Maipú', lat, lng: -70.7, indices: [0] }] });
    await repo.importar(e, [conPin(-33.5)]);
    const [{ id: localId } = { id: '' }] = await db.selectFrom('local').select('id').where('empresa_id', '=', e).execute();
    expect(await db.selectFrom('local').select(['pin_estado', 'pin_fuente', 'lat']).where('id', '=', localId).executeTakeFirst()).toMatchObject({ pin_estado: 'sugerido', pin_fuente: 'importado', lat: -33.5 });

    await repo.actualizarLocal(e, localId, { pin: { lat: -33.51, lng: -70.71, estado: 'validado', fuente: 'manual' } });
    await repo.importar(e, [conPin(-33.9)]); // reimportar con otro pin
    expect(await db.selectFrom('local').select(['pin_estado', 'lat']).where('id', '=', localId).executeTakeFirst()).toMatchObject({ pin_estado: 'validado', lat: -33.51 });
  });

  it('sin RUT: se reconoce al cliente por razón social + dirección y no se duplica', async () => {
    const e = await crearEmpresa(db);
    const sinRut = (razon: string, dir: string): ClienteImportable => ({ claveCliente: `s:${razon}`, razonSocial: razon, locales: [{ claveLocal: `${razon}|${dir}`, direccion: dir, comuna: 'Maipú', indices: [0] }] });
    await repo.importar(e, [sinRut('Kiosko Sol', 'Calle 1 10')]);
    await repo.importar(e, [sinRut('KIOSKO  SOL', 'calle 1 10')]);
    expect(await db.selectFrom('cliente').select('id').where('empresa_id', '=', e).execute()).toHaveLength(1);
    expect(await db.selectFrom('local').select('id').where('empresa_id', '=', e).execute()).toHaveLength(1);
  });
});

describe('crearConLocal', () => {
  const datos = { razonSocial: 'Botillería El Sol', estado: 'nuevo' as const, local: { direccion: 'Calle Falsa 123', comuna: 'Maipú', pinEstado: 'pendiente' as const } };

  it('crea cliente y local; el mismo cliente y dirección devuelve el existente (completándolo); con RUT reutiliza al cliente', async () => {
    const e = await crearEmpresa(db);
    const a = await repo.crearConLocal(e, { ...datos, rut: '12345678-5' });
    expect(a.ok && a.value.existente).toBe(false);
    const repetida = await repo.crearConLocal(e, { ...datos, rut: '12345678-5' });
    expect(repetida.ok && repetida.value.existente).toBe(true);
    expect(a.ok && repetida.ok && repetida.value.localId === a.value.localId).toBe(true);
    const otraDir = await repo.crearConLocal(e, { ...datos, rut: '12345678-5', local: { ...datos.local, direccion: 'Otra 55' } });
    expect(a.ok && otraDir.ok && otraDir.value.clienteId === a.value.clienteId).toBe(true);
    const sinRut = { ...datos, razonSocial: 'Botillería Sin RUT' };
    const s1 = await repo.crearConLocal(e, sinRut);
    expect(s1.ok && s1.value.existente).toBe(false);
    const s2 = await repo.crearConLocal(e, sinRut);
    expect(s1.ok && s2.ok && s2.value.existente && s2.value.localId === s1.value.localId).toBe(true);
  });

  it('el existente incompleto se completa con lo que le faltaba (RUT, nota y pin) sin pisar lo que ya tenía', async () => {
    const e = await crearEmpresa(db);
    const a = await repo.crearConLocal(e, { ...datos, local: { ...datos.local, nota: 'portón verde' } });
    expect(a.ok).toBe(true);
    const b = await repo.crearConLocal(e, { ...datos, rut: '12345678-5', local: { ...datos.local, nota: 'otra nota', lat: -33.5, lng: -70.7, pinEstado: 'validado', pinFuente: 'manual' } });
    expect(b.ok && b.value.existente).toBe(true);
    const local = await db.selectFrom('local').select(['lat', 'lng', 'nota', 'pin_estado']).where('id', '=', b.ok ? b.value.localId : '').executeTakeFirstOrThrow();
    expect(local).toMatchObject({ lat: -33.5, lng: -70.7, nota: 'portón verde', pin_estado: 'validado' });
    const cliente = await db.selectFrom('cliente').select('rut').where('id', '=', b.ok ? b.value.clienteId : '').executeTakeFirstOrThrow();
    expect(cliente.rut).toBe('12345678-5');
    // Un pin que ya existía no se pisa.
    const c = await repo.crearConLocal(e, { ...datos, local: { ...datos.local, lat: -33.9, lng: -70.1, pinEstado: 'validado', pinFuente: 'manual' } });
    expect(c.ok && c.value.existente).toBe(true);
    const igual = await db.selectFrom('local').select(['lat']).where('id', '=', c.ok ? c.value.localId : '').executeTakeFirstOrThrow();
    expect(igual.lat).toBe(-33.5);
  });
});

describe('aislamiento entre empresas (nadie ve datos de otra empresa)', () => {
  it('buscar, obtener, actualizar y reconocer direcciones respetan la empresa', async () => {
    const a = await crearEmpresa(db, 'A');
    const b = await crearEmpresa(db, 'B');
    await repo.importar(a, [cliente(1, { razonSocial: 'Secreto SpA', rut: '55555555-5' })]);
    const [{ id: localId } = { id: '' }] = await db.selectFrom('local').select('id').where('empresa_id', '=', a).execute();

    expect(await repo.buscar(b, { texto: 'secreto', limite: 8 })).toEqual([]);
    expect(await repo.buscar(a, { texto: 'secreto', limite: 8 })).toHaveLength(1);
    expect(await repo.obtenerLocal(b, localId)).toBeUndefined();
    expect(await repo.obtenerLocal(a, localId)).toMatchObject({ razonSocial: 'Secreto SpA' });
    expect(await repo.actualizarLocal(b, localId, { nota: 'hackeado' })).toBe(false);
    expect((await repo.obtenerLocal(a, localId))?.nota).toBeUndefined();
    expect(await repo.coincidenciaDeDireccion(b, '55555555-5', 'Calle 1 100')).toBeUndefined();
    expect(await repo.coincidenciaDeDireccion(a, '55555555-5', 'calle 1 100')).toMatchObject({ localId });
  });

  it('actualizarLocal guarda nota, rumbo y foto', async () => {
    const e = await crearEmpresa(db);
    await repo.importar(e, [cliente(1)]);
    const [{ id: localId } = { id: '' }] = await db.selectFrom('local').select('id').where('empresa_id', '=', e).execute();
    expect(await repo.actualizarLocal(e, localId, { nota: 'portón verde', streetviewRumbo: 120, fotoPath: `${e}/${localId}/x.webp` })).toBe(true);
    expect(await repo.obtenerLocal(e, localId)).toMatchObject({ nota: 'portón verde', streetviewRumbo: 120, fotoPath: `${e}/${localId}/x.webp` });
    expect(await repo.actualizarLocal(e, '00000000-0000-0000-0000-000000000000', { nota: 'x' })).toBe(false);
  });

  it('sin RUT, una dirección que identifica a dos locales no se asigna sola', async () => {
    const e = await crearEmpresa(db);
    const mismaDir = (n: number): ClienteImportable => cliente(n, { locales: [{ claveLocal: `d${n}`, direccion: 'Plaza Central 1', comuna: 'Maipú', indices: [n] }] });
    await repo.importar(e, [mismaDir(1)]);
    expect(await repo.coincidenciaDeDireccion(e, undefined, 'plaza central 1')).toBeDefined();
    await repo.importar(e, [mismaDir(2)]);
    expect(await repo.coincidenciaDeDireccion(e, undefined, 'plaza central 1')).toBeUndefined();
  });
});

describe('búsqueda por RUT', () => {
  it('encuentra al cliente y todas sus direcciones por RUT (con o sin dígito verificador), y respeta empresa y comuna', async () => {
    const a = await crearEmpresa(db, 'A-rut');
    const b = await crearEmpresa(db, 'B-rut');
    await repo.importar(a, [
      { claveCliente: 'x', rut: '77975918-0', razonSocial: 'Rabelo Mágica SpA', locales: [
        { claveLocal: 'x|1', direccion: 'Av. Colón Sur 765', comuna: 'San Bernardo', indices: [0] },
        { claveLocal: 'x|2', direccion: 'Gran Avenida 1000', comuna: 'La Cisterna', indices: [1] },
      ] },
      { claveCliente: 'y', rut: '12345678-5', razonSocial: 'Otro SpA', locales: [{ claveLocal: 'y|1', direccion: 'Calle 1 10', comuna: 'Maipú', indices: [2] }] },
    ]);
    await repo.importar(b, [{ claveCliente: 'z', rut: '77975918-0', razonSocial: 'Ajeno', locales: [{ claveLocal: 'z|1', direccion: 'Calle 9 9', comuna: 'Maipú', indices: [0] }] }]);

    const porCuerpo = await repo.buscar(a, { texto: '', rutDigitos: '77975918', limite: 8 });
    expect(porCuerpo.map((r) => r.direccion).sort()).toEqual(['Av. Colón Sur 765', 'Gran Avenida 1000']);
    expect(porCuerpo.every((r) => r.razonSocial === 'Rabelo Mágica SpA')).toBe(true);
    expect((await repo.buscar(a, { texto: '', rutDigitos: '779759180', limite: 8 })).length).toBe(2);
    expect((await repo.buscar(a, { texto: '', rutDigitos: '77975', limite: 8 })).length).toBe(2); // prefijo
    expect((await repo.buscar(a, { texto: '', rutDigitos: '77975918', comuna: 'San Bernardo', limite: 8 })).map((r) => r.direccion)).toEqual(['Av. Colón Sur 765']);
    expect(await repo.buscar(a, { texto: '', rutDigitos: '99999999', limite: 8 })).toEqual([]);
    expect((await repo.buscar(b, { texto: '', rutDigitos: '77975918', limite: 8 })).map((r) => r.razonSocial)).toEqual(['Ajeno']);
  });
});
