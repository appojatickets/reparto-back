import { describe, expect, it } from 'vitest';
import { diaDeSemana, esFechaValida, fechaEnChile, minutosEnChile, sumarDias } from './fechas.js';

describe('fechas', () => {
  it('valida fechas reales de calendario', () => {
    expect(esFechaValida('2026-10-05')).toBe(true);
    expect(esFechaValida('2028-02-29')).toBe(true); // bisiesto
    for (const mala of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '26-10-05', '2026/10/05', '', 'hoy']) expect(esFechaValida(mala), mala).toBe(false);
  });

  it('hoy en Chile: a las 22:00 de Chile ya es el día siguiente en UTC, pero la fecha de reparto es la de Chile', () => {
    // 2026-10-05 22:30 en Chile (UTC-3, verano) = 2026-10-06 01:30 UTC
    expect(fechaEnChile(new Date('2026-10-06T01:30:00Z'))).toBe('2026-10-05');
    expect(fechaEnChile(new Date('2026-10-06T03:30:00Z'))).toBe('2026-10-06');
  });

  it('respeta el horario de invierno (UTC-4)', () => {
    // 2026-07-01 23:30 Chile (UTC-4) = 2026-07-02 03:30 UTC
    expect(fechaEnChile(new Date('2026-07-02T03:30:00Z'))).toBe('2026-07-01');
    expect(fechaEnChile(new Date('2026-07-02T04:30:00Z'))).toBe('2026-07-02');
  });

  it('suma días cruzando mes y año', () => {
    expect(sumarDias('2026-10-05', 1)).toBe('2026-10-06');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('día de la semana (0 = domingo)', () => {
    expect(diaDeSemana('2026-10-04')).toBe(0); // domingo
    expect(diaDeSemana('2026-10-05')).toBe(1); // lunes
    expect(diaDeSemana('2026-10-10')).toBe(6);
  });

  it('una fecha inválida es un error de programación', () => {
    expect(() => sumarDias('x', 1)).toThrow();
    expect(() => diaDeSemana('x')).toThrow();
  });
});

describe('minutosEnChile', () => {
  it('usa la hora de Chile (verano UTC-3, invierno UTC-4)', () => {
    expect(minutosEnChile(new Date('2026-10-05T12:00:00Z'))).toBe(9 * 60); // 09:00
    expect(minutosEnChile(new Date('2026-07-01T12:30:00Z'))).toBe(8 * 60 + 30); // 08:30
    expect(minutosEnChile(new Date('2026-10-06T02:59:00Z'))).toBe(23 * 60 + 59);
  });
});
