import { respaldoDelPin, type NivelRespaldoPin, type RespaldoDelPin, type VisitaConGps } from '../../domain/entidades/respaldo-del-pin.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { ok, type Result } from '../../domain/shared/result.js';
import type { ErrorApp } from '../errores.js';
import type { ClienteRepository, LocalConPin } from '../ports/out/clientes.js';
import type { EntregaRepository } from '../ports/out/entregas.js';

const ENTREGAS_POR_LOCAL = 20;
const MAXIMO_A_REVISAR = 400;
export const MAXIMO_EN_PANTALLA = 100;

export type PinParaRevisar = LocalConPin & { readonly respaldo: RespaldoDelPin };
export type PinesParaRevisar = { readonly total: number; readonly pines: readonly PinParaRevisar[] };

/** Primero lo que se puede verificar con confianza, después lo que hay que mirar, al final lo que aún no tiene evidencia. */
const PRIORIDAD: Readonly<Record<NivelRespaldoPin, number>> = { respaldado: 0, en_conflicto: 1, sin_respaldo: 2, verificado: 3 };

/**
 * La lista para revisar pines, como la de fotos: «por verificar» (con cuánto respaldan las entregas a cada pin, lo más seguro primero) y
 * «verificados» (los más recientes primero, con si los verificó una persona o las entregas). Nada cambia solo al mirarla.
 */
export const crearRevisarPines = ({ clientes, entregas }: { clientes: ClienteRepository; entregas: Pick<EntregaRepository, 'visitasConGpsDeLocales'> }) =>
  async (actor: Usuario, estado: 'por_verificar' | 'verificados'): Promise<Result<PinesParaRevisar, ErrorApp>> => {
    const locales = await clientes.listarPinesParaRevisar(actor.empresaId, estado, MAXIMO_A_REVISAR);
    // El nivel es información de apoyo: si no se pueden leer las entregas, la lista igual se entrega (sin evidencia).
    const visitas = await entregas.visitasConGpsDeLocales(actor.empresaId, locales.map((l) => l.id), ENTREGAS_POR_LOCAL).catch((): ReadonlyMap<string, readonly VisitaConGps[]> => new Map());
    const conRespaldo = locales.map((l): PinParaRevisar => ({ ...l, respaldo: respaldoDelPin({ lat: l.lat, lng: l.lng }, l.pinVerificacion !== undefined, visitas.get(l.id) ?? []) }));
    const ordenadas = estado === 'por_verificar'
      ? [...conRespaldo].sort((a, b) => PRIORIDAD[a.respaldo.nivel] - PRIORIDAD[b.respaldo.nivel] || b.respaldo.entregas - a.respaldo.entregas)
      : conRespaldo;
    return ok({ total: ordenadas.length, pines: ordenadas.slice(0, MAXIMO_EN_PANTALLA) });
  };
