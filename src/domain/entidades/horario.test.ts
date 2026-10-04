import { describe, expect, it } from 'vitest';
import { crearVentana, type VentanaHoraria } from '../valor/ventana-horaria.js';
import { resolverHorario, ventanasParaRuta, VENTANA_VENCIDA, type HorarioLocal } from './horario.js';

const v = (a: number, b: number): VentanaHoraria => {
  const r = crearVentana(a, b);
  if (!r.ok) throw new Error('ventana inválida en el test');
  return r.value;
};
const h = (
  fuente: HorarioLocal['fuente'],
  dias: HorarioLocal['dias'],
  tramos: VentanaHoraria[],
  confianza = 0.5,
): HorarioLocal => ({ dias, tramos, fuente, confianza });

const LUN = 1;
const DOM = 0;
const semana = [1, 2, 3, 4, 5] as const;

describe('resolverHorario · precedencia de datos', () => {
  it('sin horarios y sin condición: sin restricción', () => {
    expect(resolverHorario([], LUN)).toEqual({ tipo: 'sin_restriccion' });
  });

  it('prefiere confirmado > aprendido > sugerido > giro', () => {
    const horarios = [
      h('giro', semana, [v(480, 1200)]),
      h('sugerido', semana, [v(540, 1140)]),
      h('aprendido', semana, [v(600, 1080)]),
      h('confirmado', semana, [v(660, 1020)]),
    ];
    expect(resolverHorario(horarios, LUN)).toEqual({ tipo: 'ventanas', ventanas: [v(660, 1020)], fuente: 'confirmado' });
    expect(resolverHorario(horarios.slice(0, 3), LUN)).toMatchObject({ fuente: 'aprendido' });
    expect(resolverHorario(horarios.slice(0, 2), LUN)).toMatchObject({ fuente: 'sugerido' });
    expect(resolverHorario(horarios.slice(0, 1), LUN)).toMatchObject({ fuente: 'giro' });
  });

  it('une los tramos de la colación del mismo nivel de precedencia', () => {
    const horarios = [h('confirmado', semana, [v(480, 780)]), h('confirmado', semana, [v(870, 1140)])];
    expect(resolverHorario(horarios, LUN)).toMatchObject({ ventanas: [v(480, 780), v(870, 1140)] });
  });

  it('solo considera los horarios del día pedido', () => {
    const horarios = [h('confirmado', [6], [v(600, 900)]), h('giro', semana, [v(480, 1200)])];
    expect(resolverHorario(horarios, LUN)).toMatchObject({ fuente: 'giro' });
  });

  it('con datos para otros días pero no para éste, el local está cerrado ese día', () => {
    const horarios = [h('confirmado', semana, [v(480, 1200)])];
    expect(resolverHorario(horarios, DOM)).toEqual({ tipo: 'imposible', motivo: 'CERRADO_ESE_DIA' });
  });
});

describe('resolverHorario · condición del día', () => {
  const base = [h('confirmado', semana, [v(480, 780), v(870, 1140)])];

  it('«antes de» recorta los tramos', () => {
    expect(resolverHorario(base, LUN, { antesDeMin: 720 })).toMatchObject({ ventanas: [v(480, 720)] });
  });

  it('«antes de» sin datos de horario crea la ventana 00:00 → límite', () => {
    expect(resolverHorario([], LUN, { antesDeMin: 720 })).toEqual({
      tipo: 'ventanas',
      ventanas: [v(0, 720)],
      fuente: 'condicion_del_dia',
    });
  });

  it('«antes de» anterior a la apertura es imposible y no se ignora', () => {
    expect(resolverHorario(base, LUN, { antesDeMin: 400 })).toEqual({
      tipo: 'imposible',
      motivo: 'CONDICION_ANTES_DE_APERTURA',
    });
  });

  it('una condición sin «antes de» no cambia el horario', () => {
    expect(resolverHorario(base, LUN, { prioridad: true })).toMatchObject({ fuente: 'confirmado' });
  });
});

describe('ventanasParaRuta', () => {
  it('sin restricción → lista vacía; ventanas → tal cual; imposible → ventana ya vencida', () => {
    expect(ventanasParaRuta({ tipo: 'sin_restriccion' })).toEqual([]);
    expect(ventanasParaRuta({ tipo: 'ventanas', ventanas: [v(480, 900)], fuente: 'giro' })).toEqual([v(480, 900)]);
    expect(ventanasParaRuta({ tipo: 'imposible', motivo: 'CERRADO_ESE_DIA' })).toEqual([VENTANA_VENCIDA]);
  });
});
