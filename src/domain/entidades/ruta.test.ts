import { describe, expect, it } from 'vitest';
import { aplicarEvento, conteoFinal, pendientes, siguienteParada, type Ruta } from './ruta.js';

const ruta: Ruta = {
  id: 'r1',
  paradas: [
    { id: 'c', localId: 'l3', estado: 'pendiente', ordenPlan: 3 },
    { id: 'a', localId: 'l1', estado: 'entregada', ordenPlan: 1 },
    { id: 'b', localId: 'l2', estado: 'pendiente', ordenPlan: 2 },
    { id: 'd', localId: 'l4', estado: 'quitada', ordenPlan: 4 },
  ],
};

describe('Ruta', () => {
  it('pendientes salen ordenadas por el orden planificado', () => {
    expect(pendientes(ruta).map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('siguienteParada es la primera pendiente, o undefined si no queda ninguna', () => {
    expect(siguienteParada(ruta)?.id).toBe('b');
    expect(siguienteParada({ id: 'x', paradas: [] })).toBeUndefined();
  });

  it('aplicarEvento cambia solo la parada indicada y no muta la ruta original', () => {
    const r = aplicarEvento(ruta, 'b', 'ENTREGADO');
    expect(r.ok && r.value.paradas.find((p) => p.id === 'b')?.estado).toBe('entregada');
    expect(ruta.paradas.find((p) => p.id === 'b')?.estado).toBe('pendiente');
  });

  it('aplicarEvento sobre una parada inexistente es un error de negocio', () => {
    const r = aplicarEvento(ruta, 'zzz', 'ENTREGADO');
    expect(!r.ok && r.error.codigo).toBe('PARADA_NO_ENCONTRADA');
  });

  it('aplicarEvento propaga la transición inválida', () => {
    const r = aplicarEvento(ruta, 'a', 'ENTREGADO');
    expect(!r.ok && r.error.codigo).toBe('TRANSICION_INVALIDA');
  });

  it('conteoFinal separa hechas, no hechas y pendientes; las quitadas no cuentan', () => {
    expect(conteoFinal(ruta)).toEqual({ hechas: 1, noHechas: 0, pendientes: 2 });
    const r = aplicarEvento(ruta, 'b', 'NO_PUDE');
    expect(r.ok && conteoFinal(r.value)).toEqual({ hechas: 1, noHechas: 1, pendientes: 1 });
  });
});
