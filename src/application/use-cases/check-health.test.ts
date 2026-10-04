import { describe, expect, it } from 'vitest';
import { err, ok } from '../../domain/shared/result.js';
import type { Clock } from '../ports/out/clock.js';
import type { DatabaseHealth } from '../ports/out/database-health.js';
import { checkHealth } from './check-health.js';

const clock: Clock = { now: () => new Date('2026-10-05T12:00:00.000Z') };

describe('checkHealth', () => {
  it('informa ok cuando la base responde', async () => {
    const db: DatabaseHealth = { ping: () => Promise.resolve(ok(undefined)) };
    const report = await checkHealth({ db, clock });
    expect(report).toEqual({ status: 'ok', database: 'ok', timestamp: '2026-10-05T12:00:00.000Z' });
  });

  it('informa degradado cuando la base falla, sin exponer el detalle', async () => {
    const db: DatabaseHealth = {
      ping: () => Promise.resolve(err({ kind: 'DATABASE_UNAVAILABLE', detail: 'password=secreto' })),
    };
    const report = await checkHealth({ db, clock });
    expect(report).toEqual({ status: 'degraded', database: 'error', timestamp: '2026-10-05T12:00:00.000Z' });
  });
});
