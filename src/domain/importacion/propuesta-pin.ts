import { distanciaKm, type Coordenada } from '../valor/coordenada.js';

export const distanciaMetros = (a: Coordenada, b: Coordenada): number => distanciaKm(a, b) * 1000;
