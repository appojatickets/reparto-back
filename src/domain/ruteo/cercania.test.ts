import { describe, expect, it } from 'vitest';
import { optimizar } from './optimizador.js';
import { parada, problemaPlano, v } from './problemas.test-util.js';
import { DEPOSITO, ORIGEN } from './tiempos.js';

const posiciones: Record<string, number> = { [ORIGEN]: 0, [DEPOSITO]: 0, A: 1, B: 2, C: 3, D: 4 };
const enLinea = (escala = 1) => problemaPlano(
  ['A', 'B', 'C', 'D'].map((id) => parada(id, { servicioMin: 1 })),
  {
    tiempos: { cortes: [], tiempo: (a, b) => Math.abs((posiciones[a] ?? 0) - (posiciones[b] ?? 0)) * escala },
    parametros: { ...problemaPlano([]).parametros, epsLlegada: 0.5 },
  },
);

describe('barrido por cercanía', () => {
  it('atiende el vecino de descarga larga sin saltarlo para volver después', () => {
    const p = enLinea();
    const largo = { ...p, paradas: p.paradas.map((s) => s.id === 'A' ? { ...s, servicioMin: 30 } : s) };
    expect(optimizar(largo).orden).toEqual(['A', 'B', 'C', 'D']);
  });

  it('un orden aprendido no provoca un regreso entre vecinos', () => {
    const p = { ...enLinea(0.1), preferenciasRecorrido: [{ antes: 'C', despues: 'B', peso: 1.5 }] };
    expect(optimizar(p).orden).toEqual(['A', 'B', 'C', 'D']);
  });

  it('respeta el comienzo fijado manualmente', () => {
    expect(optimizar({ ...enLinea(), fijas: ['C'] }).orden[0]).toBe('C');
  });

  it('puede anticipar una entrega lejana con cierre confirmado', () => {
    const p = enLinea();
    const conCierre = { ...p, paradas: p.paradas.map((s) => s.id === 'D' ? { ...s, ventanas: [v(480, 484)] } : s) };
    expect(optimizar(conCierre).orden[0]).toBe('D');
  });
});
