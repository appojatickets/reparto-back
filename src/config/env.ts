import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  JOB_TOKEN: z.string().min(16),
  FRONT_ORIGIN: z.url(),
  /** Clave publishable/anon de Supabase: con ella se inicia sesión. Si falta, se usa la de servicio. */
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  /** Dominio de los correos sintéticos de las cuentas (`jperez@<dominio>`); nunca se envía un correo. */
  AUTH_EMAIL_DOMAIN: z.string().min(3).regex(/^[a-z0-9.-]+$/).default('usuarios.reparto.test'),
  MAIL_API_KEY: z.string().optional(),
  /** Identifica a la aplicación ante el servicio gratuito de mapas (Nominatim lo exige). Conviene incluir un correo o la URL del sitio. */
  /** Clave de OpenRouteService (plan gratuito): con ella la ruta usa tiempos de manejar por calles. Si falta, la ruta mide en línea recta. */
  ORS_API_KEY: z.string().min(10).optional(),
  GEOCODER_USER_AGENT: z.string().min(8).default('reparto-api/1.0 (+https://reparto-front.vercel.app)'),
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
