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
    expect(r).toEqual({ url: LARGA });
    expect(buscar).toHaveBeenCalledTimes(2);
    expect(buscar.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('si llega a la página de un lugar de Google Maps sin coordenadas en la dirección, devuelve el comienzo de esa página para leerlas de ahí', async () => {
    const PAGINA = 'https://www.google.com/maps/place/Los+Tilos+265/data=!4m2!3m1!1s0x9662d:0xabc';
    const html = '<meta content="https://maps.google.com/maps/api/staticmap?center=-33.6102%2C-70.5758">';
    const buscar = vi.fn()
      .mockImplementationOnce(() => redireccion(PAGINA))
      .mockImplementationOnce(() => Promise.resolve(new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })));
    const r = await crearResolvedorEnlacesHttp(buscar).resolver('https://maps.app.goo.gl/tQsDTWhhRh9eyaTC8');
    expect(r).toEqual({ url: PAGINA, cuerpo: html });
    const cabeceras = (buscar.mock.calls[1]?.[1] as { headers: Record<string, string> } | undefined)?.headers;
    expect(cabeceras?.['user-agent']).toContain('Chrome');
  });

  it('no baja más que un tope de la página', async () => {
    const enorme = 'a'.repeat(900_000);
    const buscar = vi.fn(() => Promise.resolve(new Response(enorme, { status: 200 })));
    const r = await crearResolvedorEnlacesHttp(buscar).resolver('https://www.google.com/maps/place/X/data=!1s0x1');
    expect(r?.cuerpo?.length).toBeLessThan(500_000);
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
    expect(await crearResolvedorEnlacesHttp(ok200 as unknown as typeof fetch).resolver('https://maps.app.goo.gl/a')).toBeUndefined(); // un 200 fuera de la página de un lugar no se lee
    const roto = vi.fn(() => Promise.reject(new Error('sin red')));
    expect(await crearResolvedorEnlacesHttp(roto as unknown as typeof fetch).resolver('https://maps.app.goo.gl/a')).toBeUndefined();
  });
});
