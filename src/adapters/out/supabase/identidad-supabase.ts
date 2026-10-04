import { err, ok, type Result } from '../../../domain/shared/result.js';
import type { ErrorIdentidad, ProveedorIdentidad, Sesion } from '../../../application/ports/out/identidad.js';
import { cabecerasDeServicio, llamarJson, type Fetch, type RespuestaJson } from './cabeceras.js';

export type ConfigIdentidad = {
  readonly urlBase: string;
  readonly claveServicio: string;
  /** Clave publishable/anon: la que usa un cliente para iniciar sesión. Si falta se usa la de servicio. */
  readonly clavePublica?: string | undefined;
  readonly fetch?: Fetch | undefined;
};

const texto = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined);
const falla = (kind: ErrorIdentidad['kind'], detalle?: string): { ok: false; error: ErrorIdentidad } =>
  err(detalle === undefined ? { kind } : { kind, detalle });

/** Adaptador de Supabase Auth (GoTrue). Las cuentas son usuarios con correo sintético; nunca se envía un correo. */
export class IdentidadSupabase implements ProveedorIdentidad {
  private readonly fetchFn: Fetch;
  private readonly clavePublica: string;

  constructor(private readonly cfg: ConfigIdentidad) {
    this.fetchFn = cfg.fetch ?? globalThis.fetch;
    this.clavePublica = cfg.clavePublica ?? cfg.claveServicio;
  }

  private url(ruta: string): string {
    return `${this.cfg.urlBase.replace(/\/$/, '')}/auth/v1${ruta}`;
  }

  /** Cualquier error de red o de servidor (5xx, 429) es «no disponible», nunca «credenciales inválidas». */
  private async llamar(url: string, init: RequestInit): Promise<RespuestaJson | undefined> {
    try {
      const r = await llamarJson(this.fetchFn, url, init);
      return r.status >= 500 || r.status === 429 ? undefined : r;
    } catch {
      return undefined;
    }
  }

  private sesionDe(c: Record<string, unknown>): Sesion | undefined {
    const accessToken = texto(c['access_token']);
    const refreshToken = texto(c['refresh_token']);
    const expira = c['expires_in'];
    return accessToken && refreshToken && typeof expira === 'number' ? { accessToken, refreshToken, expiraEnSegundos: expira } : undefined;
  }

  private tokenGrant(grant: 'password' | 'refresh_token', cuerpo: object): Promise<RespuestaJson | undefined> {
    return this.llamar(this.url(`/token?grant_type=${grant}`), {
      method: 'POST',
      headers: { apikey: this.clavePublica, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  }

  async iniciarSesion(correo: string, clave: string): Promise<Result<Sesion, ErrorIdentidad>> {
    const r = await this.tokenGrant('password', { email: correo, password: clave });
    if (!r) return falla('NO_DISPONIBLE');
    if (r.status === 200) {
      const s = this.sesionDe(r.cuerpo);
      return s ? ok(s) : falla('NO_DISPONIBLE', 'respuesta inesperada');
    }
    return falla('CREDENCIALES_INVALIDAS');
  }

  async refrescarSesion(refreshToken: string): Promise<Result<Sesion, ErrorIdentidad>> {
    const r = await this.tokenGrant('refresh_token', { refresh_token: refreshToken });
    if (!r) return falla('NO_DISPONIBLE');
    if (r.status === 200) {
      const s = this.sesionDe(r.cuerpo);
      return s ? ok(s) : falla('NO_DISPONIBLE', 'respuesta inesperada');
    }
    return falla('TOKEN_INVALIDO');
  }

  async verificarToken(accessToken: string): Promise<Result<{ usuarioId: string }, ErrorIdentidad>> {
    const r = await this.llamar(this.url('/user'), { headers: { apikey: this.clavePublica, authorization: `Bearer ${accessToken}` } });
    if (!r) return falla('NO_DISPONIBLE');
    const id = texto(r.cuerpo['id']);
    return r.status === 200 && id ? ok({ usuarioId: id }) : falla('TOKEN_INVALIDO');
  }

  async crearCuenta(correo: string, clave: string): Promise<Result<{ usuarioId: string }, ErrorIdentidad>> {
    const r = await this.llamar(this.url('/admin/users'), {
      method: 'POST',
      headers: { ...cabecerasDeServicio(this.cfg.claveServicio), 'content-type': 'application/json' },
      // email_confirm: la cuenta nace confirmada; el correo es sintético y no existe un buzón al que mandar nada.
      body: JSON.stringify({ email: correo, password: clave, email_confirm: true }),
    });
    if (!r) return falla('NO_DISPONIBLE');
    const id = texto(r.cuerpo['id']);
    if (r.status < 300 && id) return ok({ usuarioId: id });
    if (r.cuerpo['error_code'] === 'email_exists' || r.cuerpo['error_code'] === 'user_already_exists') return falla('YA_EXISTE');
    return falla('RECHAZADO', texto(r.cuerpo['msg']) ?? texto(r.cuerpo['message']) ?? `HTTP ${r.status}`);
  }

  async cambiarClave(usuarioId: string, clave: string): Promise<Result<void, ErrorIdentidad>> {
    const r = await this.llamar(this.url(`/admin/users/${encodeURIComponent(usuarioId)}`), {
      method: 'PUT',
      headers: { ...cabecerasDeServicio(this.cfg.claveServicio), 'content-type': 'application/json' },
      body: JSON.stringify({ password: clave }),
    });
    if (!r) return falla('NO_DISPONIBLE');
    return r.status < 300 ? ok(undefined) : falla('RECHAZADO', `HTTP ${r.status}`);
  }

  async eliminarCuenta(usuarioId: string): Promise<Result<void, ErrorIdentidad>> {
    const r = await this.llamar(this.url(`/admin/users/${encodeURIComponent(usuarioId)}`), { method: 'DELETE', headers: cabecerasDeServicio(this.cfg.claveServicio) });
    if (!r) return falla('NO_DISPONIBLE');
    return r.status < 300 || r.status === 404 ? ok(undefined) : falla('RECHAZADO', `HTTP ${r.status}`);
  }
}
