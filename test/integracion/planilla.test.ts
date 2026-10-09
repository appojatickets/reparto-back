import { afterAll, describe, expect, it } from 'vitest';
import { PostgresCamionRepository } from '../../src/adapters/out/postgres/repositorio-camiones.js';
import { PostgresPlanillaRepository } from '../../src/adapters/out/postgres/repositorio-planillas.js';
import { PostgresVendedorRepository } from '../../src/adapters/out/postgres/repositorio-vendedores.js';
import { abrirDb, crearEmpresa, crearUsuario } from './utils.js';

const db = abrirDb();
const vendedores = new PostgresVendedorRepository(db);
const planillas = new PostgresPlanillaRepository(db);
const camiones = new PostgresCamionRepository(db);
afterAll(() => db.destroy());

const FECHA = '2026-10-05';
const camionDe = async (empresa: string, patente: string, alias?: string): Promise<string> => {
  const r = await camiones.crear(empresa, { patente, ...(alias !== undefined ? { alias } : {}) });
  if (!r.ok) throw new Error('camión');
  return r.value.id;
};

describe('vendedores (Postgres)', () => {
  it('crea con celular, lista ordenado por código y rechaza un código repetido solo dentro de la misma empresa', async () => {
    const e1 = await crearEmpresa(db);
    const e2 = await crearEmpresa(db);
    const v12 = await vendedores.crear(e1, { codigo: 'V12', nombre: 'Ana Soto', celular: '56912345678' });
    expect(v12.ok && v12.value).toMatchObject({ codigo: 'V12', nombre: 'Ana Soto', celular: '56912345678', activo: true });
    await vendedores.crear(e1, { codigo: 'V03', nombre: 'Luis' });
    const repetido = await vendedores.crear(e1, { codigo: 'V12', nombre: 'Otra' });
    expect(!repetido.ok && repetido.error).toBe('CODIGO_DUPLICADO');
    expect((await vendedores.crear(e2, { codigo: 'V12', nombre: 'Ana' })).ok).toBe(true);
    expect((await vendedores.listar(e1, {})).map((v) => v.codigo)).toEqual(['V03', 'V12']);
  });

  it('asegurar crea los que faltan (el código hace de nombre), completa el nombre de los que no lo tenían y no pisa uno puesto', async () => {
    const e = await crearEmpresa(db);
    await vendedores.crear(e, { codigo: 'V01', nombre: 'Original' });
    await vendedores.crear(e, { codigo: 'V02', nombre: 'V02' });
    const r = await vendedores.asegurar(e, [{ codigo: 'V01', nombre: 'Otro' }, { codigo: 'V02', nombre: 'Marta' }, { codigo: 'V03' }]);
    expect(r.creados).toBe(1);
    expect(r.vendedores.map((v) => [v.codigo, v.nombre])).toEqual([['V01', 'Original'], ['V02', 'Marta'], ['V03', 'V03']]);
    expect(await vendedores.asegurar(e, [])).toEqual({ vendedores: [], creados: 0 });
    expect((await vendedores.listar(e, {})).length).toBe(3);
  });

  it('asegurar no toca a los vendedores de otra empresa', async () => {
    const e1 = await crearEmpresa(db);
    const e2 = await crearEmpresa(db);
    await vendedores.crear(e2, { codigo: 'V01', nombre: 'V01' });
    await vendedores.asegurar(e1, [{ codigo: 'V01', nombre: 'Ana' }]);
    expect((await vendedores.listar(e2, {}))[0]?.nombre).toBe('V01');
  });
});

