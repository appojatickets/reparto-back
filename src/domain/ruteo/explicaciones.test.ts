import { describe, expect, it } from 'vitest';
import { explicarCambio } from './explicaciones.js';
import { evaluarOrden, optimizar } from './optimizador.js';
import { parada, problemaPlano, v } from './problemas.test-util.js';

describe('explicarCambio (mensaje corto para el chofer)', () => {
  it('sin paradas pendientes', () => {
    expect(explicarCambio(undefined, optimizar(problemaPlano([])))).toBe('No quedan paradas pendientes. Vuelve al depósito.');
  });

  it('dice qué sigue y a qué hora llega', () => {
    const s = optimizar(problemaPlano([parada('A', { nombre: 'Muebles y GB' })]));
    expect(explicarCambio(undefined, s)).toBe('Ahora sigue Muebles y GB. Llegas a las 08:10.');
  });

  it('avisa de las paradas que quedan en riesgo y de cuándo cierran', () => {
    const p = problemaPlano([parada('X', { nombre: 'Almacén X' }), parada('Y', { nombre: 'Panadería Sol', ventanas: [v(480, 500)] })]);
    const s = evaluarOrden(p, ['X', 'Y']);
    expect(explicarCambio(undefined, s)).toBe('Ahora sigue Almacén X. Llegas a las 08:10. Panadería Sol queda en riesgo: cierra 08:20.');
  });

  it('con un estado anterior solo menciona los riesgos nuevos', () => {
    const p = problemaPlano([parada('X'), parada('Y', { nombre: 'Panadería Sol', ventanas: [v(480, 500)] })]);
    const s = evaluarOrden(p, ['X', 'Y']);
    expect(explicarCambio(s, s)).not.toContain('riesgo');
  });

  it('menciona las paradas que ya cerraron y el regreso tardío', () => {
    const p = problemaPlano([parada('A', { servicioMin: 40 }), parada('D', { nombre: 'Kiosko D', ventanas: [v(480, 490)] })], { salida: 1230 });
    const msg = explicarCambio(undefined, optimizar(p));
    expect(msg).toContain('Kiosko D ya cerró.');
    expect(msg).toContain('Regresarías al depósito a las');
  });
});
