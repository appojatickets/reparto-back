import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const pinEstado = z.enum(['pendiente', 'sugerido', 'validado']);

const resultadoBusqueda = z.object({
  localId: z.string(),
  clienteId: z.string(),
  razonSocial: z.string(),
  direccion: z.string(),
  comuna: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  pinEstado,
  pinVerificado: z.boolean().optional(),
  fotoPath: z.string().optional(),
  fotoVerificada: z.boolean().optional(),
  streetviewRumbo: z.number().optional(),
  nota: z.string().optional(),
  score: z.number(),
});

const numeroOTexto = z.union([z.number(), z.string().max(40)]);
const filaCliente = z.object({
  rut: z.string().max(20).optional(),
  razonSocial: z.string().max(400).optional(),
  giro: z.string().max(200).optional(),
  direccion: z.string().max(600).optional(),
  comuna: z.string().max(100).optional(),
  lat: numeroOTexto.optional(),
  lng: numeroOTexto.optional(),
  nota: z.string().max(1000).optional(),
});
const errorFila = z.object({ fila: z.number(), errores: z.array(z.object({ codigo: z.string(), mensaje: z.string() })) });

export const rutasClientes = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/clientes/buscar',
    {
      preHandler: guard('clientes:leer'),
      schema: {
        tags: ['clientes'],
        summary: 'Autocompletado de clientes por razón social o dirección (tolera tildes y errores de dictado)',
        security: SEGURIDAD,
        querystring: z.object({ q: z.string().max(100), comuna: z.string().max(100).optional(), limite: z.coerce.number().int().min(1).max(20).optional() }),
        response: { 200: z.object({ resultados: z.array(resultadoBusqueda) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => reply.send({ resultados: [...(await casos.buscarClientes(actor(req), req.query))] }),
  );

  a.post(
    '/v1/clientes',
    {
      preHandler: guard('clientes:crear'),
      schema: {
        tags: ['clientes'],
        summary: 'Cliente nuevo con su primer local',
        security: SEGURIDAD,
        body: filaCliente,
        response: { 201: z.object({ clienteId: z.string(), localId: z.string(), existente: z.boolean() }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.crearClienteNuevo(actor(req), req.body);
      return r.ok ? reply.code(201).send(r.value) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/clientes/importaciones',
    {
      preHandler: guard('clientes:importar'),
      bodyLimit: 2 * 1024 * 1024,
      schema: {
        tags: ['clientes'],
        summary: 'Importar un lote (hasta 1.000 filas) de la planilla de clientes',
        security: SEGURIDAD,
        body: z.object({ filas: z.array(filaCliente).min(1).max(1000) }),
        response: {
          200: z.object({
            totalFilas: z.number(),
            validas: z.number(),
            errores: z.array(errorFila),
            resumen: z.object({ clientesCreados: z.number(), clientesActualizados: z.number(), localesCreados: z.number(), localesActualizados: z.number() }),
          }),
          ...RESPUESTAS_ERROR,
        },
      },
    },
    async (req, reply) => {
      const r = await casos.importarClientes(actor(req), req.body.filas);
      return r.ok ? reply.send({ ...r.value, errores: r.value.errores.map((e) => ({ fila: e.fila, errores: e.errores.map((x) => ({ codigo: x.codigo, mensaje: x.mensaje })) })) }) : enviarError(reply, r.error);
    },
  );

  const detalleLocal = z.object({
    id: z.string(),
    clienteId: z.string(),
    razonSocial: z.string(),
    rut: z.string().optional(),
    direccion: z.string(),
    comuna: z.string(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    pinEstado,
    pinFuente: z.enum(['geocodificador', 'manual', 'importado', 'aprendido', 'chofer', 'enlace']).optional(),
    pinVerificado: z.boolean(),
    pinVerificacion: z.enum(['persona', 'entregas']).optional(),
    /** Qué tan firme es el pin según las entregas (solo si el local tiene pin). */
    pinRespaldo: z.object({ nivel: z.enum(['verificado', 'respaldado', 'en_conflicto', 'sin_respaldo']), entregas: z.number(), dias: z.number(), distanciaM: z.number().optional() }).optional(),
    fotoPath: z.string().optional(),
    fotoVerificada: z.boolean().optional(),
    streetviewRumbo: z.number().optional(),
    nota: z.string().optional(),
  });

  a.get(
    '/v1/locales/:id',
    { preHandler: guard('clientes:leer'), schema: { tags: ['clientes'], summary: 'Detalle de un local', security: SEGURIDAD, params: idParam, response: { 200: detalleLocal, ...RESPUESTAS_ERROR } } },
    async (req, reply) => {
      const r = await casos.obtenerLocal(actor(req), req.params.id);
      return r.ok ? reply.send(r.value) : enviarError(reply, r.error);
    },
  );

  a.patch(
    '/v1/clientes/:id',
    {
      preHandler: guard('clientes:escribir'),
      schema: {
        tags: ['clientes'],
        summary: 'Corregir los datos del cliente: razón social, RUT y giro (RUT o giro vacíos los borran)',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ razonSocial: z.string().max(400).optional(), rut: z.string().max(40).optional(), giro: z.string().max(300).optional() }),
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.corregirCliente(actor(req), req.params.id, req.body);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.delete(
    '/v1/locales/:id',
    {
      preHandler: guard('locales:eliminar'),
      schema: {
        tags: ['clientes'],
        summary: 'Eliminar una dirección equivocada con sus facturas pendientes (y el cliente si se queda sin direcciones); con entregas hechas responde 409',
        security: SEGURIDAD,
        params: idParam,
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.eliminarLocal(actor(req), req.params.id);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  const localParaLista = z.object({
    localId: z.string(),
    clienteId: z.string(),
    razonSocial: z.string(),
    rut: z.string().optional(),
    giro: z.string().optional(),
    direccion: z.string(),
    comuna: z.string(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    pinFuente: z.string().optional(),
    pinVerificado: z.boolean(),
    pinVerificacion: z.enum(['persona', 'entregas']).optional(),
    nota: z.string().optional(),
    streetviewRumbo: z.number().optional(),
    tieneFoto: z.boolean(),
    entregas: z.number(),
  });

  a.get(
    '/v1/locales',
    {
      preHandler: guard('clientes:escribir'),
      schema: {
        tags: ['clientes'],
        summary: 'Locales con los datos de su cliente y cuántas entregas tiene: de una comuna o los que coinciden con un texto (razón social, RUT o dirección); primero los de pin por verificar',
        security: SEGURIDAD,
        querystring: z.object({ comuna: z.string().max(100).optional(), texto: z.string().max(100).optional(), limite: z.coerce.number().int().optional() }),
        response: { 200: z.object({ total: z.number(), locales: z.array(localParaLista) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.listarLocales(actor(req), { comuna: req.query.comuna, texto: req.query.texto }, req.query.limite);
      return reply.send({ total: r.total, locales: [...r.locales] });
    },
  );

  a.get(
    '/v1/locales/comunas',
    {
      preHandler: guard('clientes:escribir'),
      schema: {
        tags: ['clientes'],
        summary: 'Por comuna: cuántos locales hay, cuántos con pin verificado y cuántos sin pin',
        security: SEGURIDAD,
        response: { 200: z.object({ comunas: z.array(z.object({ comuna: z.string(), total: z.number(), verificados: z.number(), sinPin: z.number() })) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => reply.send({ comunas: [...(await casos.resumenComunas(actor(req)))] }),
  );

  a.patch(
    '/v1/locales/:id',
    {
      preHandler: guard('clientes:escribir'),
      schema: {
        tags: ['clientes'],
        summary: 'Dirección y comuna, nota, rumbo de Street View (solo la referencia) y pin del local',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ direccion: z.string().max(600).optional(), comuna: z.string().max(100).optional(), nota: z.string().max(1000).optional(), streetviewRumbo: z.number().optional(), lat: z.number().optional(), lng: z.number().optional() }),
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.actualizarLocal(actor(req), req.params.id, req.body);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );
};
