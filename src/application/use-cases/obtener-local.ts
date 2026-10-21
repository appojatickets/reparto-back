import type { VisitaConGps } from '../../domain/entidades/respaldo-del-pin.js';
import { respaldoDelPin, type RespaldoDelPin } from '../../domain/entidades/respaldo-del-pin.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository, LocalDetalle } from '../ports/out/clientes.js';
import type { EntregaRepository } from '../ports/out/entregas.js';
import { correccionGemini, respaldoGemini } from '../../domain/entidades/pin-gemini.js';

/** Cuántas de las últimas entregas se miran para saber cuánto respaldan al pin. */
const ENTREGAS_PARA_RESPALDO = 20;

/** El local con, si tiene pin, qué tan firme es: verificado, respaldado por entregas, en conflicto o sin respaldo. */
export type LocalConRespaldo = LocalDetalle & { readonly pinRespaldo?: RespaldoDelPin; readonly pinCorreccion?: { readonly lat: number; readonly lng: number } };

export const crearObtenerLocal = ({ clientes, entregas }: { clientes: ClienteRepository; entregas: Pick<EntregaRepository, 'visitasConGps' | 'visitasDetenidasDeLocales'> }) =>
  async (actor: Usuario, localId: string): Promise<Result<LocalConRespaldo, ErrorApp>> => {
    const local = await clientes.obtenerLocal(actor.empresaId, localId);
    if (!local) return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
    if (local.lat === undefined || local.lng === undefined) return ok(local);
    if (local.pinFuente === 'gemini') {
      const visitas = (await entregas.visitasDetenidasDeLocales?.(actor.empresaId, [localId], ENTREGAS_PARA_RESPALDO).catch((): ReadonlyMap<string, readonly VisitaConGps[]> => new Map()))?.get(localId) ?? [];
      const pin = { lat: local.lat, lng: local.lng };
      const correccion = !local.pinVerificado ? correccionGemini(pin, visitas) : undefined;
      return ok({ ...local, pinRespaldo: respaldoGemini(pin, local.pinVerificado, visitas), ...(correccion ? { pinCorreccion: correccion } : {}) });
    }
    // El nivel es información de apoyo: si no se pueden leer las entregas, la ficha igual se entrega.
    const visitas = await entregas.visitasConGps(actor.empresaId, localId, ENTREGAS_PARA_RESPALDO).catch(() => undefined);
    return ok(visitas === undefined ? local : { ...local, pinRespaldo: respaldoDelPin({ lat: local.lat, lng: local.lng }, local.pinVerificado, visitas) });
  };
