import { describe, expect, it, vi } from 'vitest';
import type { Geocodificacion } from '../ports/out/geocodificador.js';
import { err, ok } from '../../domain/shared/result.js';
import { fakeClientes, localDe } from './fakes-clientes.test-util.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeEntregasRuta, fakeRutas } from './fakes-rutas.test-util.js';
import { fakeFacturas, facturaDe, resolverDePrueba } from './fakes-facturas.test-util.js';
import { crearGeocodificarLocal } from './geocodificar-local.js';
import { crearRegistrarEvento } from './entregas.js';
import { crearVerificarPinesRespaldados } from './verificar-pines-respaldados.js';
import { crearObtenerLocal } from './obtener-local.js';
const pin: Geocodificacion = { lat: -33.6, lng: -70.7, precision: 'exacta', comuna: 'San Bernardo', direccion: 'OHiggins 955' };
const visitas = [20, 21].map(d => ({ lat: pin.lat, lng: pin.lng, precisionM: 10, en: new Date(`2026-10-${d}T15:00:00Z`) }));

describe('búsqueda y consolidación de pines Gemini', () => {
  it('solo fija un resultado exacto del mapa con calle, número y comuna compatibles, conservando el origen Gemini', async () => {
    const clientes = fakeClientes([localDe({ direccion: 'OHigins 955', comuna: 'San Bernardo' })]);
    const buscar = vi.fn().mockResolvedValueOnce(err('SIN_RESULTADO')).mockResolvedValueOnce(ok(pin));
    const buscadorIA = { buscar: vi.fn(async (_d: string, _c: string, mapa: (d: string) => Promise<Geocodificacion | undefined>) => mapa('OHiggins 955')) };
    const caso = crearGeocodificarLocal({ clientes, geocodificadores: [{ buscar }], buscadorIA, clock: crearReloj().clock });
    expect(await caso('empresa-1', 'l-1')).toBe('fijado');
    expect(clientes.fijarPinGeocodificado).toHaveBeenCalledWith('empresa-1', 'l-1', pin.lat, pin.lng, 0.6, 'gemini');
  });
  it.each([{ ...pin, direccion: 'OHiggins 950' }, { ...pin, comuna: 'Maipú' }, { ...pin, precision: 'calle' as const }, { ...pin, lat: 0 }])('descarta una coincidencia incompatible sin fijar un pin', async resultado => {
    const clientes = fakeClientes([localDe({ direccion: 'OHigins 955', comuna: 'San Bernardo' })]);
    const buscar = vi.fn().mockResolvedValueOnce(err('SIN_RESULTADO')).mockResolvedValueOnce(ok(resultado));
    const buscadorIA = { buscar: vi.fn(async (_d: string, _c: string, mapa: (d: string) => Promise<Geocodificacion | undefined>) => mapa('OHiggins 955')) };
    expect(await crearGeocodificarLocal({ clientes, geocodificadores: [{ buscar }], buscadorIA, clock: crearReloj().clock })('empresa-1', 'l-1')).toBe('sin_resultado');
    expect(clientes.fijarPinGeocodificado).not.toHaveBeenCalled();
  });
  it('no consulta IA si el pin ya existe o los mapas están caídos', async () => {
    const buscadorIA = { buscar: vi.fn() }, buscar = vi.fn().mockResolvedValue(err('RED'));
    const clientes = fakeClientes([localDe({ lat: pin.lat, lng: pin.lng })]);
    expect(await crearGeocodificarLocal({ clientes, geocodificadores: [{ buscar }], buscadorIA, clock: crearReloj().clock })('empresa-1', 'l-1')).toBe('ya_tiene_pin');
    const sin = fakeClientes([localDe()]);
    expect(await crearGeocodificarLocal({ clientes: sin, geocodificadores: [{ buscar }], buscadorIA, clock: crearReloj().clock })('empresa-1', 'l-1')).toBe('detener');
    expect(buscadorIA.buscar).not.toHaveBeenCalled();
  });
  it('ni la primera entrega ni dos botones solos mueven o verifican un pin Gemini; dos detenciones sí lo confirman', async () => {
    for (const n of [0, 1, 2]) {
      const clientes = fakeClientes([localDe({ lat: pin.lat, lng: pin.lng, pinFuente: 'gemini' })]);
      const entregas = fakeEntregasRuta();
      entregas.visitasConGps.mockResolvedValue(visitas);
      entregas.visitasDetenidasDeLocales.mockResolvedValue(new Map([['l-1', visitas.slice(0, n)]]));
      const facturas = fakeFacturas(); facturas.obtener.mockResolvedValue(facturaDe());
      const caso = crearRegistrarEvento({ clientes, entregas, facturas, rutas: fakeRutas().repo, resolverCamion: resolverDePrueba(), reloj: crearReloj().clock });
      const r = await caso(usuarioDe(), 'f-1', { tipo: 'entregado', lat: pin.lat, lng: pin.lng, precisionM: 10 });
      expect(r.ok).toBe(true);
      expect(clientes.ajustarPinPorEntrega).not.toHaveBeenCalled();
      expect(clientes.verificarPinPorEntregas).toHaveBeenCalledTimes(n === 2 ? 1 : 0);
    }
  });
  it('el análisis de fondo exige la misma evidencia y muestra una propuesta si las visitas coinciden lejos', async () => {
    const clientes = fakeClientes([localDe({ lat: pin.lat, lng: pin.lng, pinFuente: 'gemini' })]);
    clientes.listarPinesParaRevisar.mockResolvedValue([{ id: 'l-1', razonSocial: 'Local', direccion: pin.direccion ?? '', comuna: 'San Bernardo', lat: pin.lat, lng: pin.lng, pinFuente: 'gemini' }]);
    const entregas = fakeEntregasRuta();
    entregas.visitasConGpsDeLocales.mockResolvedValue(new Map([['l-1', visitas]]));
    const verificar = crearVerificarPinesRespaldados({ clientes, entregas, clock: crearReloj().clock });
    expect(await verificar('empresa-1')).toBe(0);
    entregas.visitasDetenidasDeLocales.mockResolvedValue(new Map([['l-1', visitas]]));
    expect(await verificar('empresa-1')).toBe(1);
    const lejos = visitas.map(v => ({ ...v, lat: v.lat + 0.01 }));
    entregas.visitasDetenidasDeLocales.mockResolvedValue(new Map([['l-1', lejos]]));
    expect(await verificar('empresa-1')).toBe(0);
    const ficha = await crearObtenerLocal({ clientes, entregas })(usuarioDe(), 'l-1');
    expect(ficha.ok && ficha.value.pinRespaldo?.nivel).toBe('en_conflicto');
    expect(ficha.ok && ficha.value.pinCorreccion).toEqual({ lat: pin.lat + 0.01, lng: pin.lng });
  });
});
