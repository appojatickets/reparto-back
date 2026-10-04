import { describe, expect, it } from 'vitest';
import { agruparDias, diasDeHorarios, validarHorarioSemanal, type DiaHorario } from './horario-semanal.js';

const abierto = (dia: number, tramos: [number, number][]) => ({ dia, cerrado: false, tramos: tramos.map(([desde, hasta]) => ({ desde, hasta })) });
const cerrado = (dia: number) => ({ dia, cerrado: true, tramos: [] });
const codigos = (r: ReturnType<typeof validarHorarioSemanal>) => (r.ok ? [] : r.error.map((e) => e.codigo));

describe('validarHorarioSemanal', () => {
  it('acepta días abiertos, con colación y cerrados, y los ordena', () => {
    const r = validarHorarioSemanal([cerrado(0), abierto(1, [[840, 1080], [600, 780]]), abierto(6, [[600, 780]])]);
    expect(r.ok && r.value.map((d) => d.dia)).toEqual([0, 1, 6]);
    expect(r.ok && r.value[1]?.tramos).toEqual([{ desde: 600, hasta: 780 }, { desde: 840, hasta: 1080 }]);
  });

  it('no exige nada: un horario vacío es válido (todo sin dato)', () => {
    expect(validarHorarioSemanal([]).ok).toBe(true);
  });

  it('rechaza días inválidos o repetidos', () => {
    expect(codigos(validarHorarioSemanal([abierto(7, [[600, 700]])]))).toEqual(['DIA_INVALIDO']);
    expect(codigos(validarHorarioSemanal([cerrado(1), cerrado(1)]))).toEqual(['DIA_REPETIDO']);
  });

  it('un día cerrado no puede traer horas; uno abierto necesita entre 1 y 3 tramos', () => {
    expect(codigos(validarHorarioSemanal([{ dia: 1, cerrado: true, tramos: [{ desde: 600, hasta: 700 }] }]))).toEqual(['CERRADO_CON_TRAMOS']);
    expect(codigos(validarHorarioSemanal([abierto(1, [])]))).toEqual(['TRAMOS_INVALIDOS']);
    expect(codigos(validarHorarioSemanal([abierto(1, [[0, 100], [200, 300], [400, 500], [600, 700]])]))).toEqual(['TRAMOS_INVALIDOS']);
  });

  it('rechaza tramos al revés, fuera del día o solapados (la colación debe dejar un espacio)', () => {
    expect(codigos(validarHorarioSemanal([abierto(1, [[700, 600]])]))).toEqual(['TRAMO_INVALIDO']);
    expect(codigos(validarHorarioSemanal([abierto(1, [[600, 1440]])]))).toEqual(['TRAMO_INVALIDO']);
    expect(codigos(validarHorarioSemanal([abierto(1, [[600, 780], [780, 900]])]))).toEqual(['TRAMOS_SOLAPADOS']);
    expect(codigos(validarHorarioSemanal([abierto(1, [[600, 800], [700, 900]])]))).toEqual(['TRAMOS_SOLAPADOS']);
  });

  it('informa todos los errores a la vez, con el nombre del día', () => {
    const r = validarHorarioSemanal([abierto(1, [[700, 600]]), abierto(2, [])]);
    expect(!r.ok && r.error).toHaveLength(2);
    expect(!r.ok && r.error[0]?.mensaje).toContain('lunes');
  });
});

describe('agruparDias / diasDeHorarios', () => {
  const dias: DiaHorario[] = [
    { dia: 1, cerrado: false, tramos: [{ desde: 600, hasta: 1080 }] },
    { dia: 2, cerrado: false, tramos: [{ desde: 600, hasta: 1080 }] },
    { dia: 3, cerrado: false, tramos: [{ desde: 600, hasta: 780 }, { desde: 840, hasta: 1080 }] },
    { dia: 0, cerrado: true, tramos: [] },
    { dia: 6, cerrado: true, tramos: [] },
  ];

  it('junta los días iguales en un registro y deja «cerrado» como registro sin tramos', () => {
    const g = agruparDias(dias);
    expect(g).toEqual([
      { dias: [1, 2], tramos: [{ desde: 600, hasta: 1080 }] },
      { dias: [3], tramos: [{ desde: 600, hasta: 780 }, { desde: 840, hasta: 1080 }] },
      { dias: [0, 6], tramos: [] },
    ]);
  });

  it('reconstruye los días desde lo guardado (ida y vuelta)', () => {
    const guardado = agruparDias(dias).map((g) => ({ dias: g.dias, tramos: g.tramos.map((t) => ({ apertura: t.desde, cierre: t.hasta })) }));
    const vuelta = diasDeHorarios(guardado);
    expect(vuelta.map((d) => d.dia)).toEqual([0, 1, 2, 3, 6]);
    expect(vuelta.find((d) => d.dia === 3)?.tramos).toEqual([{ desde: 600, hasta: 780 }, { desde: 840, hasta: 1080 }]);
    expect(vuelta.find((d) => d.dia === 6)?.cerrado).toBe(true);
  });
});