describe('planilla del día (Postgres)', () => {
  it('guarda la asignación con personas, comunas y vendedores y la devuelve por día y por camión', async () => {
    const e = await crearEmpresa(db);
    const juan = await crearUsuario(db, e, 'chofer', `c${Math.random().toString(36).slice(2, 8)}`);
    const admin = await crearUsuario(db, e, 'admin', `a${Math.random().toString(36).slice(2, 8)}`);
    const cam1 = await camionDe(e, 'ABCD12', '12');
    const cam2 = await camionDe(e, 'WXYZ99');
    const vs = await vendedores.asegurar(e, [{ codigo: 'V02', nombre: 'Marta' }, { codigo: 'V01' }]);
    await vendedores.actualizar(e, vs.vendedores[0]?.id ?? '', { celular: '56911112222' });
    await planillas.guardar(e, FECHA, [
      { camionId: cam1, chofer: { nombre: 'Juan Pérez', usuarioId: juan }, ayudante: { nombre: 'Pedro Sin Usuario' }, comunas: ['Maipú', 'Pudahuel'], vendedorIds: vs.vendedores.map((v) => v.id) },
      { camionId: cam2, comunas: [], vendedorIds: [] },
    ], admin);

    const dia = await planillas.obtener(e, FECHA);
    expect(dia.map((a) => a.camion.patente)).toEqual(['ABCD12', 'WXYZ99']);
    expect(dia[0]).toMatchObject({
      fecha: FECHA,
      camion: { id: cam1, patente: 'ABCD12', alias: '12' },
      chofer: { nombre: 'Juan Pérez', usuarioId: juan },
      ayudante: { nombre: 'Pedro Sin Usuario' },
      comunas: ['Maipú', 'Pudahuel'],
    });
    expect(dia[0]?.ayudante && 'usuarioId' in dia[0].ayudante).toBe(false);
    expect(dia[0]?.vendedores.map((v) => [v.codigo, v.celular])).toEqual([['V01', undefined], ['V02', '56911112222']]);
    expect(dia[1]).toMatchObject({ comunas: [], vendedores: [] });
    expect(dia[1] && 'chofer' in dia[1]).toBe(false);

    const uno = await planillas.deCamion(e, FECHA, cam1);
    expect(uno?.camion.id).toBe(cam1);
    expect(await planillas.deCamion(e, '2026-10-06', cam1)).toBeUndefined();
    expect(await planillas.obtener(e, '2026-10-06')).toEqual([]);
  });

  it('volver a guardar el mismo camión reemplaza su asignación y no toca los demás camiones ni otros días', async () => {
    const e = await crearEmpresa(db);
    const admin = await crearUsuario(db, e, 'admin', `a${Math.random().toString(36).slice(2, 8)}`);
    const cam1 = await camionDe(e, 'ABCD12');
    const cam2 = await camionDe(e, 'WXYZ99');
    const vs = await vendedores.asegurar(e, [{ codigo: 'V01' }, { codigo: 'V02' }]);
    const [v1, v2] = vs.vendedores;
    await planillas.guardar(e, FECHA, [{ camionId: cam1, comunas: ['Maipú'], vendedorIds: [v1?.id ?? ''] }, { camionId: cam2, comunas: ['Ñuñoa'], vendedorIds: [] }], admin);
    await planillas.guardar(e, '2026-10-06', [{ camionId: cam1, comunas: ['Lampa'], vendedorIds: [] }], admin);

    await planillas.guardar(e, FECHA, [{ camionId: cam1, chofer: { nombre: 'Nuevo Chofer' }, comunas: ['Providencia'], vendedorIds: [v2?.id ?? ''] }], admin);

    const dia = await planillas.obtener(e, FECHA);
    expect(dia).toHaveLength(2);
    const a1 = dia.find((a) => a.camion.id === cam1);
    expect(a1).toMatchObject({ chofer: { nombre: 'Nuevo Chofer' }, comunas: ['Providencia'] });
    expect(a1?.vendedores.map((v) => v.codigo)).toEqual(['V02']);
    expect(dia.find((a) => a.camion.id === cam2)?.comunas).toEqual(['Ñuñoa']);
    expect((await planillas.deCamion(e, '2026-10-06', cam1))?.comunas).toEqual(['Lampa']);
  });

  it('una empresa no ve la planilla de otra', async () => {
    const e1 = await crearEmpresa(db);
    const e2 = await crearEmpresa(db);
    const admin = await crearUsuario(db, e1, 'admin', `a${Math.random().toString(36).slice(2, 8)}`);
    const cam = await camionDe(e1, 'ABCD12');
    await planillas.guardar(e1, FECHA, [{ camionId: cam, comunas: [], vendedorIds: [] }], admin);
    expect(await planillas.obtener(e2, FECHA)).toEqual([]);
    expect(await planillas.deCamion(e2, FECHA, cam)).toBeUndefined();
  });
});
