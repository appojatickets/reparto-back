import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const vendedorSchema = z.object({ id: z.string(), codigo: z.string(), nombre: z.string(), celular: z.string().optional(), activo: z.boolean() });
const persona = z.object({ nombre: z.string(), usuarioId: z.string().optional() });
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const asignacionSchema = z.object({
  fecha: z.string(),
  camion: z.object({ id: z.string(), patente: z.string(), alias: z.string().optional() }),
  chofer: persona.optional(),
  ayudante: persona.optional(),
  comunas: z.array(z.string()).readonly(),
  vendedores: z.array(vendedorSchema).readonly(),
});

const estadoPersona = z.enum(['enlazada', 'sin_usuario']);
const resultadoFila = z.object({
  patente: z.string(),
  valida: z.boolean(),
  errores: z.array(z.string()).readonly(),
  camionCreado: z.boolean(),
  alias: z.string().optional(),
  vendedoresCreados: z.number(),
  chofer: z.object({ nombre: z.string(), estado: estadoPersona }).optional(),
  ayudante: z.object({ nombre: z.string(), estado: estadoPersona }).optional(),
  jornadasAbiertas: z.number(),
});

export const rutasPlanilla = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/planilla',
    {
      preHandler: guard('planilla:gestionar'),
      schema: {
        tags: ['planilla'],
        summary: 'Qué lleva cada camión un día (chofer, ayudante, vendedores y comunas); hoy si no se indica',
        security: SEGURIDAD,
        querystring: z.object({ fecha: fecha.optional() }),
        response: { 200: z.object({ asignaciones: z.array(asignacionSchema).readonly() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.obtenerPlanilla(actor(req), req.query.fecha);
      return r.ok ? reply.send({ asignaciones: r.value }) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/planilla',
    {
      preHandler: guard('planilla:gestionar'),
      bodyLimit: 512 * 1024,
      schema: {
        tags: ['planilla'],
        summary: 'Aplicar la planilla de la mañana: crea camiones y vendedores que falten, enlaza chofer y ayudante y, si es de hoy, deja a cada uno con su camión elegido',
        security: SEGURIDAD,
        body: z.object({
          fecha,
          filas: z
            .array(
              z.object({
                patente: z.string().max(30),
                chofer: z.string().max(120).optional(),
                ayudante: z.string().max(120).optional(),
                vendedores: z.array(z.object({ codigo: z.string().max(10), nombre: z.string().max(100).optional() })).max(20).optional(),
                comunas: z.array(z.string().max(60)).max(60).optional(),
              }),
            )
            .min(1)
            .max(100),
        }),
        response: { 200: z.object({ filas: z.array(resultadoFila).readonly() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.aplicarPlanilla(actor(req), req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );
};
