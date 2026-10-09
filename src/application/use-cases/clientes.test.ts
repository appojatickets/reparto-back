import { describe, expect, it, vi } from 'vitest';
import { crearActualizarLocal } from './actualizar-local.js';
import { crearBuscarClientes } from './buscar-clientes.js';
import { crearCrearClienteNuevo } from './crear-cliente-nuevo.js';
import { crearImportarClientes } from './importar-clientes.js';
import { ok } from '../../domain/shared/result.js';
import { usuarioDe } from './fakes.test-util.js';
import { fakeClientes, localDe } from './fakes-clientes.test-util.js';

const despachador = usuarioDe({ id: 'u-d', rol: 'despachador' });
const admin = usuarioDe();

describe('buscarClientes por RUT', () => {
  it('un RUT escrito solo con números busca por RUT (sin puntos ni guion) y no por texto', async () => {
    const clientes = fakeClientes();
    const buscar = crearBuscarClientes({ clientes });
    await buscar(despachador, { q: '77.975.918-0' });
    expect(clientes.buscar).toHaveBeenLastCalledWith('empresa-1', { texto: '', rutDigitos: '779759180', limite: 8 });
    await buscar(despachador, { q: '77975918', comuna: 'San Bernardo', limite: 3 });
    expect(clientes.buscar).toHaveBeenLastCalledWith('empresa-1', { texto: '', rutDigitos: '77975918', comuna: 'San Bernardo', limite: 3 });
  });

  it('un número de calle no se toma por RUT', async () => {
    const clientes = fakeClientes();
    await crearBuscarClientes({ clientes })(despachador, { q: 'colon 765' });
    expect(clientes.buscar).toHaveBeenLastCalledWith('empresa-1', { texto: 'colon 765', limite: 8 });
  });
});

describe('buscarClientes', () => {
  it('normaliza el texto (tildes, mayúsculas) y filtra por la empresa del actor', async () => {
    const clientes = fakeClientes();
    await crearBuscarClientes({ clientes })(despachador, { q: '  RÁBE ' });
    expect(clientes.buscar).toHaveBeenCalledWith('empresa-1', { texto: 'rabe', limite: 8 });
  });

  it('con menos de 2 letras no consulta la base', async () => {
    const clientes = fakeClientes();
    expect(await crearBuscarClientes({ clientes })(despachador, { q: ' a ' })).toEqual([]);
    expect(clientes.buscar).not.toHaveBeenCalled();
  });

  it('acota el límite y resuelve la comuna ignorando tildes; una comuna inválida se ignora', async () => {
    const clientes = fakeClientes();
    const buscar = crearBuscarClientes({ clientes });
    await buscar(despachador, { q: 'kiosko', comuna: 'nunoa', limite: 500 });
    expect(clientes.buscar).toHaveBeenLastCalledWith('empresa-1', { texto: 'kiosko', comuna: 'Ñuñoa', limite: 20 });
    await buscar(despachador, { q: 'kiosko', comuna: 'Valparaíso', limite: 0 });
    expect(clientes.buscar).toHaveBeenLastCalledWith('empresa-1', { texto: 'kiosko', limite: 1 });
  });
});

const datos = { rut: '12.345.678-5', razonSocial: 'Rabelo Mágica SpA', direccion: 'Av. Providencia 1234', comuna: 'Providencia' };

