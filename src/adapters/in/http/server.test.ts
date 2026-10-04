import { describe, expect, it } from 'vitest';
import { casosVacios } from './casos-vacios.js';
import { buildServer } from './server.js';

const report = (status: 'ok' | 'degraded') => ({ status, database: status === 'ok' ? ('ok' as const) : ('error' as const), timestamp: '2026-10-05T12:00:00.000Z' });
const servidor = (status: 'ok' | 'degraded' = 'ok') => buildServer({ frontOrigin: 'https://front.test', casos: { ...casosVacios(), checkHealth: () => Promise.resolve(report(status)) } });

describe('HTTP /v1/health', () => {
  it('responde 200 cuando todo está ok y 503 cuando la base está caída', async () => {
    const ok = await (await servidor()).inject({ method: 'GET', url: '/v1/health' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual(report('ok'));
    expect((await (await servidor('degraded')).inject({ method: 'GET', url: '/v1/health' })).statusCode).toBe(503);
  });

  it('CORS solo permite el origen del front', async () => {
    const app = await servidor();
    const bueno = await app.inject({ method: 'GET', url: '/v1/health', headers: { origin: 'https://front.test' } });
    expect(bueno.headers['access-control-allow-origin']).toBe('https://front.test');
    const malo = await app.inject({ method: 'GET', url: '/v1/health', headers: { origin: 'https://evil.test' } });
    expect(malo.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('el preflight de PATCH y de Authorization está permitido solo para el front', async () => {
    const app = await servidor();
    const r = await app.inject({ method: 'OPTIONS', url: '/v1/usuarios/x', headers: { origin: 'https://front.test', 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'authorization,content-type' } });
    expect(r.statusCode).toBe(204);
    expect(r.headers['access-control-allow-methods']).toContain('PATCH');
  });

  it('publica /openapi.json con las rutas, el esquema Bearer y las rutas protegidas marcadas', async () => {
    const res = await (await servidor()).inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json<{ paths: Record<string, Record<string, { security?: unknown }>>; components: { securitySchemes: object } }>();
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/v1/health', '/v1/auth/login', '/v1/me', '/v1/clientes/buscar', '/v1/clientes/importaciones', '/v1/usuarios', '/v1/archivos/url-subida', '/v1/pines/propuestas']));
    expect(doc.components.securitySchemes).toHaveProperty('bearerAuth');
    expect(doc.paths['/v1/usuarios']?.['get']?.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.paths['/v1/auth/login']?.['post']?.security).toBeUndefined();
  });

  it('una falla inesperada responde 500 con forma estándar y sin filtrar el detalle', async () => {
    const app = await buildServer({ frontOrigin: 'https://front.test', casos: { ...casosVacios(), checkHealth: () => Promise.reject(new Error('password=secreto')) } });
    const r = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(r.statusCode).toBe(500);
    expect(r.json()).toEqual({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' });
  });

  it('una ruta inexistente responde 404 con forma estándar', async () => {
    const r = await (await servidor()).inject({ method: 'GET', url: '/v1/no-existe' });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ codigo: 'NO_ENCONTRADO', mensaje: 'La ruta no existe.' });
  });
});
