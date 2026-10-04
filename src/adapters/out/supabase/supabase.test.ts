import { describe, expect, it, vi } from 'vitest';
import { AlmacenSupabase } from './almacen-supabase.js';
import { cabecerasDeServicio } from './cabeceras.js';
import { IdentidadSupabase } from './identidad-supabase.js';

const json = (status: number, cuerpo: unknown): Response => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const cuerpoDe = (init: RequestInit | undefined): unknown => JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
const SESION = { access_token: 'at', refresh_token: 'rt', expires_in: 3600, user: { id: 'u1' } };

const identidad = (respuesta: () => Response | Promise<Response>, extra: { clavePublica?: string; claveServicio?: string } = {}) => {
  const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(respuesta()));
  return { fetchFn, proveedor: new IdentidadSupabase({ urlBase: 'https://p.supabase.co/', claveServicio: extra.claveServicio ?? 'svc-jwt', clavePublica: extra.clavePublica ?? 'pub', fetch: fetchFn }) };
};

describe('cabecerasDeServicio', () => {
  it('una clave nueva (sb_secret_) va solo en apikey; una antigua (JWT) también como Bearer', () => {
    expect(cabecerasDeServicio('sb_secret_abc')).toEqual({ apikey: 'sb_secret_abc' });
    expect(cabecerasDeServicio('eyJ.x.y')).toEqual({ apikey: 'eyJ.x.y', authorization: 'Bearer eyJ.x.y' });
  });
});

describe('IdentidadSupabase', () => {
  it('iniciar sesión usa la clave pública y el grant password', async () => {
    const { proveedor, fetchFn } = identidad(() => json(200, SESION));
    const r = await proveedor.iniciarSesion('jperez@d.test', '482915');
    expect(r).toEqual({ ok: true, value: { accessToken: 'at', refreshToken: 'rt', expiraEnSegundos: 3600 } });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('https://p.supabase.co/auth/v1/token?grant_type=password');
    expect(init?.headers).toMatchObject({ apikey: 'pub' });
    expect(cuerpoDe(init)).toEqual({ email: 'jperez@d.test', password: '482915' });
  });

  it('credenciales malas (400) → CREDENCIALES_INVALIDAS; caída (500), límite (429) o red → NO_DISPONIBLE', async () => {
    expect((await identidad(() => json(400, { error: 'invalid_grant' })).proveedor.iniciarSesion('a', 'b')).ok).toBe(false);
    const mala = await identidad(() => json(400, { error: 'invalid_grant' })).proveedor.iniciarSesion('a', 'b');
    expect(!mala.ok && mala.error.kind).toBe('CREDENCIALES_INVALIDAS');
    for (const status of [500, 502, 429]) {
      const r = await identidad(() => json(status, {})).proveedor.iniciarSesion('a', 'b');
      expect(!r.ok && r.error.kind).toBe('NO_DISPONIBLE');
    }
    const red = await identidad(() => { throw new TypeError('fetch failed'); }).proveedor.iniciarSesion('a', 'b');
    expect(!red.ok && red.error.kind).toBe('NO_DISPONIBLE');
  });

  it('una respuesta 200 sin tokens no se acepta como sesión', async () => {
    const r = await identidad(() => json(200, { user: {} })).proveedor.iniciarSesion('a', 'b');
    expect(!r.ok && r.error.kind).toBe('NO_DISPONIBLE');
  });

  it('refrescar usa el grant refresh_token; un token malo es TOKEN_INVALIDO', async () => {
    const buena = identidad(() => json(200, SESION));
    expect((await buena.proveedor.refrescarSesion('rt')).ok).toBe(true);
    expect(buena.fetchFn.mock.calls[0]?.[0]).toContain('grant_type=refresh_token');
    const mala = await identidad(() => json(400, { error: 'invalid_grant' })).proveedor.refrescarSesion('x');
    expect(!mala.ok && mala.error.kind).toBe('TOKEN_INVALIDO');
  });

  it('verificar token: GET /user con el Bearer del usuario; 401 → TOKEN_INVALIDO', async () => {
    const buena = identidad(() => json(200, { id: 'u1', email: 'x' }));
    expect(await buena.proveedor.verificarToken('tok')).toEqual({ ok: true, value: { usuarioId: 'u1' } });
    expect(buena.fetchFn.mock.calls[0]?.[1]?.headers).toMatchObject({ apikey: 'pub', authorization: 'Bearer tok' });
    const mala = await identidad(() => json(401, { msg: 'invalid JWT' })).proveedor.verificarToken('tok');
    expect(!mala.ok && mala.error.kind).toBe('TOKEN_INVALIDO');
    const caida = await identidad(() => json(503, {})).proveedor.verificarToken('tok');
    expect(!caida.ok && caida.error.kind).toBe('NO_DISPONIBLE');
  });

  it('crear cuenta: usa la clave de servicio, confirma el correo y distingue «ya existe»', async () => {
    const { proveedor, fetchFn } = identidad(() => json(200, { id: 'nuevo' }));
    expect(await proveedor.crearCuenta('jperez@d.test', '482915')).toEqual({ ok: true, value: { usuarioId: 'nuevo' } });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('https://p.supabase.co/auth/v1/admin/users');
    expect(init?.headers).toMatchObject({ apikey: 'svc-jwt', authorization: 'Bearer svc-jwt' });
    expect(cuerpoDe(init)).toMatchObject({ email_confirm: true });

    const existe = await identidad(() => json(422, { error_code: 'email_exists', msg: 'dup' })).proveedor.crearCuenta('a', 'b');
    expect(!existe.ok && existe.error.kind).toBe('YA_EXISTE');
    const rechazo = await identidad(() => json(422, { msg: 'Password should be at least 6 characters' })).proveedor.crearCuenta('a', 'b');
    expect(!rechazo.ok && rechazo.error).toEqual({ kind: 'RECHAZADO', detalle: 'Password should be at least 6 characters' });
  });

  it('con clave nueva (sb_secret_) las llamadas de administración no mandan Authorization', async () => {
    const { proveedor, fetchFn } = identidad(() => json(200, { id: 'x' }), { claveServicio: 'sb_secret_zzz' });
    await proveedor.crearCuenta('a', 'b');
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toEqual({ apikey: 'sb_secret_zzz', 'content-type': 'application/json' });
  });

  it('cambiar clave y eliminar cuenta (borrar algo que ya no existe es éxito)', async () => {
    const c = identidad(() => json(200, {}));
    expect((await c.proveedor.cambiarClave('u 1', '905031')).ok).toBe(true);
    expect(c.fetchFn.mock.calls[0]?.[0]).toBe('https://p.supabase.co/auth/v1/admin/users/u%201');
    expect(c.fetchFn.mock.calls[0]?.[1]?.method).toBe('PUT');
    expect((await identidad(() => json(404, {})).proveedor.eliminarCuenta('u1')).ok).toBe(true);
    expect((await identidad(() => json(403, {})).proveedor.eliminarCuenta('u1')).ok).toBe(false);
    expect((await identidad(() => json(403, {})).proveedor.cambiarClave('u1', '1')).ok).toBe(false);
  });
});

