import { describe, expect, it, vi } from 'vitest';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeClientes } from './fakes-clientes.test-util.js';
import { crearVerFichaAprendida } from './ficha-aprendida.js';

const admin = usuarioDe({ id: 'u-a', rol: 'admin' });
const en = (dia: number, hora: number): Date => new Date(Date.UTC(2026, 9, dia, hora + 3));

describe('ver la ficha aprendida de un local', () => {
  it('arma la ficha con los avisos de entrega y de cerrado del local, de los últimos 180 días', async () => {
    const clientes = fakeClientes();
    clientes.obtenerLocal.mockResolvedValue({ id: 'l1' } as never);
    const eventos = [{ tipo: 'entregado', creadoEn: en(5, 10) }, { tipo: 'entregado', creadoEn: en(6, 10) }, { tipo: 'cerrado', creadoEn: en(7, 13) }];
    const entregas = { eventosDeLocal: vi.fn(() => Promise.resolve(eventos)) };
    const { clock } = crearReloj('2026-10-10T12:00:00Z');
    const r = await crearVerFichaAprendida({ clientes, entregas, clock })(admin, 'l1');
    expect(r.ok && r.value).toMatchObject({ visitas: 3, entregas: 2, cerrados: 1 });
    expect(entregas.eventosDeLocal).toHaveBeenCalledWith('empresa-1', 'l1', new Date('2026-04-13T12:00:00.000Z'));
  });

  it('un local que no existe es NO_ENCONTRADO', async () => {
    const clientes = fakeClientes();
    clientes.obtenerLocal.mockResolvedValue(undefined);
    const r = await crearVerFichaAprendida({ clientes, entregas: { eventosDeLocal: vi.fn() }, clock: crearReloj().clock })(admin, 'x');
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });
});
