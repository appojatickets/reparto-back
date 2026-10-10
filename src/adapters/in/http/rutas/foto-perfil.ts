import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

/** La foto de perfil de cada persona: la sube y la quita ella misma; cualquiera de la empresa puede verla. */
export const rutasFotoPerfil = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.post(
    '/v1/me/foto/url-subida',
    {
      preHandler: guard(),
      schema: {
        tags: ['perfil'],
        summary: 'URL firmada para subir mi foto de perfil directo a Storage (la API no recibe los bytes)',
        security: SEGURIDAD,
        body: z.object({ tipo: z.enum(['webp', 'jpeg']) }),
        response: { 200: z.object({ path: z.string(), url: z.string() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.solicitarUrlSubidaPerfil(actor(req), req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.put(
    '/v1/me/foto',
    { preHandler: guard(), schema: { tags: ['perfil'], summary: 'Registrar mi foto de perfil ya subida', security: SEGURIDAD, body: z.object({ path: z.string().max(300) }), response: { 204: z.null(), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.registrarFotoPerfil(actor(req), req.body.path);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.delete(
    '/v1/me/foto',
    { preHandler: guard(), schema: { tags: ['perfil'], summary: 'Quitar mi foto de perfil', security: SEGURIDAD, response: { 204: z.null(), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.quitarFotoPerfil(actor(req));
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.get(
    '/v1/usuarios/:id/foto-url',
    { preHandler: guard(), schema: { tags: ['perfil'], summary: 'URL firmada (5 minutos) para ver la foto de perfil de una persona de la empresa', security: SEGURIDAD, params: idParam, response: { 200: z.object({ url: z.string(), expiraEnSegundos: z.number() }), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.obtenerUrlFotoUsuario(actor(req), req.params.id);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );
};
