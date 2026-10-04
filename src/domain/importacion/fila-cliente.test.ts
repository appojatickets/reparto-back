import { describe, expect, it } from 'vitest';
import { agruparPorCliente, consolidarFilas, validarFilaCliente, type FilaClienteCruda } from './fila-cliente.js';

const valida: FilaClienteCruda = {
  rut: '12.345.678-5',
  razonSocial: '  Rabelo   Mágica SpA ',
  giro: 'Minimarket',
  direccion: 'Av. Providencia 1234',
  comuna: 'providencia',
};

const ok = (f: FilaClienteCruda) => {
  const r = validarFilaCliente(f);
  if (!r.ok) throw new Error(`debía ser válida: ${r.error.map((e) => e.codigo).join()}`);
  return r.value;
};
const codigos = (f: FilaClienteCruda) => {
  const r = validarFilaCliente(f);
  return r.ok ? [] : r.error.map((e) => e.codigo);
};

describe('validarFilaCliente', () => {
  it('normaliza RUT, razón social y comuna', () => {
    const v = ok(valida);
    expect(v.rut).toBe('12345678-5');
    expect(v.razonSocial).toBe('Rabelo Mágica SpA');
    expect(v.comuna).toBe('Providencia');
  });

  it('el RUT es opcional; vacío cuenta como ausente', () => {
    expect(ok({ ...valida, rut: '' }).rut).toBeUndefined();
    expect(ok({ ...valida, rut: undefined }).rut).toBeUndefined();
  });

  it('acepta coordenadas como número o como texto con coma decimal', () => {
    const v = ok({ ...valida, lat: '-33,4372', lng: -70.6506 });
    expect(v.lat).toBeCloseTo(-33.4372, 6);
    expect(v.lng).toBeCloseTo(-70.6506, 6);
  });

  it('junta todos los errores de la fila', () => {
    expect(codigos({ razonSocial: '', direccion: '', comuna: 'Valparaíso', rut: '1-8' })).toEqual([
      'RAZON_SOCIAL_REQUERIDA',
      'DIRECCION_REQUERIDA',
      'COMUNA_INVALIDA',
      'RUT_DV_INVALIDO',
    ]);
  });

  it('las coordenadas vienen en par, son números y caen en la Región Metropolitana', () => {
    expect(codigos({ ...valida, lat: -33.4 })).toContain('PIN_INCOMPLETO');
    expect(codigos({ ...valida, lat: 'abc', lng: 'x' })).toContain('PIN_INVALIDO');
    expect(codigos({ ...valida, lat: -41.47, lng: -72.94 })).toContain('PIN_FUERA_DE_REGION');
  });

  it('limita el largo de los campos de texto', () => {
    expect(codigos({ ...valida, razonSocial: 'x'.repeat(201) })).toContain('RAZON_SOCIAL_LARGA');
    expect(codigos({ ...valida, nota: 'x'.repeat(501) })).toContain('NOTA_LARGA');
  });
});

describe('consolidarFilas', () => {
  it('une las filas repetidas (mismo RUT y dirección) y recuerda de qué filas vienen', () => {
    const a = ok(valida);
    const b = ok({ ...valida, direccion: 'AV PROVIDENCIA 1234', giro: 'Abarrotes' });
    const c = ok({ ...valida, direccion: 'Otra 55' });
    const r = consolidarFilas([a, b, c]);
    expect(r).toHaveLength(2);
    expect(r[0]?.fila.giro).toBe('Abarrotes'); // la última fila gana
    expect(r[0]?.indices).toEqual([0, 1]);
    expect(r[1]?.indices).toEqual([2]);
  });

  it('sin RUT, el cliente se identifica por razón social + dirección', () => {
    const sinRut = { ...valida, rut: undefined };
    const r = consolidarFilas([ok(sinRut), ok({ ...sinRut, razonSocial: 'Otro Nombre' })]);
    expect(r).toHaveLength(2);
  });
});

describe('agruparPorCliente', () => {
  it('un cliente con dos direcciones queda con dos locales', () => {
    const a = ok(valida);
    const b = ok({ ...valida, direccion: 'Otra 55', giro: 'Ferretería' });
    const [cliente, ...resto] = agruparPorCliente(consolidarFilas([a, b]));
    expect(resto).toEqual([]);
    expect(cliente?.locales.map((l) => l.direccion)).toEqual(['Av. Providencia 1234', 'Otra 55']);
    expect(cliente?.giro).toBe('Ferretería');
    expect(cliente?.rut).toBe('12345678-5');
  });
});
