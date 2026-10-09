import { describe, expect, it } from 'vitest';
import { usuarioDe } from './fakes.test-util.js';
import { fakeClientes } from './fakes-clientes.test-util.js';
import { crearListarLocales, crearResumenComunas } from './listar-locales.js';

const admin = usuarioDe();

describe('listar los locales (por comuna o por texto)', () => {
  it('pide los de la empresa del actor, con la comuna con su nombre oficial y el texto limpio', async () => {
    const clientes = fakeClientes();
    await crearListarLocales({ clientes })(admin, { comuna: 'san bernardo', texto: '  rabelo   mágica ' });
    expect(clientes.listarLocales).toHaveBeenCalledWith('empresa-1', { comuna: 'San Bernardo', texto: 'rabelo mágica' }, 300);
  });

  it('sin filtros trae de todas las comunas; el límite se acota entre 1 y 500', async () => {
    const clientes = fakeClientes();
    const listar = crearListarLocales({ clientes });
    await listar(admin, {}, 99999);
    expect(clientes.listarLocales).toHaveBeenLastCalledWith('empresa-1', {}, 500);
    await listar(admin, { texto: '   ' }, 0);
    expect(clientes.listarLocales).toHaveBeenLastCalledWith('empresa-1', {}, 1);
  });

  it('devuelve lo que entrega el repositorio', async () => {
    const clientes = fakeClientes();
    clientes.listarLocales.mockResolvedValueOnce({ total: 7, locales: [] });
    expect(await crearListarLocales({ clientes })(admin, { comuna: 'Maipú' })).toEqual({ total: 7, locales: [] });
  });
});

describe('resumen por comuna', () => {
  it('usa la empresa del actor', async () => {
    const clientes = fakeClientes();
    clientes.resumenPorComuna.mockResolvedValueOnce([{ comuna: 'Maipú', total: 5, verificados: 2, sinPin: 1 }]);
    expect(await crearResumenComunas({ clientes })(admin)).toEqual([{ comuna: 'Maipú', total: 5, verificados: 2, sinPin: 1 }]);
    expect(clientes.resumenPorComuna).toHaveBeenCalledWith('empresa-1');
  });
});
