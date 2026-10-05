import type { ResolvedorEnlaces } from '../../../application/ports/out/enlaces.js';
import { esHostDeMapas, leerCoordenadaDeEnlace } from '../../../domain/valor/enlace-mapa.js';

const MAX_SALTOS = 5;
const ESPERA_MS = 4000;

/**
 * Sigue a mano las redirecciones de un enlace corto de Google Maps o Waze hasta dar con una dirección que traiga el punto.
 * Solo se visitan hosts de mapas (en cada salto), nunca se descarga el cuerpo y hay tope de saltos y de tiempo: el servidor no
 * puede usarse para consultar direcciones internas ni ajenas.
 */
export const crearResolvedorEnlacesHttp = (buscar: typeof fetch = fetch): ResolvedorEnlaces => ({
  async resolver(url) {
    let actual = url;
    for (let salto = 0; salto < MAX_SALTOS; salto++) {
      let u: URL;
      try {
        u = new URL(actual);
      } catch {
        return undefined;
      }
      if (u.protocol !== 'https:' || !esHostDeMapas(u.hostname)) return undefined;
      if (leerCoordenadaDeEnlace(u.href)) return u.href;
      let respuesta: Response;
      try {
        respuesta = await buscar(u.href, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(ESPERA_MS), headers: { 'user-agent': 'Mozilla/5.0 (compatible; reparto)' } });
      } catch {
        return undefined;
      }
      void respuesta.body?.cancel();
      const destino = respuesta.headers.get('location');
      if (respuesta.status < 300 || respuesta.status >= 400 || !destino) return undefined;
      actual = new URL(destino, u).href;
    }
    return undefined;
  },
});
