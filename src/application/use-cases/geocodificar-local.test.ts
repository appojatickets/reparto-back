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
  return { clientes, buscar, caso: crearGeocodificarLocal({ clientes, geocodificadores: [{ buscar }], clock }) };
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

  describe('con un segundo buscador de respaldo', () => {
    const calle = ok({ lat: -33.72, lng: -70.59, precision: 'calle' as const, comuna: 'Pirque' });
    const armar = (primero: ReturnType<Geocodificador['buscar']>, segundo: ReturnType<Geocodificador['buscar']>) => {
      const clientes = fakeClientes([localDe({ direccion: 'Camino Santa Rita Parcela Nº 4', comuna: 'Pirque' })]);
      const uno = vi.fn<Geocodificador['buscar']>(() => primero);
      const dos = vi.fn<Geocodificador['buscar']>(() => segundo);
      return { clientes, uno, dos, caso: crearGeocodificarLocal({ clientes, geocodificadores: [{ buscar: uno }, { buscar: dos }], clock }) };
    };

    it('si el primero no lo encuentra, prueba con el segundo y fija su pin', async () => {
      const { caso, uno, dos, clientes } = armar(Promise.resolve(err('SIN_RESULTADO' as const)), Promise.resolve(calle));
      expect(await caso('empresa-1', 'l-1')).toBe('fijado');
      expect(uno).toHaveBeenCalledTimes(1);
      expect(dos).toHaveBeenCalledWith('Camino Santa Rita, Pirque, Región Metropolitana, Chile');
      expect(clientes.fijarPinGeocodificado).toHaveBeenCalledWith('empresa-1', 'l-1', -33.72, -70.59, 0.6);
    });

    it('si el primero responde algo que no sirve (otra comuna, solo una zona), también prueba con el segundo', async () => {
      const { caso, dos } = armar(Promise.resolve(ok({ lat: -33.7, lng: -70.7, precision: 'calle' as const, comuna: 'Buin' })), Promise.resolve(calle));
      expect(await caso('empresa-1', 'l-1')).toBe('fijado');
      expect(dos).toHaveBeenCalledTimes(1);
    });

    it('si el primero sirve, el segundo ni se consulta (cuida el límite diario)', async () => {
      const { caso, dos } = armar(Promise.resolve(calle), Promise.resolve(calle));
      expect(await caso('empresa-1', 'l-1')).toBe('fijado');
      expect(dos).not.toHaveBeenCalled();
    });

    it('si el primero cae pero el segundo lo encuentra, se fija igual', async () => {
      const { caso } = armar(Promise.resolve(err('RED' as const)), Promise.resolve(calle));
      expect(await caso('empresa-1', 'l-1')).toBe('fijado');
    });

    it('si ninguno lo encuentra se anota el intento una sola vez: «no se encontró»', async () => {
      const { caso, clientes } = armar(Promise.resolve(err('SIN_RESULTADO' as const)), Promise.resolve(err('SIN_RESULTADO' as const)));
      expect(await caso('empresa-1', 'l-1')).toBe('sin_resultado');
      expect(clientes.marcarIntentoGeocodificacion).toHaveBeenCalledTimes(1);
    });

    it('si uno no encontró y el otro estaba caído o sin cupo, no se anota el intento: se vuelve a probar', async () => {
      for (const e of ['RED', 'LIMITE'] as const) {
        const { caso, clientes } = armar(Promise.resolve(err('SIN_RESULTADO' as const)), Promise.resolve(err(e)));
        expect(await caso('empresa-1', 'l-1')).toBe('detener');
        expect(clientes.marcarIntentoGeocodificacion).not.toHaveBeenCalled();
      }
    });
  });
});

describe('asistencia de direcciones tras fallar los mapas', () => {
  const montarIa = (conPin = false) => {
    const clientes = fakeClientes([localDe({ direccion: 'OHigins 955', comuna: 'San Bernardo', ...(conPin ? { lat: -33.59, lng: -70.71 } : {}) })]);
    const buscar = vi.fn<Geocodificador['buscar']>().mockResolvedValue(err('SIN_RESULTADO'));
    const esperar = vi.fn<((ms: number) => Promise<void>)>().mockResolvedValue(undefined);
    const normalizar = vi.fn().mockResolvedValue("O'Higgins 955");
    return { clientes, buscar, normalizar, esperar, caso: crearGeocodificarLocal({ clientes, geocodificadores: [{ buscar }], normalizador: { normalizar }, esperar, clock }) };
  };
  it('solo usa coordenadas del mapa y deja aproximada la propuesta de IA', async () => {
    const s = montarIa();
    s.buscar.mockResolvedValueOnce(err('SIN_RESULTADO')).mockResolvedValueOnce(ok({ lat: -33.59, lng: -70.71, precision: 'exacta', comuna: 'San Bernardo' }));
    expect(await s.caso('empresa-1', 'l-1')).toBe('fijado');
    expect(s.normalizar).toHaveBeenCalledWith('OHigins 955', 'San Bernardo');
    expect(s.esperar).toHaveBeenCalledWith(1000);
    expect(s.buscar).toHaveBeenLastCalledWith("O'Higgins 955, San Bernardo, Región Metropolitana, Chile");
    expect(s.clientes.fijarPinGeocodificado).toHaveBeenCalledWith('empresa-1', 'l-1', -33.59, -70.71, 0.6);
  });
  it('no consume IA si ya hay pin, el mapa acierta o existe una caída de mapas', async () => {
    const conPin = montarIa(true); expect(await conPin.caso('empresa-1', 'l-1')).toBe('ya_tiene_pin'); expect(conPin.normalizar).not.toHaveBeenCalled();
    const directo = montarIa(); directo.buscar.mockResolvedValue(ok({ lat: -33.59, lng: -70.71, precision: 'exacta', comuna: 'San Bernardo' }));
    expect(await directo.caso('empresa-1', 'l-1')).toBe('fijado'); expect(directo.normalizar).not.toHaveBeenCalled();
    const caido = montarIa(); caido.buscar.mockResolvedValue(err('LIMITE'));
    expect(await caido.caso('empresa-1', 'l-1')).toBe('detener'); expect(caido.normalizar).not.toHaveBeenCalled();
  });
  it('un fallo de IA conserva el funcionamiento normal y rechaza coordenadas en otra comuna', async () => {
    const s = montarIa(); s.normalizar.mockRejectedValue(new Error('sin cuota'));
    expect(await s.caso('empresa-1', 'l-1')).toBe('sin_resultado'); expect(s.clientes.fijarPinGeocodificado).not.toHaveBeenCalled();
    const otra = montarIa(); otra.buscar.mockResolvedValueOnce(err('SIN_RESULTADO')).mockResolvedValueOnce(ok({ lat: -33.59, lng: -70.71, precision: 'exacta', comuna: 'Buin' }));
    expect(await otra.caso('empresa-1', 'l-1')).toBe('sin_resultado'); expect(otra.clientes.fijarPinGeocodificado).not.toHaveBeenCalled();
  });
});
