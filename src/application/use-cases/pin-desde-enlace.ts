import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { distanciaKm } from '../../domain/valor/coordenada.js';
import { esHostDeMapas, extraerEnlace, leerCoordenadaDeEnlace, leerCoordenadaDeHtml } from '../../domain/valor/enlace-mapa.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { ResolvedorEnlaces } from '../ports/out/enlaces.js';
import type { PropuestaPinRepository } from '../ports/out/pines.js';

export type ResultadoPinDesdeEnlace = { readonly resultado: 'fijado' | 'propuesto'; readonly lat: number; readonly lng: number };

const NO_LEIDO = 'No pude leer la ubicación de ese enlace. Pega el enlace de «Compartir» de Google Maps o Waze, o las coordenadas.';
const SIN_PUNTO = 'Abrí el enlace, pero Google no trae el punto exacto de ese lugar (es una dirección buscada, no un pin). En Google Maps mantén apretado el lugar en el mapa para dejar un pin, toca Compartir y pega ese enlace.';

/**
 * Cualquiera del equipo pega la ubicación que mandó el vendedor (ADR 0018). Se fija como pin «validado» de fuente «enlace»,
 * salvo que el local ya tenga un pin validado por el admin o por una revisión: ahí queda como propuesta para revisar (nada
 * que una persona fijó se pisa solo). Un pin que ya vino de un enlace sí se reemplaza por el más nuevo.
 */
export const crearFijarPinDesdeEnlace = ({ clientes, pines, resolvedor }: { clientes: ClienteRepository; pines: PropuestaPinRepository; resolvedor: ResolvedorEnlaces }) =>
  async (actor: Usuario, localId: string, enlace: string): Promise<Result<ResultadoPinDesdeEnlace, ErrorApp>> => {
    let punto = leerCoordenadaDeEnlace(enlace);
    let abierto = false;
    if (!punto) {
      const url = extraerEnlace(enlace);
      if (url && esHostDeMapas(url.hostname)) {
        const larga = await resolvedor.resolver(url.href);
        abierto = larga !== undefined;
        if (larga) punto = leerCoordenadaDeEnlace(larga.url) ?? (larga.cuerpo !== undefined ? leerCoordenadaDeHtml(larga.cuerpo) : undefined);
      }
    }
    if (!punto) return err(errorApp('VALIDACION', abierto ? SIN_PUNTO : NO_LEIDO));

    const local = await clientes.obtenerLocal(actor.empresaId, localId);
    if (!local) return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));

    const protegido = local.pinEstado === 'validado' && local.pinFuente !== 'enlace';
    if (protegido) {
      const distancia = local.lat !== undefined && local.lng !== undefined ? Math.round(distanciaKm({ lat: local.lat, lng: local.lng }, punto) * 1000) : undefined;
      await pines.crearLote(actor.empresaId, actor.id, [
        { localId, direccion: local.direccion, lat: punto.lat, lng: punto.lng, ...(distancia !== undefined ? { distanciaActualM: distancia } : {}), estado: 'pendiente' },
      ]);
      return ok({ resultado: 'propuesto', ...punto });
    }
    await clientes.actualizarLocal(actor.empresaId, localId, { pin: { ...punto, estado: 'validado', fuente: 'enlace' } });
    return ok({ resultado: 'fijado', ...punto });
  };
