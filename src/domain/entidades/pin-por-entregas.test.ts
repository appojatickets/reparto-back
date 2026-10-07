import { describe, expect, it } from 'vitest';
import { distanciaKm } from '../valor/coordenada.js';
import { pinPorEntregas, type PosicionDeEntrega } from './pin-por-entregas.js';

const p = (dLat: number, dLng = 0, precisionM = 15): PosicionDeEntrega => ({ lat: -33.5 + dLat, lng: -70.7 + dLng, precisionM });

describe('pin según dónde se avisó ENTREGADO', () => {
  it('con una sola entrega, el pin es ese punto', () => {
    expect(pinPorEntregas([p(0.0004)])).toEqual({ lat: -33.5 + 0.0004, lng: -70.7 });
  });

  it('con varias entregas que coinciden, queda la mediana del grupo', () => {
    const r = pinPorEntregas([p(0.0002), p(0.0004), p(0.0003)]);
    expect(r?.lat).toBeCloseTo(-33.5 + 0.0003, 6);
  });

  it('una entrega avisada desde otro lado no arrastra el pin: manda donde coinciden las demás', () => {
    const r = pinPorEntregas([p(0), p(0.0003), p(0.0002), p(0.09)]);
    expect(distanciaKm(r ?? { lat: 0, lng: 0 }, { lat: -33.5 + 0.0002, lng: -70.7 }) * 1000).toBeLessThan(40);
  });

  it('si dos puntos no coinciden, gana el más reciente', () => {
    const reciente = p(0.0005);
    const antigua = p(0.09);
    expect(pinPorEntregas([reciente, antigua])).toEqual({ lat: reciente.lat, lng: reciente.lng });
  });

  it('descarta el GPS impreciso o sin precisión y solo mira las últimas 5', () => {
    expect(pinPorEntregas([p(0.0004, 0, 300), { lat: -33.5, lng: -70.7 }])).toBeUndefined();
    expect(pinPorEntregas([])).toBeUndefined();
    const recientes = [p(0.0001), p(0.0001), p(0.0001), p(0.0001), p(0.0001), p(0.2), p(0.2), p(0.2), p(0.2)];
    expect(pinPorEntregas(recientes)?.lat).toBeCloseTo(-33.5 + 0.0001, 6);
  });
});
