import type { EnlaceAbierto, ResolvedorEnlaces } from '../../../application/ports/out/enlaces.js';
import { esHostDeMapas, leerCoordenadaDeEnlace } from '../../../domain/valor/enlace-mapa.js';

const MAX_SALTOS = 5;
const ESPERA_MS = 6000;
/** De la página de un lugar solo interesa el comienzo (ahí están las metaetiquetas y el estado inicial). */
const MAX_CUERPO_CARACTERES = 400_000;
const NAVEGADOR = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
/** Solo las páginas de Google Maps se leen enteras; el resto de los hosts permitidos solo se siguen por sus redirecciones. */
const esPaginaDeGoogleMaps = (u: URL): boolean => /(^|\.)google\.(com|cl)$/i.test(u.hostname) && u.pathname.startsWith('/maps');

const leerComienzo = async (r: Response): Promise<string | undefined> => {
  try {
    return (await r.text()).slice(0, MAX_CUERPO_CARACTERES);
  } catch {
    return undefined;
  }
};

/**
 * Sigue a mano las redirecciones de un enlace corto de Google Maps o Waze hasta dar con una dirección que traiga el punto. Si la
 * dirección final es la página de un lugar de Google Maps y no trae el punto, devuelve también el comienzo de esa página (tope de
 * tamaño) para que se lea de ahí. Solo se visitan hosts de mapas (en cada salto) y hay tope de saltos, de tamaño y de tiempo: el
 * servidor no puede usarse para consultar direcciones internas ni ajenas.
 */
export const crearResolvedorEnlacesHttp = (buscar: typeof fetch = fetch): ResolvedorEnlaces => ({
  async resolver(url): Promise<EnlaceAbierto | undefined> {
    let actual = url;
    for (let salto = 0; salto < MAX_SALTOS; salto++) {
      let u: URL;
      try {
        u = new URL(actual);
      } catch {
        return undefined;
      }
      if (u.protocol !== 'https:' || !esHostDeMapas(u.hostname)) return undefined;
      if (leerCoordenadaDeEnlace(u.href)) return { url: u.href };
      let respuesta: Response;
      try {
        respuesta = await buscar(u.href, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(ESPERA_MS), headers: { 'user-agent': NAVEGADOR, 'accept-language': 'es-CL,es;q=0.9', accept: 'text/html' } });
      } catch {
        return undefined;
      }
      const destino = respuesta.headers.get('location');
      if (respuesta.status >= 300 && respuesta.status < 400 && destino) {
        void respuesta.body?.cancel().catch(() => undefined);
        actual = new URL(destino, u).href;
        continue;
      }
      if (respuesta.status === 200 && esPaginaDeGoogleMaps(u)) {
        const cuerpo = await leerComienzo(respuesta);
        return { url: u.href, ...(cuerpo ? { cuerpo } : {}) };
      }
      void respuesta.body?.cancel().catch(() => undefined);
      return undefined;
    }
    return undefined;
  },
});
