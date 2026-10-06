import type { Usuario } from '../../domain/entidades/usuario.js';
import { esDeCamion } from '../../domain/permisos.js';
import { estadoTras, puedeFijarPin, validarEvento, type EventoCrudo } from '../../domain/entidades/entrega.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { EntregaRepository } from '../ports/out/entregas.js';
import type { EstadoFactura, FacturaRepository } from '../ports/out/facturas.js';
import type { RutaRepository } from '../ports/out/rutas.js';
import type { ResolverCamion } from './jornada.js';

export type ResultadoEvento = { readonly estado: EstadoFactura; readonly pinFijado: boolean };

/**
 * Lo que el chofer avisa desde la parada: llegué, entregué, está cerrado, espero N minutos, no se entregó, vuelvo más tarde.
 * Un chofer (o ayudante) solo avisa sobre facturas de su camión de hoy. Al llegar a un local sin pin, la posición se vuelve su
 * pin (colaborativo); si ya tiene, queda como evidencia.
 */
export const crearRegistrarEvento = ({ facturas, entregas, clientes, rutas, resolverCamion }: { facturas: FacturaRepository; entregas: EntregaRepository; clientes: ClienteRepository; rutas: RutaRepository; resolverCamion: ResolverCamion }) =>
  async (actor: Usuario, facturaId: string, entrada: EventoCrudo): Promise<Result<ResultadoEvento, ErrorApp>> => {
    const v = validarEvento(entrada);
    if (!v.ok) return err(errorApp('VALIDACION', v.error.map((e) => e.mensaje).join(' '), { errores: v.error }));
    const evento = v.value;

    const f = await facturas.obtener(actor.empresaId, facturaId);
    if (!f) return err(errorApp('NO_ENCONTRADO', 'La entrega no existe.'));
    if (esDeCamion(actor.rol)) {
      const propio = await resolverCamion(actor, f.camion?.id ?? '');
      if (!propio.ok) return propio.error.codigo === 'SIN_PERMISO' ? err(errorApp('SIN_PERMISO', 'Esa entrega no es de tu camión de hoy.')) : propio;
    }
    if (f.estado === 'anulada') return err(errorApp('CONFLICTO', 'Esa entrega fue quitada.'));
    const nuevoEstado = estadoTras(evento.tipo);
    if (nuevoEstado !== undefined && f.estado !== 'pendiente') {
      return err(errorApp('CONFLICTO', f.estado === 'entregada' ? 'Esa entrega ya está marcada como entregada.' : 'Esa entrega ya está marcada como no entregada.'));
    }

    // En qué lugar de la ruta iba esta parada: sirve para comparar lo que sugirió el sistema con lo que de verdad se hizo.
    const ruta = f.camion ? await rutas.obtener(actor.empresaId, f.camion.id, f.fecha) : undefined;
    const lugar = ruta ? ruta.orden.indexOf(facturaId) + 1 : 0;
    await entregas.registrar(actor.empresaId, {
      ...evento,
      origen: 'manual',
      ...(ruta && lugar > 0 ? { posicionEnRuta: lugar, paradasEnRuta: ruta.orden.length } : {}),
      facturaId,
      localId: f.local.id,
      ...(f.camion ? { camionId: f.camion.id } : {}),
      usuarioId: actor.id,
      ...(nuevoEstado !== undefined ? { nuevoEstado } : {}),
    });

    let pinFijado = false;
    if (puedeFijarPin(evento, f.local.tienePin) && evento.lat !== undefined && evento.lng !== undefined) {
      pinFijado = await clientes.fijarPinSiFalta(actor.empresaId, f.local.id, evento.lat, evento.lng);
    }
    return ok({ estado: nuevoEstado ?? f.estado, pinFijado });
  };
