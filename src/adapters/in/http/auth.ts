import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Usuario } from '../../../domain/entidades/usuario.js';
import { puede, type Permiso } from '../../../domain/permisos.js';
import { errorApp } from '../../../application/errores.js';
import type { CasosDeUso } from './casos-de-uso.js';
import { enviarError } from './errores.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Usuario autenticado; solo existe después del guard de una ruta protegida. */
    usuario?: Usuario;
  }
}

export type Guard = (permiso?: Permiso) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

const tokenDe = (req: FastifyRequest): string | undefined => {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
  return m?.[1];
};

/**
 * Autentica con el token y comprueba el permiso. Los permisos viven en el dominio (`puede`); aquí solo se aplican.
 * Sin token o token inválido → 401; sin permiso → 403.
 */
export const crearGuard = (casos: Pick<CasosDeUso, 'autenticar'>): Guard => (permiso) => async (req, reply) => {
  const token = tokenDe(req);
  if (!token) return void enviarError(reply, errorApp('NO_AUTENTICADO', 'Falta iniciar sesión.'));
  const r = await casos.autenticar(token);
  if (!r.ok) return void enviarError(reply, r.error);
  if (permiso !== undefined && !puede(r.value.rol, permiso)) {
    return void enviarError(reply, errorApp('SIN_PERMISO', 'No tienes permiso para esta acción.'));
  }
  req.usuario = r.value;
};

/** Usuario ya autenticado por el guard; si faltara, es un error de programación (la ruta olvidó el guard). */
export const actor = (req: FastifyRequest): Usuario => {
  if (!req.usuario) throw new Error('Ruta sin guard de autenticación');
  return req.usuario;
};
