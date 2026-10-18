import { describe, expect, it } from 'vitest';
import { aObservaciones, bancoDePruebasDeFicha, cierreProbableDe, fichaAprendida, predecirCierre, type ObservacionLocal } from './ficha-aprendida.js';

/** Un instante en Chile (octubre = UTC-3): `dia` de octubre de 2026 a las `hora`:`min`. Lunes 5, martes 6, miércoles 7… */
const en = (dia: number, hora: number, min = 0): Date => new Date(Date.UTC(2026, 9, dia, hora + 3, min));
const ent = (dia: number, hora: number, min = 0): ObservacionLocal => ({ tipo: 'entregado', cuando: en(dia, hora, min) });
const cer = (dia: number, hora: number, min = 0): ObservacionLocal => ({ tipo: 'cerrado', cuando: en(dia, hora, min) });

describe('observaciones de un local', () => {
  it('junta entregado y cerrado (también «no entregado: cerrado»), ordena y no cuenta dos veces el mismo cierre', () => {
    const r = aObservaciones([
      { tipo: 'no_entregado', motivo: 'cerrado', creadoEn: en(5, 14, 10) },
      { tipo: 'cerrado', creadoEn: en(5, 14, 5) },
      { tipo: 'llegada', creadoEn: en(5, 13) },
      { tipo: 'no_entregado', motivo: 'otro', creadoEn: en(5, 15) },
      { tipo: 'entregado', creadoEn: en(5, 10) },
    ]);
    expect(r.map((o) => o.tipo)).toEqual(['entregado', 'cerrado']);
  });
});

describe('ficha aprendida de un local', () => {
  it('sin entregas suficientes no inventa una hora habitual', () => {
    const f = fichaAprendida([ent(5, 10), ent(6, 11)]);
    expect(f.horaHabitual).toBeUndefined();
    expect(f).toMatchObject({ entregas: 2, visitas: 2, cerrados: 0 });
  });

  it('con 3 o más entregas da el rango en que se entrega (de un cuarto a tres cuartos de los casos) y la mediana', () => {
    const f = fichaAprendida([ent(5, 10, 0), ent(6, 10, 30), ent(7, 11, 0), ent(8, 11, 30), ent(9, 12, 0)]);
    expect(f.horaHabitual).toEqual({ desdeMin: 630, hastaMin: 690, medianaMin: 660, entregas: 5 });
  });

  it('separa por día de la semana cuando hay 3 entregas ese día (lunes distinto de viernes)', () => {
    const lunes = [5, 12, 19].map((d) => ent(d, 9, 0));
    const viernes = [9, 16, 23].map((d) => ent(d, 15, 0));
    const f = fichaAprendida([...lunes, ...viernes]);
    expect(f.porDiaSemana).toEqual([
      { diaSemana: 1, desdeMin: 540, hastaMin: 540, medianaMin: 540, entregas: 3 },
      { diaSemana: 5, desdeMin: 900, hastaMin: 900, medianaMin: 900, entregas: 3 },
    ]);
  });

  it('cuenta los cierres por franja de 2 horas y da la probabilidad de cerrado con evidencia suavizada', () => {
    const f = fichaAprendida([cer(5, 13, 10), cer(6, 13, 50), ent(7, 13, 30), ent(8, 10, 0), ent(9, 10, 30)]);
    expect(f.franjas.find((x) => x.desdeHora === 12)).toMatchObject({ visitas: 3, cerrados: 2 });
    expect(f.franjas.find((x) => x.desdeHora === 10)).toMatchObject({ visitas: 2, cerrados: 0 });
    expect(f.franjas.find((x) => x.desdeHora === 12)?.pCerrado).toBeCloseTo(3 / 5, 5); // (2+1)/(3+2)
    expect(f.confianza).toBeCloseTo(5 / 15, 5);
  });

  it('predice cerrado solo con evidencia en esa franja: una hora en que nunca se ha ido queda desconocida', () => {
    const f = fichaAprendida([cer(5, 13), cer(6, 13, 30), ent(7, 10), ent(8, 10, 30)]);
    expect(predecirCierre(f, 13 * 60 + 20)).toMatchObject({ pCerrado: 0.75, visitas: 2 });
    expect(predecirCierre(f, 10 * 60 + 15)?.pCerrado).toBeCloseTo(0.25, 5);
    expect(predecirCierre(f, 18 * 60)).toBeUndefined();
    expect(predecirCierre(fichaAprendida([cer(5, 13)]), 13 * 60)).toBeUndefined();
  });
});

