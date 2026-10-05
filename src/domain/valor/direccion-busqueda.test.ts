import { describe, expect, it } from 'vitest';
import { direccionParaBuscar } from './direccion-busqueda.js';

describe('dirección lista para buscar en un mapa', () => {
  it.each([
    ['Camino Santa Rita Parcela Nº 4', 'Camino Santa Rita'],
    ['Calle Alameda 114', 'Calle Alameda 114'],
    ['Av. Irarrazabal S/N', 'Avenida Irarrazabal'],
    ['Cam. Padre Hurtado 31280', 'Camino Padre Hurtado 31280'],
    ['La Romana Sitio 32 Chada', 'La Romana Chada'],
    ['Lonquen Sur Paradero 28', 'Lonquen Sur Paradero 28'],
    ['Camino el Cerrillo 2749 Linderos', 'Camino el Cerrillo 2749 Linderos'],
    ['Peralillo St 7 Lote 7A', 'Peralillo'],
    ['Pasaje Siete 2716', 'Pasaje Siete 2716'],
    ['Pje. Obispo Aguilera 907', 'Pasaje Obispo Aguilera 907'],
    ['21 de Mayo 4548 Loc. B', '21 de Mayo 4548'],
    ['Sta. Rita 5154', 'Santa Rita 5154'],
  ])('«%s» → «%s»', (entrada, esperado) => {
    expect(direccionParaBuscar(entrada)).toBe(esperado);
  });

  it.each(['', '   ', 'Sin dirección', 'Ubicación en el mapa (-33.7, -70.9)', 'Sin nombre · Calle 1', 'Parcela 4 Sitio 2', 'Camino 12', 'S/N'])('no hay nada que buscar en «%s»', (entrada) => {
    expect(direccionParaBuscar(entrada)).toBeUndefined();
  });
});
