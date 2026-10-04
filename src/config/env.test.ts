import { describe, expect, it } from 'vitest';
import { InvalidEnvError, loadEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@host:6543/db',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  JOB_TOKEN: 'a-very-long-job-token',
  FRONT_ORIGIN: 'https://reparto.example.com',
};

describe('loadEnv', () => {
  it('aplica valores por defecto', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.AUTH_EMAIL_DOMAIN).toBe('usuarios.reparto.test');
    expect(env.SUPABASE_ANON_KEY).toBeUndefined();
  });

  it('rechaza un dominio de correo con caracteres inválidos', () => {
    expect(() => loadEnv({ ...valid, AUTH_EMAIL_DOMAIN: 'Mal Dominio!' })).toThrow(InvalidEnvError);
    expect(loadEnv({ ...valid, AUTH_EMAIL_DOMAIN: 'mi.empresa.cl' }).AUTH_EMAIL_DOMAIN).toBe('mi.empresa.cl');
  });

  it('falla indicando las variables faltantes', () => {
    expect(() => loadEnv({})).toThrow(InvalidEnvError);
    try {
      loadEnv({ ...valid, JOB_TOKEN: 'corto' });
    } catch (e) {
      expect((e as InvalidEnvError).issues.join()).toContain('JOB_TOKEN');
    }
  });
});
