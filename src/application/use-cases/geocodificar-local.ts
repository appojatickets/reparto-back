import { direccionParaBuscar } from '../../domain/valor/direccion-busqueda.js';
import { CONFIANZA_CALLE, evaluarGeocodificacion, evaluarPuntoDeModelo } from '../../domain/valor/geocodificacion.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { Clock } from '../ports/out/clock.js';
import type { Geocodificador } from '../ports/out/geocodificador.js';
import type { NormalizadorDeDirecciones } from '../ports/out/normalizador-direcciones.js';

/** detener: algún buscador no respondió o llegó a su límite y ninguno dio un punto; no se marca el intento, se vuelve a probar más tarde. */
export type ResultadoGeocodificar = 'fijado' | 'sin_resultado' | 'ya_tiene_pin' | 'no_existe' | 'detener';

/**
 * Busca la dirección del local en el mapa y, si el punto sirve (calle o número, en su comuna, dentro de la región), lo deja como su pin
 * «sugerido». Sirve para todos los choferes y los días siguientes: cada dirección se busca una sola vez.
 *
 * Si ningún buscador la encuentra (y ninguno falló), el `normalizador` opcional (Gemini) ordena la dirección —corrige errores y abreviaturas— y
 * se busca de nuevo con ese texto; si aun así nadie la halla, queda el punto aproximado que estime el modelo, si es creíble. Es la última carta y puede fallar: sin él, o si falla, todo queda como antes. Como el texto lo reescribió
 * un modelo, el punto que se encuentre así queda como aproximado (confianza de calle): el GPS de la primera entrega lo confirma o lo reemplaza.
 */
export const crearGeocodificarLocal = ({
  clientes,
  geocodificadores,
  clock,
  normalizador,
}: {
  clientes: ClienteRepository;
  geocodificadores: readonly Geocodificador[];
  clock: Clock;
  normalizador?: NormalizadorDeDirecciones;
}) =>
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
    // `fallo`: algún buscador no respondió o llegó a su límite, así que no se puede dar la dirección por perdida.
    const probar = async (consulta: string, limiteConfianza = Infinity): Promise<{ readonly resultado?: ResultadoGeocodificar; readonly fallo: boolean }> => {
      let fallo = false;
      for (const geocodificador of geocodificadores) {
        const r = await geocodificador.buscar(consulta);
        if (!r.ok) {
          if (r.error !== 'SIN_RESULTADO') fallo = true;
          continue;
        }
        const aceptada = evaluarGeocodificacion(r.value, local.comuna);
        if (!aceptada) continue;
        const fijado = await clientes.fijarPinGeocodificado(empresaId, localId, r.value.lat, r.value.lng, Math.min(aceptada.confianza, limiteConfianza));
        return { resultado: fijado ? 'fijado' : 'ya_tiene_pin', fallo };
      }
      return { fallo };
    };
    const enLaRegion = (c: string): string => `${c}, ${local.comuna}, Región Metropolitana, Chile`;

    const primera = await probar(enLaRegion(calle));
    if (primera.resultado) return primera.resultado;
    // Si algún buscador no respondió (caído o sin cupo) no se da por perdido: no se anota el intento y se vuelve a probar.
    if (primera.fallo) return 'detener';

    if (normalizador) {
      const n = await normalizador.normalizar(local.direccion, local.comuna);
      if (!n.ok && n.error === 'LIMITE') return 'detener';
      if (n.ok) {
        const reescrita = enLaRegion(`${n.value.calle}${n.value.numero !== undefined ? ` ${String(n.value.numero)}` : ''}`);
        if (reescrita !== enLaRegion(calle)) {
          const segunda = await probar(reescrita, CONFIANZA_CALLE);
          if (segunda.resultado) return segunda.resultado;
          if (segunda.fallo) return 'detener';
        }
        // Último escalón: ningún mapa la halló, pero el modelo estima dónde queda. Si es creíble (en su comuna) queda como pin aproximado, mejor
        // que el centro de la comuna; la primera entrega con GPS lo reemplaza y, si la calle tiene otras puertas conocidas, mandan ellas.
        const estimada = n.value.estimada;
        const creible = estimada ? evaluarPuntoDeModelo(estimada, local.comuna) : undefined;
        if (estimada && creible) {
          const fijado = await clientes.fijarPinGeocodificado(empresaId, localId, estimada.lat, estimada.lng, creible.confianza);
          return fijado ? 'fijado' : 'ya_tiene_pin';
        }
      }
    }
    await clientes.marcarIntentoGeocodificacion(empresaId, localId, clock.now());
    return 'sin_resultado';
  };

export const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
