import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const vendedorSchema = z.object({ id: z.string(), codigo: z.string(), nombre: z.string(), celular: z.string().optional(), activo: z.boolean() });
const booleanoDeTexto = z.enum(['true', 'false']).transform((v) => v === 'true');

export const rutasVendedores = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/vendedores',
    {
      preHandler: guard('vendedores:leer'),
      schema: {
        tags: ['vendedores'],
        summary: 'Vendedores de la empresa con su celular (por defecto solo los activos). El celular es 569 + 8 dígitos.',
        security: SEGURIDAD,
        querystring: z.object({ incluirInactivos: booleanoDeTexto.optional() }),
        response: { 200: z.object({ vendedores: z.array(vendedorSchema) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => reply.send({ vendedores: [...(await casos.listarVendedores(actor(req), { soloActivos: req.query.incluirInactivos !== true }))] }),
  );

  a.post(
    '/v1/vendedores',
    {
      preHandler: guard('vendedores:gestionar'),
      schema: {
        tags: ['vendedores'],
        summary: 'Registrar un vendedor (código como V01, nombre y, si se quiere, su celular)',
        security: SEGURIDAD,
        body: z.object({ codigo: z.string().max(20), nombre: z.string().max(100), celular: z.string().max(30).optional() }),
        response: { 201: vendedorSchema, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.crearVendedor(actor(req), req.body);
      return r.ok ? reply.code(201).send(r.value) : enviarError(reply, r.error);
    },
  );

  a.patch(
    '/v1/vendedores/:id',
    {
      preHandler: guard('vendedores:gestionar'),
      schema: {
        tags: ['vendedores'],
        summary: 'Cambiar nombre o celular (`null` lo borra) o activar/desactivar un vendedor',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ nombre: z.string().max(100).optional(), celular: z.string().max(30).nullable().optional(), activo: z.boolean().optional() }),
        response: { 200: vendedorSchema, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.actualizarVendedor(actor(req), req.params.id, req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );
};
