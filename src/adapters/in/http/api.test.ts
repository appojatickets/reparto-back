import { describe, expect, it, vi } from 'vitest';
import type { Usuario } from '../../../domain/entidades/usuario.js';
import { puede, type Permiso, type Rol } from '../../../domain/permisos.js';
import { err, ok } from '../../../domain/shared/result.js';
import { errorApp } from '../../../application/errores.js';
import { usuarioDe } from '../../../application/use-cases/fakes.test-util.js';
import { casosVacios } from './casos-vacios.js';
import type { CasosDeUso } from './casos-de-uso.js';
import { buildServer } from './server.js';

const UUID = '123e4567-e89b-42d3-a456-426614174000';
const USUARIOS: Record<string, Usuario> = {
  't-admin': usuarioDe({ id: 'u-a', rol: 'admin', username: 'admin' }),
  't-desp': usuarioDe({ id: 'u-d', rol: 'despachador', username: 'desp' }),
  't-chofer': usuarioDe({ id: 'u-c', rol: 'chofer', username: 'chofer' }),
};
const ROLES: Record<Rol, string> = { admin: 't-admin', despachador: 't-desp', chofer: 't-chofer' };

const construir = async (extra: Partial<CasosDeUso> = {}) => {
  const casos: CasosDeUso = {
    ...casosVacios(),
    autenticar: (token) => {
      const u = USUARIOS[token];
      if (u) return Promise.resolve(ok(u));
      if (token === 't-inactivo') return Promise.resolve(err(errorApp('USUARIO_INACTIVO', 'Tu cuenta está desactivada.')));
      return Promise.resolve(err(errorApp('NO_AUTENTICADO', 'Tu sesión no es válida.')));
    },
    ...extra,
  };
  return buildServer({ frontOrigin: 'https://front.test', casos });
};

type RutaProtegida = { metodo: 'GET' | 'POST' | 'PUT' | 'PATCH'; url: string; body?: object; permiso: Permiso | undefined; caso: keyof CasosDeUso };
const filaCliente = { razonSocial: 'X', direccion: 'Calle 1', comuna: 'Maipú' };
const RUTAS: RutaProtegida[] = [
  { metodo: 'GET', url: '/v1/usuarios', permiso: 'usuarios:gestionar', caso: 'listarUsuarios' },
  { metodo: 'POST', url: '/v1/usuarios', body: { nombre: 'Juan', apellidoPaterno: 'Pérez', rol: 'chofer', pin: '482915' }, permiso: 'usuarios:gestionar', caso: 'crearUsuario' },
  { metodo: 'POST', url: `/v1/usuarios/${UUID}/pin`, body: { pin: '482915' }, permiso: 'usuarios:gestionar', caso: 'resetearPin' },
  { metodo: 'PATCH', url: `/v1/usuarios/${UUID}`, body: { activo: false }, permiso: 'usuarios:gestionar', caso: 'cambiarEstadoUsuario' },
  { metodo: 'GET', url: '/v1/clientes/buscar?q=rabe', permiso: 'clientes:leer', caso: 'buscarClientes' },
  { metodo: 'POST', url: '/v1/clientes', body: filaCliente, permiso: 'clientes:escribir', caso: 'crearClienteNuevo' },
  { metodo: 'POST', url: '/v1/clientes/importaciones', body: { filas: [filaCliente] }, permiso: 'clientes:importar', caso: 'importarClientes' },
  { metodo: 'GET', url: `/v1/locales/${UUID}`, permiso: 'clientes:leer', caso: 'obtenerLocal' },
  { metodo: 'PATCH', url: `/v1/locales/${UUID}`, body: { nota: 'portón verde' }, permiso: 'clientes:escribir', caso: 'actualizarLocal' },
  { metodo: 'POST', url: '/v1/pines/importaciones', body: { pines: [{ direccion: 'x', lat: -33.4, lng: -70.6 }] }, permiso: 'pines:proponer', caso: 'importarPines' },
  { metodo: 'GET', url: '/v1/pines/propuestas', permiso: 'pines:revisar', caso: 'listarPropuestasPin' },
  { metodo: 'POST', url: `/v1/pines/propuestas/${UUID}/resolver`, body: { accion: 'aceptar' }, permiso: 'pines:revisar', caso: 'resolverPropuestaPin' },
  { metodo: 'POST', url: '/v1/archivos/url-subida', body: { localId: UUID, tipo: 'webp' }, permiso: 'archivos:subir', caso: 'solicitarUrlSubida' },
  { metodo: 'PUT', url: `/v1/locales/${UUID}/foto`, body: { path: 'a/b.webp' }, permiso: 'archivos:subir', caso: 'registrarFotoLocal' },
  { metodo: 'GET', url: `/v1/locales/${UUID}/foto-url`, permiso: 'clientes:leer', caso: 'obtenerUrlFoto' },
];

