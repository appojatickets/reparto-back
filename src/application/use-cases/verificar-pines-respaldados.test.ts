import { describe, expect, it, vi } from 'vitest';
import type { VisitaConGps } from '../../domain/entidades/respaldo-del-pin.js';
import type { LocalConPin } from '../ports/out/clientes.js';
import { crearReloj } from './fakes.test-util.js';
import { fakeClientes } from './fakes-clientes.test-util.js';
import { crearVerificarPinesRespaldados } from './verificar-pines-respaldados.js';

const local = (id: string): LocalConPin => ({ id, razonSocial: `Local ${id}`, direccion: `Calle ${id}`, comuna: 'Maipú', lat: -33.5, lng: -70.7 });
const visita = (dia: string, dLat = 0, precisionM = 10): VisitaConGps => ({ lat: -33.5 + dLat, lng: -70.7, precisionM, en: new Date(`${dia}T15:00:00Z`) });

const montar = (locales: LocalConPin[], visitas: Record<string, VisitaConGps[]>) => {
  const clientes = fakeClientes();
  clientes.listarPinesParaRevisar.mockResolvedValue(locales);
  const entregas = { visitasConGpsDeLocales: vi.fn(() => Promise.resolve(new Map(Object.entries(visitas)) as ReadonlyMap<string, readonly VisitaConGps[]>)) };
  return { verificar: crearVerificarPinesRespaldados({ clientes, entregas, clock: crearReloj().clock }), clientes };
};

describe('verificar solos los pines que las entregas respaldan', () => {
  it('verifica el pin con dos entregas parecidas junto a él; deja a la persona el que no tiene entregas y el que tiene entregas en lugares distintos', async () => {
    const t = montar(
      [local('respaldado'), local('sin'), local('conflicto'), local('una')],
      {
        respaldado: [visita('2026-10-07'), visita('2026-10-08', 0.0001)],
        conflicto: [visita('2026-10-07', 0.004), visita('2026-10-08', -0.004)],
        una: [visita('2026-10-07')],
      },
    );
    expect(await t.verificar('empresa-1')).toBe(1);
    expect(t.clientes.verificarPinPorEntregas).toHaveBeenCalledTimes(1);
    expect(t.clientes.verificarPinPorEntregas).toHaveBeenCalledWith('empresa-1', 'respaldado', expect.any(Date));
  });

  it('dos entregas que coinciden entre sí pero lejos del pin no lo verifican: eso lo mira una persona', async () => {
    const t = montar([local('lejos')], { lejos: [visita('2026-10-07', 0.001), visita('2026-10-08', 0.001)] });
    expect(await t.verificar('empresa-1')).toBe(0);
    expect(t.clientes.verificarPinPorEntregas).not.toHaveBeenCalled();
  });

  it('un GPS impreciso no cuenta como respaldo', async () => {
    const t = montar([local('malo')], { malo: [visita('2026-10-07', 0, 90), visita('2026-10-08', 0, 90)] });
    expect(await t.verificar('empresa-1')).toBe(0);
  });
});
