import type { Usuario } from '../../domain/entidades/usuario.js';
import { esDeCamion } from '../../domain/permisos.js';
import { estadoTras, puedeFijarPin, validarEvento, type EventoCrudo } from '../../domain/entidades/entrega.js';
import { ENTREGAS_PARA_PIN, pinPorEntregas, posicionSirveParaPin } from '../../domain/entidades/pin-por-entregas.js';
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
 * Un chofer (o ayudante) solo avisa sobre facturas de su camión de hoy. Al avisar ENTREGADO con buen GPS, el lugar de la entrega pasa a ser
 * el pin del local mientras ese pin no esté verificado (se va ajustando con cada entrega); uno verificado no se mueve. Al llegar o
 * encontrarlo cerrado, un local sin pin toma esa posición.
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
    if (evento.tipo === 'entregado' && evento.lat !== undefined && evento.lng !== undefined && posicionSirveParaPin({ lat: evento.lat, lng: evento.lng, ...(evento.precisionM !== undefined ? { precisionM: evento.precisionM } : {}) })) {
      // Donde de verdad se entrega manda sobre el pin que hay, mientras nadie lo haya verificado (ya queda registrada esta entrega).
      const punto = pinPorEntregas(await entregas.posicionesDeEntrega(actor.empresaId, f.local.id, ENTREGAS_PARA_PIN));
      if (punto) pinFijado = await clientes.ajustarPinPorEntrega(actor.empresaId, f.local.id, punto);
    } else if (puedeFijarPin(evento, f.local.tienePin) && evento.lat !== undefined && evento.lng !== undefined) {
      pinFijado = await clientes.fijarPinSiFalta(actor.empresaId, f.local.id, evento.lat, evento.lng);
    }
    return ok({ estado: nuevoEstado ?? f.estado, pinFijado });
  };
