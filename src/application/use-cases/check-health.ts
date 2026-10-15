import type { Clock } from '../ports/out/clock.js';
import type { DatabaseHealth } from '../ports/out/database-health.js';

export type HealthReport = {
  readonly status: 'ok' | 'degraded';
  readonly database: 'ok' | 'error';
  readonly timestamp: string;
  /** El commit que está corriendo (para saber si el servidor ya tiene lo último publicado). */
  readonly version?: string;
};

export type CheckHealthDeps = { readonly db: DatabaseHealth; readonly clock: Clock; readonly version?: string };

export const checkHealth = async ({ db, clock, version }: CheckHealthDeps): Promise<HealthReport> => {
  const result = await db.ping();
  const timestamp = clock.now().toISOString();
  const extra = version !== undefined ? { version } : {};
  return result.ok
    ? { status: 'ok', database: 'ok', timestamp, ...extra }
    : { status: 'degraded', database: 'error', timestamp, ...extra };
};
