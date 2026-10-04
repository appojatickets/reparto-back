import type { Clock } from '../ports/out/clock.js';
import type { DatabaseHealth } from '../ports/out/database-health.js';

export type HealthReport = {
  readonly status: 'ok' | 'degraded';
  readonly database: 'ok' | 'error';
  readonly timestamp: string;
};

export type CheckHealthDeps = { readonly db: DatabaseHealth; readonly clock: Clock };

export const checkHealth = async ({ db, clock }: CheckHealthDeps): Promise<HealthReport> => {
  const result = await db.ping();
  const timestamp = clock.now().toISOString();
  return result.ok
    ? { status: 'ok', database: 'ok', timestamp }
    : { status: 'degraded', database: 'error', timestamp };
};
