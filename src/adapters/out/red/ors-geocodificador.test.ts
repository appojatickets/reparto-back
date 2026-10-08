import { describe, expect, it, vi } from 'vitest';
import { crearOrsGeocodificador } from './ors-geocodificador.js';

const json = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));
const con = (f: () => Promise<Response>) => crearOrsGeocodificador('clave-de-prueba', vi.fn(f));
const lugar = (propiedades: Record<string, unknown>, coordenadas: unknown = [-70.6, -33.5]) => ({ geometry: { coordinates: coordenadas }, properties: propiedades });

describe('geocodificador OpenRouteService (Pelias)', () => {
  it('pide acotado a Chile con la clave en el encabezado y devuelve el punto como (lat, lng)', async () => {
    const buscar = vi.fn(() => json({ features: [lugar({ layer: 'address', match_type: 'exact', localadmin: 'Maipú' }, [-70.7587, -33.5101])] }));
    const r = await crearOrsGeocodificador('mi-clave', buscar).buscar('Avenida Pajaritos 1234, Maipú, Región Metropolitana, Chile');
    expect(r).toEqual({ ok: true, value: { lat: -33.5101, lng: -70.7587, precision: 'exacta', comuna: 'Maipú' } });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('https://api.openrouteservice.org/geocode/search');
    expect(url).toContain('boundary.country=CL');
    expect(url).toContain(`text=${encodeURIComponent('Avenida Pajaritos 1234, Maipú, Región Metropolitana, Chile')}`);
    expect((init.headers as Record<string, string>)['authorization']).toBe('mi-clave');
    expect(url).not.toContain('mi-clave');
  });

  it('un número interpolado o una calle valen como «calle»; un barrio o una comuna, como zona', async () => {
    const interpolada = await con(() => json({ features: [lugar({ layer: 'address', match_type: 'interpolated', locality: 'Pirque' })] })).buscar('x');
    expect(interpolada.ok && interpolada.value).toMatchObject({ precision: 'calle', comuna: 'Pirque' });
    const calle = await con(() => json({ features: [lugar({ layer: 'street', county: 'Buin' })] })).buscar('x');
    expect(calle.ok && calle.value).toMatchObject({ precision: 'calle', comuna: 'Buin' });
    const zona = await con(() => json({ features: [lugar({ layer: 'locality', locality: 'Paine' })] })).buscar('x');
    expect(zona.ok && zona.value.precision).toBe('zona');
  });

  it('toma el resultado más preciso entre los devueltos', async () => {
    const r = await con(() => json({ features: [lugar({ layer: 'locality' }, [-70.1, -33.1]), lugar({ layer: 'address', match_type: 'exact' }, [-70.2, -33.2])] })).buscar('x');
    expect(r.ok && r.value).toMatchObject({ lat: -33.2, lng: -70.2, precision: 'exacta' });
  });

  it('sin resultados o con coordenadas inválidas no hay resultado', async () => {
    expect(await con(() => json({ features: [] })).buscar('x')).toEqual({ ok: false, error: 'SIN_RESULTADO' });
    expect(await con(() => json({ features: [lugar({ layer: 'address' }, ['a', 'b'])] })).buscar('x')).toEqual({ ok: false, error: 'SIN_RESULTADO' });
    expect(await con(() => json({ raro: true })).buscar('x')).toEqual({ ok: false, error: 'SIN_RESULTADO' });
  });

  it('distingue el límite o la clave inválida de una caída de la red', async () => {
    expect(await con(() => json({}, 429)).buscar('x')).toEqual({ ok: false, error: 'LIMITE' });
    expect(await con(() => json({}, 403)).buscar('x')).toEqual({ ok: false, error: 'LIMITE' });
    expect(await con(() => json({}, 401)).buscar('x')).toEqual({ ok: false, error: 'LIMITE' });
    expect(await con(() => json({}, 500)).buscar('x')).toEqual({ ok: false, error: 'RED' });
    expect(await con(() => Promise.reject(new Error('sin red'))).buscar('x')).toEqual({ ok: false, error: 'RED' });
    expect(await con(() => Promise.resolve(new Response('no es json'))).buscar('x')).toEqual({ ok: false, error: 'RED' });
  });
});
