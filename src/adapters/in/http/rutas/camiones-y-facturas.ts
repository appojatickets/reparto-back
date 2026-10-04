import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const camionSchema = z.object({ id: z.string(), patente: z.string(), alias: z.string().optional(), activo: z.boolean() });

const camionResumen = z.object({ id: z.string(), patente: z.string(), alias: z.string().optional() });

const facturaSchema = z.object({
  id: z.string(),
  folio: z.string(),
  fecha: z.string(),
  estado: z.enum(['pendiente', 'anulada']),
  total: z.number().optional(),
  antesDeMin: z.number().optional(),
  urgente: z.boolean(),
  nota: z.string().optional(),
  camion: camionResumen.optional(),
  local: z.object({ id: z.string(), razonSocial: z.string(), direccion: z.string(), comuna: z.string(), tienePin: z.boolean() }),
});

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const booleanoDeTexto = z.enum(['true', 'false']).transform((v) => v === 'true');

export const rutasCamionesYFacturas = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/camiones',
    {
      preHandler: guard('facturas:leer'),
      schema: {
        tags: ['camiones'],
        summary: 'Camiones de la empresa (por defecto solo los activos)',
        security: SEGURIDAD,
        querystring: z.object({ incluirInactivos: booleanoDeTexto.optional() }),
        response: { 200: z.object({ camiones: z.array(camionSchema) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => reply.send({ camiones: [...(await casos.listarCamiones(actor(req), { soloActivos: req.query.incluirInactivos !== true }))] }),
  );

  a.post(
    '/v1/camiones',
    {
      preHandler: guard('camiones:gestionar'),
      schema: {
        tags: ['camiones'],
        summary: 'Registrar un camión por su patente',
        security: SEGURIDAD,
        body: z.object({ patente: z.string().max(20), alias: z.string().max(60).optional() }),
        response: { 201: camionSchema, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.crearCamion(actor(req), req.body);
      return r.ok ? reply.code(201).send(r.value) : enviarError(reply, r.error);
    },
  );

  a.patch(
    '/v1/camiones/:id',
    {
      preHandler: guard('camiones:gestionar'),
      schema: {
        tags: ['camiones'],
        summary: 'Cambiar el alias o activar/desactivar un camión',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ alias: z.string().max(60).nullable().optional(), activo: z.boolean().optional() }),
        response: { 200: camionSchema, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.actualizarCamion(actor(req), req.params.id, req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.get(
    '/v1/facturas',
    {
      preHandler: guard('facturas:leer'),
      schema: {
        tags: ['facturas'],
        summary: 'Facturas de un día (hoy en Chile si no se indica), en orden de ingreso',
        security: SEGURIDAD,
        querystring: z.object({
          fecha: fecha.optional(),
          camionId: z.uuid().optional(),
          sinCamion: booleanoDeTexto.optional(),
          incluirAnuladas: booleanoDeTexto.optional(),
        }),
        response: { 200: z.object({ facturas: z.array(facturaSchema) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.listarFacturas(actor(req), req.query);
      return r.ok ? reply.send({ facturas: [...r.value] }) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/facturas',
    {
      preHandler: guard('facturas:escribir'),
      schema: {
        tags: ['facturas'],
        summary: 'Ingresar una factura: folio, cliente (local), camión opcional y condiciones de entrega',
        security: SEGURIDAD,
        body: z.object({
          folio: z.string().max(40),
          localId: z.uuid(),
          camionId: z.uuid().optional(),
          fecha: fecha.optional(),
          total: z.number().int().min(0).optional(),
          antesDeMin: z.number().int().min(0).max(1439).optional(),
          urgente: z.boolean().optional(),
          nota: z.string().max(300).optional(),
        }),
        response: { 201: facturaSchema, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.registrarFactura(actor(req), req.body);
      return r.ok ? reply.code(201).send(r.value) : enviarError(reply, r.error);
    },
  );

  a.patch(
    '/v1/facturas/:id',
    {
      preHandler: guard('facturas:escribir'),
      schema: {
        tags: ['facturas'],
        summary: 'Cambiar camión, día o condiciones, o anular. `null` quita el valor.',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({
          camionId: z.uuid().nullable().optional(),
          fecha: fecha.optional(),
          total: z.number().int().min(0).nullable().optional(),
          antesDeMin: z.number().int().min(0).max(1439).nullable().optional(),
          urgente: z.boolean().optional(),
          nota: z.string().max(300).nullable().optional(),
          estado: z.enum(['pendiente', 'anulada']).optional(),
        }),
        response: { 200: facturaSchema, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.actualizarFactura(actor(req), req.params.id, req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );
};
