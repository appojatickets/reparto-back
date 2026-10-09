import { describe, expect, it } from 'vitest';
import { compilar } from './compilar.js';
import { evaluar } from './evaluacion.js';
import { evaluarOrden, optimizar } from './optimizador.js';
import { verificarInvariantes } from './invariantes.js';
import { parada, problemaAleatorio, problemaPlano, v } from './problemas.test-util.js';
import { PARAMETROS_POR_DEFECTO } from './parametros.js';

const permutaciones = <T>(xs: readonly T[]): T[][] =>
  xs.length <= 1 ? [[...xs]] : xs.flatMap((x, i) => permutaciones([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));

describe('optimizar · casos simples', () => {
  it('sin paradas: vuelve directo al depósito', () => {
    const s = optimizar(problemaPlano([]));
    expect(s.orden).toEqual([]);
    expect(s.regreso).toBe(490);
    expect(s.costo).toBe(10);
  });

  it('una parada', () => {
    const s = optimizar(problemaPlano([parada('A')]));
    expect(s.orden).toEqual(['A']);
    expect(s.detalle[0]?.llegada).toBe(490);
    expect(s.regreso).toBe(505);
  });

  it('visita primero el local que abre más tarde para no esperar: [B, A] y no [A, B]', () => {
    const s = optimizar(problemaPlano([parada('A', { ventanas: [v(540, 600)] }), parada('B')]));
    expect(s.orden).toEqual(['B', 'A']);
    expect(s.costo).toBeCloseTo(40.5, 9);
  });

  it('respeta una ventana dura aunque implique un recorrido más largo', () => {
    // C cierra pronto: hay que ir primero a C aunque B esté "en el camino".
    const s = optimizar(problemaPlano([parada('B'), parada('C', { ventanas: [v(480, 495)] })]));
    expect(s.orden[0]).toBe('C');
    expect(s.enRiesgo).toEqual([]);
  });

  it('cada parada trae al menos un motivo', () => {
    const s = optimizar(problemaPlano([parada('A', { ventanas: [v(480, 500)] }), parada('B', { prioridad: true }), parada('C')]));
    for (const d of s.detalle) expect(d.motivos.length).toBeGreaterThan(0);
    expect(s.detalle.find((d) => d.id === 'A')?.motivos).toContain('VENTANA_DURA');
    expect(s.detalle.find((d) => d.id === 'B')?.motivos).toContain('PRIORIDAD');
  });

  it('marca COLACION y CERCANIA_COMUNA', () => {
    const s = optimizar(
      problemaPlano([
        parada('A', { comuna: 'Ñuñoa', ventanas: [v(480, 700), v(800, 1000)] }),
        parada('B', { comuna: 'Ñuñoa' }),
      ]),
    );
    expect(s.detalle.flatMap((d) => d.motivos)).toContain('COLACION');
    expect(s.detalle.flatMap((d) => d.motivos)).toContain('CERCANIA_COMUNA');
  });
});

describe('optimizar · ventanas duras infactibles', () => {
  it('nunca descarta en silencio: la parada queda EN RIESGO con conflictos y sugerencias', () => {
    // Dos locales que cierran a las 08:20: solo se llega a tiempo al primero.
    const s = optimizar(problemaPlano([parada('E', { ventanas: [v(480, 500)] }), parada('F', { ventanas: [v(480, 500)] })]));
    expect(s.orden).toHaveLength(2);
    expect(s.enRiesgo).toHaveLength(1);
    const r = s.enRiesgo[0];
    expect(r?.conflictos[0]).toContain('cierra a las 08:20');
    const tipos = r?.sugerencias.map((x) => x.tipo);
    expect(tipos).toContain('SALIR_ANTES');
    expect(tipos).toContain('OTRO_CAMION');
    expect(r?.sugerencias.find((x) => x.tipo === 'SALIR_ANTES')?.minutos).toBe(5);
  });

  it('una ventana ya vencida va a «no atendidas», con su conflicto, y el resto se ordena igual', () => {
    const s = optimizar(problemaPlano([parada('D', { ventanas: [v(480, 490)] }), parada('B')], { salida: 600 }));
    expect(s.orden).toEqual(['B']);
    expect(s.noAtendidas).toHaveLength(1);
    expect(s.noAtendidas[0]).toMatchObject({ paradaId: 'D', motivo: 'VENTANA_VENCIDA' });
    expect(s.noAtendidas[0]?.conflictos[0]).toContain('08:10');
    expect(s.costo).toBeGreaterThanOrEqual(1000); // w_j de la no atendida
  });

  it('sugiere hacer primero la parada cuando eso resuelve el riesgo', () => {
    const p = problemaPlano([parada('X'), parada('Y', { ventanas: [v(480, 500)] })]);
    const s = evaluarOrden(p, ['X', 'Y']); // un orden malo dado a mano: Y llega a las 08:25 y cierra a las 08:20
    expect(s.enRiesgo.map((r) => r.paradaId)).toEqual(['Y']);
    expect(s.enRiesgo[0]?.sugerencias.map((x) => x.tipo)).toContain('MOVER_AL_INICIO');
    expect(optimizar(p).enRiesgo).toEqual([]); // y el optimizador ya lo evita solo
  });

  it('avisa si el regreso pasa de las 21:00', () => {
    const s = optimizar(problemaPlano([parada('A', { servicioMin: 30 })], { salida: 1230 }));
    expect(s.regresoTardio).toBe(true);
    expect(optimizar(problemaPlano([parada('A')])).regresoTardio).toBe(false);
  });
});

describe('optimizar · fijas, reproducibilidad y presupuesto', () => {
  it('las paradas fijadas por el chofer quedan al frente, en su orden', () => {
    const p = problemaAleatorio(3, 8);
    const s = optimizar({ ...p, fijas: ['p5', 'p2'] });
    expect(s.orden.slice(0, 2)).toEqual(['p5', 'p2']);
    expect(s.detalle[0]?.motivos).toContain('FIJADA_POR_CHOFER');
  });

  it('es reproducible: mismo problema y misma semilla dan el mismo resultado', () => {
    const p = problemaAleatorio(11, 15);
    expect(optimizar(p)).toEqual(optimizar(p));
  });

  it('ordenInicial: mantiene o mejora el orden dado y completa lo que falte', () => {
    const p = problemaAleatorio(5, 10);
    const s0 = optimizar(p);
    const s1 = optimizar(p, { ordenInicial: s0.orden.slice(0, 6) });
    expect(s1.orden).toHaveLength(s0.orden.length);
    expect(optimizar(p, { ordenInicial: s0.orden }).costo).toBeLessThanOrEqual(s0.costo + 1e-6);
  });

  it('un presupuesto agotado igual devuelve una solución válida (solo construcción)', () => {
    const p = problemaAleatorio(7, 20);
    const s = optimizar(p, { presupuesto: { reloj: () => 10_000, limiteMs: 1 } });
    expect(verificarInvariantes(p, s)).toEqual([]);
    expect(s.orden).toHaveLength(20);
  });

  it('el ritmo del chofer alarga la ruta', () => {
    const rapido = optimizar(problemaAleatorio(2, 10, { ritmo: 1 }));
    const lento = optimizar(problemaAleatorio(2, 10, { ritmo: 1.3 }));
    expect(lento.regreso).toBeGreaterThan(rapido.regreso);
  });
});

describe('optimizar · contra fuerza bruta (≤ 7 paradas)', () => {
  const casos = Array.from({ length: 40 }, (_, i) => ({ semilla: 100 + i, n: 4 + (i % 4) }));

  it.each(casos)('semilla $semilla con $n paradas alcanza el óptimo', ({ semilla, n }) => {
    const p = problemaAleatorio(semilla, n, { fraccionConVentana: 0.7 });
    const s = optimizar(p);
    const c = compilar(p);
    const atendidas = s.orden.map((id) => c.indice.get(id) ?? 0);
    const optimo = Math.min(...permutaciones(atendidas).map((perm) => evaluar(c, perm, perm.length)));
    const castigo = s.costo - evaluar(c, atendidas, atendidas.length);
    expect(s.costo - castigo).toBeCloseTo(optimo, 6);
  });
});

describe('optimizar · orden en que el chofer cargó las facturas', () => {
  it('con todo lo demás igual, sigue el orden de carga', () => {
    const paradas = [parada('X', { ordenCarga: 2 }), parada('Y', { ordenCarga: 0 }), parada('Z', { ordenCarga: 1 })];
    const conPeso = problemaPlano(paradas, { parametros: { ...PARAMETROS_POR_DEFECTO, pesoOrdenCarga: 1 } });
    expect(optimizar(conPeso).orden).toEqual(['Y', 'Z', 'X']);
  });

  it('el orden de carga no gana contra una ventana horaria', () => {
    const paradas = [parada('A', { ordenCarga: 0, ventanas: [v(600, 700)] }), parada('B', { ordenCarga: 1, ventanas: [v(480, 500)] })];
    const p = problemaPlano(paradas, { parametros: { ...PARAMETROS_POR_DEFECTO, penalizacionRiesgo: 10_000, pesoOrdenCarga: 1 } });
    expect(optimizar(p).orden).toEqual(['B', 'A']);
  });
});
