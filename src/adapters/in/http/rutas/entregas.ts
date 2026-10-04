import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

export const rutasEntregas = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.post(
    '/v1/entregas/:id/eventos',
    {
      preHandler: guard('entregas:registrar'),
      schema: {
        tags: ['entregas'],
        summary: 'Avisar desde la parada: llegué, entregué, está cerrado, espero, no se entregó o vuelvo más tarde (con la posición si hay)',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({
          tipo: z.enum(['llegada', 'entregado', 'cerrado', 'espera', 'no_entregado', 'vuelve_mas_tarde']),
          lat: z.number().min(-90).max(90).optional(),
          lng: z.number().min(-180).max(180).optional(),
          precisionM: z.number().min(0).max(100_000).optional(),
          motivo: z.enum(['cerrado', 'no_recibe', 'direccion', 'otro']).optional(),
          minutos: z.number().int().min(1).max(240).optional(),
        }),
        response: { 200: z.object({ estado: z.enum(['pendiente', 'entregada', 'no_entregada', 'anulada']), pinFijado: z.boolean() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.registrarEvento(actor(req), req.params.id, req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );
};