describe('crearClienteNuevo', () => {
  it('el despachador crea un cliente «nuevo»; el admin lo crea «activo»', async () => {
    const clientes = fakeClientes();
    const crear = crearCrearClienteNuevo({ clientes });
    await crear(despachador, datos);
    expect(clientes.crearConLocal.mock.calls[0]?.[1].estado).toBe('nuevo');
    await crear(admin, datos);
    expect(clientes.crearConLocal.mock.calls[1]?.[1].estado).toBe('activo');
  });

  it('con coordenadas el pin queda validado (manual); sin ellas, pendiente', async () => {
    const clientes = fakeClientes();
    const crear = crearCrearClienteNuevo({ clientes });
    await crear(despachador, { ...datos, lat: -33.43, lng: -70.61 });
    expect(clientes.crearConLocal.mock.calls[0]?.[1].local).toMatchObject({ pinEstado: 'validado', pinFuente: 'manual', lat: -33.43 });
    await crear(despachador, datos);
    expect(clientes.crearConLocal.mock.calls[1]?.[1].local.pinEstado).toBe('pendiente');
  });

  it('datos inválidos: VALIDACION con el detalle de cada error y sin tocar la base', async () => {
    const clientes = fakeClientes();
    const r = await crearCrearClienteNuevo({ clientes })(despachador, { ...datos, comuna: 'Valparaíso', rut: '1-8' });
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(clientes.crearConLocal).not.toHaveBeenCalled();
  });

  it('si el cliente ya existía (incompleto), no se rechaza: se completa y se devuelve el existente', async () => {
    const clientes = fakeClientes();
    clientes.crearConLocal.mockResolvedValueOnce(ok({ clienteId: 'c-7', localId: 'l-7', existente: true }));
    const r = await crearCrearClienteNuevo({ clientes })(despachador, datos);
    expect(r).toEqual({ ok: true, value: { clienteId: 'c-7', localId: 'l-7', existente: true } });
  });

  it('una carrera con otra persona que lo registró justo antes es CONFLICTO con un mensaje claro', async () => {
    const clientes = fakeClientes();
    clientes.crearConLocal.mockResolvedValueOnce({ ok: false, error: 'DUPLICADO' });
    const r = await crearCrearClienteNuevo({ clientes })(despachador, datos);
    expect(!r.ok && r.error.codigo).toBe('CONFLICTO');
    expect(!r.ok && r.error.mensaje).toContain('Vuelve a buscarlo');
  });
});

describe('importarClientes', () => {
  const fila = (n: number) => ({ rut: '', razonSocial: `Cliente ${n}`, direccion: `Calle ${n}`, comuna: 'Maipú' });

  it('importa las filas válidas y reporta las inválidas con su número', async () => {
    const clientes = fakeClientes();
    const r = await crearImportarClientes({ clientes })(admin, [fila(1), { ...fila(2), comuna: 'Marte' }, fila(3)]);
    expect(r.ok && r.value).toMatchObject({ totalFilas: 3, validas: 2, resumen: { clientesCreados: 2 } });
    expect(r.ok && r.value.errores).toEqual([{ fila: 2, errores: [expect.objectContaining({ codigo: 'COMUNA_INVALIDA' })] }]);
  });

  it('consolida duplicados dentro del lote antes de llegar al repositorio', async () => {
    const clientes = fakeClientes();
    await crearImportarClientes({ clientes })(admin, [fila(1), { ...fila(1), direccion: 'CALLE 1' }, fila(2)]);
    expect(clientes.importar.mock.calls[0]?.[1]).toHaveLength(2);
  });

  it('un lote vacío o demasiado grande se rechaza', async () => {
    const clientes = fakeClientes();
    const importar = crearImportarClientes({ clientes });
    const vacio = await importar(admin, []);
    expect(!vacio.ok && vacio.error.codigo).toBe('VALIDACION');
    const grande = await importar(admin, Array.from({ length: 1001 }, (_, i) => fila(i)));
    expect(!grande.ok && grande.error.mensaje).toContain('1000');
    expect(clientes.importar).not.toHaveBeenCalled();
  });

  it('si todas las filas son inválidas no llama al repositorio', async () => {
    const clientes = fakeClientes();
    const r = await crearImportarClientes({ clientes })(admin, [{ razonSocial: '', direccion: '', comuna: '' }]);
    expect(r.ok && r.value.validas).toBe(0);
    expect(clientes.importar).not.toHaveBeenCalled();
  });
});

