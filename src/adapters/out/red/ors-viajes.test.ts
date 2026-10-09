import { describe, expect, it, vi } from 'vitest';
import { crearProveedorOrs, MAX_TRAMOS_POR_CONSULTA } from './ors-viajes.js';

const puntos = [{ lat: -33.5, lng: -70.7 }, { lat: -33.51, lng: -70.71 }, { lat: -33.6, lng: -70.5 }];
const ok = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } }));

describe('OpenRouteService: matriz por calles', () => {
  it('pide la matriz con la clave, en el orden longitud-latitud, y devuelve segundos y metros', async () => {
    const buscar = vi.fn(() => ok({ durations: [[0, 120, 900]], distances: [[0, 1500, 18000]] }));
    const r = await crearProveedorOrs('mi-clave', buscar).matriz(puntos, [0], [0, 1, 2]);
    expect(r).toEqual({ segundos: [[0, 120, 900]], metros: [[0, 1500, 18000]] });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string; method: string }];
    expect(url).toBe('https://api.openrouteservice.org/v2/matrix/driving-car');
    expect(init.method).toBe('POST');
    expect(init.headers['authorization']).toBe('mi-clave');
    expect(JSON.parse(init.body)).toEqual({ locations: [[-70.7, -33.5], [-70.71, -33.51], [-70.5, -33.6]], sources: [0], destinations: [0, 1, 2], metrics: ['duration', 'distance'], units: 'm' });
  });

  it('un tramo sin camino (null) pasa como NaN para que se descarte', async () => {
    const buscar = vi.fn(() => ok({ durations: [[0, null]], distances: [[0, null]] }));
    const r = await crearProveedorOrs('k', buscar).matriz(puntos, [0], [0, 1]);
    expect(Number.isNaN(r?.segundos[0]?.[1])).toBe(true);
  });

  it('cualquier falla devuelve undefined: clave mala, límite diario, red caída, respuesta rara o forma distinta de la pedida', async () => {
    const con = (b: () => Promise<Response>) => crearProveedorOrs('k', vi.fn(b)).matriz(puntos, [0], [0, 1, 2]);
    expect(await con(() => ok({ error: 'Access to this API has been disallowed' }, 403))).toBeUndefined();
    expect(await con(() => ok({ error: 'Rate limit exceeded' }, 429))).toBeUndefined();
    expect(await con(() => Promise.reject(new Error('sin red')))).toBeUndefined();
    expect(await con(() => Promise.resolve(new Response('no es json', { status: 200 })))).toBeUndefined();
    expect(await con(() => ok({ durations: 'x', distances: [] }))).toBeUndefined();
    expect(await con(() => ok({ durations: [[1, 2]], distances: [[1, 2]] }))).toBeUndefined(); // pidió 3 columnas
  });

  it('no consulta si excede el límite del plan gratuito ni con menos de 2 puntos', async () => {
    const buscar = vi.fn();
    const p = crearProveedorOrs('k', buscar);
    const muchos = Array.from({ length: 100 }, (_, i) => ({ lat: -33.5 - i * 0.001, lng: -70.7 }));
    const todos = muchos.map((_, i) => i);
    expect(todos.length * todos.length).toBeGreaterThan(MAX_TRAMOS_POR_CONSULTA);
    expect(await p.matriz(muchos, todos, todos)).toBeUndefined();
    expect(await p.matriz([puntos[0] ?? { lat: 0, lng: 0 }], [0], [0])).toBeUndefined();
    expect(buscar).not.toHaveBeenCalled();
  });
});
