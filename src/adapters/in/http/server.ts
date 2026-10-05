import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, hasZodFastifySchemaValidationErrors, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { crearGuard } from './auth.js';
import type { CasosDeUso } from './casos-de-uso.js';
import { rutasClientes } from './rutas/clientes.js';
import { rutasPinesYArchivos } from './rutas/pines-y-archivos.js';
import { rutasSesion } from './rutas/sesion.js';
import { rutasVendedores } from './rutas/vendedores.js';
import { rutasExportaciones } from './rutas/exportaciones.js';
import { rutasFotos } from './rutas/fotos.js';
import { rutasCamionesYFacturas } from './rutas/camiones-y-facturas.js';
import { rutasDelDia } from './rutas/rutas-del-dia.js';
import { rutasEntregas } from './rutas/entregas.js';
import { rutasJornada } from './rutas/jornada.js';
import { rutasHorarios } from './rutas/horarios.js';
import { rutasEmpresa } from './rutas/empresa.js';
import { rutasUsuarios } from './rutas/usuarios.js';

export type HttpDeps = {
  readonly frontOrigin: string;
  readonly casos: CasosDeUso;
  readonly logger?: boolean;
};

const estadoDe = (error: unknown): number => {
  const s = typeof error === 'object' && error !== null ? (error as { statusCode?: unknown }).statusCode : undefined;
  return typeof s === 'number' && s >= 400 && s < 600 ? s : 500;
};

const healthSchema = z.object({ status: z.enum(['ok', 'degraded']), database: z.enum(['ok', 'error']), timestamp: z.iso.datetime() });

export const buildServer = async (deps: HttpDeps): Promise<FastifyInstance> => {
  // trustProxy: detrás de Render, sin esto todas las peticiones parecen venir de la misma IP y el límite de tasa
  // (global y de login) castigaría a todos los usuarios juntos.
  const app = Fastify({ logger: deps.logger ?? false, trustProxy: true });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Forma única de error también para datos mal formados (zod) y para fallas inesperadas (sin filtrar detalles).
  app.setErrorHandler((error, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({ codigo: 'VALIDACION', mensaje: 'Los datos enviados no son válidos.', detalle: error.validation.map((v) => ({ campo: v.instancePath, mensaje: v.message })) });
    }
    const status = estadoDe(error);
    if (status >= 500) req.log.error({ err: error }, 'error inesperado');
    const mensaje = status >= 500 || !(error instanceof Error) ? 'Ocurrió un error inesperado.' : error.message;
    return reply.code(status).send({ codigo: status === 429 ? 'LIMITE_DE_PETICIONES' : status >= 500 ? 'ERROR_INTERNO' : 'PETICION_INVALIDA', mensaje });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ codigo: 'NO_ENCONTRADO', mensaje: 'La ruta no existe.' }));

  await app.register(cors, { origin: [deps.frontOrigin], methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Reparto API', version: '0.2.0' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    },
    transform: jsonSchemaTransform,
  });

  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    '/v1/health',
    { schema: { tags: ['sistema'], response: { 200: healthSchema, 503: healthSchema } } },
    async (_req, reply) => {
      const report = await deps.casos.checkHealth();
      return reply.code(report.status === 'ok' ? 200 : 503).send(report);
    },
  );

  const contexto = { app, casos: deps.casos, guard: crearGuard(deps.casos) };
  rutasSesion(contexto);
  rutasUsuarios(contexto);
  rutasClientes(contexto);
  rutasPinesYArchivos(contexto);
  rutasCamionesYFacturas(contexto);
  rutasVendedores(contexto);
  rutasExportaciones(contexto);
  rutasFotos(contexto);
  rutasEmpresa(contexto);
  rutasDelDia(contexto);
  rutasHorarios(contexto);
  rutasJornada(contexto);
  rutasEntregas(contexto);

  app.get('/openapi.json', { schema: { hide: true } }, () => app.swagger());
  return app;
};
