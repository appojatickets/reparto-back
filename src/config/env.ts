import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  JOB_TOKEN: z.string().min(16),
  FRONT_ORIGIN: z.url(),
  MAIL_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export class InvalidEnvError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Variables de entorno inválidas: ${issues.join('; ')}`);
    this.name = 'InvalidEnvError';
  }
}

/** Valida las variables de entorno. Falla al arrancar si falta o sobra algo inválido. */
export const loadEnv = (source: Readonly<Record<string, string | undefined>>): Env => {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new InvalidEnvError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return parsed.data;
};
