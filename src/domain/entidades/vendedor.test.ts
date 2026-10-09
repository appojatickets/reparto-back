import { describe, expect, it } from 'vitest';
import { leerCeldaVendedores, normalizarCodigoVendedor } from './vendedor.js';

describe('código de vendedor', () => {
  it.each([['V12', 'V12'], ['v6', 'V06'], ['V 06', 'V06'], [' V006 ', 'V06'], ['V100', 'V100']])('%s → %s', (entrada, esperado) => {
    expect(normalizarCodigoVendedor(entrada)).toEqual({ ok: true, value: esperado });
  });
  it.each(['', 'X12', 'V', 'V1234', 'Vendedor 2'])('rechaza %s', (entrada) => {
    expect(normalizarCodigoVendedor(entrada).ok).toBe(false);
  });
});

describe('celda de vendedores de la planilla', () => {
  it('uno o varios, con nombre, separados por guion', () => {
    expect(leerCeldaVendedores('V12 Mario Quiroz- V13 Oscar baeza')).toEqual([{ codigo: 'V12', nombre: 'Mario Quiroz' }, { codigo: 'V13', nombre: 'Oscar baeza' }]);
    expect(leerCeldaVendedores('V03 Roberto del Rio - V07 Dario maldonado - V09 Luis budin')).toEqual([
      { codigo: 'V03', nombre: 'Roberto del Rio' }, { codigo: 'V07', nombre: 'Dario maldonado' }, { codigo: 'V09', nombre: 'Luis budin' },
    ]);
  });
  it('solo el código, con comas o sin separador', () => {
    expect(leerCeldaVendedores('V14')).toEqual([{ codigo: 'V14' }]);
    expect(leerCeldaVendedores('V05, V16')).toEqual([{ codigo: 'V05' }, { codigo: 'V16' }]);
    expect(leerCeldaVendedores('v1 Pedro v2 Juan')).toEqual([{ codigo: 'V01', nombre: 'Pedro' }, { codigo: 'V02', nombre: 'Juan' }]);
  });
  it('vacío o guion no tiene vendedores', () => {
    expect(leerCeldaVendedores('')).toEqual([]);
    expect(leerCeldaVendedores(' - ')).toEqual([]);
    expect(leerCeldaVendedores('sin vendedor')).toEqual([]);
  });
});
