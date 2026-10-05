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
  't-ayud': usuarioDe({ id: 'u-y', rol: 'ayudante', username: 'ayud' }),
};
const ROLES: Record<Rol, string> = { admin: 't-admin', despachador: 't-desp', chofer: 't-chofer', ayudante: 't-ayud' };

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

type RutaProtegida = { metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; url: string; body?: object; permiso: Permiso | undefined; caso: keyof CasosDeUso };
const filaCliente = { razonSocial: 'X', direccion: 'Calle 1', comuna: 'Maipú' };
const RUTAS: RutaProtegida[] = [
  { metodo: 'GET', url: '/v1/usuarios', permiso: 'usuarios:gestionar', caso: 'listarUsuarios' },
  { metodo: 'POST', url: '/v1/usuarios', body: { nombre: 'Juan', apellidoPaterno: 'Pérez', rol: 'chofer', pin: '482915' }, permiso: 'usuarios:gestionar', caso: 'crearUsuario' },
  { metodo: 'POST', url: `/v1/usuarios/${UUID}/pin`, body: { pin: '482915' }, permiso: 'usuarios:gestionar', caso: 'resetearPin' },
  { metodo: 'PATCH', url: `/v1/usuarios/${UUID}`, body: { activo: false }, permiso: 'usuarios:gestionar', caso: 'cambiarEstadoUsuario' },
  { metodo: 'GET', url: '/v1/clientes/buscar?q=rabe', permiso: 'clientes:leer', caso: 'buscarClientes' },
  { metodo: 'POST', url: '/v1/clientes', body: filaCliente, permiso: 'clientes:crear', caso: 'crearClienteNuevo' },
  { metodo: 'POST', url: '/v1/clientes/importaciones', body: { filas: [filaCliente] }, permiso: 'clientes:importar', caso: 'importarClientes' },
  { metodo: 'GET', url: `/v1/locales/${UUID}`, permiso: 'clientes:leer', caso: 'obtenerLocal' },
  { metodo: 'PATCH', url: `/v1/locales/${UUID}`, body: { nota: 'portón verde' }, permiso: 'clientes:escribir', caso: 'actualizarLocal' },
  { metodo: 'POST', url: '/v1/pines/importaciones', body: { pines: [{ direccion: 'x', lat: -33.4, lng: -70.6 }] }, permiso: 'pines:proponer', caso: 'importarPines' },
  { metodo: 'GET', url: '/v1/pines/propuestas', permiso: 'pines:revisar', caso: 'listarPropuestasPin' },
  { metodo: 'POST', url: `/v1/pines/propuestas/${UUID}/resolver`, body: { accion: 'aceptar' }, permiso: 'pines:revisar', caso: 'resolverPropuestaPin' },
  { metodo: 'POST', url: '/v1/archivos/url-subida', body: { localId: UUID, tipo: 'webp' }, permiso: 'archivos:subir', caso: 'solicitarUrlSubida' },
  { metodo: 'PUT', url: `/v1/locales/${UUID}/foto`, body: { path: 'a/b.webp' }, permiso: 'archivos:subir', caso: 'registrarFotoLocal' },
  { metodo: 'GET', url: `/v1/locales/${UUID}/foto-url`, permiso: 'clientes:leer', caso: 'obtenerUrlFoto' },
  { metodo: 'GET', url: '/v1/camiones', permiso: 'facturas:leer', caso: 'listarCamiones' },
  { metodo: 'POST', url: '/v1/camiones', body: { patente: 'AB1234' }, permiso: 'camiones:gestionar', caso: 'crearCamion' },
  { metodo: 'PATCH', url: `/v1/camiones/${UUID}`, body: { activo: false }, permiso: 'camiones:gestionar', caso: 'actualizarCamion' },
  { metodo: 'POST', url: `/v1/locales/${UUID}/pin-desde-enlace`, body: { enlace: 'https://maps.google.com/?q=-33.5,-70.7' }, permiso: 'pines:proponer', caso: 'fijarPinDesdeEnlace' },
  { metodo: 'POST', url: '/v1/locales/buscar-pines', permiso: 'pines:revisar', caso: 'buscarPinesPendientes' },
  { metodo: 'GET', url: '/v1/locales/buscar-pines', permiso: 'pines:revisar', caso: 'estadoBusquedaPines' },
  { metodo: 'GET', url: '/v1/exportaciones/locales', permiso: 'datos:exportar', caso: 'exportarLocales' },
  { metodo: 'DELETE', url: `/v1/locales/${UUID}/foto`, permiso: 'clientes:escribir', caso: 'quitarFotoLocal' },
  { metodo: 'GET', url: '/v1/vendedores', permiso: 'vendedores:leer', caso: 'listarVendedores' },
  { metodo: 'POST', url: '/v1/vendedores', body: { codigo: 'V01', nombre: 'Ana' }, permiso: 'vendedores:gestionar', caso: 'crearVendedor' },
  { metodo: 'PATCH', url: `/v1/vendedores/${UUID}`, body: { activo: false }, permiso: 'vendedores:gestionar', caso: 'actualizarVendedor' },
  { metodo: 'GET', url: '/v1/facturas', permiso: 'facturas:leer', caso: 'listarFacturas' },
  { metodo: 'POST', url: '/v1/facturas', body: { folio: '1001', localId: UUID }, permiso: 'facturas:escribir', caso: 'registrarFactura' },
  { metodo: 'PATCH', url: `/v1/facturas/${UUID}`, body: { urgente: true }, permiso: 'facturas:escribir', caso: 'actualizarFactura' },
  { metodo: 'GET', url: '/v1/empresa/config', permiso: 'rutas:leer', caso: 'obtenerConfigEmpresa' },
  { metodo: 'PUT', url: '/v1/empresa/config', body: { salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 }, permiso: 'empresa:configurar', caso: 'guardarConfigEmpresa' },
  { metodo: 'GET', url: `/v1/rutas?camionId=${UUID}&fecha=2026-10-05`, permiso: 'rutas:leer', caso: 'verRuta' },
  { metodo: 'POST', url: '/v1/rutas/planificar', body: { camionId: UUID, fecha: '2026-10-05' }, permiso: 'rutas:escribir', caso: 'planificarRuta' },
  { metodo: 'POST', url: '/v1/rutas/operaciones', body: { camionId: UUID, fecha: '2026-10-05', version: 1, operacion: { tipo: 'ordenar' } }, permiso: 'rutas:escribir', caso: 'operarRuta' },
  { metodo: 'POST', url: `/v1/entregas/${UUID}/eventos`, body: { tipo: 'llegada' }, permiso: 'entregas:registrar', caso: 'registrarEvento' },
  { metodo: 'GET', url: '/v1/jornada', permiso: 'jornada:gestionar', caso: 'miJornada' },
  { metodo: 'POST', url: '/v1/jornada', body: { camionId: UUID }, permiso: 'jornada:gestionar', caso: 'iniciarJornada' },
  { metodo: 'DELETE', url: '/v1/jornada', permiso: 'jornada:gestionar', caso: 'terminarJornada' },
  { metodo: 'POST', url: '/v1/jornada/terminar', permiso: 'jornada:gestionar', caso: 'terminarJornada' },
  { metodo: 'GET', url: `/v1/locales/${UUID}/horario`, permiso: 'clientes:leer', caso: 'obtenerHorario' },
  { metodo: 'PUT', url: `/v1/locales/${UUID}/horario`, body: { dias: [{ dia: 1, cerrado: false, tramos: [{ desde: 600, hasta: 1080 }] }] }, permiso: 'clientes:escribir', caso: 'guardarHorario' },
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

      for (const rol of ['admin', 'despachador', 'chofer', 'ayudante'] as const) {
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

describe('camiones y facturas', () => {
  const auth = (rol: Rol) => ({ authorization: `Bearer ${ROLES[rol]}` });
  const factura = { id: UUID, folio: '1001', fecha: '2026-10-05', estado: 'pendiente' as const, urgente: false, local: { id: UUID, razonSocial: 'Rabe', direccion: 'Calle 1', comuna: 'Maipú', tienePin: true } };

  it('ingresar factura: 201 con el detalle; folio repetido 409; cliente inexistente 404', async () => {
    const registrarFactura = vi.fn()
      .mockResolvedValueOnce(ok(factura))
      .mockResolvedValueOnce(err(errorApp('CONFLICTO', 'Ya existe una factura con el folio 1001.')))
      .mockResolvedValueOnce(err(errorApp('NO_ENCONTRADO', 'El cliente no existe.')));
    const app = await construir({ registrarFactura });
    const llamar = () => app.inject({ method: 'POST', url: '/v1/facturas', headers: auth('despachador'), payload: { folio: '1001', localId: UUID, antesDeMin: 720, urgente: true } });
    const a = await llamar();
    expect(a.statusCode).toBe(201);
    expect(a.json()).toMatchObject({ folio: '1001', local: { razonSocial: 'Rabe' } });
    expect(registrarFactura).toHaveBeenCalledWith(USUARIOS['t-desp'], { folio: '1001', localId: UUID, antesDeMin: 720, urgente: true });
    expect((await llamar()).statusCode).toBe(409);
    expect((await llamar()).statusCode).toBe(404);
  });

  it('valida el cuerpo antes de llamar al caso de uso', async () => {
    const registrarFactura = vi.fn();
    const app = await construir({ registrarFactura });
    const mal = (payload: object) => app.inject({ method: 'POST', url: '/v1/facturas', headers: auth('admin'), payload });
    expect((await mal({ folio: '1', localId: 'no-uuid' })).statusCode).toBe(400);
    expect((await mal({ folio: '1', localId: UUID, antesDeMin: 2000 })).statusCode).toBe(400);
    expect((await mal({ folio: '1', localId: UUID, total: 10.5 })).statusCode).toBe(400);
    expect(registrarFactura).not.toHaveBeenCalled();
  });

  it('listar facturas pasa los filtros ya convertidos (sinCamion y incluirAnuladas booleanos)', async () => {
    const listarFacturas = vi.fn(() => Promise.resolve(ok([factura])));
    const app = await construir({ listarFacturas });
    const r = await app.inject({ method: 'GET', url: `/v1/facturas?fecha=2026-10-05&sinCamion=true&incluirAnuladas=false&camionId=${UUID}`, headers: auth('despachador') });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ facturas: unknown[] }>().facturas).toHaveLength(1);
    expect(listarFacturas).toHaveBeenCalledWith(USUARIOS['t-desp'], { fecha: '2026-10-05', sinCamion: true, incluirAnuladas: false, camionId: UUID });
  });

  it('actualizar factura permite null para quitar valores', async () => {
    const actualizarFactura = vi.fn(() => Promise.resolve(ok(factura)));
    const r = await (await construir({ actualizarFactura })).inject({ method: 'PATCH', url: `/v1/facturas/${UUID}`, headers: auth('despachador'), payload: { camionId: null, antesDeMin: null, nota: null } });
    expect(r.statusCode).toBe(200);
    expect(actualizarFactura).toHaveBeenCalledWith(USUARIOS['t-desp'], UUID, { camionId: null, antesDeMin: null, nota: null });
  });

  it('camiones: patente duplicada 409; el despachador lista pero no crea', async () => {
    const crearCamion = vi.fn(() => Promise.resolve(err(errorApp('CONFLICTO', 'Ya existe un camión con la patente AB·1234.'))));
    const listarCamiones = vi.fn(() => Promise.resolve([{ id: UUID, patente: 'AB1234', activo: true }]));
    const app = await construir({ crearCamion, listarCamiones });
    expect((await app.inject({ method: 'POST', url: '/v1/camiones', headers: auth('admin'), payload: { patente: 'AB1234' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/v1/camiones', headers: auth('despachador'), payload: { patente: 'AB1234' } })).statusCode).toBe(403);
    const l = await app.inject({ method: 'GET', url: '/v1/camiones', headers: auth('despachador') });
    expect(l.json()).toEqual({ camiones: [{ id: UUID, patente: 'AB1234', activo: true }] });
    expect(listarCamiones).toHaveBeenCalledWith(USUARIOS['t-desp'], { soloActivos: true });
  });
});

describe('terminar la ruta', () => {
  it('devuelve el resumen del día con las horas en ISO; sin jornada devuelve null', async () => {
    const terminarJornada = vi.fn()
      .mockResolvedValueOnce({ fecha: '2026-10-05', camionId: UUID, desde: new Date('2026-10-05T11:00:00Z'), hasta: new Date('2026-10-05T20:30:00Z'), entregadas: 28, noEntregadas: 2, pendientes: 3 })
      .mockResolvedValueOnce(undefined);
    const app = await construir({ terminarJornada });
    const headers = { authorization: `Bearer ${ROLES.chofer}` };
    const a = await app.inject({ method: 'POST', url: '/v1/jornada/terminar', headers });
    expect(a.statusCode).toBe(200);
    expect(a.json()).toEqual({ resumen: { fecha: '2026-10-05', camionId: UUID, desde: '2026-10-05T11:00:00.000Z', hasta: '2026-10-05T20:30:00.000Z', entregadas: 28, noEntregadas: 2, pendientes: 3 } });
    const b = await app.inject({ method: 'POST', url: '/v1/jornada/terminar', headers });
    expect(b.json()).toEqual({ resumen: null });
  });
});

describe('rutas del día', () => {
  const auth = (rol: Rol) => ({ authorization: `Bearer ${ROLES[rol]}` });
  const vista = { camionId: UUID, fecha: '2026-10-05', planificada: true, modo: 'sugerida' as const, version: 1, salidaMin: 480, horaLimiteRegresoMin: 1260, deposito: { lat: -33.5, lng: -70.7 }, regreso: 700, regresoTardio: false, paradas: [], nuevas: [], hechas: [], sinPin: [], noAtendidas: [], enRiesgo: [] };

  it('ver y planificar devuelven la vista; sin depósito responde 422 con el código', async () => {
    const verRuta = vi.fn().mockResolvedValueOnce(ok(vista)).mockResolvedValueOnce(err(errorApp('VALIDACION', 'Primero configura el depósito.', { codigo: 'SIN_DEPOSITO' })));
    const planificarRuta = vi.fn(() => Promise.resolve(ok(vista)));
    const app = await construir({ verRuta, planificarRuta });
    const url = `/v1/rutas?camionId=${UUID}&fecha=2026-10-05`;
    const a = await app.inject({ method: 'GET', url, headers: auth('despachador') });
    expect(a.statusCode).toBe(200);
    expect(a.json()).toMatchObject({ planificada: true, version: 1 });
    expect(verRuta).toHaveBeenCalledWith(USUARIOS['t-desp'], { camionId: UUID, fecha: '2026-10-05' });
    const b = await app.inject({ method: 'GET', url, headers: auth('admin') });
    expect(b.statusCode).toBe(422);
    expect(b.json()).toMatchObject({ codigo: 'VALIDACION', detalle: { codigo: 'SIN_DEPOSITO' } });
    const p = await app.inject({ method: 'POST', url: '/v1/rutas/planificar', headers: auth('despachador'), payload: { camionId: UUID, fecha: '2026-10-05', salidaMin: 450 } });
    expect(p.statusCode).toBe(200);
    expect(planificarRuta).toHaveBeenCalledWith(USUARIOS['t-desp'], { camionId: UUID, fecha: '2026-10-05', salidaMin: 450 });
  });

  it('operaciones: valida el cuerpo; versión vieja responde 409', async () => {
    const operarRuta = vi.fn().mockResolvedValueOnce(ok(vista)).mockResolvedValueOnce(err(errorApp('CONFLICTO', 'Otra persona cambió esta ruta.', { codigo: 'RUTA_DESACTUALIZADA' })));
    const app = await construir({ operarRuta });
    const llamar = (operacion: object, version = 1) => app.inject({ method: 'POST', url: '/v1/rutas/operaciones', headers: auth('despachador'), payload: { camionId: UUID, fecha: '2026-10-05', version, operacion } });
    expect((await llamar({ tipo: 'subir', facturaId: UUID })).statusCode).toBe(200);
    expect(operarRuta).toHaveBeenCalledWith(USUARIOS['t-desp'], { camionId: UUID, fecha: '2026-10-05', version: 1, operacion: { tipo: 'subir', facturaId: UUID } });
    const conflicto = await llamar({ tipo: 'ordenar' }, 1);
    expect(conflicto.statusCode).toBe(409);
    expect(conflicto.json()).toMatchObject({ detalle: { codigo: 'RUTA_DESACTUALIZADA' } });
    expect((await llamar({ tipo: 'subir' })).statusCode).toBe(400); // falta la factura
    expect((await llamar({ tipo: 'volar' })).statusCode).toBe(400);
    expect((await llamar({ tipo: 'salida', salidaMin: 2000 })).statusCode).toBe(400);
    expect(operarRuta).toHaveBeenCalledTimes(2);
  });

  it('configuración: el despachador la lee pero no la cambia', async () => {
    const obtenerConfigEmpresa = vi.fn(() => Promise.resolve(ok({ deposito: { lat: -33.5, lng: -70.7, nombre: 'Bodega' }, salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 })));
    const app = await construir({ obtenerConfigEmpresa });
    const g = await app.inject({ method: 'GET', url: '/v1/empresa/config', headers: auth('despachador') });
    expect(g.json()).toEqual({ deposito: { lat: -33.5, lng: -70.7, nombre: 'Bodega' }, salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 });
    const p = await app.inject({ method: 'PUT', url: '/v1/empresa/config', headers: auth('despachador'), payload: { salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 } });
    expect(p.statusCode).toBe(403);
  });
});

describe('horario del local', () => {
  const auth = (rol: Rol) => ({ authorization: `Bearer ${ROLES[rol]}` });
  it('guardar valida el cuerpo y devuelve el horario; errores del caso de uso salen con su código', async () => {
    const guardarHorario = vi.fn()
      .mockResolvedValueOnce(ok([{ dia: 1, cerrado: false, tramos: [{ desde: 600, hasta: 1080 }] }, { dia: 0, cerrado: true, tramos: [] }]))
      .mockResolvedValueOnce(err(errorApp('VALIDACION', 'El lunes: los tramos se solapan.')));
    const app = await construir({ guardarHorario });
    const url = `/v1/locales/${UUID}/horario`;
    const dias = [{ dia: 1, cerrado: false, tramos: [{ desde: 600, hasta: 1080 }] }, { dia: 0, cerrado: true, tramos: [] }];
    const a = await app.inject({ method: 'PUT', url, headers: auth('despachador'), payload: { dias } });
    expect(a.statusCode).toBe(200);
    expect(a.json()).toEqual({ dias });
    expect(guardarHorario).toHaveBeenCalledWith(USUARIOS['t-desp'], UUID, dias);
    expect((await app.inject({ method: 'PUT', url, headers: auth('admin'), payload: { dias } })).statusCode).toBe(422);
    expect((await app.inject({ method: 'PUT', url, headers: auth('admin'), payload: { dias: [{ dia: 9, cerrado: true, tramos: [] }] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url, headers: auth('admin'), payload: { dias: [{ dia: 1, cerrado: false, tramos: [{ desde: 600, hasta: 2000 }] }] } })).statusCode).toBe(400);
    expect(guardarHorario).toHaveBeenCalledTimes(2);
  });

  it('leer devuelve los días declarados', async () => {
    const obtenerHorario = vi.fn(() => Promise.resolve(ok([{ dia: 6 as const, cerrado: true, tramos: [] }])));
    const r = await (await construir({ obtenerHorario })).inject({ method: 'GET', url: `/v1/locales/${UUID}/horario`, headers: auth('despachador') });
    expect(r.json()).toEqual({ dias: [{ dia: 6, cerrado: true, tramos: [] }] });
  });
});

describe('avisos de entrega', () => {
  const auth = (rol: Rol) => ({ authorization: `Bearer ${ROLES[rol]}` });
  const url = `/v1/entregas/${UUID}/eventos`;

  it('entrega el aviso al caso de uso con la posición y devuelve el estado y si se fijó el pin', async () => {
    const registrarEvento = vi.fn(() => Promise.resolve(ok({ estado: 'pendiente' as const, pinFijado: true })));
    const r = await (await construir({ registrarEvento })).inject({ method: 'POST', url, headers: auth('chofer'), payload: { tipo: 'llegada', lat: -33.45, lng: -70.66, precisionM: 12 } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ estado: 'pendiente', pinFijado: true });
    expect(registrarEvento).toHaveBeenCalledWith(USUARIOS['t-chofer'], UUID, { tipo: 'llegada', lat: -33.45, lng: -70.66, precisionM: 12 });
  });

  it('valida el cuerpo; conflicto y permiso del caso de uso salen con su código', async () => {
    const registrarEvento = vi.fn()
      .mockResolvedValueOnce(err(errorApp('CONFLICTO', 'Esa entrega ya está marcada como entregada.')))
      .mockResolvedValueOnce(err(errorApp('SIN_PERMISO', 'Esa entrega no es de tu camión de hoy.')));
    const app = await construir({ registrarEvento });
    const enviar = (payload: object) => app.inject({ method: 'POST', url, headers: auth('ayudante'), payload });
    expect((await enviar({ tipo: 'entregado' })).statusCode).toBe(409);
    expect((await enviar({ tipo: 'entregado' })).statusCode).toBe(403);
    expect((await enviar({ tipo: 'volar' })).statusCode).toBe(400);
    expect((await enviar({ tipo: 'llegada', lat: 123, lng: 0 })).statusCode).toBe(400);
    expect((await enviar({ tipo: 'espera', minutos: 500 })).statusCode).toBe(400);
    expect(registrarEvento).toHaveBeenCalledTimes(2);
  });
});
