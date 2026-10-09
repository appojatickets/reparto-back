import { direccionParaBuscar } from '../../domain/valor/direccion-busqueda.js';
import { evaluarGeocodificacion } from '../../domain/valor/geocodificacion.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { Clock } from '../ports/out/clock.js';
import type { Geocodificador } from '../ports/out/geocodificador.js';

/** detener: algún buscador no respondió o llegó a su límite y ninguno dio un punto; no se marca el intento, se vuelve a probar más tarde. */
export type ResultadoGeocodificar = 'fijado' | 'sin_resultado' | 'ya_tiene_pin' | 'no_existe' | 'detener';

/**
 * Busca la dirección del local en el mapa y, si el punto sirve (calle o número, en su comuna, dentro de la región), lo deja como su pin
 * «sugerido». Sirve para todos los choferes y los días siguientes: cada dirección se busca una sola vez.
 */
export const crearGeocodificarLocal = ({ clientes, geocodificadores, clock }: { clientes: ClienteRepository; geocodificadores: readonly Geocodificador[]; clock: Clock }) =>
  async (empresaId: string, localId: string): Promise<ResultadoGeocodificar> => {
    const local = await clientes.obtenerLocal(empresaId, localId);
    if (!local) return 'no_existe';
    if (local.lat !== undefined && local.lng !== undefined) return 'ya_tiene_pin';

    const calle = direccionParaBuscar(local.direccion);
    if (calle === undefined) {
      await clientes.marcarIntentoGeocodificacion(empresaId, localId, clock.now());
      return 'sin_resultado';
    }
    // Se prueba cada buscador en orden hasta que uno dé un punto que sirva; el siguiente solo se consulta si el anterior no lo encontró.
    const consulta = `${calle}, ${local.comuna}, Región Metropolitana, Chile`;
    let fallo = false;
    for (const geocodificador of geocodificadores) {
      const r = await geocodificador.buscar(consulta);
      if (!r.ok) {
        if (r.error !== 'SIN_RESULTADO') fallo = true;
        continue;
      }
      const aceptada = evaluarGeocodificacion(r.value, local.comuna);
      if (!aceptada) continue;
      const fijado = await clientes.fijarPinGeocodificado(empresaId, localId, r.value.lat, r.value.lng, aceptada.confianza);
      return fijado ? 'fijado' : 'ya_tiene_pin';
    }
    // Si algún buscador no respondió (caído o sin cupo) no se da por perdido: no se anota el intento y se vuelve a probar.
    if (fallo) return 'detener';
    await clientes.marcarIntentoGeocodificacion(empresaId, localId, clock.now());
    return 'sin_resultado';
  };

export const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
