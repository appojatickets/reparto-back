import { resolverComuna } from '../../domain/comunas.js';
import type { Coordenada } from '../../domain/valor/coordenada.js';
import { calleYNumero } from '../../domain/valor/direccion-calle.js';
import { ubicarPorOrdenDeCarga, type AnclaDeCarga } from '../../domain/ruteo/ubicacion-por-carga.js';
import { ubicarPorCalle, type AnclaDeCalle, type ParadaPorUbicar } from '../../domain/ruteo/ubicacion-por-calle.js';
import type { FacturaParaRuta, HechaConUbicacion, PinDeLocal } from '../ports/out/rutas.js';

/** La calle de una factura con su comuna: dos facturas con la misma clave están en la misma calle. */
export const claveDeCalle = (direccion: string, comuna: string): { readonly clave: string; readonly calle: string; readonly numero?: number } | undefined => {
  const d = calleYNumero(direccion, comuna);
  return d ? { clave: `${resolverComuna(comuna) ?? comuna.trim().toLowerCase()}|${d.calle}`, calle: d.calle, ...(d.numero !== undefined ? { numero: d.numero } : {}) } : undefined;
};

const tienePinExacto = (f: FacturaParaRuta): boolean => f.lat !== undefined && f.lng !== undefined && f.pinAproximado !== true;

/**
 * Qué sabe la ruta de dónde está cada factura del día:
 *  - `ordenCarga`: el lugar en que el chofer la cargó (0 = la primera).
 *  - `estimadas`: dónde queda, aproximadamente, la que no tiene un pin exacto (sin pin, o con un pin hallado solo hasta la calle). Primero por su
 *    calle y número (junto a las demás puertas de esa calle: pines de otras facturas, entregas del día y locales ya ubicados) y, si su calle no
 *    se reconoce, entre las facturas de su comuna cargadas justo antes y después. Sin nada de eso no está en el mapa y queda el centro de la comuna.
 *  - `calles`: la calle de cada factura, para que la ruta la termine antes de dejarla.
 *  - `inciertas`: las que quedaron sin pin exacto y sin una calle que las ubique: solo se adivina dónde están, y ahí el orden de carga es la única pista.
 */
export const ubicarFacturas = (items: readonly FacturaParaRuta[], hechas: readonly HechaConUbicacion[], pinesDeLocales: readonly PinDeLocal[] = []) => {
  const conTiempo = items.every((f) => f.cargadaEn !== undefined);
  const claves = conTiempo
    ? [...items.map((f) => ({ id: f.facturaId, t: f.cargadaEn ?? 0 })), ...hechas.map((h, i) => ({ id: `hecha:${String(i)}`, t: h.cargadaEn }))]
    : items.map((f, i) => ({ id: f.facturaId, t: i }));
  const rango = new Map([...claves].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((x, i) => [x.id, i]));
  const ordenCarga = new Map(items.map((f) => [f.facturaId, rango.get(f.facturaId) ?? 0]));

  const anclasDeCarga: AnclaDeCarga[] = [
    ...items.flatMap((f) => (f.lat !== undefined && f.lng !== undefined ? [{ orden: rango.get(f.facturaId) ?? 0, comuna: f.comuna, coordenada: { lat: f.lat, lng: f.lng } }] : [])),
    ...(conTiempo ? hechas.map((h, i) => ({ orden: rango.get(`hecha:${String(i)}`) ?? 0, comuna: h.comuna, coordenada: { lat: h.lat, lng: h.lng } })) : []),
  ];
  const porCarga = (comuna: string, orden: number): Coordenada | undefined => ubicarPorOrdenDeCarga({ orden, comuna }, anclasDeCarga);

  const calles = new Map<string, string>();
  const porUbicar: ParadaPorUbicar[] = [];
  for (const f of items) {
    const d = claveDeCalle(f.direccion, f.comuna);
    if (!d) continue;
    calles.set(f.facturaId, d.clave);
    porUbicar.push({
      id: f.facturaId,
      comuna: f.comuna,
      calle: d.calle,
      ...(d.numero !== undefined ? { numero: d.numero } : {}),
      orden: rango.get(f.facturaId) ?? 0,
      ...(f.lat !== undefined && f.lng !== undefined ? { coordenada: { lat: f.lat, lng: f.lng } } : {}),
      ...(f.pinAproximado === true ? { aproximada: true } : {}),
    });
  }

  // Puertas con ubicación conocida que no son de las facturas de hoy: lo ya entregado y los locales con pin confiable de la empresa.
  const hoy = new Set(items.map((f) => f.localId));
  const externas: AnclaDeCalle[] = [
    ...hechas.map((h) => ({ direccion: h.direccion, comuna: h.comuna, lat: h.lat, lng: h.lng })),
    ...pinesDeLocales.filter((p) => !hoy.has(p.localId)),
  ].flatMap((p) => {
    const d = calleYNumero(p.direccion, p.comuna);
    return d ? [{ comuna: p.comuna, calle: d.calle, ...(d.numero !== undefined ? { numero: d.numero } : {}), coordenada: { lat: p.lat, lng: p.lng } }] : [];
  });
  const porCalle = ubicarPorCalle(porUbicar, externas, porCarga);
  const adivinadas = porCalle.sinPuertasConocidas;

  const estimadas = new Map<string, Coordenada>();
  const inciertas = new Set<string>();
  for (const f of items) {
    if (tienePinExacto(f)) continue;
    const porSuCalle = porCalle.ubicadas.get(f.facturaId);
    const u = porSuCalle ?? (f.lat === undefined ? porCarga(f.comuna, rango.get(f.facturaId) ?? 0) : undefined);
    if (u) estimadas.set(f.facturaId, u);
    if (porSuCalle === undefined || adivinadas.has(f.facturaId)) inciertas.add(f.facturaId);
  }

  // Las de una calle de la que no se conoce ninguna puerta están donde las adivina el orden de carga, pero entre sí las ordena su número: todas
  // comparten el lugar de carga de su calle (el del medio), así el orden de carga guía a la calle entera y no las desordena por dentro.
  const lugaresPorCalle = new Map<string, number[]>();
  for (const f of items) {
    const clave = calles.get(f.facturaId);
    if (clave !== undefined && adivinadas.has(f.facturaId)) lugaresPorCalle.set(clave, [...(lugaresPorCalle.get(clave) ?? []), rango.get(f.facturaId) ?? 0]);
  }
  for (const f of items) {
    const clave = calles.get(f.facturaId);
    const lugares = clave !== undefined && adivinadas.has(f.facturaId) ? lugaresPorCalle.get(clave) : undefined;
    if (lugares) ordenCarga.set(f.facturaId, [...lugares].sort((a, b) => a - b)[lugares.length >> 1] ?? 0);
  }
  return { ordenCarga, estimadas, calles, inciertas };
};
