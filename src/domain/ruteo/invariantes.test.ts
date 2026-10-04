import { describe, expect, it } from 'vitest';
import { optimizarVerificado, verificarInvariantes } from './invariantes.js';
import { optimizar } from './optimizador.js';
import { parada, problemaAleatorio, problemaPlano, v } from './problemas.test-util.js';
import type { Solucion } from './tipos.js';

const base = () => {
  const problema = problemaPlano(
    [parada('A', { ventanas: [v(540, 600)] }), parada('B'), parada('C', { ventanas: [v(480, 500)] }), parada('D', { ventanas: [v(480, 500)] })],
    { fijas: [] },
  );
  return { problema, solucion: optimizar(problema) };
};

const alterar = (s: Solucion, cambios: Partial<Solucion>): Solucion => ({ ...s, ...cambios });

describe('verificarInvariantes', () => {
  it('una solución del optimizador no tiene violaciones', () => {
    const { problema, solucion } = base();
    expect(verificarInvariantes(problema, solucion)).toEqual([]);
  });

  it('detecta una parada repetida', () => {
    const { problema, solucion } = base();
    const orden = [...solucion.orden.slice(0, 3), solucion.orden[0] ?? ''];
    expect(verificarInvariantes(problema, alterar(solucion, { orden })).join()).toContain('repetidas');
  });

  it('detecta una parada perdida (ni en el orden ni en no atendidas)', () => {
    const { problema, solucion } = base();
    const faltante = alterar(solucion, { orden: solucion.orden.slice(1), detalle: solucion.detalle.slice(1) });
    expect(verificarInvariantes(problema, faltante).join()).toContain('no coinciden');
  });

  it('detecta una ETA manipulada', () => {
    const { problema, solucion } = base();
    const detalle = solucion.detalle.map((d, k) => (k === 1 ? { ...d, llegada: d.llegada + 7 } : d));
    expect(verificarInvariantes(problema, alterar(solucion, { detalle })).join()).toContain('ETA incoherente');
  });

  it('detecta una hora de regreso manipulada y una alerta incoherente', () => {
    const { problema, solucion } = base();
    expect(verificarInvariantes(problema, alterar(solucion, { regreso: solucion.regreso + 30 })).join()).toContain('regreso');
    expect(verificarInvariantes(problema, alterar(solucion, { regresoTardio: !solucion.regresoTardio })).join()).toContain('tardío');
  });

  it('detecta una parada tarde que no está marcada en riesgo, y viceversa', () => {
    const { problema, solucion } = base();
    expect(solucion.enRiesgo.length).toBeGreaterThan(0);
    expect(verificarInvariantes(problema, alterar(solucion, { enRiesgo: [] })).join()).toContain('no está marcada en riesgo');
    const falsa = { paradaId: 'B', nombre: 'B', cierre: 0, conflictos: [], sugerencias: [] };
    expect(verificarInvariantes(problema, alterar(solucion, { enRiesgo: [...solucion.enRiesgo, falsa] })).join()).toContain('sin estarlo');
  });

  it('detecta que las fijadas no estén al frente', () => {
    const problema = { ...problemaAleatorio(4, 6), fijas: ['p3'] };
    const solucion = optimizar(problema);
    expect(verificarInvariantes(problema, solucion)).toEqual([]);
    const mala = alterar(solucion, { orden: [...solucion.orden].reverse() });
    expect(verificarInvariantes(problema, mala).join()).toContain('fijadas');
  });
});

describe('optimizarVerificado', () => {
  it('devuelve ok cuando la solución cumple las invariantes', () => {
    const r = optimizarVerificado(problemaAleatorio(9, 12));
    expect(r.ok).toBe(true);
  });
});