describe('permisos: cada ruta exige su permiso y no llega al caso de uso sin él', () => {
  for (const ruta of RUTAS) {
    describe(`${ruta.metodo} ${ruta.url.split('?')[0]?.replace(UUID, ':id')}`, () => {
      it('sin token → 401 y token inválido → 401', async () => {
        const caso = vi.fn(() => { throw new Error('no debía llamarse'); });
        const app = await construir({ [ruta.caso]: caso });
        const sin = await app.inject({ method: ruta.metodo, url: ruta.url, ...(ruta.body ? { payload: ruta.body } : {}) });
        expect(sin.statusCode).toBe(401);
        const mal = await app.inject({ method: ruta.metodo, url: ruta.url, headers: { authorization: 'Bearer basura' }, ...(ruta.body ? { payload: ruta.body } : {}) });
        expect(mal.statusCode).toBe(401);
        expect(mal.json()).toMatchObject({ codigo: 'NO_AUTENTICADO' });
        expect(caso).not.toHaveBeenCalled();
      });

      for (const rol of ['admin', 'despachador', 'chofer'] as const) {
        const permitido = ruta.permiso === undefined || puede(rol, ruta.permiso);
        it(`${rol}: ${permitido ? 'puede (llega al caso de uso)' : '403 sin llegar al caso de uso'}`, async () => {
          const caso = vi.fn(() => { throw new Error('boom'); });
          const app = await construir({ [ruta.caso]: caso });
          const r = await app.inject({ method: ruta.metodo, url: ruta.url, headers: { authorization: `Bearer ${ROLES[rol]}` }, ...(ruta.body ? { payload: ruta.body } : {}) });
          if (permitido) {
            expect(caso).toHaveBeenCalledTimes(1);
            expect(r.statusCode).toBe(500); // el caso de uso de prueba lanza: lo importante es que no fue 401/403
          } else {
            expect(r.statusCode).toBe(403);
            expect(r.json()).toMatchObject({ codigo: 'SIN_PERMISO' });
            expect(caso).not.toHaveBeenCalled();
          }
        });
      }
    });
  }

  it('un chofer recibe 403 en CUALQUIER ruta que no sea suya (clientes, usuarios, pines por revisar, importaciones)', async () => {
    const denegadas = RUTAS.filter((r) => r.permiso !== undefined && !puede('chofer', r.permiso));
    expect(denegadas.length).toBeGreaterThanOrEqual(10);
    const app = await construir();
    for (const r of denegadas) {
      const res = await app.inject({ method: r.metodo, url: r.url, headers: { authorization: 'Bearer t-chofer' }, ...(r.body ? { payload: r.body } : {}) });
      expect(res.statusCode, `${r.metodo} ${r.url}`).toBe(403);
    }
  });

  it('un usuario desactivado recibe 403 USUARIO_INACTIVO', async () => {
    const r = await (await construir()).inject({ method: 'GET', url: '/v1/me', headers: { authorization: 'Bearer t-inactivo' } });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ codigo: 'USUARIO_INACTIVO' });
  });

  it('el esquema de Authorization debe ser Bearer', async () => {
    const r = await (await construir()).inject({ method: 'GET', url: '/v1/me', headers: { authorization: 'Basic t-admin' } });
    expect(r.statusCode).toBe(401);
  });
});

