import { describe, expect, it } from 'vitest';
import { estadoTras, puedeFijarPin, validarEvento } from './entrega.js';

const pos = { lat: -33.45, lng: -70.66, precisionM: 12 };
const codigos = (e: Parameters<typeof validarEvento>[0]) => { const r = validarEvento(e); return r.ok ? [] : r.error.map((x) => x.codigo); };

describe('validarEvento', () => {
  it('acepta llegada, entregado y cerrado con o sin posición', () => {
    expect(validarEvento({ tipo: 'llegada', ...pos })).toEqual({ ok: true, value: { tipo: 'llegada', lat: -33.45, lng: -70.66, precisionM: 12 } });
    expect(validarEvento({ tipo: 'entregado' })).toEqual({ ok: true, value: { tipo: 'entregado' } });
    expect(validarEvento({ tipo: 'cerrado', ...pos }).ok).toBe(true);
  });

  it('rechaza un tipo desconocido', () => {
    expect(codigos({ tipo: 'volar' })).toEqual(['TIPO_INVALIDO']);
  });

  it('la posición debe venir completa, ser válida y estar en la Región Metropolitana', () => {
    expect(codigos({ tipo: 'llegada', lat: -33.4 })).toEqual(['POSICION_INCOMPLETA']);
    expect(codigos({ tipo: 'llegada', lat: -41.47, lng: -72.94 })).toEqual(['POSICION_INVALIDA']);
    expect(codigos({ tipo: 'llegada', lat: 200, lng: 0 })).toEqual(['POSICION_INVALIDA']);
    expect(codigos({ tipo: 'llegada', ...pos, precisionM: -1 })).toEqual(['PRECISION_INVALIDA']);
  });

  it('la espera exige minutos válidos; los minutos no valen en otros avisos', () => {
    expect(validarEvento({ tipo: 'espera', minutos: 15 })).toEqual({ ok: true, value: { tipo: 'espera', minutos: 15 } });
    expect(codigos({ tipo: 'espera' })).toEqual(['MINUTOS_INVALIDOS']);
    expect(codigos({ tipo: 'espera', minutos: 0 })).toEqual(['MINUTOS_INVALIDOS']);
    expect(codigos({ tipo: 'espera', minutos: 241 })).toEqual(['MINUTOS_INVALIDOS']);
    expect(codigos({ tipo: 'cerrado', minutos: 5 })).toEqual(['MINUTOS_NO_APLICA']);
  });

  it('no entregado exige motivo válido; el motivo no vale en otros avisos', () => {
    expect(validarEvento({ tipo: 'no_entregado', motivo: 'cerrado' })).toEqual({ ok: true, value: { tipo: 'no_entregado', motivo: 'cerrado' } });
    expect(codigos({ tipo: 'no_entregado' })).toEqual(['MOTIVO_REQUERIDO']);
    expect(codigos({ tipo: 'no_entregado', motivo: 'quien sabe' })).toEqual(['MOTIVO_REQUERIDO']);
    expect(codigos({ tipo: 'entregado', motivo: 'otro' })).toEqual(['MOTIVO_NO_APLICA']);
  });

  it('la precisión solo se guarda junto con una posición', () => {
    expect(validarEvento({ tipo: 'entregado', precisionM: 5 })).toEqual({ ok: true, value: { tipo: 'entregado' } });
  });
});

describe('estadoTras', () => {
  it('entregado → entregada, no entregado → no entregada, el resto no cambia la factura', () => {
    expect(estadoTras('entregado')).toBe('entregada');
    expect(estadoTras('no_entregado')).toBe('no_entregada');
    for (const t of ['llegada', 'cerrado', 'espera', 'vuelve_mas_tarde'] as const) expect(estadoTras(t)).toBeUndefined();
  });
});

describe('puedeFijarPin (pin colaborativo)', () => {
  const llegada = { tipo: 'llegada' as const, lat: -33.45, lng: -70.66, precisionM: 20 };
  it('un local sin pin toma una posición precisa', () => {
    expect(puedeFijarPin(llegada, false)).toBe(true);
    expect(puedeFijarPin({ ...llegada, tipo: 'entregado' }, false)).toBe(true);
    expect(puedeFijarPin({ ...llegada, tipo: 'cerrado' }, false)).toBe(true);
  });
  it('si ya tiene pin, la posición es solo evidencia', () => {
    expect(puedeFijarPin(llegada, true)).toBe(false);
  });
  it('una posición imprecisa, sin precisión o sin coordenadas no fija nada', () => {
    expect(puedeFijarPin({ ...llegada, precisionM: 150 }, false)).toBe(false);
    expect(puedeFijarPin({ tipo: 'llegada', lat: -33.45, lng: -70.66 }, false)).toBe(false);
    expect(puedeFijarPin({ tipo: 'llegada' }, false)).toBe(false);
  });
  it('esperar o no entregar no fijan pin', () => {
    expect(puedeFijarPin({ ...llegada, tipo: 'espera' }, false)).toBe(false);
  });
});
