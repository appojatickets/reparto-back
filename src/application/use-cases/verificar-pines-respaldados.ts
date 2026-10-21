import { respaldoDelPin, type VisitaConGps } from '../../domain/entidades/respaldo-del-pin.js';
import { RADIO_ACUERDO_PIN_M } from '../../domain/entidades/pin-por-entregas.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { Clock } from '../ports/out/clock.js';
import type { EntregaRepository } from '../ports/out/entregas.js';
import { respaldoGemini } from '../../domain/entidades/pin-gemini.js';

const ENTREGAS_POR_LOCAL = 20;
const MAXIMO_A_REVISAR = 5000;
const LOTE = 400;

/**
 * Los pines que las entregas ya respaldan se verifican solos (ADR 0047). A la persona le quedan solo dos casos: pines sin entregas con que compararlos y
 * pines con entregas en lugares distintos. «Respaldado» = al menos dos entregas con buen GPS que coinciden entre sí y quedan junto al pin
 * (a ≤ 60 m). Al registrar una entrega ya se hacía, pero lo anterior (o una segunda entrega que no alcanzó la precisión en ese momento) quedaba esperando
 * a una persona; este barrido, que corre con el análisis de segundo plano, lo deja al día. Devuelve cuántos verificó.
 */
export const crearVerificarPinesRespaldados = ({ clientes, entregas, clock }: { clientes: ClienteRepository; entregas: Pick<EntregaRepository, 'visitasConGpsDeLocales' | 'visitasDetenidasDeLocales'>; clock: Clock }) =>
  async (empresaId: string): Promise<number> => {
    const locales = await clientes.listarPinesParaRevisar(empresaId, 'por_verificar', MAXIMO_A_REVISAR);
    let verificados = 0;
    for (let i = 0; i < locales.length; i += LOTE) {
      const lote = locales.slice(i, i + LOTE);
      const visitas = await entregas.visitasConGpsDeLocales(empresaId, lote.map((l) => l.id), ENTREGAS_POR_LOCAL);
      const ia = lote.filter(l => l.pinFuente === 'gemini').map(l => l.id);
      const detenidas = ia.length ? await entregas.visitasDetenidasDeLocales?.(empresaId, ia, ENTREGAS_POR_LOCAL) : undefined;
      for (const l of lote) {
        if (l.pinFuente === 'gemini') {
          const r = respaldoGemini(l, false, detenidas?.get(l.id) ?? []);
          if (r.nivel === 'respaldado' && await clientes.verificarPinPorEntregas(empresaId, l.id, clock.now(), { lat: l.lat, lng: l.lng })) verificados++;
          continue;
        }
        const r = respaldoDelPin({ lat: l.lat, lng: l.lng }, false, visitas.get(l.id) ?? ([] as readonly VisitaConGps[]));
        if (r.nivel !== 'respaldado' || (r.distanciaM ?? Infinity) > RADIO_ACUERDO_PIN_M) continue;
        if (await clientes.verificarPinPorEntregas(empresaId, l.id, clock.now())) verificados += 1;
      }
    }
    return verificados;
  };

export type VerificarPinesRespaldados = ReturnType<typeof crearVerificarPinesRespaldados>;
