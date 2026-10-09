import { z } from 'zod';
import { TIPOS_REPORTE_LOCAL } from '../../../../domain/entidades/reporte-local.js';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { idParam, SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const reporte = z.object({
  id: z.string(),
  tipo: z.enum(['foto', ...TIPOS_REPORTE_LOCAL]),
  localId: z.string(),
  razonSocial: z.string(),
  direccion: z.string(),
  comuna: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  motivo: z.string().optional(),
  detalle: z.string().optional(),
  sugerido: z.string().optional(),
  reportadoPor: z.string().optional(),
  reportadoEn: z.iso.datetime(),
  yaCambio: z.boolean(),
  subidaPor: z.string().optional(),
  subidaEn: z.iso.datetime().optional(),
});

export const rutasReportes = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.post(
    '/v1/locales/:id/reportes',
    {
      preHandler: guard('archivos:subir'),
      schema: {
        tags: ['reportes'],
        summary: 'Reportar el nombre o la ubicación (pin) de un local; el admin lo revisa. Reportar la ubicación saca al pin de «verificado». (La foto se reporta aparte.)',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ tipo: z.enum(TIPOS_REPORTE_LOCAL), detalle: z.string().max(200).optional(), sugerido: z.string().max(120).optional() }),
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.reportarLocal(actor(req), req.params.id, req.body);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );

  a.get(
    '/v1/reportes',
    {
      preHandler: guard('reportes:revisar'),
      schema: {
        tags: ['reportes'],
        summary: 'Todo lo reportado y sin resolver (fotos, nombres y ubicaciones), del más nuevo al más antiguo',
        security: SEGURIDAD,
        response: { 200: z.object({ total: z.number(), reportes: z.array(reporte) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.verReportes(actor(req));
      return reply.send({
        total: r.total,
        reportes: r.reportes.map(({ reportadoEn, subidaEn, ...x }) => ({ ...x, reportadoEn: reportadoEn.toISOString(), ...(subidaEn ? { subidaEn: subidaEn.toISOString() } : {}) })),
      });
    },
  );

  a.post(
    '/v1/reportes/:id/resolver',
    {
      preHandler: guard('reportes:revisar'),
      schema: {
        tags: ['reportes'],
        summary: 'Cerrar un reporte de nombre o ubicación: corregido, descartar o (ubicación) el pin está bien y queda verificado. Los de foto se cierran en /v1/fotos/reportes/:id/resolver',
        security: SEGURIDAD,
        params: idParam,
        body: z.object({ accion: z.enum(['verificar_pin', 'corregido', 'descartar']) }),
        response: { 204: z.null(), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const r = await casos.resolverReporteLocal(actor(req), req.params.id, req.body.accion);
      return r.ok ? reply.code(204).send(null) : enviarError(reply, r.error);
    },
  );
};
