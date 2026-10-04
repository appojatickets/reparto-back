import { err, ok, type Result } from '../../../domain/shared/result.js';
import type { AlmacenArchivos, ErrorAlmacen } from '../../../application/ports/out/archivos.js';
import { cabecerasDeServicio, llamarJson, type Fetch } from './cabeceras.js';

export const BUCKET_FOTOS = 'fotos';

export type ConfigAlmacen = { readonly urlBase: string; readonly claveServicio: string; readonly bucket?: string; readonly fetch?: Fetch };

const codificarPath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

/** Storage de Supabase: la API pide URLs firmadas con la clave de servicio; los bytes viajan directo navegador ↔ Storage. */
export class AlmacenSupabase implements AlmacenArchivos {
  private readonly fetchFn: Fetch;
  private readonly bucket: string;
  private readonly base: string;

  constructor(private readonly cfg: ConfigAlmacen) {
    this.fetchFn = cfg.fetch ?? globalThis.fetch;
    this.bucket = cfg.bucket ?? BUCKET_FOTOS;
    this.base = `${cfg.urlBase.replace(/\/$/, '')}/storage/v1`;
  }

  private async firmar(ruta: string, cuerpo: object | undefined, campo: 'url' | 'signedURL'): Promise<Result<{ url: string }, ErrorAlmacen>> {
    try {
      const r = await llamarJson(this.fetchFn, `${this.base}${ruta}`, {
        method: 'POST',
        headers: { ...cabecerasDeServicio(this.cfg.claveServicio), 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo ?? {}),
      });
      const relativa = r.cuerpo[campo];
      if (r.status < 300 && typeof relativa === 'string') {
        return ok({ url: relativa.startsWith('http') ? relativa : `${this.base}${relativa}` });
      }
      return err({ detalle: `HTTP ${r.status}` });
    } catch (e) {
      return err({ detalle: e instanceof Error ? e.message : 'error de red' });
    }
  }

  crearUrlSubida(path: string): Promise<Result<{ url: string }, ErrorAlmacen>> {
    return this.firmar(`/object/upload/sign/${this.bucket}/${codificarPath(path)}`, undefined, 'url');
  }

  crearUrlLectura(path: string, expiraEnSegundos: number): Promise<Result<{ url: string }, ErrorAlmacen>> {
    return this.firmar(`/object/sign/${this.bucket}/${codificarPath(path)}`, { expiresIn: expiraEnSegundos }, 'signedURL');
  }
}
