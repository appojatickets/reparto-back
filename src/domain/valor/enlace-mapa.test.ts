import { describe, expect, it } from 'vitest';
import { esHostDeMapas, extraerEnlace, leerCoordenadaDeEnlace } from './enlace-mapa.js';

const P = { lat: -33.5972, lng: -70.7019 };

describe('leer coordenadas de un enlace de mapa', () => {
  it.each([
    ['Google ?q=', 'https://maps.google.com/?q=-33.5972,-70.7019'],
    ['Google @ del lugar', 'https://www.google.com/maps/place/Rabelo/@-33.5972,-70.7019,17z/data=!3m1!4b1'],
    ['Google !3d!4d (el lugar exacto, no el centro del mapa)', 'https://www.google.com/maps/place/X/@-33.6,-70.7,17z/data=!4m6!3d-33.5972!4d-70.7019'],
    ['Google destination', 'https://www.google.com/maps/dir/?api=1&destination=-33.5972,-70.7019&travelmode=driving'],
    ['Google search', 'https://www.google.com/maps/search/-33.5972,+-70.7019'],
    ['Google codificado', 'https://www.google.com/maps?q=-33.5972%2C-70.7019'],
    ['Waze ll', 'https://waze.com/ul?ll=-33.5972,-70.7019&navigate=yes'],
    ['Waze codificado', 'https://www.waze.com/live-map/directions?to=ll.-33.5972%2C-70.7019'],
    ['con texto alrededor', 'Ubicación: https://maps.google.com/?q=-33.5972,-70.7019 gracias.'],
    ['coordenadas escritas', '-33.5972, -70.7019'],
    ['con coma decimal y punto y coma', '-33,5972; -70,7019'],
  ])('%s', (_n, texto) => {
    expect(leerCoordenadaDeEnlace(texto)).toEqual(P);
  });

  it('prefiere el lugar exacto (!3d!4d) al centro del mapa (@)', () => {
    expect(leerCoordenadaDeEnlace('https://www.google.com/maps/place/X/@-33.1,-70.1,17z/data=!3d-33.5972!4d-70.7019')).toEqual(P);
  });

  it.each([
    ['sin punto', 'https://maps.app.goo.gl/AbCdEf123'],
    ['fuera de la Región Metropolitana', 'https://maps.google.com/?q=40.4168,-3.7038'],
    ['texto cualquiera', 'hola'],
    ['vacío', ''],
    ['un solo número', '-33.5972'],
  ])('rechaza: %s', (_n, texto) => {
    expect(leerCoordenadaDeEnlace(texto)).toBeUndefined();
  });

  it('extraerEnlace toma el primer enlace y le quita la puntuación final', () => {
    expect(extraerEnlace('mira https://maps.app.goo.gl/AbC. gracias')?.href).toBe('https://maps.app.goo.gl/AbC');
    expect(extraerEnlace('sin enlace')).toBeUndefined();
    expect(extraerEnlace('ftp://x.cl/a')).toBeUndefined();
  });

  it('solo se siguen enlaces de Google Maps y Waze', () => {
    expect(esHostDeMapas('maps.app.goo.gl')).toBe(true);
    expect(esHostDeMapas('WWW.WAZE.COM')).toBe(true);
    expect(esHostDeMapas('evil.com')).toBe(false);
    expect(esHostDeMapas('maps.app.goo.gl.evil.com')).toBe(false);
    expect(esHostDeMapas('127.0.0.1')).toBe(false);
  });
});
