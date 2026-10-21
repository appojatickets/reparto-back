import { describe, expect, it } from 'vitest';
import { alternativaConservaDireccion } from './direccion-alternativa.js';
describe('una ayuda de IA conserva la identidad de la dirección', () => {
  it('tolera escritura incorrecta y expansión de nombres conservando el número', () => {
    expect(alternativaConservaDireccion('OHigins 955', "Avenida Libertador Bernardo O'Higgins 955")).toBe(true);
    expect(alternativaConservaDireccion('Camino Santa Rta 45', 'Camino Santa Rita 45')).toBe(true);
  });
  it('rechaza cambiar de calle, de número o perder una parte identificadora', () => {
    expect(alternativaConservaDireccion('Calle Falsa 955', "O'Higgins 955")).toBe(false);
    expect(alternativaConservaDireccion('Santa Rita 45', 'Santa Rosa 45')).toBe(false);
    expect(alternativaConservaDireccion('OHigins 955', "O'Higgins 9550")).toBe(false);
    expect(alternativaConservaDireccion('123', 'Nueva Calle 123')).toBe(false);
  });
});
