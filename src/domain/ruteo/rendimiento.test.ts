import { describe, expect, it } from 'vitest';
import { verificarInvariantes } from './invariantes.js';
import { optimizar } from './optimizador.js';
import { problemaAleatorio } from './problemas.test-util.js';

describe('rendimiento', () => {
  it('50 paradas con ventanas se optimizan en menos de 1,5 s y la solución es válida', () => {
    const p = problemaAleatorio(2026, 50, { fraccionConVentana: 0.6 });
    const reloj = () => performance.now();
    const inicio = reloj();
    const s = optimizar(p, { presupuesto: { reloj, limiteMs: 1000 } });
    const ms = reloj() - inicio;
    expect(ms).toBeLessThan(1500);
    expect(s.orden.length + s.noAtendidas.length).toBe(50);
    expect(verificarInvariantes(p, s)).toEqual([]);
  });

  it('una edición corta (presupuesto de 300 ms) con 50 paradas respeta el límite', () => {
    const p = problemaAleatorio(77, 50);
    const reloj = () => performance.now();
    const inicio = reloj();
    optimizar(p, { presupuesto: { reloj, limiteMs: 300 } });
    expect(reloj() - inicio).toBeLessThan(900);
  });
});
