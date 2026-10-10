import { describe, expect, it } from 'vitest';
import { armarProblema, type EntradaParada } from './armar-problema.js';
import { verificarInvariantes } from './invariantes.js';
import { optimizar } from './optimizador.js';
import { v } from './problemas.test-util.js';

const DEPOSITO = { lat: -33.5, lng: -70.7 };
// Tres locales hacia el este del depósito: a ~2 km, ~7 km y ~15 km.
const CERCA = { lat: -33.5, lng: -70.68 };
const MEDIO = { lat: -33.5, lng: -70.62 };
const LEJOS = { lat: -33.5, lng: -70.54 };
const e = (id: string, coordenada: { lat: number; lng: number }, extra: Partial<EntradaParada> = {}): EntradaParada => ({ id, nombre: `Local ${id}`, coordenada, horarios: [], urgente: false, ...extra });
const base = { fecha: '2026-10-05', deposito: DEPOSITO, salida: 480, horaLimiteRegresoMin: 1260 };
const orden = (ordenInicio: 'automatico' | 'lejano' | 'cercano' | undefined, entradas: EntradaParada[]): string[] => {
  const { problema } = armarProblema({ ...base, entradas, ...(ordenInicio !== undefined ? { ordenInicio } : {}) });
  const s = optimizar(problema);
  expect(verificarInvariantes(problema, s)).toEqual([]);
  return [...s.orden];
};
const locales = [e('M', MEDIO), e('L', LEJOS), e('C', CERCA)];

describe('orden de inicio de la ruta', () => {
  it('«más lejano» parte por lo más lejano del depósito y vuelve acercándose', () => {
    expect(orden('lejano', locales)).toEqual(['L', 'M', 'C']);
  });

  it('«más cercano» parte por lo más cercano al depósito y se va alejando', () => {
    expect(orden('cercano', locales)).toEqual(['C', 'M', 'L']);
  });

  it('automático (o sin indicar) no cambia lo que el motor ya hacía', () => {
    expect(orden('automatico', locales)).toEqual(orden(undefined, locales));
  });

  it('un horario duro pesa más que la preferencia: lo que cierra temprano se atiende antes aunque esté cerca', () => {
    const cierraTemprano = e('C', CERCA, { horarios: [{ dias: [1], tramos: [v(480, 510)], fuente: 'confirmado', confianza: 1 }] });
    const r = orden('lejano', [e('L', LEJOS), cierraTemprano]);
    expect(r).toEqual(['C', 'L']);
  });

  it('con una sola parada no hay nada que preferir', () => {
    expect(orden('lejano', [e('L', LEJOS)])).toEqual(['L']);
  });
});
