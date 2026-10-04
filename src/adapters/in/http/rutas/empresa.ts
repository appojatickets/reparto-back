import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const minuto = z.number().int().min(0).max(1439);
const configSchema = z.object({
  deposito: z.object({ lat: z.number(), lng: z.number(), nombre: z.string().max(80).optional() }).optional(),
  salidaPorDefectoMin: minuto,
  horaLimiteRegresoMin: minuto,
});

export const rutasEmpresa = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/empresa/config',
    {
      preHandler: guard('rutas:leer'),
      schema: { tags: ['empresa'], summary: 'Depósito, hora de salida y hora límite de regreso', security: SEGURIDAD, response: { 200: configSchema, ...RESPUESTAS_ERROR } },
    },
    async (req, reply) => {
      const r = await casos.obtenerConfigEmpresa(actor(req));
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.put(
    '/v1/empresa/config',
    {
      preHandler: guard('empresa:configurar'),
      schema: { tags: ['empresa'], summary: 'Guardar la configuración de reparto', security: SEGURIDAD, body: configSchema, response: { 200: configSchema, ...RESPUESTAS_ERROR } },
    },
    async (req, reply) => {
      const r = await casos.guardarConfigEmpresa(actor(req), req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );
};
