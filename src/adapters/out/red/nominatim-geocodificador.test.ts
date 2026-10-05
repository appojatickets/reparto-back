import { describe, expect, it, vi } from 'vitest';
import { crearNominatimGeocodificador } from './nominatim-geocodificador.js';

const json = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));
const con = (f: () => Promise<Response>) => crearNominatimGeocodificador('reparto-test', vi.fn(f));

describe('geocodificador Nominatim', () => {
  it('pide con el User-Agent de la aplicación, acotado a Chile, y toma el resultado más preciso', async () => {
    const buscar = vi.fn(() => json([
      { lat: '-33.70', lon: '-70.60', addresstype: 'suburb', address: { municipality: 'Pirque' } },
      { lat: '-33.7211', lon: '-70.5902', addresstype: 'road', address: { municipality: 'Pirque', road: 'Camino Santa Rita' } },
    ]));
    const r = await crearNominatimGeocodificador('reparto-test (contacto)', buscar).buscar('Camino Santa Rita, Pirque, Región Metropolitana, Chile');
    expect(r).toEqual({ ok: true, value: { lat: -33.7211, lng: -70.5902, precision: 'calle', comuna: 'Pirque' } });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('countrycodes=cl');
    expect(url).toContain(encodeURIComponent('Camino Santa Rita, Pirque'));
    expect((init.headers as Record<string, string>)['user-agent']).toBe('reparto-test (contacto)');
  });

  it('reconoce un número de casa como exacto y una localidad como zona', async () => {
    const exacta = await con(() => json([{ lat: '-33.6', lon: '-70.5', addresstype: 'house', address: {} }])).buscar('x');
    expect(exacta.ok && exacta.value.precision).toBe('exacta');
    const zona = await con(() => json([{ lat: '-33.6', lon: '-70.5', addresstype: 'village', address: { municipality: 'Paine' } }])).buscar('x');
    expect(zona.ok && zona.value).toMatchObject({ precision: 'zona', comuna: 'Paine' });
  });

  it('sin resultados, o con coordenadas inválidas, no hay resultado', async () => {
    expect(await con(() => json([])).buscar('x')).toEqual({ ok: false, error: 'SIN_RESULTADO' });
    expect(await con(() => json([{ lat: 'x', lon: 'y' }])).buscar('x')).toEqual({ ok: false, error: 'SIN_RESULTADO' });
    expect(await con(() => json({ error: 'raro' })).buscar('x')).toEqual({ ok: false, error: 'SIN_RESULTADO' });
  });

  it('distingue el límite de consultas de una caída de la red', async () => {
    expect(await con(() => json([], 429)).buscar('x')).toEqual({ ok: false, error: 'LIMITE' });
    expect(await con(() => json([], 500)).buscar('x')).toEqual({ ok: false, error: 'RED' });
    expect(await con(() => Promise.reject(new Error('sin red'))).buscar('x')).toEqual({ ok: false, error: 'RED' });
    expect(await con(() => Promise.resolve(new Response('no es json'))).buscar('x')).toEqual({ ok: false, error: 'RED' });
  });
});
