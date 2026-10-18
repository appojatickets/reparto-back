import { describe, expect, it, vi } from 'vitest';
import { crearTrazadoOrs } from './ors-trazado.js';
const puntos = [{ lat: -33.5, lng: -70.6 }, { lat: -33.6, lng: -70.7 }, { lat: -33.7, lng: -70.8 }];
const respuesta = () => new Response(JSON.stringify({ features: [{ geometry: { type: 'LineString', coordinates: [[-70.6, -33.5], [-70.65, -33.55], [-70.7, -33.6], [-70.8, -33.7]] }, properties: { way_points: [0, 2, 3] } }] }));
describe('trazado por calles', () => {
  it('separa los colores por parada y cachea sin volver a consultar', async () => {
    const buscar = vi.fn<typeof fetch>(() => Promise.resolve(respuesta()));
    const proveedor = crearTrazadoOrs('clave', 'driving-hgv', () => 0, buscar);
    const r = await proveedor.trazar(puntos);
    expect(r.tramos).toHaveLength(2);
    expect(r.tramos[0]?.coordenadas).toHaveLength(3);
    expect(r.tramos[1]?.coordenadas).toEqual([[-70.7, -33.6], [-70.8, -33.7]]);
    expect(r.tramos.every((t) => t.porCalles)).toBe(true);
    await proveedor.trazar(puntos);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar.mock.calls[0]?.[0]).toContain('driving-hgv');
  });
  it('identifica el respaldo como línea recta y permite reintentar pasado un minuto', async () => {
    let ahora = 0;
    const buscar = vi.fn<typeof fetch>(() => Promise.resolve(new Response('', { status: 429 })));
    const proveedor = crearTrazadoOrs('clave', 'driving-car', () => ahora, buscar);
    expect((await proveedor.trazar(puntos)).tramos.every((t) => !t.porCalles)).toBe(true);
    await proveedor.trazar(puntos);
    expect(buscar).toHaveBeenCalledTimes(1);
    ahora = 60001;
    await proveedor.trazar(puntos);
    expect(buscar).toHaveBeenCalledTimes(2);
  });
  it('sin clave no consume red y datos inválidos no se presentan como calles', async () => {
    const buscar = vi.fn<typeof fetch>(() => Promise.resolve(new Response('{"features":[]}')));
    const sinClave = crearTrazadoOrs(undefined, 'driving-car', () => 0, buscar);
    expect((await sinClave.trazar(puntos)).tramos).toHaveLength(2);
    expect(buscar).not.toHaveBeenCalled();
    expect((await crearTrazadoOrs('clave', 'driving-car', () => 0, buscar).trazar(puntos)).tramos[0]?.porCalles).toBe(false);
  });
});
