import { describe, expect, it } from 'vitest';
import { validarPin } from './pin.js';
import { generarUsername, usernameValido } from './username.js';

describe('validarPin (clave numérica de 6 dígitos)', () => {
  it.each(['482915', '070809', '905031'])('acepta %s', (pin) => {
    expect(validarPin(pin).ok).toBe(true);
  });

  it.each(['12345', '1234567', 'abcdef', '12 456', ''])('rechaza formato %s', (pin) => {
    const r = validarPin(pin);
    expect(!r.ok && r.error.codigo).toBe('PIN_FORMATO_INVALIDO');
  });

  it.each(['000000', '111111', '123456', '654321', '012345'])('rechaza el PIN débil %s', (pin) => {
    const r = validarPin(pin);
    expect(!r.ok && r.error.codigo).toBe('PIN_DEBIL');
  });
});

describe('generarUsername (inicial del nombre + primer apellido)', () => {
  it('genera sin tildes ni espacios', () => {
    expect(generarUsername('Juan', 'Pérez', undefined, new Set())).toBe('jperez');
    expect(generarUsername('Ñandú', 'De la Cruz', undefined, new Set())).toBe('ndelacruz');
  });

  it('si existe, agrega la inicial del segundo apellido; si sigue chocando, un número', () => {
    expect(generarUsername('Juan', 'Pérez', 'González', new Set(['jperez']))).toBe('jperezg');
    expect(generarUsername('Juan', 'Pérez', 'González', new Set(['jperez', 'jperezg']))).toBe('jperezg2');
    expect(generarUsername('Juan', 'Pérez', undefined, new Set(['jperez', 'jperez2']))).toBe('jperez3');
  });

  it('valida el formato de un usuario', () => {
    expect(usernameValido('jperez')).toBe(true);
    expect(usernameValido('ab')).toBe(false);
    expect(usernameValido('J.Perez')).toBe(false);
    expect(usernameValido('a'.repeat(31))).toBe(false);
  });
});
