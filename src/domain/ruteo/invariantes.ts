import { DEPOSITO, ORIGEN } from './tiempos.js';
import type { ProblemaRuta, Solucion } from './tipos.js';
import { err, ok, type Result } from '../shared/result.js';
import type { OpcionesOptimizacion } from './tipos.js';
import { optimizar } from './optimizador.js';

const TOL = 1e-6;

/**
 * Verifica una solución con un cálculo independiente del motor (sin matrices cacheadas): si el optimizador tuviera un
 * error, esto lo detecta antes de que el chofer vea un orden equivocado. Devuelve la lista de violaciones (vacía = ok).
 */
export const verificarInvariantes = (problema: ProblemaRuta, solucion: Solucion): string[] => {
  const fallas: string[] = [];
  const porId = new Map(problema.paradas.map((p) => [p.id, p]));

  // 1. Las paradas fijadas por el chofer están al frente y en orden.
  const fijas = [...new Set(problema.fijas)].filter((id) => porId.has(id));
  if (fijas.some((id, k) => solucion.orden[k] !== id)) fallas.push('Las paradas fijadas no están al frente en su orden.');

  // 2. Cada pendiente aparece exactamente una vez, en el orden o en no atendidas.
  const vistos = [...solucion.orden, ...solucion.noAtendidas.map((n) => n.paradaId)];
  if (new Set(vistos).size !== vistos.length) fallas.push('Hay paradas repetidas.');
  if (vistos.length !== porId.size || vistos.some((id) => !porId.has(id))) {
    fallas.push('Las paradas de la solución no coinciden con las del problema.');
  }

  // 3. Horarios coherentes con la fórmula llegada = max(salida anterior + viaje·ritmo, apertura).
  let t = problema.salida;
  let previo = ORIGEN;
  const enRiesgo = new Set(solucion.enRiesgo.map((r) => r.paradaId));
  solucion.detalle.forEach((d, k) => {
    const parada = porId.get(d.id);
    if (!parada || solucion.orden[k] !== d.id) return;
    const llegada = t + problema.tiempos.tiempo(previo, d.id, t) * problema.ritmo;
    const tramo = parada.ventanas.find((w) => llegada <= w.cierre);
    const inicio = parada.ventanas.length === 0 || !tramo ? llegada : Math.max(llegada, tramo.apertura);
    const atraso = parada.ventanas.length > 0 && !tramo ? llegada - (parada.ventanas[parada.ventanas.length - 1]?.cierre ?? llegada) : 0;
    if (Math.abs(llegada - d.llegada) > TOL) fallas.push(`ETA incoherente en ${d.id}.`);
    if (Math.abs(inicio - d.inicioServicio) > TOL) fallas.push(`Inicio de servicio incoherente en ${d.id}.`);
    if (Math.abs(atraso - d.atraso) > TOL) fallas.push(`Atraso incoherente en ${d.id}.`);
    // 4. Ventana dura respetada salvo que esté marcada en riesgo.
    if (atraso > TOL && !enRiesgo.has(d.id)) fallas.push(`${d.id} llega tarde y no está marcada en riesgo.`);
    if (atraso <= TOL && enRiesgo.has(d.id)) fallas.push(`${d.id} está marcada en riesgo sin estarlo.`);
    t = inicio + parada.servicioMin;
    previo = d.id;
  });

  // 5. El regreso es la última salida más el viaje al depósito.
  const regreso = t + problema.tiempos.tiempo(previo, DEPOSITO, t) * problema.ritmo;
  if (Math.abs(regreso - solucion.regreso) > TOL) fallas.push('Hora de regreso incoherente.');
  if (solucion.regresoTardio !== regreso > problema.parametros.horaLimiteRegresoMin) fallas.push('Alerta de regreso tardío incoherente.');

  return fallas;
};

export type ViolacionDeInvariantes = { readonly violaciones: readonly string[] };

/**
 * Optimiza y verifica. Si falla, devuelve error para que la aplicación conserve el orden anterior
 * («No pude reordenar. Sigue con tu orden actual.»): el chofer nunca se queda sin ruta.
 */
export const optimizarVerificado = (
  problema: ProblemaRuta,
  opciones: OpcionesOptimizacion = {},
): Result<Solucion, ViolacionDeInvariantes> => {
  const solucion = optimizar(problema, opciones);
  const violaciones = verificarInvariantes(problema, solucion);
  return violaciones.length === 0 ? ok(solucion) : err({ violaciones });
};
