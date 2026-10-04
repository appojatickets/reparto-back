/**
 * Supabase tiene dos formatos de clave de servicio. La nueva (`sb_secret_…`) NO es un JWT: va solo en `apikey` y el
 * gateway la traduce. La antigua (`service_role`, un JWT) se manda también como Bearer. Se detecta por el prefijo.
 */
export const cabecerasDeServicio = (claveServicio: string): Record<string, string> =>
  claveServicio.startsWith('sb_') ? { apikey: claveServicio } : { apikey: claveServicio, authorization: `Bearer ${claveServicio}` };

export type Fetch = typeof globalThis.fetch;

export const TIMEOUT_MS = 10_000;

export type RespuestaJson = { readonly status: number; readonly cuerpo: Record<string, unknown> };

/** Llama y devuelve estado + JSON (objeto vacío si no hay cuerpo). Lanza si la red falla o se agota el tiempo. */
export const llamarJson = async (fetchFn: Fetch, url: string, init: RequestInit): Promise<RespuestaJson> => {
  const r = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const texto = await r.text();
  let cuerpo: Record<string, unknown> = {};
  try {
    const parseado: unknown = texto === '' ? {} : JSON.parse(texto);
    if (typeof parseado === 'object' && parseado !== null && !Array.isArray(parseado)) cuerpo = parseado as Record<string, unknown>;
  } catch {
    // cuerpo no JSON (p. ej. página de error de un proxy): se trata como vacío
  }
  return { status: r.status, cuerpo };
};
