import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const propuesta = z.object({
  id: z.string(),
  localId: z.string().optional(),
  rut: z.string().optional(),
  direccion: z.string(),
  lat: z.number(),
  lng: z.number(),
  distanciaActualM: z.number().optional(),
  estado: z.enum(['pendiente', 'aceptada', 'rechazada', 'sin_local']),
  proponenteId: z.string(),
  creadaEn: z.iso.datetime(),
  razonSocial: z.string().optional(),
  comuna: z.string().optional(),
  pinActual: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export const rutasPinesYArchivos = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.post(
    '/v1/pines/importaciones',
    {
      preHandler: guard('pines:proponer'),
      schema: {
        tags: ['pines'],
        summary: 'Proponer pines (quedan pendientes de revisión; nada cambia solo)',
        security: SEGURIDAD,
        body: z.object({
          pines: z.array(z.object({ rut: z.string().max(20).optional(), direccion: z.string().max(600).optional(), lat: z.union([z.number(), z.string().max(40)]).optional(), lng: z.union([z.number(), z.string().max(40)]).optional() })).min(1).max(500),
        }),
        response: {
          200: z.object({
            recibidas: z.number(),
            pendientes: z.number(),
            sinLocal: z.number(),
            errores: z.array(z.object({ fila: z.number(), errores: z.array(z.object({ codigo: z.string(), mensaje: z.string() })) })),
          }),
          ...RESPUESTAS_ERROR,
        },
      },
    },
    async (req, reply) => {
      const r = await casos.importarPines(actor(req), req.body.pines);
      return r.ok ? reply.send({ ...r.value, errores: r.value.errores.map((e) => ({ fila: e.fila, errores: e.errores.map((x) => ({ codigo: x.codigo, mensaje: x.mensaje })) })) }) : enviarError(reply, r.error);
    },
  );

  a.get(
    '/v1/pines/propuestas',
    {
      preHandler: guard('pines:revisar'),
      schema: {
        tags: ['pines'],
        summary: 'Propuestas de pin por estado (primero las que más se alejan del pin actual)',
        security: SEGURIDAD,
        querystring: z.object({ estado: z.enum(['pendiente', 'aceptada', 'rechazada', 'sin_local']).default('pendiente'), limite: z.coerce.number().int().min(1).max(500).optional() }),
        response: { 200: z.object({ propuestas: z.array(propuesta) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const lista = await casos.listarPropuestasPin(actor(req), req.query.estado, req.query.limite);
      return reply.send({ propuestas: lista.map((p) => ({ ...p, creadaEn: p.creadaEn.toISOString() })) });
    },
  );

  a.post(
    '/v1/pines/propuestas/:id/resolver',
    { preHandler: guard('pines:revisar'), schema: { tags: ['pines'], summary: 'Aceptar o rechazar una propuesta', security: SEGURIDAD, params: idParam, body: z.object({ accion: z.enum(['aceptar', 'rechazar']) }), response: { 204: z.null(), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.resolverPropuestaPin(actor(req), req.params.id, req.body.accion);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/archivos/url-subida',
    {
      preHandler: guard('archivos:subir'),
      schema: {
        tags: ['archivos'],
        summary: 'URL firmada para subir la foto de fachada directo a Storage (la API no recibe los bytes)',
        security: SEGURIDAD,
        body: z.object({ localId: z.uuid(), tipo: z.enum(['webp', 'jpeg']) }),
        response: { 200: z.object({ path: z.string(), url: z.string() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.solicitarUrlSubida(actor(req), req.body);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.put(
    '/v1/locales/:id/foto',
    { preHandler: guard('archivos:subir'), schema: { tags: ['archivos'], summary: 'Registrar la foto ya subida', security: SEGURIDAD, params: idParam, body: z.object({ path: z.string().max(300) }), response: { 204: z.null(), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.registrarFotoLocal(actor(req), req.params.id, req.body.path);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.delete(
    '/v1/locales/:id/foto',
    { preHandler: guard('clientes:escribir'), schema: { tags: ['archivos'], summary: 'Quitar la foto de la fachada del local (admin o despachador)', security: SEGURIDAD, params: idParam, response: { 204: z.null(), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.quitarFotoLocal(actor(req), req.params.id);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.get(
    '/v1/locales/:id/foto-url',
    { preHandler: guard('clientes:leer'), schema: { tags: ['archivos'], summary: 'URL firmada (5 minutos) para ver la foto', security: SEGURIDAD, params: idParam, response: { 200: z.object({ url: z.string(), expiraEnSegundos: z.number() }), ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.obtenerUrlFoto(actor(req), req.params.id);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/locales/:id/pin-desde-enlace',
    {
      preHandler: guard('pines:proponer'),
      schema: {
        tags: ['pines'],
        summary: 'Fijar el pin del local con la ubicación que mandó el vendedor (enlace de Google Maps o Waze, corto o largo, o coordenadas). Un pin validado por una persona no se pisa: queda como propuesta.',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ enlace: z.string().min(1).max(2000) }),
        response: { 200: z.object({ resultado: z.enum(['fijado', 'propuesto']), lat: z.number(), lng: z.number() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.fijarPinDesdeEnlace(actor(req), req.params.id, req.body.enlace);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.put(
    '/v1/locales/:id/pin/verificacion',
    {
      preHandler: guard('pines:revisar'),
      schema: {
        tags: ['pines'],
        summary: 'Verificar el pin de un local (admin o despachador): un pin verificado ya no se mueve solo con las entregas; con verificado=false vuelve a «por verificar» y se sigue ajustando',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ verificado: z.boolean() }),
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.verificarPin(actor(req), req.params.id, req.body.verificado);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  const estadoBusqueda = z.object({ sinPin: z.number(), enCola: z.number(), enMarcha: z.boolean() });

  a.post(
    '/v1/locales/buscar-pines',
    {
      preHandler: guard('pines:revisar'),
      schema: {
        tags: ['pines'],
        summary: 'Buscar en el mapa el pin de los locales que no tienen (por su dirección y comuna). Corre en segundo plano, de a una por segundo.',
        security: SEGURIDAD,
        response: { 202: estadoBusqueda.extend({ encolados: z.number() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => reply.code(202).send(await casos.buscarPinesPendientes(actor(req))),
  );

  a.get(
    '/v1/locales/buscar-pines',
    {
      preHandler: guard('pines:revisar'),
      schema: { tags: ['pines'], summary: 'Cuántos locales siguen sin pin y cuántos esperan en la cola de búsqueda', security: SEGURIDAD, response: { 200: estadoBusqueda, ...RESPUESTAS_ERROR } },
    },
    async (req, reply) => reply.send(await casos.estadoBusquedaPines(actor(req))),
  );
};
