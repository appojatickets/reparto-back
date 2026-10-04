import type { Rol } from '../permisos.js';

export type Usuario = {
  readonly id: string;
  readonly empresaId: string;
  readonly rol: Rol;
  readonly username: string;
  readonly nombre: string;
  readonly activo: boolean;
};
