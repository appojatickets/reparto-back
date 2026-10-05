import type { ResultadoGeocodificar } from './geocodificar-local.js';

export type ColaGeocodificacion = {
  /** Agrega locales a la cola (sin repetir los que ya esperan). Devuelve cuántos agregó. */
  readonly encolar: (empresaId: string, localIds: readonly string[]) => number;
  readonly pendientes: () => number;
  readonly enMarcha: () => boolean;
  /** Se resuelve cuando la cola queda vacía (para pruebas y para esperar el final). */
  readonly terminada: () => Promise<void>;
};

/**
 * Cola en memoria que busca los pines de a uno, con una pausa entre consultas (el servicio gratuito acepta una por segundo).
 * No bloquea a quien encola: la ruta del chofer no espera la búsqueda. Si el servicio se cae o llega a su límite, se detiene y vacía la
 * cola (nada se pierde: los locales siguen sin pin y se vuelven a encolar la próxima vez que se pidan).
 */
export const crearColaGeocodificacion = ({
  geocodificar,
  esperar,
  pausaMs = 1100,
}: {
  geocodificar: (empresaId: string, localId: string) => Promise<ResultadoGeocodificar>;
  esperar: (ms: number) => Promise<void>;
  pausaMs?: number;
}): ColaGeocodificacion => {
  const espera: { empresaId: string; localId: string }[] = [];
  const claves = new Set<string>();
  let corriendo: Promise<void> | undefined;

  const procesar = async (): Promise<void> => {
    let primera = true;
    for (let item = espera.shift(); item !== undefined; item = espera.shift()) {
      claves.delete(`${item.empresaId}:${item.localId}`);
      if (!primera) await esperar(pausaMs);
      primera = false;
      let r: ResultadoGeocodificar;
      try {
        r = await geocodificar(item.empresaId, item.localId);
      } catch {
        r = 'detener';
      }
      if (r === 'detener') {
        espera.length = 0;
        claves.clear();
      }
    }
    corriendo = undefined;
  };

  return {
    encolar: (empresaId, localIds) => {
      let nuevos = 0;
      for (const localId of localIds) {
        const clave = `${empresaId}:${localId}`;
        if (claves.has(clave)) continue;
        claves.add(clave);
        espera.push({ empresaId, localId });
        nuevos++;
      }
      if (nuevos > 0 && corriendo === undefined) corriendo = procesar();
      return nuevos;
    },
    pendientes: () => espera.length,
    enMarcha: () => corriendo !== undefined,
    terminada: async () => {
      while (corriendo !== undefined) await corriendo;
    },
  };
};
