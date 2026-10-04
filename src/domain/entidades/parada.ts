import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import type { CondicionDia } from './horario.js';

export type EstadoParada = 'pendiente' | 'entregada' | 'parcial' | 'no_pudo' | 'quitada';
export type EventoParada = 'ENTREGADO' | 'PARCIAL' | 'NO_PUDE' | 'QUITADA' | 'DESHECHO';

export type Parada = {
  readonly id: string;
  readonly localId: string;
  readonly folio?: string;
  readonly estado: EstadoParada;
  readonly ordenPlan: number;
  readonly ordenReal?: number;
  readonly etaPlanMin?: number;
  readonly condicion?: CondicionDia;
  readonly nota?: string;
};

const DESTINO: Record<Exclude<EventoParada, 'DESHECHO'>, EstadoParada> = {
  ENTREGADO: 'entregada',
  PARCIAL: 'parcial',
  NO_PUDE: 'no_pudo',
  QUITADA: 'quitada',
};

/** Una parada se marca una sola vez; para corregir se usa DESHECHO (10 s en la app), que la devuelve a pendiente. */
export const transicionarParada = (estado: EstadoParada, evento: EventoParada): Result<EstadoParada, ErrorDominio> => {
  if (evento === 'DESHECHO') {
    return estado === 'pendiente' ? invalida(estado, evento) : ok('pendiente');
  }
  return estado === 'pendiente' ? ok(DESTINO[evento]) : invalida(estado, evento);
};

const invalida = (estado: EstadoParada, evento: EventoParada) =>
  err(errorDominio('TRANSICION_INVALIDA', `No se puede aplicar ${evento} a una parada ${estado}.`));
