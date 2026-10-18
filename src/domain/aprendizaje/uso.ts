import { MIN_VISITAS_GPS_LOCAL, MIN_VISITAS_GPS_GENERAL } from './servicio-gps.js';
import type { ParametroAprendido } from './analisis.js';

/** Un valor aprendido con menos confianza que esto no se usa: el motor sigue con su valor de respaldo. */
export const CONFIANZA_MINIMA = 0.25;
const RITMO_ACOTADO = { min: 0.6, max: 2 } as const;
const SERVICIO_ACOTADO_MIN = { min: 2, max: 40 } as const;

/**
 * Con menos visitas medidas que esto, el tiempo de atención de un local no reemplaza al estándar (10 minutos). El tiempo general que se mide
 * (llegada → entrega) deja afuera estacionar y caminar, y quedaba muy por debajo de lo real: se vuelve a usar cuando haya más datos y mejor medida.
 */
export const MINIMO_MUESTRAS_SERVICIO_LOCAL = 10;

const acotar = (x: number, r: { readonly min: number; readonly max: number }): number => Math.min(r.max, Math.max(r.min, x));

export type AprendidoParaRuta = {
  /** Multiplica los tiempos de viaje: 1 = lo calculado; 1,2 = este camión demora 20 % más. */
  readonly ritmo: number;
  /** Minutos que se demora atender ese local, si se sabe con suficientes datos; si no, se usa el promedio GPS del camión/global o el estándar de 10 minutos. */
  readonly servicioMin: (localId: string) => number | undefined;
};

/** Qué de lo aprendido usa la ruta de un camión: su ritmo (o el general) y el tiempo de atención de cada local (o el general). */
export const aprendidoParaRuta = (parametros: readonly ParametroAprendido[], camionId: string): AprendidoParaRuta => {
  const buscar = (clave: ParametroAprendido['clave'], ambito: string): ParametroAprendido | undefined =>
    parametros.find((p) => p.clave === clave && p.ambito === ambito && p.confianza >= CONFIANZA_MINIMA);
  const ritmo = buscar('ritmo', `camion:${camionId}`) ?? buscar('ritmo', 'global');
  const porLocal = new Map(parametros.filter((p) => p.clave === 'servicio_min' && p.ambito.startsWith('local:') && p.confianza >= CONFIANZA_MINIMA && p.muestras >= MINIMO_MUESTRAS_SERVICIO_LOCAL).map((p) => [p.ambito.slice(6), p.valor]));
  const gpsLocal = new Map(parametros.filter((p) => p.clave === 'servicio_min' && p.ambito.startsWith('gps:local:') && p.confianza >= CONFIANZA_MINIMA && p.muestras >= MIN_VISITAS_GPS_LOCAL).map((p) => [p.ambito.slice(10), p.valor]));
  const gpsCamion = buscar('servicio_min', `gps:camion:${camionId}`);
  const gpsGlobal = buscar('servicio_min', 'gps:global');
  const general = [gpsCamion, gpsGlobal].find((p) => p !== undefined && p.muestras >= MIN_VISITAS_GPS_GENERAL);
  return {
    ritmo: ritmo ? acotar(ritmo.valor, RITMO_ACOTADO) : 1,
    servicioMin: (localId) => {
      const v = gpsLocal.get(localId) ?? porLocal.get(localId) ?? general?.valor;
      return v === undefined ? undefined : acotar(v, SERVICIO_ACOTADO_MIN);
    },
  };
};

export const SIN_APRENDIZAJE: AprendidoParaRuta = { ritmo: 1, servicioMin: () => undefined };
