import { describe, expect, it } from 'vitest';
import { detectarLlegada, type PuntoGps } from './llegada.js';

const PIN = { lat: -33.5, lng: -70.7 };
const en = (segundos: number, extra: Partial<PuntoGps> = {}): PuntoGps => ({ lat: PIN.lat + 0.0002, lng: PIN.lng, tomadoEn: new Date(1_700_000_000_000 + segundos * 1000), ...extra }); // ≈ 22 m del pin
const lejos = (segundos: number): PuntoGps => ({ lat: PIN.lat + 0.01, lng: PIN.lng, tomadoEn: new Date(1_700_000_000_000 + segundos * 1000) }); // ≈ 1,1 km

describe('detectar la llegada del camión a un pin', () => {
  it('cerca del pin y quedándose un rato: llegó, y devuelve el primer punto del tramo', () => {
    const r = detectarLlegada([lejos(0), en(60), en(120), en(180)], PIN);
    expect(r?.tomadoEn.getTime()).toBe(en(60).tomadoEn.getTime());
  });

  it('pasar de largo (un solo punto cerca o muy poco tiempo) no es llegar', () => {
    expect(detectarLlegada([lejos(0), en(60), lejos(120)], PIN)).toBeUndefined();
    expect(detectarLlegada([en(0), en(20)], PIN)).toBeUndefined();
  });

  it('si los puntos cercanos no se quedan juntos (salió y volvió) no suma el tiempo', () => {
    expect(detectarLlegada([en(0), lejos(30), en(60), lejos(90)], PIN)).toBeUndefined();
  });

  it('un punto impreciso no cuenta', () => {
    expect(detectarLlegada([en(0, { precisionM: 200 }), en(60, { precisionM: 200 }), en(120, { precisionM: 200 })], PIN)).toBeUndefined();
  });

  it('yendo rápido por la calle del local no es llegar, aunque haya varios puntos cerca', () => {
    const rapido = [en(0, { velocidadMs: 9 }), en(30, { velocidadMs: 9 }), en(60, { velocidadMs: 9 })];
    expect(detectarLlegada(rapido, PIN)).toBeUndefined();
  });

  it('sin dato de velocidad, o con alguno detenido, vale', () => {
    expect(detectarLlegada([en(0), en(50)], PIN)).toBeDefined();
    expect(detectarLlegada([en(0, { velocidadMs: 9 }), en(50, { velocidadMs: 0.5 })], PIN)).toBeDefined();
  });

  it('el tramo se confirma aunque el camión ya se haya ido al llegar el último punto', () => {
    expect(detectarLlegada([en(0), en(50), lejos(100)], PIN)).toBeDefined();
  });
});
