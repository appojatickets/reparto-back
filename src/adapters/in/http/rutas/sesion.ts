import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, sesionSchema, tipada, usuarioPublico, type ContextoRutas } from './comunes.js';

export const rutasSesion = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.post(
    '/v1/auth/login',
    {
      // Límite propio y más estricto que el global: frena la adivinación de claves por IP (además del bloqueo por usuario).
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['sesión'],
        summary: 'Iniciar sesión con usuario y clave de 6 dígitos',
        body: z.object({ username: z.string().min(1).max(50), pin: z.string().min(1).max(64) }),
        response: { 200: sesionSchema.extend({ usuario: usuarioPublico }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.iniciarSesion(req.body);
      if (!r.ok) return enviarError(reply, r.error);
      const { sesion, usuario } = r.value;
      return reply.send({ ...sesion, usuario: { id: usuario.id, username: usuario.username, nombre: usuario.nombre, rol: usuario.rol, activo: usuario.activo } });
    },
  );

  a.post(
    '/v1/auth/refresh',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['sesión'],
        summary: 'Renovar la sesión con el refresh token',
        body: z.object({ refreshToken: z.string().min(1).max(512) }),
        response: { 200: sesionSchema, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.refrescarSesion(req.body.refreshToken);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.get(
    '/v1/me',
    {
      preHandler: guard(),
      schema: {
        tags: ['sesión'],
        summary: 'Quién soy',
        security: SEGURIDAD,
        response: { 200: usuarioPublico.extend({ empresaId: z.string() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const u = actor(req);
      return reply.send({ id: u.id, username: u.username, nombre: u.nombre, rol: u.rol, activo: u.activo, empresaId: u.empresaId });
    },
  );
};
