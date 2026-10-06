import { crearCoordenada, dentroDeRegionMetropolitana, type Coordenada } from './coordenada.js';

/** Dominios desde los que se acepta (y se sigue) un enlace compartido: solo mapas, nunca una dirección cualquiera. */
const HOSTS_DE_MAPAS = ['maps.app.goo.gl', 'goo.gl', 'waze.com', 'www.waze.com', 'ul.waze.com', 'google.com', 'www.google.com', 'maps.google.com', 'google.cl', 'www.google.cl'];

export const esHostDeMapas = (host: string): boolean => HOSTS_DE_MAPAS.includes(host.toLowerCase());

/** El primer enlace https dentro de un texto (lo que llega pegado desde WhatsApp suele traer palabras alrededor). */
export const extraerEnlace = (texto: string): URL | undefined => {
  const m = /https?:\/\/[^\s<>"']+/i.exec(texto);
  if (!m) return undefined;
  try {
    const url = new URL(m[0].replace(/[.,;)]+$/, ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
};

const numero = (t: string | undefined): number | undefined => {
  if (t === undefined) return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const coordenada = (lat: string | undefined, lng: string | undefined): Coordenada | undefined => {
  const la = numero(lat);
  const lo = numero(lng);
  if (la === undefined || lo === undefined) return undefined;
  const c = crearCoordenada(la, lo);
  return c.ok && dentroDeRegionMetropolitana(c.value) ? c.value : undefined;
};

const PAR = '(-?\\d{1,3}(?:\\.\\d+)?)\\s*,\\s*\\+?(-?\\d{1,3}(?:\\.\\d+)?)';

/**
 * Lee el punto de un enlace largo de Google Maps o Waze, o unas coordenadas escritas («-33.4372, -70.6506»).
 * Formatos: `!3d…!4d…` (el lugar exacto), `@lat,lng`, `?q=`/`ll=`/`destination=`/`query=`/`center=` y `ll.lat,lng` (Waze).
 * Devuelve undefined si no hay punto o cae fuera de la Región Metropolitana. Los enlaces cortos no traen coordenadas: hay que abrirlos.
 */
export const leerCoordenadaDeEnlace = (texto: string): Coordenada | undefined => {
  const url = extraerEnlace(texto);
  if (!url) {
    const partes = texto.split(';');
    if (partes.length === 2) return coordenada(partes[0]?.trim(), partes[1]?.trim());
    const plano = new RegExp(`^\\s*${PAR}\\s*$`).exec(texto);
    return plano ? coordenada(plano[1], plano[2]) : undefined;
  }
  let completo = url.href;
  try {
    completo = decodeURIComponent(completo);
  } catch {
    /* se lee tal cual */
  }
  const exacto = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(completo);
  if (exacto) return coordenada(exacto[1], exacto[2]);
  const arroba = new RegExp(`@${PAR}`).exec(completo);
  if (arroba) return coordenada(arroba[1], arroba[2]);
  const parametro = new RegExp(`[?&](?:q|ll|destination|query|center|viewpoint|daddr)=\\+?${PAR}`).exec(completo);
  if (parametro) return coordenada(parametro[1], parametro[2]);
  const waze = new RegExp(`[?&=]ll\\.${PAR}`).exec(completo);
  if (waze) return coordenada(waze[1], waze[2]);
  const ruta = new RegExp(`/maps/(?:search|place)/\\+?${PAR}`).exec(completo);
  return ruta ? coordenada(ruta[1], ruta[2]) : undefined;
};

const DECIMAL = '(-?\\d{1,3}\\.\\d{3,})';

/**
 * Cuando el enlace compartido no trae el punto en la dirección (Google identifica el lugar por un código interno), la propia página
 * del lugar sí lo lleva: en la imagen del mapa (`center=lat,lng`), en la posición inicial de la vista (`[[[zoom,lng,lat]`) o en
 * una dirección con `@lat,lng`. Se prueban en ese orden y se acepta solo lo que cae en la Región Metropolitana.
 */
export const leerCoordenadaDeHtml = (html: string): Coordenada | undefined => {
  const texto = html.replace(/&amp;/g, '&').replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&');
  const imagen = new RegExp(`center=${DECIMAL}(?:%2C|,)${DECIMAL}`).exec(texto);
  if (imagen) {
    const c = coordenada(imagen[1], imagen[2]);
    if (c) return c;
  }
  const inicial = new RegExp(`APP_INITIALIZATION_STATE=\\[\\[\\[\\s*-?[\\d.]+\\s*,\\s*${DECIMAL}\\s*,\\s*${DECIMAL}`).exec(texto);
  if (inicial) {
    const c = coordenada(inicial[2], inicial[1]);
    if (c) return c;
  }
  const arroba = new RegExp(`@${DECIMAL},${DECIMAL}`).exec(texto);
  if (arroba) {
    const c = coordenada(arroba[1], arroba[2]);
    if (c) return c;
  }
  const exacto = new RegExp(`!3d${DECIMAL}!4d${DECIMAL}`).exec(texto);
  return exacto ? coordenada(exacto[1], exacto[2]) : undefined;
};
