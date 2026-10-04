import { describe, expect, it } from 'vitest';
import { CONFIG_POR_DEFECTO, validarConfig } from './config-empresa.js';

const base = { salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 };

describe('configuración de la empresa', () => {
  it('por defecto sale a las 08:00 y avisa desde las 21:00, sin depósito', () => {
    expect(CONFIG_POR_DEFECTO).toEqual({ salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 });
  });

  it('acepta un depósito en la RM y normaliza el nombre', () => {
    const r = validarConfig({ ...base, deposito: { lat: -33.45, lng: -70.66, nombre: '  Bodega   Central ' } });
    expect(r.ok && r.value.deposito).toEqual({ lat: -33.45, lng: -70.66, nombre: 'Bodega Central' });
  });

  it('el depósito es opcional (aún no configurado)', () => {
    const r = validarConfig(base);
    expect(r.ok && r.value).toEqual(base);
  });

  it('rechaza un depósito fuera de la RM o con coordenadas imposibles', () => {
    const lejos = validarConfig({ ...base, deposito: { lat: -41.47, lng: -72.94 } });
    expect(!lejos.ok && lejos.error[0]?.codigo).toBe('DEPOSITO_FUERA_DE_RM');
    const roto = validarConfig({ ...base, deposito: { lat: 200, lng: 0 } });
    expect(!roto.ok && roto.error[0]?.codigo).toBe('DEPOSITO_INVALIDO');
  });

  it('rechaza horas fuera del día y un límite anterior a la salida', () => {
    const a = validarConfig({ salidaPorDefectoMin: 1500, horaLimiteRegresoMin: 1260 });
    expect(!a.ok && a.error.map((e) => e.codigo)).toEqual(['SALIDA_INVALIDA']);
    const b = validarConfig({ salidaPorDefectoMin: 600, horaLimiteRegresoMin: 600 });
    expect(!b.ok && b.error.map((e) => e.codigo)).toEqual(['LIMITE_ANTES_DE_SALIDA']);
    const c = validarConfig({ salidaPorDefectoMin: 480, horaLimiteRegresoMin: 3.5 });
    expect(!c.ok && c.error.map((e) => e.codigo)).toEqual(['LIMITE_INVALIDO']);
  });
});
