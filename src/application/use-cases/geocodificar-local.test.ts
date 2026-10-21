import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../domain/shared/result.js';
import type { Geocodificador } from '../ports/out/geocodificador.js';
import type { NormalizadorDeDirecciones } from '../ports/out/normalizador-direcciones.js';
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

describe('cuando ningún buscador la encuentra, Gemini ordena la dirección y se busca de nuevo', () => {
  const sucia = () => localDe({ direccion: 'Pje Los Olmoz 88 depto 3', comuna: 'San Bernardo' });
  const montarConGemini = (normalizar: NormalizadorDeDirecciones['normalizar'], encontrar: (consulta: string) => ReturnType<Geocodificador['buscar']>) => {
    const clientes = fakeClientes([sucia()]);
    const buscar = vi.fn<Geocodificador['buscar']>(encontrar);
    const normalizarFn = vi.fn<NormalizadorDeDirecciones['normalizar']>(normalizar);
    return { clientes, buscar, normalizar: normalizarFn, caso: crearGeocodificarLocal({ clientes, geocodificadores: [{ buscar }], clock, normalizador: { normalizar: normalizarFn } }) };
  };
  const hallado = ok({ lat: -33.6, lng: -70.7, precision: 'exacta' as const, comuna: 'San Bernardo' });

  it('busca con la dirección ordenada y deja el pin como aproximado (confianza de calle), aunque el mapa diga que es exacto', async () => {
    const m = montarConGemini(() => Promise.resolve(ok({ calle: 'Los Olmos', numero: 88 })), (c) => Promise.resolve(c.startsWith('Los Olmos 88') ? hallado : err('SIN_RESULTADO' as const)));
    expect(await m.caso('empresa-1', 'l-1')).toBe('fijado');
    expect(m.normalizar).toHaveBeenCalledWith('Pje Los Olmoz 88 depto 3', 'San Bernardo');
    expect(m.buscar).toHaveBeenLastCalledWith('Los Olmos 88, San Bernardo, Región Metropolitana, Chile');
    expect(m.clientes.fijarPinGeocodificado).toHaveBeenCalledWith('empresa-1', 'l-1', -33.6, -70.7, 0.6);
  });

  it('si ningún mapa la halla ni con el texto ordenado, queda el punto aproximado que estimó Gemini si es creíble en su comuna (confianza 0,3)', async () => {
    const m = montarConGemini(() => Promise.resolve(ok({ calle: 'Los Olmos', numero: 88, estimada: { lat: -33.595, lng: -70.705 } })), () => Promise.resolve(err('SIN_RESULTADO' as const)));
    expect(await m.caso('empresa-1', 'l-1')).toBe('fijado');
    expect(m.clientes.fijarPinGeocodificado).toHaveBeenCalledWith('empresa-1', 'l-1', -33.595, -70.705, 0.3);
    expect(m.clientes.marcarIntentoGeocodificacion).not.toHaveBeenCalled();
  });

  it('una estimación que cae lejos de su comuna se descarta: queda sin resultado, como si Gemini no hubiera ayudado', async () => {
    const m = montarConGemini(() => Promise.resolve(ok({ calle: 'Los Olmos', numero: 88, estimada: { lat: -33.4, lng: -70.4 } })), () => Promise.resolve(err('SIN_RESULTADO' as const)));
    expect(await m.caso('empresa-1', 'l-1')).toBe('sin_resultado');
    expect(m.clientes.fijarPinGeocodificado).not.toHaveBeenCalled();
    expect(m.clientes.marcarIntentoGeocodificacion).toHaveBeenCalledTimes(1);
  });

  it('un mapa que sí la halla manda sobre la estimación de Gemini', async () => {
    const m = montarConGemini(() => Promise.resolve(ok({ calle: 'Los Olmos', numero: 88, estimada: { lat: -33.595, lng: -70.705 } })), (c) => Promise.resolve(c.startsWith('Los Olmos 88') ? hallado : err('SIN_RESULTADO' as const)));
    expect(await m.caso('empresa-1', 'l-1')).toBe('fijado');
    expect(m.clientes.fijarPinGeocodificado).toHaveBeenCalledWith('empresa-1', 'l-1', -33.6, -70.7, 0.6);
  });

  it('si el primer buscador ya la encontró, Gemini ni se consulta', async () => {
    const m = montarConGemini(() => Promise.resolve(err('FALLO' as const)), () => Promise.resolve(hallado));
    expect(await m.caso('empresa-1', 'l-1')).toBe('fijado');
    expect(m.normalizar).not.toHaveBeenCalled();
  });

  it('si Gemini falla o no entiende la dirección, queda como antes: sin resultado y se anota el intento', async () => {
    for (const e of ['FALLO', 'SIN_RESULTADO'] as const) {
      const m = montarConGemini(() => Promise.resolve(err(e)), () => Promise.resolve(err('SIN_RESULTADO' as const)));
      expect(await m.caso('empresa-1', 'l-1')).toBe('sin_resultado');
      expect(m.clientes.marcarIntentoGeocodificacion).toHaveBeenCalledTimes(1);
    }
  });

  it('si a Gemini se le acabó el cupo, se detiene sin anotar el intento (se vuelve a probar más tarde)', async () => {
    const m = montarConGemini(() => Promise.resolve(err('LIMITE' as const)), () => Promise.resolve(err('SIN_RESULTADO' as const)));
    expect(await m.caso('empresa-1', 'l-1')).toBe('detener');
    expect(m.clientes.marcarIntentoGeocodificacion).not.toHaveBeenCalled();
  });

  it('si Gemini devuelve lo mismo que ya se buscó, no repite la búsqueda', async () => {
    const m = montarConGemini(() => Promise.resolve(ok({ calle: 'Pje Los Olmoz 88 depto 3' })), () => Promise.resolve(err('SIN_RESULTADO' as const)));
    // La dirección ya limpia es «Pasaje Los Olmoz 88»: otra escritura sí se busca, la idéntica no.
    const antes = m.buscar.mock.calls.length;
    await m.caso('empresa-1', 'l-1');
    expect(m.buscar.mock.calls.length - antes).toBeLessThanOrEqual(2);
  });

  it('un punto hallado con el texto de Gemini sigue pasando por las mismas reglas: en otra comuna no se acepta', async () => {
    const m = montarConGemini(() => Promise.resolve(ok({ calle: 'Los Olmos', numero: 88 })), () => Promise.resolve(ok({ lat: -33.4, lng: -70.6, precision: 'exacta' as const, comuna: 'Providencia' })));
    expect(await m.caso('empresa-1', 'l-1')).toBe('sin_resultado');
    expect(m.clientes.fijarPinGeocodificado).not.toHaveBeenCalled();
  });

  it('si un buscador falla al probar el texto de Gemini, se detiene sin anotar el intento', async () => {
    let n = 0;
    const m = montarConGemini(() => Promise.resolve(ok({ calle: 'Los Olmos', numero: 88 })), () => Promise.resolve(++n === 1 ? err('SIN_RESULTADO' as const) : err('RED' as const)));
    expect(await m.caso('empresa-1', 'l-1')).toBe('detener');
    expect(m.clientes.marcarIntentoGeocodificacion).not.toHaveBeenCalled();
  });
});
