import { esDeCamion } from '../../domain/permisos.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { esFechaValida, fechaEnChile } from '../../domain/shared/fechas.js';
import { validarAntesDe, validarFactura, validarNota, validarTotal, type FacturaCruda } from '../../domain/entidades/factura.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ResolverCamion } from './jornada.js';
import type { Clock } from '../ports/out/clock.js';
import type { CambiosFactura, FacturaDetallada, FacturaRepository, FiltroFacturas } from '../ports/out/facturas.js';

const sinCamion = () => errorApp('NO_ENCONTRADO', 'El camión no existe o está desactivado.');

export type EntradaFactura = FacturaCruda & { readonly localId: string; readonly camionId?: string | undefined };

/** Ingreso de una factura. Sin fecha se reparte hoy (hora de Chile). Un folio repetido se informa, nunca se duplica. */
export const crearRegistrarFactura = ({ facturas, clock, resolverCamion, programarPines }: { facturas: FacturaRepository; clock: Clock; resolverCamion: ResolverCamion; programarPines?: (empresaId: string, localIds: readonly string[]) => void }) =>
  async (actor: Usuario, entrada: EntradaFactura): Promise<Result<FacturaDetallada, ErrorApp>> => {
    const v = validarFactura(entrada);
    if (!v.ok) return err(errorApp('VALIDACION', v.error.map((e) => e.mensaje).join(' '), { errores: v.error }));
    // Un chofer carga siempre en el camión de su jornada.
    const camion = await resolverCamion(actor, entrada.camionId);
    if (!camion.ok) return camion;
    const r = await facturas.crear(actor.empresaId, {
      ...(v.value.folio !== undefined ? { folio: v.value.folio } : {}),
      localId: entrada.localId,
      fecha: v.value.fecha ?? fechaEnChile(clock.now()),
      ...(camion.value !== undefined ? { camionId: camion.value } : {}),
      ...(v.value.total !== undefined ? { total: v.value.total } : {}),
      ...(v.value.antesDeMin !== undefined ? { antesDeMin: v.value.antesDeMin } : {}),
      urgente: v.value.urgente,
      ...(v.value.nota !== undefined ? { nota: v.value.nota } : {}),
      creadoPor: actor.id,
    });
    if (r.ok) {
      // La dirección que escribió el chofer se busca en el mapa para tener su pin cuando calcule la ruta (y para los días siguientes).
      if (!r.value.local.tienePin) programarPines?.(actor.empresaId, [entrada.localId]);
      return ok(r.value);
    }
    switch (r.error) {
      case 'FOLIO_DUPLICADO':
        return err(errorApp('CONFLICTO', `Ya existe una factura con el folio ${v.value.folio ?? ''}.`, { folio: v.value.folio }));
      case 'LOCAL_NO_EXISTE':
        return err(errorApp('NO_ENCONTRADO', 'El cliente no existe.'));
      case 'CAMION_NO_DISPONIBLE':
        return err(sinCamion());
    }
  };

export type EntradaListarFacturas = {
  readonly fecha?: string | undefined;
  readonly camionId?: string | undefined;
  readonly sinCamion?: boolean | undefined;
  readonly incluirAnuladas?: boolean | undefined;
  readonly incluirHechas?: boolean | undefined;
};

export const crearListarFacturas = ({ facturas, clock, resolverCamion }: { facturas: FacturaRepository; clock: Clock; resolverCamion: ResolverCamion }) =>
  async (actor: Usuario, entrada: EntradaListarFacturas = {}): Promise<Result<readonly FacturaDetallada[], ErrorApp>> => {
    if (entrada.fecha !== undefined && !esFechaValida(entrada.fecha)) return err(errorApp('VALIDACION', 'La fecha no es válida.'));
    const camion = await resolverCamion(actor, entrada.camionId);
    if (!camion.ok) return camion;
    const esChofer = esDeCamion(actor.rol);
    const filtro: FiltroFacturas = {
      fecha: entrada.fecha ?? fechaEnChile(clock.now()),
      ...(camion.value !== undefined ? { camionId: camion.value } : {}),
      ...(entrada.sinCamion === true && !esChofer ? { sinCamion: true } : {}),
      ...(entrada.incluirAnuladas === true ? { incluirAnuladas: true } : {}),
      ...(entrada.incluirHechas === true ? { incluirHechas: true } : {}),
    };
    return ok(await facturas.listar(actor.empresaId, filtro));
  };

export type EntradaActualizarFactura = {
  readonly camionId?: string | null | undefined;
  readonly fecha?: string | undefined;
  readonly total?: number | null | undefined;
  readonly antesDeMin?: number | null | undefined;
  readonly urgente?: boolean | undefined;
  readonly nota?: string | null | undefined;
  readonly estado?: 'pendiente' | 'anulada' | undefined;
};

/** Cambiar camión, día, condiciones o anular. `null` quita un valor (p. ej. sacar la hora límite). */
export const crearActualizarFactura = ({ facturas, resolverCamion }: { facturas: FacturaRepository; resolverCamion: ResolverCamion }) =>
  async (actor: Usuario, id: string, e: EntradaActualizarFactura): Promise<Result<FacturaDetallada, ErrorApp>> => {
    const invalido = (m: string) => err(errorApp('VALIDACION', m));
    if (esDeCamion(actor.rol)) {
      // Solo las facturas de su camión de hoy, y no puede pasarlas a otro camión.
      const actual = await facturas.obtener(actor.empresaId, id);
      if (!actual) return err(errorApp('NO_ENCONTRADO', 'La factura no existe.'));
      const propio = await resolverCamion(actor, actual.camion?.id ?? '');
      if (!propio.ok) return propio.error.codigo === 'SIN_PERMISO' ? err(errorApp('SIN_PERMISO', 'Esa factura no es de tu camión de hoy.')) : propio;
      if (e.camionId !== undefined) return err(errorApp('SIN_PERMISO', 'No puedes pasar la factura a otro camión.'));
    }
    if (e.fecha !== undefined && !esFechaValida(e.fecha)) return invalido('La fecha no es válida.');
    if (typeof e.total === 'number' && !validarTotal(e.total)) return invalido('El total debe ser un número entero de pesos.');
    if (typeof e.antesDeMin === 'number' && !validarAntesDe(e.antesDeMin)) return invalido('La hora límite no es válida.');
    const nota = typeof e.nota === 'string' ? e.nota.trim() : e.nota;
    if (typeof nota === 'string' && !validarNota(nota)) return invalido('La nota supera 300 caracteres.');

    const cambios: CambiosFactura = {
      ...(e.camionId !== undefined ? { camionId: e.camionId } : {}),
      ...(e.fecha !== undefined ? { fecha: e.fecha } : {}),
      ...(e.total !== undefined ? { total: e.total } : {}),
      ...(e.antesDeMin !== undefined ? { antesDeMin: e.antesDeMin } : {}),
      ...(e.urgente !== undefined ? { urgente: e.urgente } : {}),
      ...(nota !== undefined ? { nota: nota === '' ? null : nota } : {}),
      ...(e.estado !== undefined ? { estado: e.estado } : {}),
    };
    if (Object.keys(cambios).length === 0) return invalido('No hay nada que actualizar.');

    const r = await facturas.actualizar(actor.empresaId, id, cambios);
    if (r.ok) return ok(r.value);
    return err(r.error === 'NO_ENCONTRADA' ? errorApp('NO_ENCONTRADO', 'La factura no existe.') : sinCamion());
  };
