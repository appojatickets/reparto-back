import { checkHealth } from './application/use-cases/check-health.js';
import { buildServer } from './adapters/in/http/server.js';
import { createDb } from './adapters/out/postgres/client.js';
import { PostgresDatabaseHealth } from './adapters/out/postgres/database-health.js';
import { loadEnv } from './config/env.js';

const env = loadEnv(process.env);
const db = createDb(env.DATABASE_URL);
const dbHealth = new PostgresDatabaseHealth(db);
const clock = { now: () => new Date() };

const app = await buildServer({
  frontOrigin: env.FRONT_ORIGIN,
  checkHealth: () => checkHealth({ db: dbHealth, clock }),
  logger: true,
});

const shutdown = async (): Promise<void> => {
  await app.close();
  await db.destroy();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: env.PORT, host: '0.0.0.0' });
