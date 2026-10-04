import { sql } from 'kysely';
import { err, ok, type Result } from '../../../domain/shared/result.js';
import type { DatabaseHealth, DatabaseUnavailable } from '../../../application/ports/out/database-health.js';
import type { Db } from './client.js';

export class PostgresDatabaseHealth implements DatabaseHealth {
  constructor(private readonly db: Db) {}

  async ping(): Promise<Result<void, DatabaseUnavailable>> {
    try {
      await sql`select 1`.execute(this.db);
      return ok(undefined);
    } catch (e) {
      return err({ kind: 'DATABASE_UNAVAILABLE', detail: e instanceof Error ? e.message : 'unknown' });
    }
  }
}
