import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';
import { asignacionSchema } from './planilla.js';
import type { JornadaConAsignacion } from '../../../../application/use-cases/jornada.js';

const jornadaSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  desde: z.string(),
  camion: z.object({ id: z.string(), patente: z.string(), alias: z.string().optional() }),
  /** Lo que dice la planilla de hoy para ese camión: quiénes van, comunas y vendedores con su celular. */
  asignacion: asignacionSchema.optional(),
});
const aJson = (j: JornadaConAsignacion) => ({ id: j.id, fecha: j.fecha, desde: j.desde.toISOString(), camion: j.camion, ...(j.asignacion ? { asignacion: j.asignacion } : {}) });

export const rutasJornada = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/jornada',
    {
      preHandler: guard('jornada:gestionar'),
      schema: {
        tags: ['jornada'],
        summary: 'El camión que el usuario maneja hoy (null si todavía no lo eligió)',
        security: SEGURIDAD,
        response: { 200: z.object({ jornada: jornadaSchema.nullable() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const j = await casos.miJornada(actor(req));
      return reply.send({ jornada: j ? aJson(j) : null });
    },
  );

  a.post(
    '/v1/jornada',
    {
      preHandler: guard('jornada:gestionar'),
      schema: {
        tags: ['jornada'],
        summary: 'Elegir (o cambiar) el camión de hoy; cierra la jornada anterior',
        security: SEGURIDAD,
        body: z.object({ camionId: z.uuid() }),
        response: { 200: jornadaSchema, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.iniciarJornada(actor(req), req.body.camionId);
      return r.ok ? reply.send(aJson(r.value)) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/jornada/terminar',
    {
      preHandler: guard('jornada:gestionar'),
      schema: {
        tags: ['jornada'],
        summary: 'Terminar la ruta de hoy y devolver el resumen del día (entregadas, no entregadas y pendientes); queda registrada la hora de término',
        security: SEGURIDAD,
        response: {
          200: z.object({
            resumen: z.object({ fecha: z.string(), camionId: z.string(), desde: z.string(), hasta: z.string(), entregadas: z.number(), noEntregadas: z.number(), pendientes: z.number() }).nullable(),
          }),
          ...RESPUESTAS_ERROR,
        },
      },
    },
    async (req, reply) => {
      const r = await casos.terminarJornada(actor(req));
      return reply.send({ resumen: r ? { ...r, desde: r.desde.toISOString(), hasta: r.hasta.toISOString() } : null });
    },
  );

  a.post(
    '/v1/jornada/posiciones',
    {
      preHandler: guard('jornada:gestionar'),
      schema: {
        tags: ['jornada'],
        summary: 'Informar dónde está el camión mientras la app está abierta (se sigue al camión, no a la persona); si se queda junto al pin de una entrega, el servidor anota la llegada solo',
        security: SEGURIDAD,
        body: z.object({
          puntos: z.array(z.object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
            precisionM: z.number().min(0).max(100_000).optional(),
            velocidadMs: z.number().min(0).max(100).optional(),
            tomadoEn: z.iso.datetime(),
          })).min(1).max(30),
        }),
        response: { 200: z.object({ guardados: z.number(), descartados: z.number(), llegadasAutomaticas: z.array(z.string()) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.registrarPosiciones(actor(req), req.body.puntos.map((p) => ({ ...p, tomadoEn: new Date(p.tomadoEn) })));
      return r.ok ? reply.send({ ...r.value, llegadasAutomaticas: [...r.value.llegadasAutomaticas] }) : enviarError(reply, r.error);
    },
  );

  a.delete(
    '/v1/jornada',
    {
      preHandler: guard('jornada:gestionar'),
      schema: { tags: ['jornada'], summary: 'Terminar la jornada de hoy', security: SEGURIDAD, response: { 204: z.null(), ...RESPUESTAS_ERROR } },
    },
    async (req, reply) => {
      await casos.terminarJornada(actor(req));
      return reply.code(204).send(null);
    },
  );
};
