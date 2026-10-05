import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../domain/shared/result.js';
import type { Geocodificador } from '../ports/out/geocodificador.js';
import { crearReloj } from './fakes.test-util.js';
import { fakeClientes, localDe } from './fakes-clientes.test-util.js';
import { crearGeocodificarLocal } from './geocodificar-local.js';

const { clock } = crearReloj();
const montar = (local = localDe({ direccion: 'Camino Santa Rita Parcela Nº 4', comuna: 'Pirque' }), respuesta: ReturnType<Geocodificador['buscar']> = Promise.resolve(ok({ lat: -33.72, lng: -70.59, precision: 'calle' as const, comuna: 'Pirque' }))) => {
  const clientes = fakeClientes([local]);
  const buscar = vi.fn<Geocodificador['buscar']>(() => respuesta);
  return { clientes, buscar, caso: crearGeocodificarLocal({ clientes, geocodificador: { buscar }, clock }) };
};

describe('buscar el pin de un local por su dirección', () => {
  it('busca la calle sin parcela ni loteo, con la comuna, y deja el pin sugerido con su confianza', async () => {
    const { caso, buscar, clientes } = montar();
    expect(await caso('empresa-1', 'l-1')).toBe('fijado');
    expect(buscar).toHaveBeenCalledWith('Camino Santa Rita, Pirque, Región Metropolitana, Chile');
    expect(clientes.fijarPinGeocodificado).toHaveBeenCalledWith('empresa-1', 'l-1', -33.72, -70.59, 0.6);
  });

  it('un local que ya tiene pin no se busca', async () => {
    const { caso, buscar } = montar(localDe({ lat: -33.5, lng: -70.6 }));
    expect(await caso('empresa-1', 'l-1')).toBe('ya_tiene_pin');
    expect(buscar).not.toHaveBeenCalled();
  });

  it('un local que no existe en esa empresa', async () => {
    const { caso } = montar();
    expect(await caso('otra', 'l-1')).toBe('no_existe');
  });

  it('una dirección sin calle (solo parcela, «Sin dirección») no sale a buscar y queda anotada', async () => {
    const { caso, buscar, clientes } = montar(localDe({ direccion: 'Sin dirección', comuna: 'Paine' }));
    expect(await caso('empresa-1', 'l-1')).toBe('sin_resultado');
    expect(buscar).not.toHaveBeenCalled();
    expect(clientes.marcarIntentoGeocodificacion).toHaveBeenCalledWith('empresa-1', 'l-1', clock.now());
  });

  it('sin resultado, o con un punto en otra comuna o solo una zona, no se fija y se anota el intento', async () => {
    for (const respuesta of [err('SIN_RESULTADO' as const), ok({ lat: -33.7, lng: -70.7, precision: 'calle' as const, comuna: 'Buin' }), ok({ lat: -33.7, lng: -70.7, precision: 'zona' as const })]) {
      const { caso, clientes } = montar(undefined, Promise.resolve(respuesta));
      expect(await caso('empresa-1', 'l-1')).toBe('sin_resultado');
      expect(clientes.fijarPinGeocodificado).not.toHaveBeenCalled();
      expect(clientes.marcarIntentoGeocodificacion).toHaveBeenCalledTimes(1);
    }
  });

  it('si el servicio cae o llega al límite se detiene sin anotar el intento (se vuelve a probar)', async () => {
    for (const e of ['RED', 'LIMITE'] as const) {
      const { caso, clientes } = montar(undefined, Promise.resolve(err(e)));
      expect(await caso('empresa-1', 'l-1')).toBe('detener');
      expect(clientes.marcarIntentoGeocodificacion).not.toHaveBeenCalled();
    }
  });

  it('si mientras tanto alguien fijó el pin, no lo pisa', async () => {
    const { caso, clientes } = montar();
    clientes.fijarPinGeocodificado.mockResolvedValueOnce(false);
    expect(await caso('empresa-1', 'l-1')).toBe('ya_tiene_pin');
  });
});
