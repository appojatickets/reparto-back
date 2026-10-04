import { describe, expect, it } from 'vitest';
import { validarFactura } from './factura.js';

const codigos = (f: Parameters<typeof validarFactura>[0]) => {
  const r = validarFactura(f);
  return r.ok ? [] : r.error.map((e) => e.codigo);
};

describe('validarFactura', () => {
  it('normaliza el folio y completa lo opcional', () => {
    expect(validarFactura({ folio: ' 12 34 ' })).toEqual({ ok: true, value: { folio: '1234', urgente: false } });
    expect(validarFactura({ folio: 'A-77', fecha: '2026-10-05', total: 15990, antesDeMin: 720, urgente: true, nota: ' portón verde ' })).toEqual({
      ok: true,
      value: { folio: 'A-77', fecha: '2026-10-05', total: 15990, antesDeMin: 720, urgente: true, nota: 'portón verde' },
    });
  });

  it('junta todos los errores', () => {
    expect(codigos({ folio: '', fecha: '2026-02-30', total: -5, antesDeMin: 1440, nota: 'x'.repeat(301) })).toEqual([
      'FOLIO_REQUERIDO', 'FECHA_INVALIDA', 'TOTAL_INVALIDO', 'HORA_LIMITE_INVALIDA', 'NOTA_LARGA',
    ]);
  });

  it.each(['12/34', 'a'.repeat(21), 'ñandú', '12.5'])('rechaza el folio %s', (folio) => {
    expect(codigos({ folio })).toEqual(['FOLIO_INVALIDO']);
  });

  it('el total debe ser entero (CLP no tiene decimales) y la hora límite un minuto del día', () => {
    expect(codigos({ folio: '1', total: 10.5 })).toEqual(['TOTAL_INVALIDO']);
    expect(codigos({ folio: '1', antesDeMin: 12.5 })).toEqual(['HORA_LIMITE_INVALIDA']);
    expect(codigos({ folio: '1', antesDeMin: 0, total: 0 })).toEqual([]);
  });
});
