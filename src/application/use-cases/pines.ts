import type { Usuario } from '../../domain/entidades/usuario.js';
import { distanciaMetros, validarPropuestaPin, type PropuestaPinCruda } from '../../domain/importacion/propuesta-pin.js';
import type { ErrorDominio } from '../../domain/shared/errores.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { EstadoPropuesta, NuevaPropuestaPin, PropuestaPin, PropuestaPinRepository } from '../ports/out/pines.js';

export const MAX_PINES_POR_LOTE = 500;
const EN_PARALELO = 20;

export type ResultadoImportacionPines = {
  readonly recibidas: number;
  readonly pendientes: number;
  readonly sinLocal: number;
  readonly errores: readonly { readonly fila: number; readonly errores: readonly ErrorDominio[] }[];
};

/**
 * Importación de pines (p. ej. los que juntaron los choferes). Nada cambia solo: cada pin queda como propuesta
 * pendiente de revisión, con la distancia al pin actual para que quien revisa vea de un vistazo cuáles importan.
 */
export const crearImportarPines = ({ clientes, pines }: { clientes: ClienteRepository; pines: PropuestaPinRepository }) =>
  async (actor: Usuario, entradas: readonly PropuestaPinCruda[]): Promise<Result<ResultadoImportacionPines, ErrorApp>> => {
    if (entradas.length === 0) return err(errorApp('VALIDACION', 'No hay pines para importar.'));
    if (entradas.length > MAX_PINES_POR_LOTE) return err(errorApp('VALIDACION', `Máximo ${MAX_PINES_POR_LOTE} pines por lote.`));

    const errores: { fila: number; errores: readonly ErrorDominio[] }[] = [];
    const validas: { indice: number; rut: string | undefined; direccion: string; lat: number; lng: number }[] = [];
    entradas.forEach((e, i) => {
      const r = validarPropuestaPin(e);
      if (r.ok) validas.push({ indice: i, rut: r.value.rut, direccion: r.value.direccion, lat: r.value.lat, lng: r.value.lng });
      else errores.push({ fila: i + 1, errores: r.error });
    });

    const propuestas: NuevaPropuestaPin[] = [];
    for (let desde = 0; desde < validas.length; desde += EN_PARALELO) {
      const tanda = validas.slice(desde, desde + EN_PARALELO);
      const coincidencias = await Promise.all(tanda.map((v) => clientes.coincidenciaDeDireccion(actor.empresaId, v.rut, v.direccion)));
      tanda.forEach((v, k) => {
        const c = coincidencias[k];
        const distancia = c?.lat !== undefined && c.lng !== undefined ? distanciaMetros({ lat: c.lat, lng: c.lng }, v) : undefined;
        propuestas.push({
          ...(c ? { localId: c.localId } : {}),
          ...(v.rut !== undefined ? { rut: v.rut } : {}),
          direccion: v.direccion,
          lat: v.lat,
          lng: v.lng,
          ...(distancia !== undefined ? { distanciaActualM: Math.round(distancia * 10) / 10 } : {}),
          estado: c ? 'pendiente' : 'sin_local',
        });
      });
    }

    if (propuestas.length > 0) await pines.crearLote(actor.empresaId, actor.id, propuestas);
    const sinLocal = propuestas.filter((p) => p.estado === 'sin_local').length;
    return ok({ recibidas: entradas.length, pendientes: propuestas.length - sinLocal, sinLocal, errores });
  };

export const crearListarPropuestasPin = ({ pines }: { pines: PropuestaPinRepository }) =>
  (actor: Usuario, estado: EstadoPropuesta, limite = 100): Promise<readonly PropuestaPin[]> =>
    pines.listar(actor.empresaId, estado, Math.min(Math.max(limite, 1), 500));

export const crearResolverPropuestaPin = ({ pines, clock }: { pines: PropuestaPinRepository; clock: { now(): Date } }) =>
  async (actor: Usuario, id: string, accion: 'aceptar' | 'rechazar'): Promise<Result<void, ErrorApp>> => {
    const r = await pines.resolver(actor.empresaId, id, actor.id, accion === 'aceptar', clock.now());
    if (r.ok) return ok(undefined);
    switch (r.error) {
      case 'NO_ENCONTRADA':
        return err(errorApp('NO_ENCONTRADO', 'La propuesta no existe.'));
      case 'YA_RESUELTA':
        return err(errorApp('CONFLICTO', 'La propuesta ya fue resuelta.'));
      case 'SIN_LOCAL':
        return err(errorApp('VALIDACION', 'La propuesta no corresponde a ningún local; no se puede aceptar.'));
    }
  };
