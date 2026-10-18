import { describe, expect, it } from 'vitest';
import { validarEmergencia } from './emergencia.js';

describe('emergencia: voy a un mecánico o una vulcanización', () => {
  it('acepta mecánico y vulcanización sin posición (el GPS puede fallar)', () => {
    expect(validarEmergencia({ tipo: 'mecanico' })).toEqual({ ok: true, value: { tipo: 'mecanico' } });
    expect(validarEmergencia({ tipo: 'vulcanizacion' }).ok).toBe(true);
  });

  it('guarda la posición con su precisión cuando es válida y limpia los espacios del texto', () => {
    const r = validarEmergencia({ tipo: 'otro', texto: '  grúa   24 horas ', lat: -33.5, lng: -70.7, precisionM: 12 });
    expect(r).toEqual({ ok: true, value: { tipo: 'otro', texto: 'grúa 24 horas', lat: -33.5, lng: -70.7, precisionM: 12 } });
  });

  it('«otro» exige decir qué se busca y el texto no pasa de 80 letras', () => {
    expect(validarEmergencia({ tipo: 'otro' }).ok).toBe(false);
    expect(validarEmergencia({ tipo: 'otro', texto: '   ' }).ok).toBe(false);
    expect(validarEmergencia({ tipo: 'mecanico', texto: 'x'.repeat(81) }).ok).toBe(false);
  });

  it('rechaza un tipo desconocido, una posición a medias o fuera de la región', () => {
    expect(validarEmergencia({ tipo: 'taxi' }).ok).toBe(false);
    expect(validarEmergencia({ tipo: 'mecanico', lat: -33.5 }).ok).toBe(false);
    expect(validarEmergencia({ tipo: 'mecanico', lat: 40, lng: -3 }).ok).toBe(false);
  });
});
