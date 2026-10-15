import { describe, expect, it } from 'vitest';
import { ventanaDelCamion } from './ventana-del-camion.js';

const h = (hhmm: string): Date => new Date(`2026-10-05T${hhmm}:00Z`);

describe('ventana del camión', () => {
  it('sin jornadas no hay ventana', () => {
    expect(ventanaDelCamion([])).toBeUndefined();
  });

  it('chofer y ayudante a la vez: la ventana empieza con el primero, aunque el segundo haya entrado después', () => {
    expect(ventanaDelCamion([{ desde: h('08:00') }, { desde: h('09:00') }])).toEqual({ desde: h('08:00') });
  });

  it('si el primero termina pero el otro sigue, el camión sigue abierto y no se pierde lo hecho desde el principio', () => {
    expect(ventanaDelCamion([{ desde: h('08:00'), hasta: h('10:00') }, { desde: h('09:00') }])).toEqual({ desde: h('08:00') });
  });

  it('cuando todos terminaron, la ventana termina con el último', () => {
    expect(ventanaDelCamion([{ desde: h('08:00'), hasta: h('12:00') }, { desde: h('09:00'), hasta: h('13:00') }])).toEqual({ desde: h('08:00'), hasta: h('13:00') });
  });

  it('una tanda nueva después de que el camión quedó vacío no arrastra lo anterior', () => {
    expect(ventanaDelCamion([{ desde: h('08:00'), hasta: h('10:00') }, { desde: h('14:00') }])).toEqual({ desde: h('14:00') });
  });

  it('volver a elegir el mismo camión al instante no corta la ventana', () => {
    expect(ventanaDelCamion([{ desde: h('08:00'), hasta: h('09:00') }, { desde: h('09:00') }])).toEqual({ desde: h('08:00') });
  });
});