describe('banco de pruebas de la ficha (hacia adelante: solo mira días anteriores)', () => {
  it('mide si anticipa los cierres y si la entrega cae en el rango habitual, sin usar lo que todavía no pasaba', () => {
    // Un local que cierra a la 13 h los días 5 y 6 y vuelve a estar cerrado el 7; abre a las 10 h.
    const local: ObservacionLocal[] = [cer(5, 13), cer(6, 13, 10), cer(7, 13, 5), ent(8, 10), ent(9, 10, 20), ent(12, 10, 10), ent(13, 10, 5), ent(14, 10, 15), ent(15, 13, 5)];
    const r = bancoDePruebasDeFicha(new Map([['l1', local]]));
    // El cierre del día 7 se anticipa (días 5 y 6, misma franja); el día 15 a las 13 h estaba abierto aunque se esperaba cerrado: falsa alarma.
    // Las entregas de las 10 h de los días 12, 13 y 14 se predicen abiertas y aciertan. Las de los días 8 y 9 no se evalúan (sin historia en esa franja).
    expect(r.cierre).toEqual({ evaluadas: 5, cerradas: 1, anticipadas: 1, falsasAlarmas: 1, aciertos: 4 });
    // Entregas con 3 entregas previas en días anteriores: 13, 14 y 15 de octubre caen dentro de su rango habitual; la del 15 a las 13 h no.
    expect(r.hora).toEqual({ evaluadas: 3, dentroDelRango: 2 });
  });

  it('un mismo día no se mira a sí mismo: una entrega tras un cierre del mismo día no cuenta como historia', () => {
    const r = bancoDePruebasDeFicha(new Map([['l1', [cer(5, 13), ent(5, 16)]]]));
    expect(r.cierre.evaluadas).toBe(0);
  });

  it('sin historia suficiente no evalúa nada', () => {
    expect(bancoDePruebasDeFicha(new Map([['l1', [ent(5, 10)]]]))).toEqual({ cierre: { evaluadas: 0, cerradas: 0, anticipadas: 0, falsasAlarmas: 0, aciertos: 0 }, hora: { evaluadas: 0, dentroDelRango: 0 } });
  });
});

describe('lo que la ruta puede usar de la ficha', () => {
  it('solo franjas con 3 o más visitas y probabilidad de cerrado de 0,6 o más', () => {
    const f = fichaAprendida([cer(5, 13), cer(6, 13, 10), ent(7, 13, 20), cer(5, 16), ent(6, 16, 10), ent(7, 16, 20), ent(8, 10), ent(9, 10, 20), ent(12, 10, 10)]);
    // 12–14 h: 3 visitas, 2 cerradas → (2+1)/(3+2) = 0,6. 16–18 h: 3 visitas, 1 cerrada → 0,4 (no alcanza). 10–12 h: 0 cerradas.
    expect(cierreProbableDe(f)).toEqual([{ desdeMin: 720, hastaMin: 840, p: 0.6, visitas: 3, cerrados: 2 }]);
  });

  it('con pocas visitas o sin cierres no opina: la ruta se arma como si no supiera nada', () => {
    expect(cierreProbableDe(fichaAprendida([cer(5, 13), cer(6, 13, 10)]))).toEqual([]);
    expect(cierreProbableDe(fichaAprendida([ent(5, 10), ent(6, 10), ent(7, 10)]))).toEqual([]);
  });
});
