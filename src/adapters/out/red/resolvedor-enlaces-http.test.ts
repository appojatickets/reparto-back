import { describe, expect, it, vi } from 'vitest';
import { crearResolvedorEnlacesHttp } from './resolvedor-enlaces-http.js';

const redireccion = (destino: string) => Promise.resolve(new Response(null, { status: 302, headers: { location: destino } }));
const LARGA = 'https://www.google.com/maps/place/X/@-33.5972,-70.7019,17z';

describe('resolvedor de enlaces cortos', () => {
  it('sigue las redirecciones hasta una dirección con coordenadas', async () => {
    const buscar = vi.fn()
      .mockImplementationOnce(() => redireccion('https://goo.gl/maps/otro'))
      .mockImplementationOnce(() => redireccion(LARGA));
    const r = await crearResolvedorEnlacesHttp(buscar).resolver('https://maps.app.goo.gl/AbC');
    expect(r).toBe(LARGA);
    expect(buscar).toHaveBeenCalledTimes(2);
    expect(buscar.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('no visita un host que no es de mapas, ni al empezar ni a mitad de camino', async () => {
    const buscar = vi.fn(() => redireccion('http://169.254.169.254/latest/meta-data'));
    const resolvedor = crearResolvedorEnlacesHttp(buscar);
    expect(await resolvedor.resolver('https://evil.example.com/x')).toBeUndefined();
    expect(buscar).not.toHaveBeenCalled();
    expect(await resolvedor.resolver('https://maps.app.goo.gl/AbC')).toBeUndefined();
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('se rinde con muchos saltos, con una respuesta sin redirección o si la red falla', async () => {
    const infinito = vi.fn(() => redireccion('https://goo.gl/maps/otro'));
    expect(await crearResolvedorEnlacesHttp(infinito as unknown as typeof fetch).resolver('https://maps.app.goo.gl/a')).toBeUndefined();
    expect(infinito).toHaveBeenCalledTimes(5);
    const ok200 = vi.fn(() => Promise.resolve(new Response('hola', { status: 200 })));
    expect(await crearResolvedorEnlacesHttp(ok200 as unknown as typeof fetch).resolver('https://maps.app.goo.gl/a')).toBeUndefined();
    const roto = vi.fn(() => Promise.reject(new Error('sin red')));
    expect(await crearResolvedorEnlacesHttp(roto as unknown as typeof fetch).resolver('https://maps.app.goo.gl/a')).toBeUndefined();
  });
});
