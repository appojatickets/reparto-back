import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../domain/shared/result.js';
import type { Vendedor, VendedorRepository } from '../ports/out/vendedores.js';
import { usuarioDe } from './fakes.test-util.js';
import { crearActualizarVendedor, crearCrearVendedor, crearListarVendedores } from './vendedores.js';

const admin = usuarioDe();
const V: Vendedor = { id: 'v-1', codigo: 'V01', nombre: 'Ana', celular: '56912345678', activo: true };

const fakeRepo = () => {
  const listar = vi.fn((): Promise<readonly Vendedor[]> => Promise.resolve([V]));
  const crear = vi.fn((): ReturnType<VendedorRepository['crear']> => Promise.resolve(ok(V)));
  const actualizar = vi.fn((): Promise<Vendedor | undefined> => Promise.resolve(V));
  const vendedores: VendedorRepository = { listar, crear, actualizar };
  return { vendedores, listar, crear, actualizar };
};

describe('vendedores', () => {
  it('crear normaliza el código, el nombre y el celular', async () => {
    const { vendedores, crear } = fakeRepo();
    const r = await crearCrearVendedor({ vendedores })(admin, { codigo: ' v 01 ', nombre: '  Ana   Pérez ', celular: '+56 9 1234 5678' });
    expect(r.ok).toBe(true);
    expect(crear).toHaveBeenCalledWith('empresa-1', { codigo: 'V01', nombre: 'Ana Pérez', celular: '56912345678' });
  });

  it('el celular es opcional', async () => {
    const { vendedores, crear } = fakeRepo();
    await crearCrearVendedor({ vendedores })(admin, { codigo: 'V02', nombre: 'Luis', celular: '  ' });
    expect(crear).toHaveBeenCalledWith('empresa-1', { codigo: 'V02', nombre: 'Luis' });
  });

  it.each([
    [{ codigo: '', nombre: 'Ana' }],
    [{ codigo: 'V 0!', nombre: 'Ana' }],
    [{ codigo: 'V01', nombre: '   ' }],
    [{ codigo: 'V01', nombre: 'Ana', celular: '12345' }],
  ])('rechaza datos inválidos %j sin tocar la base', async (entrada) => {
    const { vendedores, crear } = fakeRepo();
    const r = await crearCrearVendedor({ vendedores })(admin, entrada);
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(crear).not.toHaveBeenCalled();
  });

  it('código repetido es CONFLICTO', async () => {
    const { vendedores, crear } = fakeRepo();
    crear.mockResolvedValueOnce(err('CODIGO_DUPLICADO'));
    const r = await crearCrearVendedor({ vendedores })(admin, { codigo: 'V01', nombre: 'Ana' });
    expect(!r.ok && r.error.codigo).toBe('CONFLICTO');
  });

  it('listar usa la empresa del actor', async () => {
    const { vendedores, listar } = fakeRepo();
    await crearListarVendedores({ vendedores })(admin, { soloActivos: true });
    expect(listar).toHaveBeenCalledWith('empresa-1', { soloActivos: true });
  });

  it('actualizar: celular vacío o null lo borra; uno inválido se rechaza; sin cambios es VALIDACION; inexistente NO_ENCONTRADO', async () => {
    const { vendedores, actualizar: actualizarMock } = fakeRepo();
    const actualizar = crearActualizarVendedor({ vendedores });
    await actualizar(admin, 'v-1', { celular: '' });
    expect(actualizarMock).toHaveBeenLastCalledWith('empresa-1', 'v-1', { celular: null });
    await actualizar(admin, 'v-1', { celular: '987654321', activo: false, nombre: ' Ana  M ' });
    expect(actualizarMock).toHaveBeenLastCalledWith('empresa-1', 'v-1', { nombre: 'Ana M', celular: '56987654321', activo: false });
    const malo = await actualizar(admin, 'v-1', { celular: '123' });
    expect(!malo.ok && malo.error.codigo).toBe('VALIDACION');
    const nada = await actualizar(admin, 'v-1', {});
    expect(!nada.ok && nada.error.codigo).toBe('VALIDACION');
    actualizarMock.mockResolvedValueOnce(undefined);
    const no = await actualizar(admin, 'v-x', { activo: true });
    expect(!no.ok && no.error.codigo).toBe('NO_ENCONTRADO');
  });
});
