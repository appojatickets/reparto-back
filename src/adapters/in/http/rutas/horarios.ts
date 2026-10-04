import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const minuto = z.number().int().min(0).max(1439);
const tramo = z.object({ desde: minuto, hasta: minuto });
const dia = z.object({ dia: z.number().int().min(0).max(6), cerrado: z.boolean(), tramos: z.array(tramo).max(3) });
const horario = z.object({ dias: z.array(dia).max(7) });
const horarioRespuesta = z.object({ dias: z.array(dia.extend({ tramos: z.array(tramo).readonly() }).readonly()).readonly() });

export const rutasHorarios = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/locales/:id/horario',
    {
      preHandler: guard('clientes:leer'),
      schema: {
        tags: ['clientes'],
        summary: 'Horario de atención declarado a mano (0 = domingo … 6 = sábado). Los días que no aparecen no tienen dato.',
        security: SEGURIDAD,
        params: idParam,
        response: { 200: horarioRespuesta, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.obtenerHorario(actor(req), req.params.id);
      return r.ok ? reply.send({ dias: r.value }) : enviarError(reply, r.error);
    },
  );

  a.put(
    '/v1/locales/:id/horario',
    {
      preHandler: guard('clientes:escribir'),
      schema: {
        tags: ['clientes'],
        summary: 'Guardar el horario manual del local (reemplaza el anterior). «Cerrado» es un día con cerrado=true y sin tramos.',
        security: SEGURIDAD,
        params: idParam,
        body: horario,
        response: { 200: horarioRespuesta, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.guardarHorario(actor(req), req.params.id, req.body.dias);
      return r.ok ? reply.send({ dias: r.value }) : enviarError(reply, r.error);
    },
  );
};
