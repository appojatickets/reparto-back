import { crearAzar } from '../shared/azar.js';
import { crearCoordenada, type Coordenada } from '../valor/coordenada.js';
import { crearVentana, type VentanaHoraria } from '../valor/ventana-horaria.js';
import { PARAMETROS_POR_DEFECTO } from './parametros.js';
import { crearTiemposHaversine, DEPOSITO, ORIGEN, type TiemposViaje } from './tiempos.js';
import type { ParadaRuta, ProblemaRuta } from './tipos.js';

export const v = (apertura: number, cierre: number): VentanaHoraria => {
  const r = crearVentana(apertura, cierre);
  if (!r.ok) throw new Error('ventana inválida en el test');
  return r.value;
};

/** Todos los tramos duran `minutos` (0 de un nodo a sí mismo). Sin períodos. */
export const tiemposFijos = (minutos: number): TiemposViaje => ({
  cortes: [],
  tiempo: (a, b) => (a === b ? 0 : minutos),
});

export const parada = (id: string, extra: Partial<ParadaRuta> = {}): ParadaRuta => ({
  id,
  nombre: `Local ${id}`,
  ventanas: [],
  servicioMin: 5,
  prioridad: false,
  ...extra,
});

export const problemaPlano = (paradas: ParadaRuta[], extra: Partial<ProblemaRuta> = {}): ProblemaRuta => ({
  salida: 480,
  paradas,
  fijas: [],
  tiempos: tiemposFijos(10),
  ritmo: 1,
  parametros: { ...PARAMETROS_POR_DEFECTO, penalizacionRiesgo: 10_000 },
  ...extra,
});

const coordenada = (lat: number, lng: number): Coordenada => {
  const r = crearCoordenada(lat, lng);
  if (!r.ok) throw new Error('coordenada inválida en el test');
  return r.value;
};

export type OpcionesAleatorias = { readonly fraccionConVentana?: number; readonly salida?: number; readonly ritmo?: number };

/** Problema reproducible con coordenadas en la RM, tiempos haversine por período y ventanas (algunas con colación). */
export const problemaAleatorio = (semilla: number, n: number, opciones: OpcionesAleatorias = {}): ProblemaRuta => {
  const azar = crearAzar(semilla);
  const coords = new Map<string, Coordenada>();
  const deposito = coordenada(-33.5, -70.7);
  coords.set(ORIGEN, deposito);
  coords.set(DEPOSITO, deposito);
  const salida = opciones.salida ?? 510;
  const paradas: ParadaRuta[] = [];
  for (let i = 0; i < n; i++) {
    const id = `p${i}`;
    coords.set(id, coordenada(-33.65 + azar.siguiente() * 0.35, -70.8 + azar.siguiente() * 0.35));
    let ventanas: VentanaHoraria[] = [];
    if (azar.siguiente() < (opciones.fraccionConVentana ?? 0.6)) {
      const apertura = 480 + azar.entero(300);
      const ancho = 45 + azar.entero(240);
      ventanas = [v(apertura, Math.min(1439, apertura + ancho))];
      if (azar.siguiente() < 0.25) ventanas.push(v(Math.min(1300, apertura + ancho + 60), Math.min(1439, apertura + ancho + 240)));
    }
    paradas.push({ id, nombre: `Local ${i}`, ventanas, servicioMin: 3 + azar.entero(10), prioridad: azar.siguiente() < 0.1 });
  }
  return {
    salida,
    paradas,
    fijas: [],
    tiempos: crearTiemposHaversine(coords),
    ritmo: opciones.ritmo ?? 1,
    parametros: { ...PARAMETROS_POR_DEFECTO },
  };
};
