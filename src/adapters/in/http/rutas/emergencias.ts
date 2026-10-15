import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const emergencia = z.object({
  id: z.string(),
  camionId: z.string(),
  tipo: z.enum(['mecanico', 'vulcanizacion', 'otro']),
  texto: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  precisionM: z.number().optional(),
  creadoEn: z.string(),
});

export const rutasEmergencias = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.post(
    '/v1/emergencias',
    {
      preHandler: guard('entregas:registrar'),
      schema: {
        tags: ['emergencias'],
        summary: 'Kit de emergencia: avisar que se va a un mecánico, una vulcanización u otra cosa; queda como parada de emergencia del camión de la jornada (no es una entrega)',
        security: SEGURIDAD,
        body: z.object({
          tipo: z.enum(['mecanico', 'vulcanizacion', 'otro']),
          texto: z.string().max(200).optional(),
          lat: z.number().min(-90).max(90).optional(),
          lng: z.number().min(-180).max(180).optional(),
          precisionM: z.number().min(0).max(100_000).optional(),
        }),
        response: { 200: emergencia, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.registrarEmergencia(actor(req), req.body);
      return r.ok ? reply.send({ ...r.value, creadoEn: r.value.creadoEn.toISOString() }) : enviarError(reply, r.error);
    },
  );

  a.get(
    '/v1/emergencias',
    {
      preHandler: guard('rutas:leer'),
      schema: {
        tags: ['emergencias'],
        summary: 'Paradas de emergencia de un día (el chofer ve las de su camión; despacho y admin, las del camión pedido o todas)',
        security: SEGURIDAD,
        querystring: z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), camionId: z.uuid().optional() }),
        response: { 200: z.object({ emergencias: z.array(emergencia) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.listarEmergencias(actor(req), req.query);
      return r.ok ? reply.send({ emergencias: r.value.map((e) => ({ ...e, creadoEn: e.creadoEn.toISOString() })) }) : enviarError(reply, r.error);
    },
  );
};
