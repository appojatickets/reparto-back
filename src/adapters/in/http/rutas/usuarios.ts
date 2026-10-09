import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, usuarioPublico, type ContextoRutas } from './comunes.js';

const rol = z.enum(['admin', 'despachador', 'chofer', 'ayudante']);

export const rutasUsuarios = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);
  const admin = guard('usuarios:gestionar');

  a.get(
    '/v1/usuarios',
    { preHandler: admin, schema: { tags: ['usuarios'], summary: 'Listar usuarios', security: SEGURIDAD, response: { 200: z.object({ usuarios: z.array(usuarioPublico) }), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const lista = await casos.listarUsuarios(actor(req));
      return reply.send({ usuarios: lista.map((u) => ({ id: u.id, username: u.username, nombre: u.nombre, rol: u.rol, activo: u.activo, editor: u.editor })) });
    },
  );

  a.post(
    '/v1/usuarios',
    {
      preHandler: admin,
      schema: {
        tags: ['usuarios'],
        summary: 'Crear usuario (el nombre de usuario se genera: inicial + primer apellido)',
        security: SEGURIDAD,
        body: z.object({
          nombre: z.string().min(1).max(60),
          apellidoPaterno: z.string().min(1).max(60),
          apellidoMaterno: z.string().max(60).optional(),
          rol,
          pin: z.string().min(1).max(64),
        }),
        response: { 201: usuarioPublico, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.crearUsuario(actor(req), req.body);
      if (!r.ok) return enviarError(reply, r.error);
      const u = r.value;
      return reply.code(201).send({ id: u.id, username: u.username, nombre: u.nombre, rol: u.rol, activo: u.activo, editor: u.editor });
    },
  );

  a.post(
    '/v1/usuarios/:id/pin',
    { preHandler: admin, schema: { tags: ['usuarios'], summary: 'Resetear la clave', security: SEGURIDAD, params: idParam, body: z.object({ pin: z.string().min(1).max(64) }), response: { 204: z.null(), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.resetearPin(actor(req), req.params.id, req.body.pin);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.put(
    '/v1/usuarios/:id/editor',
    { preHandler: admin, schema: { tags: ['usuarios'], summary: 'Dar o quitar el permiso de editor a un chofer o ayudante (corregir clientes, quitar fotos, eliminar direcciones equivocadas)', security: SEGURIDAD, params: idParam, body: z.object({ editor: z.boolean() }), response: { 204: z.null(), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.cambiarEditorUsuario(actor(req), req.params.id, req.body.editor);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.patch(
    '/v1/usuarios/:id',
    { preHandler: admin, schema: { tags: ['usuarios'], summary: 'Activar o desactivar', security: SEGURIDAD, params: idParam, body: z.object({ activo: z.boolean() }), response: { 204: z.null(), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.cambiarEstadoUsuario(actor(req), req.params.id, req.body.activo);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );
};
