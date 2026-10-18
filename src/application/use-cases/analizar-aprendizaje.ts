import { servicioGpsAprendido } from '../../domain/aprendizaje/servicio-gps.js';
import { jornadasObservadas } from '../../domain/seguimiento/jornada-observada.js';
import {
  atenciones, calidadDeJornada, jornadasDelEquipo, capacidadAprendida, cierresFrecuentes, completarConVisitas, pinesDudosos, pinesSugeridos, resumenesDelDia, ritmoAprendido, seguimientoDeLaRuta, servicioAprendido, tramosDeViaje, visitasDeducidas, type EventoObs, type LocalObs, type ParametroAprendido,
} from '../../domain/aprendizaje/analisis.js';
import { aObservaciones, bancoDePruebasDeFicha, cierreProbableDe, fichaAprendida } from '../../domain/aprendizaje/ficha-aprendida.js';
import { validarCierresPorGps } from '../../domain/aprendizaje/cierres-gps.js';
import { distanciaMetros } from '../../domain/importacion/propuesta-pin.js';
import type { AprendizajeRepository, ResumenAnalisis } from '../ports/out/aprendizaje.js';
import type { Clock } from '../ports/out/clock.js';
import type { EmpresaRepository } from '../ports/out/empresa.js';
import type { NuevaPropuestaPin, PropuestaPinRepository } from '../ports/out/pines.js';

const porClaveLocal = <T extends { readonly localId: string }>(items: readonly T[]): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const it of items) m.set(it.localId, [...(m.get(it.localId) ?? []), it]);
  return m;
};

/** Cuántos locales ya tienen hora habitual de entrega y cuántos tienen alguna franja de cierre probable (la que usa la ruta). */
const resumenDeFichas = (porLocal: ReadonlyMap<string, readonly EventoObs[]>): { readonly locales: number; readonly conHoraHabitual: number; readonly conCierreProbable: number } => {
  let conHoraHabitual = 0, conCierreProbable = 0;
  for (const evs of porLocal.values()) {
    const ficha = fichaAprendida(aObservaciones(evs));
    if (ficha.horaHabitual) conHoraHabitual += 1;
    if (cierreProbableDe(ficha).length > 0) conCierreProbable += 1;
  }
  return { locales: porLocal.size, conHoraHabitual, conCierreProbable };
};

/** La cobertura debe respaldar la jornada registrada entera, no solo el fragmento con GPS. */
const registradoCompleto = (observados: number | undefined, registrados: number | undefined): boolean =>
  observados !== undefined && registrados !== undefined && registrados > 0 && observados / registrados >= 0.8;

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

    // Casi nadie avisa LLEGUÉ y ENTREGADO se toca al llegar: la atención y el viaje se miden con el recorrido del camión.
    const medidasGps = visitasDeducidas(datos.eventos, locales, datos.posiciones.filter((p) => p.precisionM !== undefined && p.precisionM <= 60));
    const visitas = completarConVisitas(datos.eventos, medidasGps);
    const config = await empresas.obtenerConfig(empresaId);
    const gps = jornadasObservadas(datos.posiciones, datos.eventos, datos.jornadas, config?.deposito);
    const dias = resumenesDelDia(datos.eventos).map((d) => {
      const observado = gps.find((g) => g.camionId === d.camionId && g.fecha === d.fecha);
      const registrada = observado?.inicioRegistrado && observado.finRegistrado
        ? (Date.parse(observado.finRegistrado) - Date.parse(observado.inicioRegistrado)) / 60_000 : undefined;
      const cubreJornada = registradoCompleto(observado?.minutosObservados, registrada);
      const duracion = cubreJornada && observado?.jornadaCerrada && observado.salidaDeposito && observado.regresoDeposito && observado.cobertura >= 0.8
        ? (Date.parse(observado.regresoDeposito) - Date.parse(observado.salidaDeposito)) / 60_000 : undefined;
      return duracion !== undefined && duracion >= 5 ? { ...d, duracionMin: Math.round(duracion) } : d;
    });
    const parametros: ParametroAprendido[] = [
      ...servicioGpsAprendido(medidasGps),
      ...servicioAprendido(atenciones(visitas.eventos, visitas.salidas)),
      ...ritmoAprendido(tramosDeViaje(visitas.eventos, locales, visitas.salidas)),
      ...capacidadAprendida(dias),
    ];
    await aprendizaje.guardarParametros(empresaId, parametros, iniciadoEn);

    const deposito = config?.deposito;
    const calidad = deposito ? jornadasDelEquipo(datos.jornadas).flatMap((j) => { const q = calidadDeJornada(j, visitas.eventos, datos.operaciones, locales, deposito); return q ? [q] : []; }) : [];
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
      jornadasGps: gps.slice(0, 60),
      eventos: datos.eventos.length, jornadas: datos.jornadas.length, parametros: parametros.length, jornadasComparadas: calidad.length,
      pinesSugeridos: sugeridos.length, pinesProponidos, seguimientoRuta: seguimientoDeLaRuta(datos.eventos, datos.operaciones), llegadasDeducidas: visitas.llegadasDeducidas,
      pinesDudosos: pinesDudosos(datos.eventos, locales).slice(0, 20), cierresFrecuentes: cierresFrecuentes(datos.eventos).slice(0, 20),
      cierresGps: validarCierresPorGps(datos.eventos, locales, datos.posiciones),
      fichas: resumenDeFichas(porClaveLocal(datos.eventos)),
      bancoFicha: bancoDePruebasDeFicha(new Map([...porClaveLocal(datos.eventos)].map(([id, evs]) => [id, aObservaciones(evs)] as const))),
    };
    await aprendizaje.registrarEjecucion(empresaId, { iniciadoEn, terminadoEn: clock.now(), resumen });
    return resumen;
  };

export type AnalizarAprendizaje = ReturnType<typeof crearAnalizarAprendizaje>;
