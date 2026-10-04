import { describe, expect, it } from 'vitest';
import { transicionarParada, type EstadoParada } from './parada.js';

describe('transicionarParada', () => {
  it.each([
    ['ENTREGADO', 'entregada'],
    ['PARCIAL', 'parcial'],
    ['NO_PUDE', 'no_pudo'],
    ['QUITADA', 'quitada'],
  ] as const)('desde pendiente, %s → %s', (evento, esperado) => {
    expect(transicionarParada('pendiente', evento)).toEqual({ ok: true, value: esperado });
  });

  it.each(['entregada', 'parcial', 'no_pudo', 'quitada'] as const)('DESHECHO desde %s vuelve a pendiente', (estado) => {
    expect(transicionarParada(estado, 'DESHECHO')).toEqual({ ok: true, value: 'pendiente' });
  });

  it('no se puede marcar una parada que ya no está pendiente', () => {
    const r = transicionarParada('entregada', 'NO_PUDE');
    expect(!r.ok && r.error.codigo).toBe('TRANSICION_INVALIDA');
  });

  it('no se puede deshacer lo que está pendiente', () => {
    const r = transicionarParada('pendiente' satisfies EstadoParada, 'DESHECHO');
    expect(!r.ok && r.error.codigo).toBe('TRANSICION_INVALIDA');
  });
});
