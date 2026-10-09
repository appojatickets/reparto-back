import { describe, expect, it } from 'vitest';
import { usuarioDe } from './fakes.test-util.js';
import { fakeAlmacen, fakeClientes, fallaAlmacen, localDe } from './fakes-clientes.test-util.js';
import { crearCorregirCliente, crearEliminarLocal } from './corregir-clientes.js';

const editor = usuarioDe({ id: 'u-ed', rol: 'chofer', editor: true });

describe('corregir los datos de un cliente (razón social, RUT, giro)', () => {
  const corregir = (clientes = fakeClientes([localDe()])) => ({ clientes, caso: crearCorregirCliente({ clientes }) });

  it('guarda la razón social corregida, sin espacios de más', async () => {
    const { clientes, caso } = corregir();
    const r = await caso(editor, 'c-1', { razonSocial: '  Botillería   El  Sol ' });
    expect(r.ok).toBe(true);
    expect(clientes.corregirCliente).toHaveBeenCalledWith('empresa-1', 'c-1', { razonSocial: 'Botillería El Sol' });
  });

  it('normaliza el RUT y el giro; vacíos los borran', async () => {
    const { clientes, caso } = corregir();
    await caso(editor, 'c-1', { rut: '12.345.678-5', giro: '  Almacén   de barrio ' });
    expect(clientes.corregirCliente).toHaveBeenLastCalledWith('empresa-1', 'c-1', { rut: '12345678-5', giro: 'Almacén de barrio' });
    await caso(editor, 'c-1', { rut: '  ', giro: '' });
    expect(clientes.corregirCliente).toHaveBeenLastCalledWith('empresa-1', 'c-1', { rut: null, giro: null });
  });

  it.each([
    [{ razonSocial: '   ' }, 'razón social'],
    [{ razonSocial: 'x'.repeat(201) }, '200'],
    [{ rut: '1-8' }, 'rut'],
    [{ giro: 'x'.repeat(101) }, '100'],
    [{}, 'nada'],
  ])('rechaza %j', async (cambios, texto) => {
    const { clientes, caso } = corregir();
    const r = await caso(editor, 'c-1', cambios);
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(!r.ok && r.error.mensaje.toLowerCase()).toContain(texto);
    expect(clientes.corregirCliente).not.toHaveBeenCalled();
  });

  it('un RUT que ya tiene otro cliente es CONFLICTO', async () => {
    const { clientes, caso } = corregir();
    clientes.corregirCliente.mockResolvedValueOnce('RUT_DUPLICADO');
    const r = await caso(editor, 'c-1', { rut: '12.345.678-5' });
    expect(!r.ok && r.error.codigo).toBe('CONFLICTO');
    expect(!r.ok && r.error.mensaje).toContain('RUT');
  });

  it('un cliente que no existe (o es de otra empresa) es NO_ENCONTRADO', async () => {
    const { clientes, caso } = corregir(fakeClientes([]));
    clientes.corregirCliente.mockResolvedValueOnce('NO_ENCONTRADO');
    const r = await caso(editor, 'c-9', { razonSocial: 'Nuevo' });
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });
});

describe('eliminar una dirección equivocada', () => {
  it('elimina la dirección y borra su foto del almacenamiento', async () => {
    const clientes = fakeClientes([localDe({ fotoPath: 'empresa-1/l-1/x.webp' })]);
    const almacen = fakeAlmacen();
    const r = await crearEliminarLocal({ clientes, almacen })(editor, 'l-1');
    expect(r.ok).toBe(true);
    expect(clientes.eliminarLocal).toHaveBeenCalledWith('empresa-1', 'l-1');
    expect(almacen.eliminar).toHaveBeenCalledWith('empresa-1/l-1/x.webp');
  });

  it('sin foto no toca el almacenamiento, y si el almacenamiento falla la dirección igual queda eliminada', async () => {
    const sinFoto = fakeAlmacen();
    expect((await crearEliminarLocal({ clientes: fakeClientes([localDe()]), almacen: sinFoto })(editor, 'l-1')).ok).toBe(true);
    expect(sinFoto.eliminar).not.toHaveBeenCalled();
    const r = await crearEliminarLocal({ clientes: fakeClientes([localDe({ fotoPath: 'p' })]), almacen: fallaAlmacen() })(editor, 'l-1');
    expect(r.ok).toBe(true);
  });

  it('si ya tiene entregas hechas no se elimina (se protege el historial) y la foto se conserva', async () => {
    const clientes = fakeClientes([localDe({ fotoPath: 'empresa-1/l-1/x.webp' })]);
    clientes.eliminarLocal.mockResolvedValueOnce('CON_ENTREGAS');
    const almacen = fakeAlmacen();
    const r = await crearEliminarLocal({ clientes, almacen })(editor, 'l-1');
    expect(!r.ok && r.error.codigo).toBe('CONFLICTO');
    expect(!r.ok && r.error.mensaje).toMatch(/entregas/);
    expect(almacen.eliminar).not.toHaveBeenCalled();
  });

  it('una dirección que no existe es NO_ENCONTRADO', async () => {
    const r = await crearEliminarLocal({ clientes: fakeClientes([]), almacen: fakeAlmacen() })(editor, 'l-9');
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });
});
