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
    expect(env.GEMINI_ENABLED).toBe(false);
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

it('interpreta la bandera de Gemini sin activar por error el texto false', () => {
  expect(loadEnv({ ...valid, GEMINI_ENABLED: 'false' }).GEMINI_ENABLED).toBe(false);
  expect(loadEnv({ ...valid, GEMINI_ENABLED: 'true' }).GEMINI_ENABLED).toBe(true);
  expect(() => loadEnv({ ...valid, GEMINI_ENABLED: 'si' })).toThrow(InvalidEnvError);
});

it('configura Gemini como ayuda opcional sin impedir que arranque la app sin clave', () => {
  expect(loadEnv(valid).GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
  expect(loadEnv(valid).GEMINI_DAILY_LIMIT).toBe(50);
  expect(loadEnv({ ...valid, GEMINI_API_KEY: '  ' }).GEMINI_API_KEY).toBeUndefined();
  expect(loadEnv({ ...valid, GEMINI_API_KEY: ' valor-prueba ', GEMINI_ENABLED: 'true' }).GEMINI_API_KEY).toBe('valor-prueba');
  expect(() => loadEnv({ ...valid, GEMINI_DAILY_LIMIT: '0' })).toThrow(InvalidEnvError);
});
