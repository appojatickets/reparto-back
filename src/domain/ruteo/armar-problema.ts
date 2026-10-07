import { resolverHorario, ventanasParaRuta, type HorarioLocal } from '../entidades/horario.js';
import type { Fecha } from '../shared/fechas.js';
import { diaDeSemana } from '../shared/fechas.js';
import type { Coordenada } from '../valor/coordenada.js';
import { EPS_LLEGADA_CALIBRADO, PARAMETROS_POR_DEFECTO, SERVICIO_POR_DEFECTO_MIN } from './parametros.js';
import { crearTiemposConViajes, crearTiemposHaversine, DEPOSITO, ORIGEN } from './tiempos.js';
import type { ParadaRuta, ProblemaRuta } from './tipos.js';

/** Una factura por entregar, ya con lo que el motor necesita saber del local. */
export type EntradaParada = {
  readonly id: string;
  readonly nombre: string;
  readonly comuna?: string;
  /** Pin del local. Sin pin no se puede ruteear: la factura se informa aparte, no se descarta en silencio. */
  readonly coordenada?: Coordenada;
  readonly horarios: readonly HorarioLocal[];
  readonly antesDeMin?: number;
  readonly urgente: boolean;
  readonly servicioMin?: number;
};

export type DatosProblema = {
  readonly fecha: Fecha;
  readonly deposito: Coordenada;
  /** Dónde está el camión ahora (última posición informada). Si no se indica, parte del depósito. Siempre termina en el depósito. */
  readonly origen?: Coordenada;
  readonly salida: number;
  readonly horaLimiteRegresoMin: number;
  readonly entradas: readonly EntradaParada[];
  readonly fijas?: readonly string[];
  /** Cuánto demora este camión frente a lo calculado (lo aprendido de sus rutas reales); 1 si no se sabe. */
  readonly ritmo?: number;
  /** Minutos reales de manejar entre dos nodos (ids de parada, `ORIGEN`, `DEPOSITO`), si se conocen: reemplazan al cálculo en línea recta. */
  readonly viajeMin?: (desde: string, hasta: string) => number | undefined;
};

/**
 * Arma el problema de UN camión para un día: resuelve el horario de cada local según el día de la semana y la condición
 * «antes de» de la factura, y calcula los tiempos de viaje. Lo que no tiene pin sale en `sinPin`.
 */
export const armarProblema = (d: DatosProblema): { readonly problema: ProblemaRuta; readonly sinPin: readonly EntradaParada[] } => {
  const dia = diaDeSemana(d.fecha);
  const sinPin: EntradaParada[] = [];
  const paradas: ParadaRuta[] = [];
  const coordenadas = new Map<string, Coordenada>([[ORIGEN, d.origen ?? d.deposito], [DEPOSITO, d.deposito]]);

  for (const e of d.entradas) {
    if (!e.coordenada) {
      sinPin.push(e);
      continue;
    }
    coordenadas.set(e.id, e.coordenada);
    const resolucion = resolverHorario(e.horarios, dia, { ...(e.antesDeMin !== undefined ? { antesDeMin: e.antesDeMin } : {}), prioridad: e.urgente });
    paradas.push({
      id: e.id,
      nombre: e.nombre,
      ...(e.comuna !== undefined ? { comuna: e.comuna } : {}),
      ventanas: ventanasParaRuta(resolucion),
      servicioMin: e.servicioMin ?? SERVICIO_POR_DEFECTO_MIN,
      prioridad: e.urgente,
    });
  }

  const ids = new Set(paradas.map((p) => p.id));
  return {
    sinPin,
    problema: {
      salida: d.salida,
      paradas,
      fijas: (d.fijas ?? []).filter((id) => ids.has(id)),
      tiempos: d.viajeMin ? crearTiemposConViajes(crearTiemposHaversine(coordenadas), d.viajeMin) : crearTiemposHaversine(coordenadas),
      ritmo: d.ritmo ?? 1,
      parametros: { ...PARAMETROS_POR_DEFECTO, epsLlegada: EPS_LLEGADA_CALIBRADO, horaLimiteRegresoMin: d.horaLimiteRegresoMin },
    },
  };
};
