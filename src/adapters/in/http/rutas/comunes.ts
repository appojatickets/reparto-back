import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
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
});

export const sesionSchema = z.object({ accessToken: z.string(), refreshToken: z.string(), expiraEnSegundos: z.number() });
