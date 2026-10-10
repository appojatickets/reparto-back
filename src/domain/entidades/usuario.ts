import type { Rol } from '../permisos.js';

export type Usuario = {
  readonly id: string;
  readonly empresaId: string;
  readonly rol: Rol;
  readonly username: string;
  readonly nombre: string;
  readonly activo: boolean;
  /** Chofer o ayudante con permiso de editor: puede corregir clientes, quitar fotos y eliminar direcciones equivocadas (lo da el admin). */
  readonly editor: boolean;
  /** Foto de perfil en el almacenamiento (la sube cada persona) y cuándo se puso: sirve también para saber si cambió. */
  readonly fotoPath?: string;
  readonly fotoEn?: Date;
};
