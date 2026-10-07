import { describe, expect, it } from 'vitest';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeClientes, localDe } from './fakes-clientes.test-util.js';
import { crearVerificarPin } from './pin-verificado.js';

const admin = usuarioDe({ id: 'u-admin', rol: 'admin' });
const { clock } = crearReloj();

describe('verificar el pin de un local', () => {
  it('lo marca como verificado con quién y cuándo, y se puede quitar', async () => {
    const clientes = fakeClientes([localDe()]);
    const r = await crearVerificarPin({ clientes, clock })(admin, 'l-1', true);
    expect(r.ok).toBe(true);
    expect(clientes.verificarPin).toHaveBeenCalledWith('empresa-1', 'l-1', { por: 'u-admin', en: clock.now() });
    await crearVerificarPin({ clientes, clock })(admin, 'l-1', false);
    expect(clientes.verificarPin).toHaveBeenLastCalledWith('empresa-1', 'l-1', undefined);
  });

  it('un local que no existe es NO_ENCONTRADO y uno sin pin es CONFLICTO (nada que verificar)', async () => {
    const clientes = fakeClientes([localDe()]);
    const a = await crearVerificarPin({ clientes, clock })(admin, 'otro', true);
    expect(!a.ok && a.error.codigo).toBe('NO_ENCONTRADO');
    clientes.verificarPin.mockResolvedValueOnce('SIN_PIN');
    const b = await crearVerificarPin({ clientes, clock })(admin, 'l-1', true);
    expect(!b.ok && b.error.codigo).toBe('CONFLICTO');
  });
});
