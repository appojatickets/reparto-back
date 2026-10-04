import { describe, expect, it } from 'vitest';
import { crearAutenticarUsuario } from './autenticar-usuario.js';
import { crearIniciarSesion } from './iniciar-sesion.js';
import { crearRefrescarSesion } from './refrescar-sesion.js';
import { crearReloj, fakeIdentidad, fakeIntentos, fakeUsuarios, usuarioDe } from './fakes.test-util.js';

const DOMINIO = 'usuarios.test';

const escenario = () => {
  const identidad = fakeIdentidad();
  const reloj = crearReloj();
  const chofer = usuarioDe({ id: 'cuenta-juan', rol: 'chofer', username: 'jperez', nombre: 'Juan Pérez' });
  const usuarios = fakeUsuarios([chofer]);
  const intentos = fakeIntentos();
  identidad.cuentas.set(`jperez@${DOMINIO}`, { id: 'cuenta-juan', clave: '482915' });
  const iniciar = crearIniciarSesion({ identidad: identidad.proveedor, usuarios: usuarios.repo, intentos: intentos.repo, clock: reloj.clock, dominioCorreo: DOMINIO });
  const autenticar = crearAutenticarUsuario({ identidad: identidad.proveedor, usuarios: usuarios.repo, clock: reloj.clock });
  return { identidad, reloj, chofer, usuarios, intentos, iniciar, autenticar };
};

describe('iniciarSesion', () => {
  it('con usuario y clave correctos devuelve la sesión y el usuario', async () => {
    const { iniciar, chofer } = escenario();
    const r = await iniciar({ username: ' JPerez ', pin: '482915' });
    expect(r.ok && r.value.usuario).toEqual(chofer);
    expect(r.ok && r.value.sesion.accessToken).toBe('at-cuenta-juan');
  });

  it('una clave mala cuenta intentos y avisa cuántos quedan', async () => {
    const { iniciar } = escenario();
    const r = await iniciar({ username: 'jperez', pin: '000001' });
    expect(!r.ok && r.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(!r.ok && r.error.mensaje).toBe('Usuario o clave incorrectos. Te quedan 4 intentos.');
    expect(!r.ok && r.error.detalle).toEqual({ intentosRestantes: 4 });
  });

  it('al quinto fallo bloquea 15 minutos; ni la clave correcta entra mientras dure', async () => {
    const { iniciar, reloj } = escenario();
    for (let i = 0; i < 4; i++) await iniciar({ username: 'jperez', pin: '000001' });
    const quinto = await iniciar({ username: 'jperez', pin: '000001' });
    expect(!quinto.ok && quinto.error.codigo).toBe('CUENTA_BLOQUEADA');
    const conClaveBuena = await iniciar({ username: 'jperez', pin: '482915' });
    expect(!conClaveBuena.ok && conClaveBuena.error.codigo).toBe('CUENTA_BLOQUEADA');
    reloj.avanzar(15 * 60_000 + 1);
    expect((await iniciar({ username: 'jperez', pin: '482915' })).ok).toBe(true);
  });

  it('un login correcto reinicia el contador', async () => {
    const { iniciar, intentos } = escenario();
    await iniciar({ username: 'jperez', pin: '000001' });
    await iniciar({ username: 'jperez', pin: '482915' });
    expect(intentos.estado.size).toBe(0);
  });

  it('un usuario inexistente da el mismo error y no deja rastro', async () => {
    const { iniciar, intentos } = escenario();
    const r = await iniciar({ username: 'fantasma', pin: '482915' });
    expect(!r.ok && r.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(intentos.estado.size).toBe(0);
  });

  it('un usuario desactivado no entra', async () => {
    const { iniciar, usuarios, chofer } = escenario();
    usuarios.filas.set(chofer.id, { ...chofer, activo: false });
    const r = await iniciar({ username: 'jperez', pin: '482915' });
    expect(!r.ok && r.error.codigo).toBe('USUARIO_INACTIVO');
  });

  it('si el proveedor de cuentas está caído, no cuenta como intento fallido', async () => {
    const { iniciar, identidad, intentos } = escenario();
    identidad.caer();
    const r = await iniciar({ username: 'jperez', pin: '482915' });
    expect(!r.ok && r.error.codigo).toBe('SERVICIO_EXTERNO');
    expect(intentos.estado.size).toBe(0);
  });
});

describe('autenticarUsuario (token → usuario)', () => {
  it('un token válido devuelve el usuario y se recuerda 30 s', async () => {
    const { autenticar, identidad, chofer, reloj } = escenario();
    identidad.tokens.set('tok', 'cuenta-juan');
    expect((await autenticar('tok')).ok).toBe(true);
    expect((await autenticar('tok')).ok && (await autenticar('tok'))).toEqual({ ok: true, value: chofer });
    expect(identidad.verificaciones.n).toBe(1);
    reloj.avanzar(31_000);
    await autenticar('tok');
    expect(identidad.verificaciones.n).toBe(2);
  });

  it('un token inválido es NO_AUTENTICADO', async () => {
    const r = await escenario().autenticar('basura');
    expect(!r.ok && r.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('una cuenta sin perfil en el sistema recibe SIN_PERMISO', async () => {
    const { autenticar, identidad } = escenario();
    identidad.tokens.set('tok', 'cuenta-desconocida');
    const r = await autenticar('tok');
    expect(!r.ok && r.error.codigo).toBe('SIN_PERMISO');
  });

  it('un usuario desactivado recibe USUARIO_INACTIVO', async () => {
    const { autenticar, identidad, usuarios, chofer } = escenario();
    usuarios.filas.set(chofer.id, { ...chofer, activo: false });
    identidad.tokens.set('tok', chofer.id);
    const r = await autenticar('tok');
    expect(!r.ok && r.error.codigo).toBe('USUARIO_INACTIVO');
  });

  it('si Supabase no responde, es un error de servicio y no de credenciales', async () => {
    const { autenticar, identidad } = escenario();
    identidad.caer();
    const r = await autenticar('tok');
    expect(!r.ok && r.error.codigo).toBe('SERVICIO_EXTERNO');
  });
});

describe('refrescarSesion', () => {
  it('renueva con un refresh token válido y rechaza uno inválido', async () => {
    const { identidad } = escenario();
    const refrescar = crearRefrescarSesion({ identidad: identidad.proveedor });
    expect((await refrescar('rt-cuenta-juan')).ok).toBe(true);
    const mala = await refrescar('xxx');
    expect(!mala.ok && mala.error.codigo).toBe('NO_AUTENTICADO');
    identidad.caer();
  });
});
