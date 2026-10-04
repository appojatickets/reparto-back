import { describe, expect, it } from 'vitest';
import type { HorarioLocal } from '../entidades/horario.js';
import { armarProblema, type EntradaParada } from './armar-problema.js';
import { optimizar } from './optimizador.js';
import { verificarInvariantes } from './invariantes.js';
import { v } from './problemas.test-util.js';

const DEPOSITO = { lat: -33.5, lng: -70.7 };
const abierto = (desde: number, hasta: number, dias: HorarioLocal['dias'] = [1, 2, 3, 4, 5]): HorarioLocal => ({ dias, tramos: [v(desde, hasta)], fuente: 'confirmado', confianza: 1 });
const e = (id: string, extra: Partial<EntradaParada> = {}): EntradaParada => ({ id, nombre: `Local ${id}`, coordenada: { lat: -33.45, lng: -70.65 }, horarios: [], urgente: false, ...extra });
// 2026-10-05 es lunes; 2026-10-10 es sábado.
const base = { fecha: '2026-10-05', deposito: DEPOSITO, salida: 480, horaLimiteRegresoMin: 1260 };

describe('armarProblema', () => {
  it('separa las facturas sin pin y las informa, sin descartarlas', () => {
    const r = armarProblema({ ...base, entradas: [e('A'), { id: 'B', nombre: 'Local B', horarios: [], urgente: false }] });
    expect(r.problema.paradas.map((p) => p.id)).toEqual(['A']);
    expect(r.sinPin.map((x) => x.id)).toEqual(['B']);
  });

  it('el horario del local según el día de la semana pasa como ventana; sin horario no hay restricción', () => {
    const r = armarProblema({ ...base, entradas: [e('A', { horarios: [abierto(540, 1080)] }), e('B')] });
    expect(r.problema.paradas[0]?.ventanas).toEqual([v(540, 1080)]);
    expect(r.problema.paradas[1]?.ventanas).toEqual([]);
  });

  it('un local que no abre ese día queda como ventana vencida (el motor lo informa como no atendida)', () => {
    const cerradoSabado: HorarioLocal = { dias: [6], tramos: [], fuente: 'confirmado', confianza: 1 };
    const r = armarProblema({ ...base, fecha: '2026-10-10', entradas: [e('A', { horarios: [abierto(540, 1080), cerradoSabado] })] });
    const s = optimizar(r.problema);
    expect(s.noAtendidas.map((x) => x.paradaId)).toEqual(['A']);
  });

  it('«antes de» recorta la ventana y urgente marca prioridad', () => {
    const r = armarProblema({ ...base, entradas: [e('A', { horarios: [abierto(540, 1080)], antesDeMin: 720, urgente: true })] });
    expect(r.problema.paradas[0]).toMatchObject({ ventanas: [v(540, 720)], prioridad: true });
  });

  it('«antes de» sin horario conocido pone ventana desde las 00:00', () => {
    const r = armarProblema({ ...base, entradas: [e('A', { antesDeMin: 600 })] });
    expect(r.problema.paradas[0]?.ventanas).toEqual([v(0, 600)]);
  });

  it('usa el servicio propio o el por defecto, la hora límite de la empresa y descarta fijas que ya no existen', () => {
    const r = armarProblema({ ...base, horaLimiteRegresoMin: 1200, fijas: ['B', 'Z'], entradas: [e('A', { servicioMin: 12 }), e('B')] });
    expect(r.problema.paradas.map((p) => p.servicioMin)).toEqual([12, 8]);
    expect(r.problema.parametros.horaLimiteRegresoMin).toBe(1200);
    expect(r.problema.fijas).toEqual(['B']);
  });

  it('el problema armado se puede optimizar y cumple las invariantes', () => {
    const r = armarProblema({
      ...base,
      entradas: [
        e('A', { coordenada: { lat: -33.4, lng: -70.6 } }),
        e('B', { coordenada: { lat: -33.6, lng: -70.75 }, horarios: [abierto(540, 700)] }),
        e('C', { coordenada: { lat: -33.52, lng: -70.7 } }),
      ],
    });
    const s = optimizar(r.problema);
    expect(s.orden).toHaveLength(3);
    expect(verificarInvariantes(r.problema, s)).toEqual([]);
    expect(s.regreso).toBeGreaterThan(480);
  });
});
