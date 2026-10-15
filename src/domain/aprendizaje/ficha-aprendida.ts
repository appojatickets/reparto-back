import { diaDeSemana, fechaEnChile, minutosEnChile } from '../shared/fechas.js';

/**
 * Lo que se aprendió de un local con lo que ya pasó (ADR 0049): a qué hora suele entregarse y con qué probabilidad está cerrado a cada hora.
 * Es estadística simple y explicable. Los días se parecen pero no son iguales: por eso se habla de rangos y probabilidades, no de una hora fija.
 */

/** Una visita al local que terminó en entrega o en «cerrado». */
export type ObservacionLocal = { readonly tipo: 'entregado' | 'cerrado'; readonly cuando: Date };

/** Dos avisos de cerrado del mismo local con menos de esto entre sí son la misma visita (cerrado + no entregado). */
const MISMA_VISITA_MS = 30 * 60_000;

/** Convierte los avisos crudos de un local en visitas: entregado o cerrado (también «no entregado por cerrado»), en orden y sin repetir el cierre. */
export const aObservaciones = (eventos: readonly { readonly tipo: string; readonly motivo?: string | undefined; readonly creadoEn: Date }[]): ObservacionLocal[] => {
  const salida: ObservacionLocal[] = [];
  for (const e of [...eventos].sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime())) {
    const tipo = e.tipo === 'entregado' ? 'entregado' : e.tipo === 'cerrado' || (e.tipo === 'no_entregado' && e.motivo === 'cerrado') ? 'cerrado' : undefined;
    if (tipo === undefined) continue;
    const previa = salida[salida.length - 1];
    if (tipo === 'cerrado' && previa?.tipo === 'cerrado' && e.creadoEn.getTime() - previa.cuando.getTime() < MISMA_VISITA_MS) continue;
    salida.push({ tipo, cuando: e.creadoEn });
  }
  return salida;
};

export const MINIMO_ENTREGAS_HORA = 3;
const MINIMO_VISITAS_FRANJA = 2;
/** Con 10 visitas la ficha pesa la mitad: confianza = n / (n + 10). */
const K_CONFIANZA = 10;
/** El rango habitual se estira un poco: un cuarto de hora más a cada lado todavía es «lo de siempre». */
export const MARGEN_RANGO_MIN = 30;

export type RangoHabitual = { readonly desdeMin: number; readonly hastaMin: number; readonly medianaMin: number; readonly entregas: number };
export type FranjaCierre = { readonly desdeHora: number; readonly hastaHora: number; readonly visitas: number; readonly cerrados: number; readonly pCerrado: number };

export type FichaAprendida = {
  readonly visitas: number;
  readonly entregas: number;
  readonly cerrados: number;
  /** Cuándo suele entregarse (todos los días); solo con 3 o más entregas. */
  readonly horaHabitual?: RangoHabitual;
  /** Lo mismo por día de la semana (0 = domingo), solo los que tienen 3 o más entregas. */
  readonly porDiaSemana: readonly (RangoHabitual & { readonly diaSemana: number })[];
  /** Cuántas veces se encontró cerrado en cada franja de 2 horas, y la probabilidad de cerrado suavizada: (cerrados + 1) / (visitas + 2). */
  readonly franjas: readonly FranjaCierre[];
  /** 0 a 1: cuánto se puede fiar de la ficha según cuántas visitas tiene. */
  readonly confianza: number;
};

const percentil = (ordenados: readonly number[], q: number): number => {
  if (ordenados.length === 1) return ordenados[0] ?? 0;
  const pos = (ordenados.length - 1) * q;
  const base = Math.floor(pos);
  const a = ordenados[base] ?? 0;
  const b = ordenados[Math.min(base + 1, ordenados.length - 1)] ?? a;
  return a + (b - a) * (pos - base);
};

const rangoDe = (minutos: readonly number[]): RangoHabitual => {
  const o = [...minutos].sort((a, b) => a - b);
  return { desdeMin: Math.round(percentil(o, 0.25)), hastaMin: Math.round(percentil(o, 0.75)), medianaMin: Math.round(percentil(o, 0.5)), entregas: o.length };
};