describe('actualizarLocal', () => {
  const clientes = () => fakeClientes([localDe()]);

  it('actualiza nota, rumbo y pin (el pin puesto a mano queda validado)', async () => {
    const c = clientes();
    const r = await crearActualizarLocal({ clientes: c })(despachador, 'l-1', { nota: ' portón   verde ', streetviewRumbo: 90, lat: -33.43, lng: -70.61 });
    expect(r.ok).toBe(true);
    expect(c.actualizarLocal).toHaveBeenCalledWith('empresa-1', 'l-1', {
      nota: 'portón verde',
      streetviewRumbo: 90,
      pin: { lat: -33.43, lng: -70.61, estado: 'validado', fuente: 'manual' },
    });
  });

  it.each([
    [{}, 'nada que actualizar'],
    [{ streetviewRumbo: 360 }, 'rumbo'],
    [{ streetviewRumbo: 1.5 }, 'rumbo'],
    [{ nota: 'x'.repeat(501) }, 'nota'],
    [{ lat: -33.4 }, 'longitud'],
    [{ lat: -41.4, lng: -72.9 }, 'Región Metropolitana'],
  ])('rechaza %j', async (entrada, texto) => {
    const r = await crearActualizarLocal({ clientes: clientes() })(despachador, 'l-1', entrada);
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(!r.ok && r.error.mensaje.toLowerCase()).toContain(texto.toLowerCase());
  });

  describe('corregir la dirección y la comuna', () => {
    it('limpia el texto, deja la comuna con su nombre oficial, vuelve a buscar el pin y guarda lo demás', async () => {
      const c = clientes();
      const programarPines = vi.fn();
      const r = await crearActualizarLocal({ clientes: c, programarPines })(despachador, 'l-1', { direccion: ' Av.  Colón  765 ', comuna: 'san bernardo', nota: 'portón' });
      expect(r.ok).toBe(true);
      expect(c.corregirDireccion).toHaveBeenCalledWith('empresa-1', 'l-1', { direccion: 'Av. Colón 765', comuna: 'San Bernardo' });
      expect(c.actualizarLocal).toHaveBeenCalledWith('empresa-1', 'l-1', { nota: 'portón' });
      expect(programarPines).toHaveBeenCalledWith('empresa-1', ['l-1']);
    });

    it('con solo la dirección conserva la comuna que ya tiene (y al revés)', async () => {
      const c = clientes();
      await crearActualizarLocal({ clientes: c })(despachador, 'l-1', { direccion: 'Calle Nueva 10' });
      expect(c.corregirDireccion).toHaveBeenLastCalledWith('empresa-1', 'l-1', { direccion: 'Calle Nueva 10', comuna: 'Providencia' });
      await crearActualizarLocal({ clientes: c })(despachador, 'l-1', { comuna: 'Ñuñoa' });
      expect(c.corregirDireccion).toHaveBeenLastCalledWith('empresa-1', 'l-1', { direccion: 'Av. Providencia 1234', comuna: 'Ñuñoa' });
    });

    it.each([
      [{ direccion: '   ' }, 'dirección'],
      [{ direccion: 'x'.repeat(301) }, '300'],
      [{ comuna: 'Valparaíso' }, 'comuna'],
    ])('rechaza %j sin tocar nada', async (entrada, texto) => {
      const c = clientes();
      const r = await crearActualizarLocal({ clientes: c })(despachador, 'l-1', entrada);
      expect(!r.ok && r.error.codigo).toBe('VALIDACION');
      expect(!r.ok && r.error.mensaje.toLowerCase()).toContain(texto);
      expect(c.corregirDireccion).not.toHaveBeenCalled();
    });

    it('si el cliente ya tiene un local con esa dirección es CONFLICTO y no se guarda lo demás', async () => {
      const c = clientes();
      c.corregirDireccion.mockResolvedValueOnce('DUPLICADO');
      const r = await crearActualizarLocal({ clientes: c })(despachador, 'l-1', { direccion: 'Calle Repetida 1', nota: 'x' });
      expect(!r.ok && r.error.codigo).toBe('CONFLICTO');
      expect(c.actualizarLocal).not.toHaveBeenCalled();
    });
  });

  it('un local de otra empresa o inexistente es NO_ENCONTRADO', async () => {
    const r = await crearActualizarLocal({ clientes: clientes() })(usuarioDe({ empresaId: 'otra' }), 'l-1', { nota: 'x' });
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });
});
