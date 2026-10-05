import { describe, expect, it } from 'vitest';
import { usuarioDe } from './fakes.test-util.js';
import { fakeClientes } from './fakes-clientes.test-util.js';
import { crearExportarLocales } from './exportar-locales.js';

const admin = usuarioDe();

describe('exportar locales', () => {
  it('pasa los filtros ya limpios (comunas con su nombre oficial) a la empresa del actor y cuenta las filas', async () => {
    const clientes = fakeClientes();
    const fila = { localId: 'l-1', clienteId: 'c-1', razonSocial: 'Kiosko', estadoCliente: 'activo' as const, direccion: 'Calle 1', comuna: 'Maipú', pinEstado: 'pendiente' as const, tieneFoto: false, creadoEn: '2026-10-05T12:00:00.000Z' };
    clientes.exportarLocales.mockResolvedValueOnce([fila]);
    const r = await crearExportarLocales({ clientes })(admin, { comunas: ['maipu', ' PAINE '], pin: 'sin', foto: 'con', texto: '  rabelo ' });
    expect(r).toEqual({ ok: true, value: { total: 1, filas: [fila] } });
    expect(clientes.exportarLocales).toHaveBeenCalledWith('empresa-1', { comunas: ['Maipú', 'Paine'], pin: 'sin', foto: 'con', texto: 'rabelo' }, 50_000);
  });

  it('sin filtros exporta todo; una comuna que no es de la RM es VALIDACION', async () => {
    const clientes = fakeClientes();
    expect((await crearExportarLocales({ clientes })(admin, {})).ok).toBe(true);
    expect(clientes.exportarLocales).toHaveBeenCalledWith('empresa-1', {}, 50_000);
    const mala = await crearExportarLocales({ clientes })(admin, { comunas: ['Valparaíso'] });
    expect(!mala.ok && mala.error.codigo).toBe('VALIDACION');
  });
});
