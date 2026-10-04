import type { Result } from '../../../domain/shared/result.js';

export type Sesion = { readonly accessToken: string; readonly refreshToken: string; readonly expiraEnSegundos: number };

export type ErrorIdentidad = {
  readonly kind: 'CREDENCIALES_INVALIDAS' | 'TOKEN_INVALIDO' | 'YA_EXISTE' | 'RECHAZADO' | 'NO_DISPONIBLE';
  readonly detalle?: string;
};

/** Quien autentica y guarda las cuentas (hoy Supabase Auth). El rol y el estado viven en nuestra tabla `usuario`. */
export interface ProveedorIdentidad {
  iniciarSesion(correo: string, clave: string): Promise<Result<Sesion, ErrorIdentidad>>;
  refrescarSesion(refreshToken: string): Promise<Result<Sesion, ErrorIdentidad>>;
  verificarToken(accessToken: string): Promise<Result<{ readonly usuarioId: string }, ErrorIdentidad>>;
  crearCuenta(correo: string, clave: string): Promise<Result<{ readonly usuarioId: string }, ErrorIdentidad>>;
  cambiarClave(usuarioId: string, clave: string): Promise<Result<void, ErrorIdentidad>>;
  eliminarCuenta(usuarioId: string): Promise<Result<void, ErrorIdentidad>>;
}
