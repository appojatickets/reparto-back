import { describe, expect, it } from 'vitest';
import { disponibleParaReparto } from './cliente.js';
import { claveNegocioLocal, normalizarTexto } from './local.js';

describe('Cliente', () => {
  it('solo los clientes nuevos y activos se pueden repartir', () => {
    expect(disponibleParaReparto('nuevo')).toBe(true);
    expect(disponibleParaReparto('activo')).toBe(true);
    expect(disponibleParaReparto('inactivo')).toBe(false);
    expect(disponibleParaReparto('cerrado')).toBe(false);
    expect(disponibleParaReparto('archivado')).toBe(false);
  });
});

describe('Local', () => {
  it('normalizarTexto quita tildes, mayúsculas, puntuación y espacios repetidos', () => {
    expect(normalizarTexto('  Av. Providencia   1234, Ñuñoa ')).toBe('av providencia 1234 nunoa');
  });

  it('la clave de negocio es RUT + dirección normalizada', () => {
    expect(claveNegocioLocal('12345678-5', 'Calle Falsa 123')).toBe(claveNegocioLocal('12345678-5', ' calle  FALSA 123 '));
    expect(claveNegocioLocal('12345678-5', 'Calle Falsa 123')).not.toBe(claveNegocioLocal('11111111-1', 'Calle Falsa 123'));
  });

  it('sin RUT se usa solo la dirección, marcada como tal', () => {
    expect(claveNegocioLocal(undefined, 'Calle Falsa 123')).toBe('sin-rut|calle falsa 123');
  });
});
