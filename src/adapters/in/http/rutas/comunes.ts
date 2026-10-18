import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Usuario } from '../../../../domain/entidades/usuario.js';
import type { Guard } from '../auth.js';
import type { CasosDeUso } from '../casos-de-uso.js';

export type ContextoRutas = { readonly app: FastifyInstance; readonly casos: CasosDeUso; readonly guard: Guard };
export const tipada = (app: FastifyInstance) => app.withTypeProvider<ZodTypeProvider>();

export const SEGURIDAD = [{ bearerAuth: [] }];
export const idParam = z.object({ id: z.uuid() });

export const usuarioPublico = z.object({
  id: z.string(),
  username: z.string(),
  nombre: z.string(),
  rol: z.enum(['admin', 'despachador', 'chofer', 'ayudante']),
  activo: z.boolean(),
  /** Chofer o ayudante con permiso de editor (lo da el admin). */
  editor: z.boolean(),
  /** Cuándo puso su foto de perfil (no viene si no tiene); sirve para refrescarla cuando cambia. */
  fotoEn: z.iso.datetime().optional(),
});

/** El usuario como lo ve la interfaz: sin datos internos. */
export const aUsuarioPublico = (u: Usuario): z.infer<typeof usuarioPublico> => ({
  id: u.id,
  username: u.username,
  nombre: u.nombre,
  rol: u.rol,
  activo: u.activo,
  editor: u.editor,
  ...(u.fotoPath !== undefined && u.fotoEn !== undefined ? { fotoEn: u.fotoEn.toISOString() } : {}),
});

export const sesionSchema = z.object({ accessToken: z.string(), refreshToken: z.string(), expiraEnSegundos: z.number() });
