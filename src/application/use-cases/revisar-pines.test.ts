import { describe, expect, it, vi } from 'vitest';
import type { VisitaConGps } from '../../domain/entidades/respaldo-del-pin.js';
import type { LocalConPin } from '../ports/out/clientes.js';
import { usuarioDe } from './fakes.test-util.js';
import { fakeClientes } from './fakes-clientes.test-util.js';
import { crearRevisarPines } from './revisar-pines.js';

const admin = usuarioDe({ id: 'u-a', rol: 'admin' });
const local = (id: string, extra: Partial<LocalConPin> = {}): LocalConPin => ({ id, razonSocial: `Local ${id}`, direccion: `Calle ${id}`, comuna: 'Maipú', lat: -33.5, lng: -70.7, ...extra });
const visita = (dia: string, dLat = 0): VisitaConGps => ({ lat: -33.5 + dLat, lng: -70.7, precisionM: 10, en: new Date(`${dia}T15:00:00Z`) });

const montar = (locales: LocalConPin[], visitas: Record<string, VisitaConGps[]> = {}) => {
  const clientes = fakeClientes();
  clientes.listarPinesParaRevisar.mockResolvedValue(locales);
  const entregas = { visitasConGpsDeLocales: vi.fn(() => Promise.resolve(new Map(Object.entries(visitas)) as ReadonlyMap<string, readonly VisitaConGps[]>)) };
  return { revisar: crearRevisarPines({ clientes, entregas }), clientes, entregas };
};

describe('revisar pines', () => {
  it('por verificar: primero los respaldados por entregas, después los en conflicto y al final los sin respaldo', async () => {
    const t = montar(
      [local('sin'), local('conflicto'), local('respaldado')],
      { respaldado: [visita('2026-10-07'), visita('2026-10-08', 0.0001)], conflicto: [visita('2026-10-07', 0.004), visita('2026-10-08', -0.004)] },
    );
    const r = await t.revisar(admin, 'por_verificar');
    expect(r.ok && r.value.pines.map((p) => `${p.id}:${p.respaldo.nivel}`)).toEqual(['respaldado:respaldado', 'conflicto:en_conflicto', 'sin:sin_respaldo']);
    expect(r.ok && r.value.total).toBe(3);
    expect(t.clientes.listarPinesParaRevisar).toHaveBeenCalledWith('empresa-1', 'por_verificar', 400);
  });

  it('verificados: conserva el orden del repositorio y dice quién los verificó', async () => {
    const t = montar([local('a', { pinVerificacion: 'entregas', verificadoEn: new Date('2026-10-08T15:00:00Z') }), local('b', { pinVerificacion: 'persona', verificadoEn: new Date('2026-10-07T15:00:00Z') })]);
    const r = await t.revisar(admin, 'verificados');
    expect(r.ok && r.value.pines.map((p) => [p.id, p.pinVerificacion, p.respaldo.nivel])).toEqual([['a', 'entregas', 'verificado'], ['b', 'persona', 'verificado']]);
  });

  it('muestra hasta 100 y dice cuántos hay en total', async () => {
    const t = montar(Array.from({ length: 130 }, (_, i) => local(`l${String(i)}`)));
    const r = await t.revisar(admin, 'por_verificar');
    expect(r.ok && [r.value.pines.length, r.value.total]).toEqual([100, 130]);
  });

  it('si no se pueden leer las entregas, la lista igual se entrega, sin evidencia', async () => {
    const t = montar([local('a')]);
    t.entregas.visitasConGpsDeLocales.mockRejectedValueOnce(new Error('caída'));
    const r = await t.revisar(admin, 'por_verificar');
    expect(r.ok && r.value.pines[0]?.respaldo).toMatchObject({ nivel: 'sin_respaldo', entregas: 0 });
  });
});
