import type { Usuario } from '../../../domain/entidades/usuario.js';

export interface UsuarioRepository {
  porId(id: string): Promise<Usuario | undefined>;
  /** V1 trabaja con una sola empresa: el usuario es único dentro de ella. */
  porUsername(username: string): Promise<Usuario | undefined>;
  listar(empresaId: string): Promise<readonly Usuario[]>;
  usernamesDeEmpresa(empresaId: string): Promise<ReadonlySet<string>>;
  crear(usuario: Usuario): Promise<void>;
  /** Devuelve false si el usuario no existe en esa empresa. */
  cambiarActivo(empresaId: string, id: string, activo: boolean): Promise<boolean>;
}

export type EstadoIntentos = { readonly intentos: number; readonly bloqueadoHasta?: Date };

export interface IntentosLoginRepository {
  obtener(usuarioId: string): Promise<EstadoIntentos>;
  /** Suma un fallo; al llegar a `maxIntentos` bloquea por `bloqueoMs`. */
  registrarFallo(usuarioId: string, ahora: Date, maxIntentos: number, bloqueoMs: number): Promise<EstadoIntentos>;
  reiniciar(usuarioId: string): Promise<void>;
}
