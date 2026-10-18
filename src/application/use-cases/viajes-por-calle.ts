import type { CacheDeViajes, ProveedorDeViajes, ViajeGuardado } from '../ports/out/viajes.js';

export type NodoDeViaje = { readonly id: string; readonly lat: number; readonly lng: number; readonly rol: 'origen' | 'parada' | 'deposito' };
export type ViajeMin = (desde: string, hasta: string) => number | undefined;

/** Coordenada redondeada a ~11 m: así dos pines casi iguales comparten lo consultado. */
export const claveDePunto = (p: { readonly lat: number; readonly lng: number }): string => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;

export type ViajesDeLaRuta = {
  readonly minutos: ViajeMin;
  /** Hay un servicio de rutas por calles configurado: los tiempos de la ruta ya son de manejar, no de línea recta. */
  readonly conCalles: boolean;
};

const SIN_VIAJES: ViajesDeLaRuta = { minutos: () => undefined, conCalles: false };

/**
 * Tiempos de manejar por calles entre las paradas, el depósito y el punto donde está el camión. Cada par se le pregunta al servicio de rutas
 * una sola vez y queda guardado (las calles no cambian cada día); solo se consulta lo que falta. Si no hay servicio configurado o falla, se
 * devuelve lo que haya guardado y el resto sigue en línea recta: nunca se bloquea la ruta.
 * El motor solo viaja desde el origen o una parada hacia una parada o el depósito, así que solo eso se pide.
 */
export const crearViajesPorCalle = ({ proveedor, cache }: { readonly proveedor: ProveedorDeViajes | undefined; readonly cache: CacheDeViajes }) =>
  async (nodos: readonly NodoDeViaje[]): Promise<ViajesDeLaRuta> => {
    if (!proveedor) return SIN_VIAJES;
    const claveDe = new Map(nodos.map((n) => [n.id, claveDePunto(n)]));
    const unicos = (rol: NodoDeViaje['rol'][]): { clave: string; lat: number; lng: number }[] => {
      const vistos = new Map<string, { clave: string; lat: number; lng: number }>();
      for (const n of nodos) if (rol.includes(n.rol)) vistos.set(claveDePunto(n), { clave: claveDePunto(n), lat: n.lat, lng: n.lng });
      return [...vistos.values()];
    };
    const paradas = unicos(['parada']);
    const deposito = unicos(['deposito']);
    const origen = unicos(['origen']);
    const destinos = [...paradas, ...deposito.filter((d) => !paradas.some((p) => p.clave === d.clave))];
    const fuentes = [...origen.filter((o) => !paradas.some((p) => p.clave === o.clave)), ...paradas];

    const conocidos = new Map<string, number>();
    const recordar = (v: ViajeGuardado): void => { conocidos.set(`${v.desde}|${v.hasta}`, v.segundos / 60); };
    (await cache.leer(fuentes.map((f) => f.clave), destinos.map((d) => d.clave)).catch((): readonly ViajeGuardado[] => [])).forEach(recordar);

    const faltan = (de: { clave: string }[], hacia: { clave: string }[]): boolean => de.some((d) => hacia.some((h) => d.clave !== h.clave && !conocidos.has(`${d.clave}|${h.clave}`)));
    const consultar = async (puntos: { clave: string; lat: number; lng: number }[], desde: number[], hacia: number[]): Promise<void> => {
      const m = await proveedor.matriz(puntos, desde, hacia);
      if (!m) return;
      const nuevos: ViajeGuardado[] = [];
      desde.forEach((i, fila) => {
        hacia.forEach((j, col) => {
          const de = puntos[i];
          const a = puntos[j];
          const segundos = m.segundos[fila]?.[col];
          const metros = m.metros[fila]?.[col];
          if (!de || !a || de.clave === a.clave || segundos === undefined || metros === undefined || !Number.isFinite(segundos) || !Number.isFinite(metros) || segundos < 0 || metros < 0) return;
          nuevos.push({ desde: de.clave, hasta: a.clave, segundos, metros });
        });
      });
      nuevos.forEach(recordar);
      if (nuevos.length > 0) await cache.guardar(nuevos).catch(() => undefined);
    };

    // Bloques acotados, secuenciales: nunca superar 3.500 pares ni disparar ráfagas.
    const porBloques = async (puntos: { clave: string; lat: number; lng: number }[], desde: number[], hacia: number[]): Promise<void> => {
      const ancho = Math.min(hacia.length, 50);
      if (ancho === 0) return;
      const alto = Math.max(1, Math.floor(3500 / ancho));
      for (let i = 0; i < desde.length; i += alto) {
        for (let j = 0; j < hacia.length; j += ancho) {
          const filas = desde.slice(i, i + alto);
          const columnas = hacia.slice(j, j + ancho);
          if (!filas.some((f) => columnas.some((h) => {
            const de = puntos[f]; const a = puntos[h];
            return de && a && de.clave !== a.clave && !conocidos.has(`${de.clave}|${a.clave}`);
          }))) continue;
          await consultar(puntos, filas, columnas).catch(() => undefined);
        }
      }
    };
    if (paradas.length > 0 && faltan(paradas, destinos)) {
      await porBloques(destinos, paradas.map((p) => destinos.findIndex((d) => d.clave === p.clave)), destinos.map((_, i) => i));
    }
    const soloOrigen = origen.filter((o) => !paradas.some((p) => p.clave === o.clave));
    if (soloOrigen.length > 0 && faltan(soloOrigen, destinos)) {
      await porBloques([...soloOrigen, ...destinos], soloOrigen.map((_, i) => i), destinos.map((_, i) => soloOrigen.length + i));
    }

    return {
      conCalles: conocidos.size > 0,
      minutos: (desde, hasta) => {
        const a = claveDe.get(desde);
        const b = claveDe.get(hasta);
        if (a === undefined || b === undefined) return undefined;
        return a === b ? 0 : conocidos.get(`${a}|${b}`);
      },
    };
  };

export type ViajesPorCalle = ReturnType<typeof crearViajesPorCalle>;
