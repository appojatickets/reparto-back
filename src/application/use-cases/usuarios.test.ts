import { describe, expect, it } from 'vitest';
import { crearCrearUsuario } from './crear-usuario.js';
import { crearCambiarEstadoUsuario, crearListarUsuarios, crearResetearPin } from './gestionar-usuarios.js';
import { fakeIdentidad, fakeIntentos, fakeUsuarios, usuarioDe } from './fakes.test-util.js';

const DOMINIO = 'usuarios.test';

const escenario = () => {
  const admin = usuarioDe();
  const identidad = fakeIdentidad();
  const usuarios = fakeUsuarios([admin]);
  const intentos = fakeIntentos();
  const crear = crearCrearUsuario({ identidad: identidad.proveedor, usuarios: usuarios.repo, dominioCorreo: DOMINIO });
  return { admin, identidad, usuarios, intentos, crear };
};

const entrada = { nombre: 'Juan', apellidoPaterno: 'Pérez', apellidoMaterno: 'González', rol: 'chofer' as const, pin: '482915' };

describe('crearUsuario', () => {
  it('crea la cuenta y el perfil con usuario inicial + apellido', async () => {
    const { crear, admin, identidad, usuarios } = escenario();
    const r = await crear(admin, entrada);
    expect(r.ok && r.value).toMatchObject({ username: 'jperez', rol: 'chofer', nombre: 'Juan Pérez', activo: true, empresaId: admin.empresaId });
    expect(identidad.cuentas.has(`jperez@${DOMINIO}`)).toBe(true);
    expect(usuarios.filas.size).toBe(2);
  });

  it('si el usuario existe usa la inicial del segundo apellido', async () => {
    const { crear, admin } = escenario();
    await crear(admin, entrada);
    const r = await crear(admin, { ...entrada, pin: '905031' });
    expect(r.ok && r.value.username).toBe('jperezg');
  });

  it('rechaza un PIN débil o mal formado', async () => {
    const { crear, admin, identidad } = escenario();
    const debil = await crear(admin, { ...entrada, pin: '123456' });
    expect(!debil.ok && debil.error.codigo).toBe('VALIDACION');
    expect(identidad.cuentas.size).toBe(0);
  });

  it('rechaza nombre o apellido vacíos', async () => {
    const { crear, admin } = escenario();
    const r = await crear(admin, { ...entrada, nombre: ' ' });
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
  });

  it('si falla guardar el perfil, borra la cuenta recién creada (sin cuentas huérfanas)', async () => {
    const { admin, identidad, usuarios } = escenario();
    const falla = crearCrearUsuario({
      identidad: identidad.proveedor,
      usuarios: { ...usuarios.repo, crear: () => Promise.reject(new Error('base caída')) },
      dominioCorreo: DOMINIO,
    });
    await expect(falla(admin, entrada)).rejects.toThrow('base caída');
    expect(identidad.eliminadas).toEqual(['cuenta-1']);
  });

  it('si el proveedor de cuentas está caído devuelve un error de servicio', async () => {
    const { crear, admin, identidad } = escenario();
    identidad.caer();
    const r = await crear(admin, entrada);
    expect(!r.ok && r.error.codigo).toBe('SERVICIO_EXTERNO');
  });
});

describe('gestión de usuarios', () => {
  it('listar solo muestra los usuarios de la empresa del actor', async () => {
    const { admin, usuarios } = escenario();
    usuarios.filas.set('x', usuarioDe({ id: 'x', empresaId: 'otra', username: 'otro' }));
    const lista = await crearListarUsuarios({ usuarios: usuarios.repo })(admin);
    expect(lista.map((u) => u.username)).toEqual(['admin']);
  });

  it('resetear PIN cambia la clave y levanta el bloqueo', async () => {
    const { admin, crear, identidad, usuarios, intentos } = escenario();
    const creado = await crear(admin, entrada);
    if (!creado.ok) throw new Error('no se creó');
    intentos.estado.set(creado.value.id, { intentos: 5, bloqueadoHasta: new Date('2030-01-01') });
    const resetear = crearResetearPin({ identidad: identidad.proveedor, usuarios: usuarios.repo, intentos: intentos.repo });
    const r = await resetear(admin, creado.value.id, '905031');
    expect(r.ok).toBe(true);
    expect(identidad.cuentas.get(`jperez@${DOMINIO}`)?.clave).toBe('905031');
    expect(intentos.estado.size).toBe(0);
  });

  it('resetear PIN rechaza PIN débil y usuarios de otra empresa', async () => {
    const { admin, identidad, usuarios, intentos } = escenario();
    usuarios.filas.set('x', usuarioDe({ id: 'x', empresaId: 'otra', username: 'otro' }));
    const resetear = crearResetearPin({ identidad: identidad.proveedor, usuarios: usuarios.repo, intentos: intentos.repo });
    const debil = await resetear(admin, 'x', '111111');
    expect(!debil.ok && debil.error.codigo).toBe('VALIDACION');
    const ajeno = await resetear(admin, 'x', '905031');
    expect(!ajeno.ok && ajeno.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('desactivar: no puedes desactivarte a ti mismo ni a un usuario inexistente', async () => {
    const { admin, usuarios } = escenario();
    const cambiar = crearCambiarEstadoUsuario({ usuarios: usuarios.repo });
    const yo = await cambiar(admin, admin.id, false);
    expect(!yo.ok && yo.error.mensaje).toContain('propia cuenta');
    const nadie = await cambiar(admin, 'zzz', false);
    expect(!nadie.ok && nadie.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('desactiva y reactiva a otro usuario', async () => {
    const { admin, crear, usuarios } = escenario();
    const creado = await crear(admin, entrada);
    if (!creado.ok) throw new Error('no se creó');
    const cambiar = crearCambiarEstadoUsuario({ usuarios: usuarios.repo });
    expect((await cambiar(admin, creado.value.id, false)).ok).toBe(true);
    expect(usuarios.filas.get(creado.value.id)?.activo).toBe(false);
    expect((await cambiar(admin, creado.value.id, true)).ok).toBe(true);
    expect(usuarios.filas.get(creado.value.id)?.activo).toBe(true);
  });
});
