import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

const report = (status: 'ok' | 'degraded') => ({
  status,
  database: status === 'ok' ? ('ok' as const) : ('error' as const),
  timestamp: '2026-10-05T12:00:00.000Z',
});

describe('HTTP /v1/health', () => {
  it('responde 200 cuando todo está ok', async () => {
    const app = await buildServer({ frontOrigin: 'https://front.test', checkHealth: () => Promise.resolve(report('ok')) });
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(report('ok'));
  });

  it('responde 503 cuando la base está caída', async () => {
    const app = await buildServer({ frontOrigin: 'https://front.test', checkHealth: () => Promise.resolve(report('degraded')) });
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(503);
  });

  it('CORS solo permite el origen del front', async () => {
    const app = await buildServer({ frontOrigin: 'https://front.test', checkHealth: () => Promise.resolve(report('ok')) });
    const res = await app.inject({ method: 'GET', url: '/v1/health', headers: { origin: 'https://front.test' } });
    expect(res.headers['access-control-allow-origin']).toBe('https://front.test');
    const other = await app.inject({ method: 'GET', url: '/v1/health', headers: { origin: 'https://evil.test' } });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('publica /openapi.json con la ruta de health', async () => {
    const app = await buildServer({ frontOrigin: 'https://front.test', checkHealth: () => Promise.resolve(report('ok')) });
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json<{ paths: object }>().paths)).toContain('/v1/health');
  });
});
