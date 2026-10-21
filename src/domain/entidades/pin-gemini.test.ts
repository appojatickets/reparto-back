import { describe, expect, it } from 'vitest';
import { correccionGemini, respaldoGemini, visitaDetenida, visitasIndependientes, type EntregaParaPin } from './pin-gemini.js';
const pin = { lat: -33.5, lng: -70.7 };
const visita = (id = 'f1', dia = '2026-10-20'): EntregaParaPin => {
  const en = new Date(`${dia}T15:00:00Z`);
  return { ...pin, precisionM: 10, en, facturaId: id, puntos: [-90, -30].map(s => ({ ...pin, precisionM: 10, velocidadMs: 0, en: new Date(en.getTime() + s * 1000) })) };
};
describe('confirmación de pines Gemini con visitas reales', () => {
  it('requiere dos visitas distintas, no una entrega precisa ni dos facturas en la misma detención', () => {
    const una = visita();
    expect(respaldoGemini(pin, false, visitasIndependientes([una])).nivel).toBe('sin_respaldo');
    expect(visitasIndependientes([una, { ...una, facturaId: 'f2' }])).toHaveLength(1);
    const dos = visitasIndependientes([una, visita('f2', '2026-10-21')]);
    expect(respaldoGemini(pin, false, dos).nivel).toBe('respaldado');
  });
  it('descarta GPS impreciso, paso en marcha, puntos aislados y botón apretado lejos de la detención', () => {
    const e = visita();
    expect(visitaDetenida({ ...e, precisionM: 80 })).toBeUndefined();
    expect(visitaDetenida({ ...e, puntos: e.puntos.slice(0, 1) })).toBeUndefined();
    expect(visitaDetenida({ ...e, puntos: e.puntos.map(p => ({ ...p, velocidadMs: 10 })) })).toBeUndefined();
    expect(visitaDetenida({ ...e, lat: pin.lat + 0.01 })).toBeUndefined();
    expect(visitaDetenida({ ...e, puntos: e.puntos.map(p => ({ ...p, precisionM: 80 })) })).toBeUndefined();
  });
  it('dos visitas lejos proponen una corrección, sin confirmar el pin original', () => {
    const lejos = { lat: pin.lat + 0.01, lng: pin.lng };
    const visitas = [visita(), visita('f2', '2026-10-21')].map(v => ({ ...v, ...lejos }));
    expect(respaldoGemini(pin, false, visitas).nivel).toBe('en_conflicto');
    expect(correccionGemini(pin, visitas)).toEqual(lejos);
    expect(correccionGemini(pin, [visitas[0] ?? visita()])).toBeUndefined();
  });
});
