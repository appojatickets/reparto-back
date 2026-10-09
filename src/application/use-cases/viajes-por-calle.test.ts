import { describe, expect, it, vi } from 'vitest';
import type { CacheDeViajes, ProveedorDeViajes, ViajeGuardado } from '../ports/out/viajes.js';
import { claveDePunto, crearViajesPorCalle, type NodoDeViaje } from './viajes-por-calle.js';

const nodo = (id: string, lat: number, lng: number, rol: NodoDeViaje['rol'] = 'parada'): NodoDeViaje => ({ id, lat, lng, rol });
const A = nodo('A', -33.5, -70.7);
const B = nodo('B', -33.51, -70.71);
const C = nodo('C', -33.52, -70.72);
const DEP = nodo('__deposito__', -33.6, -70.5, 'deposito');
const ORI = nodo('__origen__', -33.45, -70.65, 'origen');

/** Un servicio de prueba: cada tramo dura 60 s por cada 0,01° de diferencia en latitud y longitud. */
const proveedorDePrueba = () => {
  const matriz = vi.fn<ProveedorDeViajes['matriz']>((puntos, desde, hacia) =>
    Promise.resolve({
      segundos: desde.map((i) => hacia.map((j) => Math.round((Math.abs((puntos[i]?.lat ?? 0) - (puntos[j]?.lat ?? 0)) + Math.abs((puntos[i]?.lng ?? 0) - (puntos[j]?.lng ?? 0))) * 6000))),
      metros: desde.map((i) => hacia.map((j) => Math.round((Math.abs((puntos[i]?.lat ?? 0) - (puntos[j]?.lat ?? 0)) + Math.abs((puntos[i]?.lng ?? 0) - (puntos[j]?.lng ?? 0))) * 100_000))),
    }));
  return { matriz } satisfies ProveedorDeViajes;
};
const cacheEnMemoria = () => {
  const filas = new Map<string, ViajeGuardado>();
  const cache = {
    leer: vi.fn<CacheDeViajes['leer']>((desde, hacia) => Promise.resolve([...filas.values()].filter((f) => desde.includes(f.desde) && hacia.includes(f.hasta)))),
    guardar: vi.fn<CacheDeViajes['guardar']>((viajes) => { viajes.forEach((v) => { filas.set(`${v.desde}|${v.hasta}`, v); }); return Promise.resolve(); }),
  } satisfies CacheDeViajes;
  return { cache, filas };
};

describe('tiempos de manejar por calles', () => {
  it('sin servicio configurado no sabe nada y la ruta sigue en línea recta', async () => {
    const { cache } = cacheEnMemoria();
    const v = await crearViajesPorCalle({ proveedor: undefined, cache })([A, B, DEP]);
    expect(v.minutos('A', 'B')).toBeUndefined();
    expect(v.conCalles).toBe(false);
    expect(cache.leer).not.toHaveBeenCalled();
  });

  it('consulta lo que falta, lo guarda y entrega los minutos entre dos nodos por su id', async () => {
    const proveedor = proveedorDePrueba();
    const { cache, filas } = cacheEnMemoria();
    const { minutos: viaje, conCalles } = await crearViajesPorCalle({ proveedor, cache })([ORI, A, B, DEP]);
    expect(conCalles).toBe(true);
    expect(viaje('A', 'B')).toBe(2);
    expect(viaje('__origen__', 'A')).toBeGreaterThan(0);
    expect(viaje('B', '__deposito__')).toBeGreaterThan(0);
    expect(viaje('A', 'A')).toBe(0);
    expect(filas.size).toBe(4 + 3); // A→B, A→depósito, B→A, B→depósito, y el origen hacia los tres
    expect(proveedor.matriz).toHaveBeenCalledTimes(2); // una para entre paradas y una solo para la fila del origen
  });

  it('un par ya consultado no se vuelve a pedir; si cambia solo el punto del camión se pide solo esa fila', async () => {
    const proveedor = proveedorDePrueba();
    const { cache } = cacheEnMemoria();
    const servicio = crearViajesPorCalle({ proveedor, cache });
    await servicio([ORI, A, B, DEP]);
    expect(proveedor.matriz).toHaveBeenCalledTimes(2);
    await servicio([ORI, A, B, DEP]);
    expect(proveedor.matriz).toHaveBeenCalledTimes(2);
    await servicio([nodo('__origen__', -33.46, -70.66, 'origen'), A, B, DEP]);
    expect(proveedor.matriz).toHaveBeenCalledTimes(3);
    expect(proveedor.matriz.mock.calls[2]?.[1]).toEqual([0]); // una sola fila
    await servicio([ORI, A, B, C, DEP]); // una parada nueva: faltan los tramos entre paradas y también origen → C
    expect(proveedor.matriz).toHaveBeenCalledTimes(5);
  });

  it('dos pines casi iguales (menos de ~11 m) comparten lo consultado', async () => {
    const proveedor = proveedorDePrueba();
    const { cache } = cacheEnMemoria();
    const servicio = crearViajesPorCalle({ proveedor, cache });
    await servicio([A, B, DEP]);
    const antes = proveedor.matriz.mock.calls.length;
    await servicio([nodo('A', -33.50002, -70.70002), B, DEP]);
    expect(proveedor.matriz.mock.calls.length).toBe(antes);
    expect(claveDePunto({ lat: -33.50002, lng: -70.70002 })).toBe(claveDePunto(A));
  });

  it('si el servicio falla devuelve lo que haya guardado y no rompe', async () => {
    const proveedor = { matriz: vi.fn<ProveedorDeViajes['matriz']>(() => Promise.resolve(undefined)) } satisfies ProveedorDeViajes;
    const { cache } = cacheEnMemoria();
    const { minutos: viaje } = await crearViajesPorCalle({ proveedor, cache })([ORI, A, B, DEP]);
    expect(viaje('A', 'B')).toBeUndefined();
    const rotos = { matriz: vi.fn<ProveedorDeViajes['matriz']>(() => Promise.reject(new Error('sin red'))) } satisfies ProveedorDeViajes;
    expect((await crearViajesPorCalle({ proveedor: rotos, cache })([A, B, DEP])).minutos('A', 'B')).toBeUndefined();
  });

  it('descarta respuestas absurdas (negativas o no numéricas)', async () => {
    const proveedor = { matriz: vi.fn<ProveedorDeViajes['matriz']>((_p, desde, hacia) => Promise.resolve({ segundos: desde.map(() => hacia.map(() => -5)), metros: desde.map(() => hacia.map(() => Number.NaN)) })) } satisfies ProveedorDeViajes;
    const { cache, filas } = cacheEnMemoria();
    const { minutos: viaje } = await crearViajesPorCalle({ proveedor, cache })([A, B, DEP]);
    expect(viaje('A', 'B')).toBeUndefined();
    expect(filas.size).toBe(0);
  });
});
