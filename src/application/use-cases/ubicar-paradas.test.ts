import { describe, expect, it } from 'vitest';
import { distanciaKm } from '../../domain/valor/coordenada.js';
import type { FacturaParaRuta, HechaConUbicacion, PinDeLocal } from '../ports/out/rutas.js';
import { claveDeCalle, ubicarFacturas } from './ubicar-paradas.js';

const factura = (n: string, direccion: string, extra: Partial<FacturaParaRuta> = {}): FacturaParaRuta => ({
  facturaId: `f-${n}`,
  localId: `l-${n}`,
  razonSocial: `Local ${n}`,
  direccion,
  comuna: 'San Bernardo',
  urgente: false,
  horarios: [],
  cargadaEn: Number(n.replace(/\D/g, '') || 0) * 1000,
  ...extra,
});
const conPin = (n: string, direccion: string, lat: number, lng: number, extra: Partial<FacturaParaRuta> = {}): FacturaParaRuta => factura(n, direccion, { lat, lng, ...extra });
const km = (a: { lat: number; lng: number } | undefined, b: { lat: number; lng: number }): number => (a ? distanciaKm(a, b) : NaN);

describe('claveDeCalle', () => {
  it('la misma calle con o sin «Avenida», en la misma comuna, da la misma clave; en otra comuna, otra', () => {
    expect(claveDeCalle('Av. Colón 100', 'San Bernardo')?.clave).toBe(claveDeCalle('Colón 4500', 'san bernardo')?.clave);
    expect(claveDeCalle('Colón 100', 'Maipú')?.clave).not.toBe(claveDeCalle('Colón 100', 'San Bernardo')?.clave);
  });
  it('una dirección sin calle reconocible no tiene clave', () => {
    expect(claveDeCalle('Ubicación en el mapa', 'San Bernardo')).toBeUndefined();
  });
});

describe('ubicarFacturas', () => {
  it('el orden de carga es el lugar de cada factura entre las del día', () => {
    const r = ubicarFacturas([factura('2', 'Colón 100'), factura('1', 'Freire 100')], []);
    expect([...r.ordenCarga]).toEqual([['f-2', 1], ['f-1', 0]]);
  });

  it('una factura sin pin se ubica junto a otra de su calle que sí tiene pin, según el número', () => {
    const pin = conPin('1', 'Colón 100', -33.6, -70.7);
    const r = ubicarFacturas([pin, factura('2', 'Colón 130'), factura('3', 'Freire 900')], []);
    expect(km(r.estimadas.get('f-2'), { lat: -33.6, lng: -70.7 })).toBeLessThan(0.06);
    expect(r.estimadas.has('f-1')).toBe(false);
  });

  it('las facturas con pin exacto no llevan calle: la geometría ya sabe cómo se recorren y forzarlas a quedar juntas hace perder kilómetros', () => {
    const r = ubicarFacturas([conPin('1', 'Colón 100', -33.6, -70.7), factura('2', 'Colón 130')], []);
    expect(r.calles.has('f-1')).toBe(false);
    expect(r.calles.has('f-2')).toBe(true);
  });

  it('las calles se reconocen aunque la factura traiga «Avenida» o el complemento de la oficina', () => {
    const r = ubicarFacturas([conPin('1', 'Av. Colón 100', -33.6, -70.7), factura('2', 'Colón 110 Of 4')], []);
    expect(km(r.estimadas.get('f-2'), { lat: -33.6, lng: -70.7 })).toBeLessThan(0.05);
  });

  it('lo ya entregado hoy y los locales con pin de la empresa también son puertas conocidas, pero no el mismo local de hoy', () => {
    const hecha: HechaConUbicacion = { cargadaEn: 0, direccion: 'Colón 100', comuna: 'San Bernardo', lat: -33.6, lng: -70.7 };
    const otro: PinDeLocal = { localId: 'l-otro', direccion: 'Colón 900', comuna: 'San Bernardo', lat: -33.6, lng: -70.69 };
    const propio: PinDeLocal = { localId: 'l-2', direccion: 'Colón 500', comuna: 'San Bernardo', lat: -33.0, lng: -70.0 };
    const r = ubicarFacturas([factura('2', 'Colón 500')], [hecha], [otro, propio]);
    expect(r.estimadas.get('f-2')?.lng).toBeCloseTo(-70.695, 5);
  });

  it('varias facturas de una calle sin ninguna puerta conocida quedan juntas, aunque se hayan cargado mezcladas', () => {
    const r = ubicarFacturas(
      [conPin('1', 'Freire 10', -33.62, -70.8), factura('2', 'Colón 100'), factura('3', 'Freire 20'), factura('4', 'Colón 900'), conPin('5', 'Freire 30', -33.62, -70.8), factura('6', 'Colón 500')],
      [],
    );
    const a = r.estimadas.get('f-2');
    const b = r.estimadas.get('f-4');
    expect(a && b ? distanciaKm(a, b) : NaN).toBeLessThan(1);
    expect(r.calles.get('f-2')).toBe(r.calles.get('f-4'));
    expect(r.calles.get('f-2')).not.toBe(r.calles.get('f-3'));
  });

  it('un pin que el buscador halló solo hasta la calle cede ante lo que dicen las puertas conocidas de esa calle', () => {
    const aprox = conPin('2', 'Colón 130', -33.7, -70.9, { pinAproximado: true });
    const r = ubicarFacturas([conPin('1', 'Colón 100', -33.6, -70.7), aprox], []);
    expect(km(r.estimadas.get('f-2'), { lat: -33.6, lng: -70.7 })).toBeLessThan(0.06);
  });

  it('una dirección sin calle reconocible se ubica entre sus vecinas de carga, como antes', () => {
    const r = ubicarFacturas([conPin('1', 'Colón 100', -33.6, -70.8), factura('2', 'Ubicación en el mapa'), conPin('3', 'Freire 5', -33.6, -70.6)], []);
    expect(r.estimadas.get('f-2')?.lng).toBeCloseTo(-70.7, 5);
    expect(r.calles.has('f-2')).toBe(false);
  });
});
