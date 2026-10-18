import { mediana, type ParametroAprendido, type VisitaDeducida } from './analisis.js';
import { SERVICIO_POR_DEFECTO_MIN } from '../ruteo/parametros.js';

export const MIN_VISITAS_GPS_LOCAL = 3;
export const MIN_VISITAS_GPS_GENERAL = 5;
const K_RESPALDO = 4;

/** Solo permanencias asociadas a entregas confirmadas, nunca visitas cerradas o ambiguas. */
export const servicioGpsAprendido = (visitas: readonly VisitaDeducida[]): readonly ParametroAprendido[] => {
  const unicas = new Map([...visitas].sort((a, b) => a.llegada.getTime() - b.llegada.getTime()).map((v) => [v.facturaId, v]));
  const grupos = new Map<string, number[]>();
  for (const v of unicas.values()) {
    const minutos = (v.salida.getTime() - v.llegada.getTime()) / 60_000;
    if (!Number.isFinite(minutos) || minutos < 0.5 || minutos > 60) continue;
    for (const ambito of ['gps:global', `gps:camion:${v.camionId}`, `gps:local:${v.localId}`]) {
      const lista = grupos.get(ambito) ?? [];
      lista.push(minutos); grupos.set(ambito, lista);
    }
  }
  return [...grupos].flatMap(([ambito, minutos]) => {
    const local = ambito.startsWith('gps:local:');
    if (minutos.length < (local ? MIN_VISITAS_GPS_LOCAL : MIN_VISITAS_GPS_GENERAL)) return [];
    const centro = mediana(minutos);
    if (centro === undefined) return [];
    // El promedio general del camión puede mezclar locales distintos: introducirlo gradualmente.
    const valor = local ? centro : (minutos.length * centro + K_RESPALDO * SERVICIO_POR_DEFECTO_MIN) / (minutos.length + K_RESPALDO);
    return [{ clave: 'servicio_min' as const, ambito, valor: Math.round(Math.max(2, Math.min(40, valor)) * 100) / 100,
      muestras: minutos.length, confianza: Math.round(minutos.length / (minutos.length + K_RESPALDO) * 1000) / 1000 }];
  });
};
