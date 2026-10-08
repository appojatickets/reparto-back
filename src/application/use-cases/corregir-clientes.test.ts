import { describe, expect, it } from 'vitest';
import { usuarioDe } from './fakes.test-util.js';
import { fakeAlmacen, fakeClientes, fallaAlmacen, localDe } from './fakes-clientes.test-util.js';
import { crearCambiarRazonSocial, crearEliminarLocal } from './corregir-clientes.js';

const editor = usuarioDe({ id: 'u-ed', rol: 'chofer', editor: true });

describe('corregir la razón social de un cliente', () => {
  it('guarda el nombre corregido, sin espacios de más', async () => {
    const clientes = fakeClientes([localDe()]);
    const r = await crearCambiarRazonSocial({ clientes })(editor, 'c-1', '  Botillería   El  Sol ');
    expect(r.ok).toBe(true);
    expect(clientes.renombrarCliente).toHaveBeenCalledWith('empresa-1', 'c-1', 'Botillería El Sol');
  });

  it('rechaza un nombre vacío o de más de 200 caracteres', async () => {
    const clientes = fakeClientes([localDe()]);
    const cambiar = crearCambiarRazonSocial({ clientes });
    const vacio = await cambiar(editor, 'c-1', '   ');
    expect(!vacio.ok && vacio.error.codigo).toBe('VALIDACION');
    const largo = await cambiar(editor, 'c-1', 'x'.repeat(201));
    expect(!largo.ok && largo.error.codigo).toBe('VALIDACION');
    expect(clientes.renombrarCliente).not.toHaveBeenCalled();
  });

  it('un cliente que no existe (o es de otra empresa) es NO_ENCONTRADO', async () => {
    const clientes = fakeClientes([]);
    clientes.renombrarCliente.mockResolvedValueOnce(false);
    const r = await crearCambiarRazonSocial({ clientes })(editor, 'c-9', 'Nuevo');
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
