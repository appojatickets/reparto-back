import { afterAll, describe, expect, it } from 'vitest';
import { PostgresEmpresaRepository, leerConfig } from '../../src/adapters/out/postgres/repositorio-empresa.js';
import { abrirDb, crearEmpresa } from './utils.js';

const db = abrirDb();
const empresas = new PostgresEmpresaRepository(db);
afterAll(() => db.destroy());

describe('configuración de la empresa', () => {
  it('una empresa recién creada usa los valores por defecto y no tiene depósito', async () => {
    const e = await crearEmpresa(db);
    expect(await empresas.obtenerConfig(e)).toEqual({ salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 });
  });

  it('guarda y lee el depósito, conserva otras claves de config y sube la versión', async () => {
    const e = await crearEmpresa(db);
    await db.updateTable('empresa').set({ config: JSON.stringify({ ruteo: { mu: 7 } }) }).where('id', '=', e).execute();
    await empresas.guardarConfig(e, { deposito: { lat: -33.45, lng: -70.66, nombre: 'Bodega' }, salidaPorDefectoMin: 450, horaLimiteRegresoMin: 1230 });
    expect(await empresas.obtenerConfig(e)).toEqual({ deposito: { lat: -33.45, lng: -70.66, nombre: 'Bodega' }, salidaPorDefectoMin: 450, horaLimiteRegresoMin: 1230 });
    const fila = await db.selectFrom('empresa').select(['config', 'config_version']).where('id', '=', e).executeTakeFirstOrThrow();
    expect(fila.config).toMatchObject({ ruteo: { mu: 7 } });
    expect(fila.config_version).toBe(2);
    await empresas.guardarConfig(e, { salidaPorDefectoMin: 450, horaLimiteRegresoMin: 1230 });
    expect((await empresas.obtenerConfig(e))?.deposito).toBeUndefined();
  });

  it('una empresa inexistente devuelve undefined', async () => {
    expect(await empresas.obtenerConfig('00000000-0000-4000-8000-000000000000')).toBeUndefined();
  });

  it('leerConfig tolera datos rotos', () => {
    expect(leerConfig(null)).toEqual({ salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 });
    expect(leerConfig({ deposito: { lat: 'x' }, salidaPorDefectoMin: '8' })).toEqual({ salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 });
  });
});
