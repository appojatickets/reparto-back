import { formatearMinutos } from '../valor/minutos-del-dia.js';
import type { Compilado } from './compilar.js';
import { conSalida } from './compilar.js';
import { detallar, type Itinerario } from './evaluacion.js';
import type { DetalleParada, EnRiesgo, Motivo, NoAtendida, Solucion, Sugerencia } from './tipos.js';

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

/** Convierte un orden numérico en la solución completa: horarios, motivos, riesgos y no atendidas. */
export const armarSolucion = (c: Compilado, orden: readonly number[], vencidas: readonly number[], f: number): Solucion => {
  const it = detallar(c, orden);
  const { pesoNoAtendida, pesoNoAtendidaPrioridad, horaLimiteRegresoMin } = c.problema.parametros;

  const detalle: DetalleParada[] = [];
  const enRiesgo: EnRiesgo[] = [];
  orden.forEach((j, k) => {
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
      motivos: motivosDe(c, j, k > 0 ? orden[k - 1] : undefined, it, k, f),
    });
    const atraso = it.atraso[k] ?? 0;
    if (atraso > EPS) {
      const cierre = cierreFinal(c, j) ?? 0;
      enRiesgo.push({
        paradaId: parada.id,
        nombre: parada.nombre,
        cierre,
        conflictos: [
          `Llegaría a las ${formatearMinutos(it.llegada[k] ?? 0)} y cierra a las ${formatearMinutos(cierre)} (${Math.round(atraso)} min tarde).`,
        ],
        sugerencias: sugerenciasPara(c, orden, k, f, it),
      });
    }
  });

  const noAtendidas: NoAtendida[] = vencidas.flatMap((j) => {
    const parada = c.paradas[j];
    if (!parada) return [];
    return [
      {
        paradaId: parada.id,
        nombre: parada.nombre,
        motivo: 'VENTANA_VENCIDA' as const,
        conflictos: [`Cerró a las ${formatearMinutos(cierreFinal(c, j) ?? 0)} y ya no se alcanza a llegar a tiempo.`],
      },
    ];
  });
  const castigo = vencidas.reduce(
    (suma, j) => suma + (c.prioridad[j] === 1 ? pesoNoAtendidaPrioridad : pesoNoAtendida),
    0,
  );

  return {
    orden: detalle.map((d) => d.id),
    detalle,
    enRiesgo,
    noAtendidas,
    regreso: it.regreso,
    regresoTardio: it.regreso > horaLimiteRegresoMin,
    costo: it.costo + castigo,
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
  for (const n of despues.noAtendidas.slice(0, 2)) partes.push(`${n.nombre} ya cerró.`);
  if (despues.regresoTardio) partes.push(`Regresarías al depósito a las ${formatearMinutos(despues.regreso)}.`);
  return partes.join(' ');
};