describe('AlmacenSupabase', () => {
  const almacen = (respuesta: () => Response) => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(respuesta()));
    return { fetchFn, a: new AlmacenSupabase({ urlBase: 'https://p.supabase.co', claveServicio: 'svc', fetch: fetchFn }) };
  };

  it('URL de subida: pide la firma al bucket privado y devuelve una URL absoluta', async () => {
    const { a, fetchFn } = almacen(() => json(200, { url: '/object/upload/sign/fotos/e/l/x.webp?token=T' }));
    const r = await a.crearUrlSubida('e/l/x.webp');
    expect(r).toEqual({ ok: true, value: { url: 'https://p.supabase.co/storage/v1/object/upload/sign/fotos/e/l/x.webp?token=T' } });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://p.supabase.co/storage/v1/object/upload/sign/fotos/e/l/x.webp');
  });

  it('URL de lectura: firma con el tiempo pedido', async () => {
    const { a, fetchFn } = almacen(() => json(200, { signedURL: '/object/sign/fotos/e/l/x.webp?token=T' }));
    const r = await a.crearUrlLectura('e/l/x.webp', 300);
    expect(r.ok && r.value.url).toBe('https://p.supabase.co/storage/v1/object/sign/fotos/e/l/x.webp?token=T');
    expect(cuerpoDe(fetchFn.mock.calls[0]?.[1])).toEqual({ expiresIn: 300 });
  });

  it('errores del almacenamiento (HTTP o red) se informan sin lanzar', async () => {
    expect((await almacen(() => json(404, { message: 'Bucket not found' })).a.crearUrlSubida('x')).ok).toBe(false);
    const roto = new AlmacenSupabase({ urlBase: 'https://p.supabase.co', claveServicio: 's', fetch: () => Promise.reject(new TypeError('red')) });
    expect((await roto.crearUrlLectura('x', 60)).ok).toBe(false);
  });

  it('codifica cada tramo del path sin romper las barras', async () => {
    const { a, fetchFn } = almacen(() => json(200, { url: '/x' }));
    await a.crearUrlSubida('e/local con espacio/x.webp');
    expect(fetchFn.mock.calls[0]?.[0]).toContain('/fotos/e/local%20con%20espacio/x.webp');
  });
});
