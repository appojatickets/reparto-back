import type { Result } from '../../../domain/result.js';

export type DatabaseUnavailable = { readonly kind: 'DATABASE_UNAVAILABLE'; readonly detail: string };

export interface DatabaseHealth {
  /** Ejecuta un `select 1` contra la base de datos. */
  ping(): Promise<Result<void, DatabaseUnavailable>>;
}