describe('sesión', () => {
  const usuario = USUARIOS['t-chofer'] as Usuario;

  it('login correcto devuelve tokens y el usuario público (sin empresa ni datos internos)', async () => {
    const iniciarSesion = vi.fn(() => Promise.resolve(ok({ sesion: { accessToken: 'at', refreshToken: 'rt', expiraEnSegundos: 3600 }, usuario })));
    const r = await (await construir({ iniciarSesion })).inject({ method: 'POST', url: '/v1/auth/login', payload: { username: 'chofer', pin: '482915' } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ accessToken: 'at', refreshToken: 'rt', expiraEnSegundos: 3600, usuario: { id: 'u-c', username: 'chofer', nombre: usuario.nombre, rol: 'chofer', activo: true } });
    expect(iniciarSesion).toHaveBeenCalledWith({ username: 'chofer', pin: '482915' });
  });

  it.each([
    ['CREDENCIALES_INVALIDAS', 401, { intentosRestantes: 3 }],
    ['CUENTA_BLOQUEADA', 429, { minutos: 15 }],
    ['USUARIO_INACTIVO', 403, undefined],
    ['SERVICIO_EXTERNO', 502, undefined],
  ] as const)('login: %s → HTTP %i con forma estándar', async (codigo, status, detalle) => {
    const iniciarSesion = vi.fn(() => Promise.resolve(err(errorApp(codigo, 'mensaje', detalle))));
    const r = await (await construir({ iniciarSesion })).inject({ method: 'POST', url: '/v1/auth/login', payload: { username: 'x', pin: 'y' } });
    expect(r.statusCode).toBe(status);
    expect(r.json()).toEqual({ codigo, mensaje: 'mensaje', ...(detalle ? { detalle } : {}) });
  });

  it('datos mal formados → 400 VALIDACION con el detalle por campo', async () => {
    const app = await construir();
    const r = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { username: '' } });
    expect(r.statusCode).toBe(400);
    const cuerpo = r.json<{ codigo: string; detalle: unknown }>();
    expect(cuerpo.codigo).toBe('VALIDACION');
    expect(Array.isArray(cuerpo.detalle)).toBe(true);
    expect((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: 'no es json', headers: { 'content-type': 'application/json' } })).statusCode).toBe(400);
  });

  it('el login tiene un límite de tasa propio por IP (10 por minuto)', async () => {
    const iniciarSesion = vi.fn(() => Promise.resolve(err(errorApp('CREDENCIALES_INVALIDAS', 'mal'))));
    const app = await construir({ iniciarSesion });
    const estados: number[] = [];
    for (let i = 0; i < 12; i++) estados.push((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { username: 'x', pin: 'y' }, remoteAddress: '203.0.113.9' })).statusCode);
    expect(estados.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(estados.slice(10)).toEqual([429, 429]);
    const otraIp = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { username: 'x', pin: 'y' }, remoteAddress: '203.0.113.10' });
    expect(otraIp.statusCode).toBe(401);
  });

  it('refresh renueva o responde 401', async () => {
    const refrescarSesion = vi.fn()
      .mockResolvedValueOnce(ok({ accessToken: 'a2', refreshToken: 'r2', expiraEnSegundos: 3600 }))
      .mockResolvedValueOnce(err(errorApp('NO_AUTENTICADO', 'venció')));
    const app = await construir({ refrescarSesion });
    const buena = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: 'r1' } });
    expect(buena.json()).toEqual({ accessToken: 'a2', refreshToken: 'r2', expiraEnSegundos: 3600 });
    expect((await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: 'r1' } })).statusCode).toBe(401);
  });

  it('/v1/me devuelve al usuario autenticado', async () => {
    const r = await (await construir()).inject({ method: 'GET', url: '/v1/me', headers: { authorization: 'Bearer t-desp' } });
    expect(r.json()).toMatchObject({ username: 'desp', rol: 'despachador', empresaId: 'empresa-1' });
  });
});

