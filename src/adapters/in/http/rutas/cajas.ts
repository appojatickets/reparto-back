import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';
const cantidad = z.number().min(0).max(1_000_000);
const actual = z.object({ bultos:cantidad.nullable().optional(), registrada:z.boolean(), cargadasCamion: cantidad, cargadasUsuario: cantidad, porCerrado: cantidad, rebajes: cantidad, rebajesCamion: cantidad.nullable(), revision: z.number().int(), cerrada: z.boolean() });
const fila = z.object({ kmCamion:z.number().optional(), bultosCamion:cantidad.nullable().optional(), jornadaId: z.string(), usuarioId: z.string(), usuario: z.string(), camionId: z.string(), camion: z.string(), fecha: z.string(), desde: z.string(), hasta: z.string().nullable(), cargadas: cantidad, porCerrado: cantidad, rebajes: cantidad, tarifa: z.number(), cerrada: z.boolean(), cargaId: z.string(), cargadasCamion: cantidad, rebajesCamion: cantidad.nullable(), km: z.number(), comunas: z.array(z.string()) });
export const rutasCajas = ({ app, casos, guard }: ContextoRutas): void => {
 const a = tipada(app);
 a.get('/v1/cajas', { preHandler: guard('clientes:leer'), schema: { tags: ['cajas'], security: SEGURIDAD, response: { 200: actual.nullable(), ...RESPUESTAS_ERROR } } }, async(req,reply) => reply.send(await casos.cajas.actual(actor(req))));
 a.put('/v1/cajas', { preHandler: guard('jornada:gestionar'), schema: { tags: ['cajas'], security: SEGURIDAD, body: z.object({ bultos:cantidad.optional(),cargadasCamion: cantidad, cargadasUsuario: cantidad, revision: z.number().int().min(0) }), response: { 200: actual.nullable(), ...RESPUESTAS_ERROR } } }, async(req,reply) => { const r=await casos.cajas.guardar(actor(req),req.body); return r.ok ? reply.send(r.value ?? null) : enviarError(reply,r.error); });
 a.post('/v1/cajas/cerrar', { preHandler: guard('jornada:gestionar'), schema: { tags: ['cajas'], security: SEGURIDAD, body: z.object({ porCerrado: cantidad, rebajes: cantidad, rebajesCamion: cantidad }), response: { 200: z.boolean(), ...RESPUESTAS_ERROR } } }, async(req,reply) => { const r=await casos.cajas.cerrar(actor(req),req.body); return r.ok ? reply.send(r.value) : enviarError(reply,r.error); });
 a.get('/v1/cajas/desempeno', { preHandler: guard('clientes:leer'), schema: { tags: ['cajas'], security: SEGURIDAD, querystring: z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }), response: { 200: z.array(fila), ...RESPUESTAS_ERROR } } }, async(req,reply) => reply.send((await casos.cajas.historial(actor(req),req.query.mes)).map(f => ({ ...f, comunas: [...f.comunas] }))));
};
