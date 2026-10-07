import {
  atenciones, calidadDeJornada, capacidadAprendida, cierresFrecuentes, llegadasInferidas, pinesDudosos, pinesSugeridos, ritmoAprendido, servicioAprendido, tramosDeViaje, type LocalObs, type ParametroAprendido,
} from '../../domain/aprendizaje/analisis.js';
import { distanciaMetros } from '../../domain/importacion/propuesta-pin.js';
import type { AprendizajeRepository, ResumenAnalisis } from '../ports/out/aprendizaje.js';
import type { Clock } from '../ports/out/clock.js';
import type { EmpresaRepository } from '../ports/out/empresa.js';
import type { NuevaPropuestaPin, PropuestaPinRepository } from '../ports/out/pines.js';

/** Se mira lo de los últimos 90 días: lo viejo ya no representa cómo se reparte hoy. */
export const VENTANA_ANALISIS_DIAS = 90;

/**
 * El analizador de segundo plano: recorre lo registrado (avisos de parada, rutas sugeridas y corregidas, resúmenes de jornada) y calcula
 * lo que el sistema usa para ordenar mejor: ritmo real del camión, tiempo de atención por local, capacidad por jornada; además
 * mide cuánto se parece lo sugerido a lo manejado, propone pines corregidos por las visitas y lista los locales que se encuentran cerrados.
 * Es idempotente: se puede correr cuantas veces se quiera y siempre recalcula desde los datos.
 */
export const crearAnalizarAprendizaje = ({ aprendizaje, empresas, pines, clock }: { aprendizaje: AprendizajeRepository; empresas: EmpresaRepository; pines: PropuestaPinRepository; clock: Clock }) =>
  async (empresaId: string): Promise<ResumenAnalisis> => {
    const iniciadoEn = clock.now();
    const datos = await aprendizaje.datosParaAnalizar(empresaId, new Date(iniciadoEn.getTime() - VENTANA_ANALISIS_DIAS * 86_400_000));
    const locales = new Map<string, LocalObs>(datos.locales.map((l) => [l.id, l]));

    // Casi nadie avisa LLEGUÉ: la hora de llegada se deduce del recorrido del camión para poder medir atención y ritmo.
    const deducidas = llegadasInferidas(datos.eventos, locales, datos.posiciones);
    const conLlegadas = [...datos.eventos, ...deducidas];
    const parametros: ParametroAprendido[] = [
      ...servicioAprendido(atenciones(conLlegadas)),
      ...ritmoAprendido(tramosDeViaje(conLlegadas, locales)),
      ...capacidadAprendida(datos.resumenes),
    ];
    await aprendizaje.guardarParametros(empresaId, parametros, iniciadoEn);

    const config = await empresas.obtenerConfig(empresaId);
    const deposito = config?.deposito;
    const calidad = deposito ? datos.jornadas.flatMap((j) => { const q = calidadDeJornada(j, datos.eventos, datos.operaciones, locales, deposito); return q ? [q] : []; }) : [];
    if (calidad.length > 0) await aprendizaje.guardarCalidad(empresaId, calidad, iniciadoEn);

    // Pines que las visitas contradicen: solo se proponen (una persona decide) y sin repetir lo que ya está pendiente.
    const sugeridos = pinesSugeridos(datos.eventos, locales);
    const pendientes = sugeridos.length > 0 ? await pines.listar(empresaId, 'pendiente', 500) : [];
    const yaPropuestos = new Set(pendientes.flatMap((p) => (p.localId !== undefined ? [p.localId] : [])));
    const porProponente = new Map<string, NuevaPropuestaPin[]>();
    for (const s of sugeridos) {
      const l = datos.locales.find((x) => x.id === s.localId);
      if (!l || s.usuarioId === undefined || yaPropuestos.has(s.localId)) continue;
      const lista = porProponente.get(s.usuarioId) ?? [];
      lista.push({ localId: s.localId, direccion: l.direccion, lat: s.lat, lng: s.lng, ...(l.lat !== undefined && l.lng !== undefined ? { distanciaActualM: Math.round(distanciaMetros({ lat: l.lat, lng: l.lng }, s)) } : {}), estado: 'pendiente' });
      porProponente.set(s.usuarioId, lista);
    }
    let pinesProponidos = 0;
    for (const [usuarioId, propuestas] of porProponente) pinesProponidos += await pines.crearLote(empresaId, usuarioId, propuestas);

    const resumen: ResumenAnalisis = {
      eventos: datos.eventos.length, jornadas: datos.jornadas.length, parametros: parametros.length, jornadasComparadas: calidad.length,
      pinesSugeridos: sugeridos.length, pinesProponidos, llegadasDeducidas: deducidas.length,
      pinesDudosos: pinesDudosos(datos.eventos, locales).slice(0, 20), cierresFrecuentes: cierresFrecuentes(datos.eventos).slice(0, 20),
    };
    await aprendizaje.registrarEjecucion(empresaId, { iniciadoEn, terminadoEn: clock.now(), resumen });
    return resumen;
  };

export type AnalizarAprendizaje = ReturnType<typeof crearAnalizarAprendizaje>;
