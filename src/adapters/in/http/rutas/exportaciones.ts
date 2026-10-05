import { z } from 'zod';
import { actor } from '../auth.js';
import { enviarError, RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const fila = z.object({
  localId: z.string(),
  clienteId: z.string(),
  razonSocial: z.string(),
  rut: z.string().optional(),
  giro: z.string().optional(),
  estadoCliente: z.enum(['nuevo', 'activo', 'inactivo', 'cerrado', 'archivado']),
  direccion: z.string(),
  comuna: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  pinEstado: z.enum(['pendiente', 'sugerido', 'validado']),
  pinFuente: z.enum(['geocodificador', 'manual', 'importado', 'aprendido', 'chofer', 'enlace']).optional(),
  pinConfianza: z.number().optional(),
  nota: z.string().optional(),
  tieneFoto: z.boolean(),
  creadoEn: z.string(),
});

export const rutasExportaciones = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/exportaciones/locales',
    {
      preHandler: guard('datos:exportar'),
      schema: {
        tags: ['exportaciones'],
        summary: 'Datos de los locales y sus clientes para exportar (solo admin). Filtros opcionales; la pantalla elige las columnas.',
        security: SEGURIDAD,
        querystring: z.object({
          comunas: z.string().max(2000).optional(),
          pin: z.enum(['con', 'sin', 'aproximado']).optional(),
          foto: z.enum(['con', 'sin']).optional(),
          texto: z.string().max(100).optional(),
        }),
        response: { 200: z.object({ total: z.number(), filas: z.array(fila) }), ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => {
      const comunas = req.query.comunas?.split(',').map((c) => c.trim()).filter((c) => c !== '');
      const r = await casos.exportarLocales(actor(req), { comunas, pin: req.query.pin, foto: req.query.foto, texto: req.query.texto });
      return r.ok ? reply.send({ total: r.value.total, filas: [...r.value.filas] }) : enviarError(reply, r.error);
    },
  );
};