export const fichaAprendida = (observaciones: readonly ObservacionLocal[]): FichaAprendida => {
  const entregas = observaciones.filter((o) => o.tipo === 'entregado');
  const cerrados = observaciones.length - entregas.length;
  const minutos = entregas.map((o) => minutosEnChile(o.cuando));

  const porDia = new Map<number, number[]>();
  entregas.forEach((o, i) => {
    const d = diaDeSemana(fechaEnChile(o.cuando));
    porDia.set(d, [...(porDia.get(d) ?? []), minutos[i] ?? 0]);
  });
  const porDiaSemana = [...porDia.entries()].filter(([, v]) => v.length >= MINIMO_ENTREGAS_HORA).sort((a, b) => a[0] - b[0]).map(([diaSemana, v]) => ({ diaSemana, ...rangoDe(v) }));

  const franjas = new Map<number, { visitas: number; cerrados: number }>();
  for (const o of observaciones) {
    const desde = Math.floor(minutosEnChile(o.cuando) / 120) * 2;
    const f = franjas.get(desde) ?? { visitas: 0, cerrados: 0 };
    franjas.set(desde, { visitas: f.visitas + 1, cerrados: f.cerrados + (o.tipo === 'cerrado' ? 1 : 0) });
  }

  return {
    visitas: observaciones.length,
    entregas: entregas.length,
    cerrados,
    ...(entregas.length >= MINIMO_ENTREGAS_HORA ? { horaHabitual: rangoDe(minutos) } : {}),
    porDiaSemana,
    franjas: [...franjas.entries()].sort((a, b) => a[0] - b[0]).map(([desdeHora, f]) => ({ desdeHora, hastaHora: desdeHora + 2, visitas: f.visitas, cerrados: f.cerrados, pCerrado: (f.cerrados + 1) / (f.visitas + 2) })),
    confianza: observaciones.length / (observaciones.length + K_CONFIANZA),
  };
};

/**
 * Probabilidad de que esté cerrado a esa hora del día. Solo opina si en esa franja de 2 horas hay al menos 2 visitas: una hora en que nunca
 * se ha ido queda desconocida (no haber ido a las 19:00 no prueba que cierre antes; ADR 0007).
 */
export const predecirCierre = (ficha: FichaAprendida, minutoDelDia: number): { readonly pCerrado: number; readonly visitas: number } | undefined => {
  const franja = ficha.franjas.find((f) => minutoDelDia >= f.desdeHora * 60 && minutoDelDia < f.hastaHora * 60);
  if (franja && franja.visitas >= MINIMO_VISITAS_FRANJA) return { pCerrado: franja.pCerrado, visitas: franja.visitas };
  return undefined;
};

export type BancoDePruebasFicha = {
  readonly cierre: {
    /** Visitas donde la ficha (hecha solo con días anteriores) tenía algo que decir. */
    readonly evaluadas: number;
    /** De ellas, las que de verdad estaban cerradas y las que la ficha había anticipado como cerradas. */
    readonly cerradas: number;
    readonly anticipadas: number;
    /** La ficha decía cerrado y estaba abierto (se entregó). */
    readonly falsasAlarmas: number;
    /** Visitas en que la ficha acertó (cerrado donde estaba cerrado, abierto donde se entregó). */
    readonly aciertos: number;
  };
  readonly hora: { readonly evaluadas: number; readonly dentroDelRango: number };
};

/**
 * ¿La ficha acierta? Se repasa lo ocurrido en orden: para cada visita se arma la ficha del local solo con lo de días anteriores (nunca se mira el
 * futuro ni el mismo día) y se compara su predicción con lo que pasó. Mide si anticipa los cierres y si la entrega cae en el rango habitual.
 * Es la prueba que dice si vale la pena que el motor use la ficha.
 */
export const bancoDePruebasDeFicha = (porLocal: ReadonlyMap<string, readonly ObservacionLocal[]>): BancoDePruebasFicha => {
  let evaluadas = 0, cerradas = 0, anticipadas = 0, falsasAlarmas = 0, aciertos = 0, horaEvaluadas = 0, dentroDelRango = 0;
  for (const obs of porLocal.values()) {
    const ordenadas = [...obs].sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
    ordenadas.forEach((o, i) => {
      const dia = fechaEnChile(o.cuando);
      const previas = ordenadas.slice(0, i).filter((p) => fechaEnChile(p.cuando) < dia);
      if (previas.length === 0) return;
      const ficha = fichaAprendida(previas);
      const minuto = minutosEnChile(o.cuando);
      const p = predecirCierre(ficha, minuto);
      if (p) {
        evaluadas += 1;
        const dijoCerrado = p.pCerrado >= 0.5;
        if (o.tipo === 'cerrado') {
          cerradas += 1;
          if (dijoCerrado) { anticipadas += 1; aciertos += 1; }
        } else if (dijoCerrado) falsasAlarmas += 1;
        else aciertos += 1;
      }
      if (o.tipo === 'entregado' && ficha.horaHabitual) {
        horaEvaluadas += 1;
        if (minuto >= ficha.horaHabitual.desdeMin - MARGEN_RANGO_MIN && minuto <= ficha.horaHabitual.hastaMin + MARGEN_RANGO_MIN) dentroDelRango += 1;
      }
    });
  }
  return { cierre: { evaluadas, cerradas, anticipadas, falsasAlarmas, aciertos }, hora: { evaluadas: horaEvaluadas, dentroDelRango } };
};
