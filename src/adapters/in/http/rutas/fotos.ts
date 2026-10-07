import { z } from 'zod';
import { MOTIVOS_REPORTE_FOTO } from '../../../../domain/entidades/foto-reporte.js';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const motivo = z.enum(MOTIVOS_REPORTE_FOTO);

const fotoSubida = z.object({
  localId: z.string(),
  fotoPath: z.string(),
  razonSocial: z.string(),
  direccion: z.string(),
  comuna: z.string(),
  subidaPor: z.string().optional(),
  subidaEn: z.string().optional(),
});

export const rutasFotos = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.post(
    '/v1/locales/:id/foto/reportar',
    {
      preHandler: guard('archivos:subir'),
      schema: {
        tags: ['archivos'],
        summary: 'Reportar la foto de un local (mal tomada: no es la fachada, se ven personas, borrosa…); el admin la revisa',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ motivo, detalle: z.string().max(200).optional() }),
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.reportarFoto(actor(req), req.params.id, req.body);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.get(
    '/v1/fotos/revision',
    {
      preHandler: guard('fotos:revisar'),
      schema: {
        tags: ['archivos'],
        summary: 'Fotos para revisar (solo admin): las reportadas, las que faltan por verificar y las ya verificadas, con quién y cuándo',
        security: SEGURIDAD,
        response: {
          200: z.object({
            reportadas: z.array(
              z.object({
                id: z.string(),
                localId: z.string(),
                razonSocial: z.string(),
                direccion: z.string(),
                comuna: z.string(),
                motivo,
                detalle: z.string().optional(),
                reportadoPor: z.string().optional(),
                reportadoEn: z.string(),
                subidaPor: z.string().optional(),
                subidaEn: z.string().optional(),
              }),
            ),
            porVerificar: z.array(fotoSubida),
            verificadas: z.array(fotoSubida.extend({ verificadaPor: z.string().optional(), verificadaEn: z.string() })),
          }),
          ...RESPUESTAS_ERROR,
        },
      },
    },
    async (req, reply) => {
      const r = await casos.fotosParaRevision(actor(req));
      return reply.send({
        reportadas: r.reportadas.map(({ reportadoEn, subidaEn, ...x }) => ({ ...x, reportadoEn: reportadoEn.toISOString(), ...(subidaEn ? { subidaEn: subidaEn.toISOString() } : {}) })),
        porVerificar: r.porVerificar.map(({ subidaEn, ...x }) => ({ ...x, ...(subidaEn ? { subidaEn: subidaEn.toISOString() } : {}) })),
        verificadas: r.verificadas.map(({ subidaEn, verificadaEn, ...x }) => ({ ...x, verificadaEn: verificadaEn.toISOString(), ...(subidaEn ? { subidaEn: subidaEn.toISOString() } : {}) })),
      });
    },
  );

  a.put(
    '/v1/locales/:id/foto/verificacion',
    {
      preHandler: guard('fotos:revisar'),
      schema: {
        tags: ['archivos'],
        summary: 'Verificar la foto de un local (solo admin): sale de «por verificar» y pasa a «verificadas»; con verificada=false vuelve. Se indica la foto vista para no verificar otra que la cambiaron',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ fotoPath: z.string().max(300), verificada: z.boolean() }),
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.verificarFoto(actor(req), req.params.id, req.body);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.post(
    '/v1/fotos/reportes/:id/resolver',
    {
      preHandler: guard('fotos:revisar'),
      schema: {
        tags: ['archivos'],
        summary: 'Decidir sobre un reporte de foto (solo admin): eliminar la foto o dejarla',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ accion: z.enum(['eliminar', 'descartar']) }),
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.resolverReporteFoto(actor(req), req.params.id, req.body.accion);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );
};