describe('respuestas de las rutas', () => {
  const auth = (rol: Rol) => ({ authorization: `Bearer ${ROLES[rol]}` });

  it('buscar clientes pasa el actor y la consulta, y serializa los resultados', async () => {
    const buscarClientes = vi.fn(() => Promise.resolve([{ localId: 'l1', clienteId: 'c1', razonSocial: 'Rabelo Mágica SpA', direccion: 'Av. X 1', comuna: 'Providencia', pinEstado: 'validado' as const, lat: -33.4, lng: -70.6, score: 0.9 }]));
    const r = await (await construir({ buscarClientes })).inject({ method: 'GET', url: '/v1/clientes/buscar?q=rabe&comuna=Providencia&limite=5', headers: auth('despachador') });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ resultados: { razonSocial: string }[] }>().resultados[0]?.razonSocial).toBe('Rabelo Mágica SpA');
    expect(buscarClientes).toHaveBeenCalledWith(USUARIOS['t-desp'], { q: 'rabe', comuna: 'Providencia', limite: 5 });
  });

  it('un límite fuera de rango en la búsqueda es 400', async () => {
    const r = await (await construir()).inject({ method: 'GET', url: '/v1/clientes/buscar?q=ra&limite=500', headers: auth('admin') });
    expect(r.statusCode).toBe(400);
  });

  it('crear usuario responde 201 con el usuario generado; los errores de negocio se traducen', async () => {
    const crearUsuario = vi.fn()
      .mockResolvedValueOnce(ok({ ...USUARIOS['t-chofer'], username: 'jperez', nombre: 'Juan Pérez' }))
      .mockResolvedValueOnce(err(errorApp('VALIDACION', 'La clave es demasiado fácil de adivinar.')));
    const app = await construir({ crearUsuario });
    const body = { nombre: 'Juan', apellidoPaterno: 'Pérez', rol: 'chofer', pin: '482915' };
    const a = await app.inject({ method: 'POST', url: '/v1/usuarios', headers: auth('admin'), payload: body });
    expect(a.statusCode).toBe(201);
    expect(a.json()).toMatchObject({ username: 'jperez' });
    const b = await app.inject({ method: 'POST', url: '/v1/usuarios', headers: auth('admin'), payload: { ...body, pin: '123456' } });
    expect(b.statusCode).toBe(422);
  });

  it('un rol inexistente al crear usuario es 400', async () => {
    const r = await (await construir()).inject({ method: 'POST', url: '/v1/usuarios', headers: auth('admin'), payload: { nombre: 'a', apellidoPaterno: 'b', rol: 'superadmin', pin: '482915' } });
    expect(r.statusCode).toBe(400);
  });

  it('importar clientes: pasa las filas y rechaza más de 1.000 o ninguna', async () => {
    const importarClientes = vi.fn(() => Promise.resolve(ok({ totalFilas: 1, validas: 1, errores: [], resumen: { clientesCreados: 1, clientesActualizados: 0, localesCreados: 1, localesActualizados: 0 } })));
    const app = await construir({ importarClientes });
    const buena = await app.inject({ method: 'POST', url: '/v1/clientes/importaciones', headers: auth('admin'), payload: { filas: [filaCliente] } });
    expect(buena.statusCode).toBe(200);
    expect(importarClientes).toHaveBeenCalledWith(USUARIOS['t-admin'], [filaCliente]);
    expect((await app.inject({ method: 'POST', url: '/v1/clientes/importaciones', headers: auth('admin'), payload: { filas: [] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/clientes/importaciones', headers: auth('admin'), payload: { filas: Array.from({ length: 1001 }, () => filaCliente) } })).statusCode).toBe(400);
  });

  it('los ids de la ruta deben ser UUID', async () => {
    const r = await (await construir()).inject({ method: 'GET', url: '/v1/locales/no-es-uuid', headers: auth('admin') });
    expect(r.statusCode).toBe(400);
  });

  it('las acciones sin cuerpo responden 204; un no encontrado es 404 y un conflicto 409', async () => {
    const resolverPropuestaPin = vi.fn()
      .mockResolvedValueOnce(ok(undefined))
      .mockResolvedValueOnce(err(errorApp('NO_ENCONTRADO', 'no existe')))
      .mockResolvedValueOnce(err(errorApp('CONFLICTO', 'ya resuelta')));
    const app = await construir({ resolverPropuestaPin });
    const url = `/v1/pines/propuestas/${UUID}/resolver`;
    const llamar = () => app.inject({ method: 'POST', url, headers: auth('admin'), payload: { accion: 'aceptar' } });
    const a = await llamar();
    expect(a.statusCode).toBe(204);
    expect(a.body).toBe('');
    expect((await llamar()).statusCode).toBe(404);
    expect((await llamar()).statusCode).toBe(409);
  });

  it('listar propuestas serializa las fechas en ISO', async () => {
    const listarPropuestasPin = vi.fn(() => Promise.resolve([{ id: 'p1', direccion: 'x', lat: -33.4, lng: -70.6, estado: 'pendiente' as const, proponenteId: 'u', creadaEn: new Date('2026-10-05T12:00:00Z'), distanciaActualM: 40 }]));
    const r = await (await construir({ listarPropuestasPin })).inject({ method: 'GET', url: '/v1/pines/propuestas', headers: auth('despachador') });
    expect(r.json<{ propuestas: { creadaEn: string }[] }>().propuestas[0]?.creadaEn).toBe('2026-10-05T12:00:00.000Z');
    expect(listarPropuestasPin).toHaveBeenCalledWith(USUARIOS['t-desp'], 'pendiente', undefined);
  });

  it('URL de subida y de lectura de fotos', async () => {
    const solicitarUrlSubida = vi.fn(() => Promise.resolve(ok({ path: 'e/l/x.webp', url: 'https://alm/subir' })));
    const obtenerUrlFoto = vi.fn(() => Promise.resolve(ok({ url: 'https://alm/leer', expiraEnSegundos: 300 })));
    const app = await construir({ solicitarUrlSubida, obtenerUrlFoto });
    const s = await app.inject({ method: 'POST', url: '/v1/archivos/url-subida', headers: auth('chofer'), payload: { localId: UUID, tipo: 'webp' } });
    expect(s.json()).toEqual({ path: 'e/l/x.webp', url: 'https://alm/subir' });
    expect((await app.inject({ method: 'POST', url: '/v1/archivos/url-subida', headers: auth('chofer'), payload: { localId: UUID, tipo: 'gif' } })).statusCode).toBe(400);
    const l = await app.inject({ method: 'GET', url: `/v1/locales/${UUID}/foto-url`, headers: auth('despachador') });
    expect(l.json()).toEqual({ url: 'https://alm/leer', expiraEnSegundos: 300 });
  });
});
