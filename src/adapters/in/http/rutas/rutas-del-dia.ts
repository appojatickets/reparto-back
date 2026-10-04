import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const minuto = z.number().int().min(0).max(1439);

const item = z.object({
  facturaId: z.string(),
  folio: z.string().optional(),
  localId: z.string(),
  cliente: z.string(),
  direccion: z.string(),
  comuna: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  urgente: z.boolean(),
  antesDeMin: z.number().optional(),
  nota: z.string().optional(),
});

const motivo = z.enum(['VENTANA_DURA', 'PRIORIDAD', 'CERCANIA_COMUNA', 'COLACION', 'FIJADA_POR_CHOFER', 'MENOR_DESVIO']);
const sugerencia = z.object({ tipo: z.enum(['MOVER_AL_INICIO', 'SALIR_ANTES', 'OTRO_CAMION']), minutos: z.number().optional(), texto: z.string() });

const vistaRuta = z.object({
  camionId: z.string(),
  fecha: z.string(),
  planificada: z.boolean(),
  modo: z.enum(['sugerida', 'manual']).optional(),
  version: z.number().optional(),
  salidaMin: z.number(),
  horaLimiteRegresoMin: z.number(),
  regreso: z.number().optional(),
  regresoTardio: z.boolean().optional(),
  paradas: z
    .array(
      item.extend({
        posicion: z.number(),
        llegada: z.number(),
        inicioServicio: z.number(),
        salida: z.number(),
        espera: z.number(),
        atraso: z.number(),
        motivos: z.array(motivo).readonly(),
        fijada: z.boolean(),
      }),
    )
    .readonly(),
  nuevas: z.array(item).readonly(),
  sinPin: z.array(item).readonly(),
  noAtendidas: z.array(item.extend({ conflictos: z.array(z.string()).readonly() })).readonly(),
  enRiesgo: z.array(item.extend({ cierre: z.number(), conflictos: z.array(z.string()).readonly(), sugerencias: z.array(sugerencia).readonly() })).readonly(),
});

const operacion = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.enum(['subir', 'bajar', 'primero', 'despues', 'quitar']), facturaId: z.uuid() }),
  z.object({ tipo: z.enum(['ordenar', 'insertar']) }),
  z.object({ tipo: z.literal('salida'), salidaMin: minuto }),
]);

export const rutasDelDia = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/rutas',
    {
      preHandler: guard('rutas:leer'),
      schema: {
        tags: ['rutas'],
        summary: 'Ruta de un camión para un día: orden, horas estimadas de llegada, riesgos y facturas sin ubicar',
        security: SEGURIDAD,
        querystring: z.object({ camionId: z.uuid(), fecha }),
        response: { 200: vistaRuta, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.verRuta(actor(req), req.query);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/rutas/planificar',
    {
      preHandler: guard('rutas:escribir'),
      schema: {
        tags: ['rutas'],
        summary: 'Calcular la ruta sugerida desde cero (reemplaza la actual)',
        security: SEGURIDAD,
        body: z.object({ camionId: z.uuid(), fecha, salidaMin: minuto.optional() }),
        response: { 200: vistaRuta, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.planificarRuta(actor(req), req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/rutas/operaciones',
    {
      preHandler: guard('rutas:escribir'),
      schema: {
        tags: ['rutas'],
        summary: 'Acomodar la ruta: subir, bajar, ir primero, dejar para después, quitar, ordenar lo que queda, insertar nuevas o cambiar la salida',
        security: SEGURIDAD,
        body: z.object({ camionId: z.uuid(), fecha, version: z.number().int().min(1), operacion }),
        response: { 200: vistaRuta, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.operarRuta(actor(req), req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );
};
