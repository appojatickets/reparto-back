import { describe, expect, it } from 'vitest';
import { crearAzar } from '../shared/azar.js';
import { distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { armarProblema, type EntradaParada } from './armar-problema.js';
import { optimizar } from './optimizador.js';

const DEPOSITO = { lat: -33.5, lng: -70.7 };
const base = { fecha: '2026-10-05', deposito: DEPOSITO, salida: 540, horaLimiteRegresoMin: 1260 };

const orientacion = (p: Coordenada, q: Coordenada, r: Coordenada): number => (q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng);
const seCruzan = (a: Coordenada, b: Coordenada, c: Coordenada, d: Coordenada): boolean =>
  orientacion(a, b, c) * orientacion(a, b, d) < 0 && orientacion(c, d, a) * orientacion(c, d, b) < 0;

/** Cuántas veces el recorrido se cruza a sí mismo (dos tramos que no son vecinos y se cortan): es lo que se ve como zigzag en el mapa. */
const cruces = (puntos: readonly Coordenada[]): number => {
  let n = 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    for (let j = i + 2; j < puntos.length - 1; j++) {
      const [a, b, c, d] = [puntos[i], puntos[i + 1], puntos[j], puntos[j + 1]];
      if (a && b && c && d && seCruzan(a, b, c, d)) n++;
    }
  }
  return n;
};

describe('la ruta que arma la aplicación no hace zigzag', () => {
  it('30 paradas con pin repartidas al azar: el recorrido no se cruza consigo mismo', { timeout: 60_000 }, () => {
    let total = 0;
    for (let semilla = 1; semilla <= 4; semilla++) {
      const azar = crearAzar(semilla);
      const coordenadas = new Map<string, Coordenada>();
      const entradas: EntradaParada[] = Array.from({ length: 30 }, (_, i) => {
        const coordenada = { lat: -33.6 + azar.siguiente() * 0.15, lng: -70.75 + azar.siguiente() * 0.15 };
        coordenadas.set(`p${String(i)}`, coordenada);
        // El orden de carga no sigue las calles: no debe arrastrar a la ruta fuera de lo que queda cerca.
        return { id: `p${String(i)}`, nombre: `Local ${String(i)}`, coordenada, horarios: [], urgente: false, ordenCarga: azar.entero(30) };
      });
      const { problema } = armarProblema({ ...base, entradas });
      const s = optimizar(problema);
      total += cruces([DEPOSITO, ...s.orden.map((id) => coordenadas.get(id) ?? DEPOSITO), DEPOSITO]);
    }
    expect(total).toBe(0);
  });

  it('las paradas de una calle sin pin quedan juntas y por número, aunque se hayan cargado mezcladas con otras calles', () => {
    // Dos calles paralelas, ninguna con pin: las facturas se cargaron mezcladas.
    const calles = [{ nombre: 'Los Aromos', numeros: [100, 900, 300, 1500, 600] }, { nombre: 'Freire', numeros: [1200, 200, 800, 400, 1000] }];
    const entradas: EntradaParada[] = [];
    const ubicaciones = new Map<string, Coordenada>();
    let orden = 0;
    for (let i = 0; i < 5; i++) {
      for (const c of calles) {
        const id = `${c.nombre}-${String(c.numeros[i])}`;
        // Sin pin conocido: la aplicación las ubica por su calle y número, que es lo que se prueba acá con ubicaciones equivalentes.
        const coordenada = { lat: c.nombre === 'Freire' ? -33.5 : -33.495, lng: -70.7 + (c.numeros[i] ?? 0) * 0.0000108 };
        ubicaciones.set(id, coordenada);
        entradas.push({ id, nombre: id, coordenada, horarios: [], urgente: false, ordenCarga: orden++, calle: `San Bernardo|${c.nombre}` });
      }
    }
    const s = optimizar(armarProblema({ ...base, entradas }).problema);
    const calleDe = (id: string): string => id.split('-')[0] ?? '';
    const cambios = s.orden.filter((id, i) => i > 0 && calleDe(id) !== calleDe(s.orden[i - 1] ?? '')).length;
    expect(cambios).toBe(1);
    // Dentro de cada calle va de punta a punta, sin saltar de un extremo al otro y volver.
    for (const c of calles) {
      const lngs = s.orden.filter((id) => calleDe(id) === c.nombre).map((id) => ubicaciones.get(id)?.lng ?? 0);
      const sube = lngs.every((x, i) => i === 0 || x >= (lngs[i - 1] ?? 0));
      const baja = lngs.every((x, i) => i === 0 || x <= (lngs[i - 1] ?? 0));
      expect(sube || baja).toBe(true);
    }
    const km = s.orden.reduce((a, id, i) => a + distanciaKm(i === 0 ? DEPOSITO : (ubicaciones.get(s.orden[i - 1] ?? '') ?? DEPOSITO), ubicaciones.get(id) ?? DEPOSITO), 0);
    expect(km).toBeLessThan(40);
  });
});
