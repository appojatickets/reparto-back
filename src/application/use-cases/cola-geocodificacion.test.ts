import { describe, expect, it, vi } from 'vitest';
import { crearColaGeocodificacion } from './cola-geocodificacion.js';
import type { ResultadoGeocodificar } from './geocodificar-local.js';

describe('cola de búsqueda de pines', () => {
  const armar = (resultados: ResultadoGeocodificar[] = []) => {
    const geocodificar = vi.fn((empresaId: string, localId: string): Promise<ResultadoGeocodificar> => Promise.resolve(empresaId !== '' && localId !== '' ? (resultados.shift() ?? 'fijado') : 'detener'));
    const esperas: number[] = [];
    const cola = crearColaGeocodificacion({ geocodificar, esperar: (ms) => { esperas.push(ms); return Promise.resolve(); } });
    return { cola, geocodificar, esperas };
  };

  it('procesa de a uno con una pausa entre consultas y no repite los que ya esperan', async () => {
    const { cola, geocodificar, esperas } = armar();
    expect(cola.encolar('e1', ['a', 'b', 'a'])).toBe(2);
    expect(cola.enMarcha()).toBe(true);
    await cola.terminada();
    expect(geocodificar.mock.calls.map((c) => c[1])).toEqual(['a', 'b']);
    expect(esperas).toEqual([1100]);
    expect(cola.enMarcha()).toBe(false);
    expect(cola.pendientes()).toBe(0);
  });

  it('lo que llega mientras corre se suma; una vez terminada, se puede volver a encolar el mismo local', async () => {
    const { cola, geocodificar } = armar();
    cola.encolar('e1', ['a']);
    cola.encolar('e1', ['b']);
    await cola.terminada();
    cola.encolar('e1', ['a']);
    await cola.terminada();
    expect(geocodificar).toHaveBeenCalledTimes(3);
  });

  it('si el servicio se detiene (o algo falla) vacía la cola y queda lista para volver a empezar', async () => {
    const { cola, geocodificar } = armar(['fijado', 'detener']);
    cola.encolar('e1', ['a', 'b', 'c', 'd']);
    await cola.terminada();
    expect(geocodificar).toHaveBeenCalledTimes(2);
    expect(cola.pendientes()).toBe(0);
    geocodificar.mockRejectedValueOnce(new Error('caída'));
    cola.encolar('e1', ['x', 'y']);
    await cola.terminada();
    expect(geocodificar).toHaveBeenCalledTimes(3);
    expect(cola.enMarcha()).toBe(false);
  });
});
