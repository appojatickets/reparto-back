import { describe, expect, it } from 'vitest';
import { calleYNumero } from './direccion-calle.js';

describe('calleYNumero', () => {
  it('separa la calle del número de la puerta', () => {
    expect(calleYNumero('Av. Providencia 1234')).toEqual({ calle: 'providencia', numero: 1234 });
    expect(calleYNumero('Los Leones 45')).toEqual({ calle: 'los leones', numero: 45 });
  });

  it('«Avenida», «calle» o «pasaje» no cambian la calle: es la misma con o sin ellos', () => {
    const a = calleYNumero('Avenida Los Leones 45');
    const b = calleYNumero('Av Los Leones 120');
    const c = calleYNumero('Los Leones 3000');
    expect(a?.calle).toBe('los leones');
    expect(b?.calle).toBe('los leones');
    expect(c?.calle).toBe('los leones');
  });

  it('ignora oficina, depto, block y otros complementos que vienen después del número', () => {
    expect(calleYNumero('Gran Avenida 5400 Of 12')).toEqual({ calle: 'gran avenida', numero: 5400 });
    expect(calleYNumero('Pasaje Los Olmos 88 Depto 3')).toEqual({ calle: 'los olmos', numero: 88 });
    expect(calleYNumero('Santa Rosa 1020, Block 4')).toEqual({ calle: 'santa rosa', numero: 1020 });
  });

  it('el número es el último: una calle que se llama con número no lo confunde', () => {
    expect(calleYNumero('5 de Abril 1234')).toEqual({ calle: '5 de abril', numero: 1234 });
    expect(calleYNumero('Los Pinos 3 Norte')).toEqual({ calle: 'los pinos 3 norte' });
  });

  it('no cuenta la comuna que viene al final', () => {
    expect(calleYNumero('Av. Colón 1500 Maipú', 'Maipú')).toEqual({ calle: 'colon', numero: 1500 });
    expect(calleYNumero('Av. Colón 1500, Maipú', 'Maipú')).toEqual({ calle: 'colon', numero: 1500 });
  });

  it('sin número (S/N, camino) igual reconoce la calle', () => {
    expect(calleYNumero('Camino El Alba S/N')).toEqual({ calle: 'el alba' });
    expect(calleYNumero('Camino El Alba')).toEqual({ calle: 'el alba' });
  });

  it('no inventa una calle donde no la hay', () => {
    expect(calleYNumero('Sin dirección')).toBeUndefined();
    expect(calleYNumero('Ubicación en el mapa (-33.5, -70.6)')).toBeUndefined();
    expect(calleYNumero('1234')).toBeUndefined();
    expect(calleYNumero('')).toBeUndefined();
  });
});
