import { formatearMinutos } from '../valor/minutos-del-dia.js';
import type { Compilado } from './compilar.js';
import { conSalida } from './compilar.js';
import { detallar, type Itinerario } from './evaluacion.js';
import type { DetalleParada, EnRiesgo, Motivo, Solucion, Sugerencia } from './tipos.js';

const EPS = 1e-9;
const HOLGURA_DURA_MIN = 90;

const cierreFinal = (c: Compilado, j: number): number | undefined => {
  const v = c.paradas[j]?.ventanas ?? [];
  return v[v.length - 1]?.cierre;
};

const motivosDe = (c: Compilado, j: number, previo: number | undefined, it: Itinerario, k: number, f: number): Motivo[] => {
  const parada = c.paradas[j];
  if (!parada) return ['MENOR_DESVIO'];
  const motivos: Motivo[] = [];
  if (k < f) motivos.push('FIJADA_POR_CHOFER');
  if (parada.ventanas.length >= 2) motivos.push('COLACION');
  if (parada.ventanas.length > 0) {
    const tramo = parada.ventanas.find((w) => (it.llegada[k] ?? 0) <= w.cierre) ?? parada.ventanas[parada.ventanas.length - 1];
    if (tramo && tramo.cierre - (it.llegada[k] ?? 0) <= HOLGURA_DURA_MIN) motivos.push('VENTANA_DURA');
  }
  if (it.cierre[k]) motivos.push('CIERRE_PROBABLE');
  if (parada.prioridad) motivos.push('PRIORIDAD');
  const comunaPrevia = previo === undefined ? undefined : c.paradas[previo]?.comuna;
  if (parada.comuna !== undefined && parada.comuna === comunaPrevia) motivos.push('CERCANIA_COMUNA');
  return motivos.length > 0 ? motivos : ['MENOR_DESVIO'];
};

const contarRiesgos = (it: Itinerario): number => it.atraso.filter((a) => a > EPS).length;

const sugerenciasPara = (c: Compilado, orden: readonly number[], q: number, f: number, base: Itinerario): Sugerencia[] => {
  const sugerencias: Sugerencia[] = [];

  if (q > f) {
    const movida = [...orden.slice(0, f), orden[q] ?? 0, ...orden.slice(f, q), ...orden.slice(q + 1)];
    const it = detallar(c, movida);
    if ((it.atraso[f] ?? 1) <= EPS && contarRiesgos(it) < contarRiesgos(base)) {
      sugerencias.push({ tipo: 'MOVER_AL_INICIO', texto: 'Hacer esta parada primero.' });
    }
  }
  for (let delta = 5; delta <= 120 && c.salida - delta >= 0; delta += 5) {
    const it = detallar(conSalida(c, c.salida - delta), orden);
    if ((it.atraso[q] ?? 1) <= EPS) {
      sugerencias.push({
        tipo: 'SALIR_ANTES',
        minutos: delta,
        texto: `Salir ${delta} min antes (a las ${formatearMinutos(c.salida - delta)}).`,
      });
      break;
    }
  }
  sugerencias.push({ tipo: 'OTRO_CAMION', texto: 'Asignar esta parada a otro camión.' });
  return sugerencias;
};

/**
 * Convierte un orden numérico en la solución completa: horarios, motivos y riesgos.
 *
 * `alFinal` son las paradas que según su horario ya cerraron (o no atienden hoy): NO se sacan de la ruta —el horario es una estimación y quien está
 * en terreno manda— sino que van al final, marcadas en riesgo con el motivo, para que se puedan entregar igual si resulta que están abiertas.
 */
export const armarSolucion = (c: Compilado, orden: readonly number[], alFinal: readonly number[], f: number): Solucion => {
  const completa = [...orden, ...alFinal];
  const cerradas = new Set(alFinal);
  const it = detallar(c, completa);
  const { horaLimiteRegresoMin } = c.problema.parametros;

  const detalle: DetalleParada[] = [];
  const enRiesgo: EnRiesgo[] = [];
  completa.forEach((j, k) => {
    const parada = c.paradas[j];
    if (!parada) return;
    detalle.push({
      id: parada.id,
      nombre: parada.nombre,
      posicion: k,
      llegada: it.llegada[k] ?? 0,
      inicioServicio: it.inicio[k] ?? 0,
      salida: it.salida[k] ?? 0,
      espera: it.espera[k] ?? 0,
      atraso: it.atraso[k] ?? 0,
      motivos: motivosDe(c, j, k > 0 ? completa[k - 1] : undefined, it, k, f),
    });
    const atraso = it.atraso[k] ?? 0;
    if (atraso > EPS) {
      const cierre = cierreFinal(c, j) ?? 0;
      const conflicto = cerradas.has(j)
        ? cierre === 0
          ? 'Según su horario hoy no atiende.'
          : `Según su horario cerró a las ${formatearMinutos(cierre)} y ya no se alcanza a llegar a tiempo.`
        : `Llegaría a las ${formatearMinutos(it.llegada[k] ?? 0)} y cierra a las ${formatearMinutos(cierre)} (${Math.round(atraso)} min tarde).`;
      enRiesgo.push({ paradaId: parada.id, nombre: parada.nombre, cierre, conflictos: [conflicto], sugerencias: sugerenciasPara(c, completa, k, f, it) });
    }
  });

  return {
    orden: detalle.map((d) => d.id),
    detalle,
    enRiesgo,
    // Ya nada se saca de la ruta por su horario: lo que cerró va al final, marcado en `enRiesgo`.
    noAtendidas: [],
    regreso: it.regreso,
    regresoTardio: it.regreso > horaLimiteRegresoMin,
    costo: it.costo,
  };
};

/** Mensaje corto para el chofer tras un cambio (pantalla C3). Si hay `antes`, solo avisa de los riesgos nuevos. */
export const explicarCambio = (antes: Solucion | undefined, despues: Solucion): string => {
  const primera = despues.detalle[0];
  if (!primera) return 'No quedan paradas pendientes. Vuelve al depósito.';
  const partes = [`Ahora sigue ${primera.nombre}. Llegas a las ${formatearMinutos(primera.llegada)}.`];
  const yaEnRiesgo = new Set(antes?.enRiesgo.map((r) => r.paradaId));
  for (const r of despues.enRiesgo.filter((x) => !yaEnRiesgo.has(x.paradaId)).slice(0, 2)) {
    partes.push(`${r.nombre} queda en riesgo: cierra ${formatearMinutos(r.cierre)}.`);
  }
  if (despues.regresoTardio) partes.push(`Regresarías al depósito a las ${formatearMinutos(despues.regreso)}.`);
  return partes.join(' ');
};
