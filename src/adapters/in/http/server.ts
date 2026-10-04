import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { HealthReport } from '../../../application/use-cases/check-health.js';

export type HttpDeps = {
  readonly frontOrigin: string;
  readonly checkHealth: () => Promise<HealthReport>;
  readonly logger?: boolean;
};

const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['ok', 'error']),
  timestamp: z.iso.datetime(),
});

export const buildServer = async (deps: HttpDeps): Promise<FastifyInstance> => {
  const app = Fastify({ logger: deps.logger ?? false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: [deps.frontOrigin] });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: { info: { title: 'Reparto API', version: '0.1.0' } },
    transform: jsonSchemaTransform,
  });

  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/v1/health',
    {
      schema: {
        tags: ['sistema'],
        response: { 200: healthSchema, 503: healthSchema },
      },
    },
    async (_req, reply) => {
      const report = await deps.checkHealth();
      return reply.code(report.status === 'ok' ? 200 : 503).send(report);
    },
  );

  app.get('/openapi.json', { schema: { hide: true } }, () => app.swagger());

  return app;
};
