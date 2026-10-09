import { describe, expect, it } from 'vitest';
import { aliasSugerido, coincidirPersona, validarFilaPlanilla } from './planilla.js';

describe('validarFilaPlanilla', () => {
  it('normaliza patente, vendedores y comunas, y quita los espacios y guiones sobrantes', () => {
    const r = validarFilaPlanilla({
      patente: 'SDTS-23', chofer: '  Ricardo   Mora ', ayudante: 'Jonnathan araya',
      vendedores: [{ codigo: 'v12', nombre: ' Mario Quiroz ' }, { codigo: 'V13' }, { codigo: 'V12' }],
      comunas: ['san bernardo', 'Maipu', 'maipú'],
    });
    expect(r).toEqual({ ok: true, value: {
      patente: 'SDTS23', chofer: 'Ricardo Mora', ayudante: 'Jonnathan araya',
      vendedores: [{ codigo: 'V12', nombre: 'Mario Quiroz' }, { codigo: 'V13' }], comunas: ['San Bernardo', 'Maipú'],
    } });
  });

  it('solo la patente es obligatoria', () => {
    expect(validarFilaPlanilla({ patente: 'DJTT71' })).toEqual({ ok: true, value: { patente: 'DJTT71', vendedores: [], comunas: [] } });
    expect(validarFilaPlanilla({ patente: 'DJTT71', chofer: '-', ayudante: '' })).toEqual({ ok: true, value: { patente: 'DJTT71', vendedores: [], comunas: [] } });
  });

  it('informa todos los errores: patente que no es patente (CABINET), vendedor y comuna inválidos', () => {
    const r = validarFilaPlanilla({ patente: 'CABINET', vendedores: [{ codigo: 'X1' }], comunas: ['Valparaíso'] });
    expect(!r.ok && r.error.map((e) => e.codigo)).toEqual(['PATENTE_INVALIDA', 'CODIGO_VENDEDOR_INVALIDO', 'COMUNA_INVALIDA']);
  });
});

describe('aliasSugerido', () => {
  it('los dos últimos dígitos de la patente', () => {
    expect(aliasSugerido('SDTS23')).toBe('23');
    expect(aliasSugerido('AB1234')).toBe('34');
  });
});

describe('coincidirPersona', () => {
  const usuarios = [
    { id: 1, nombre: 'Ricardo Mora Soto' }, { id: 2, nombre: 'Juan Aguilar Pérez' }, { id: 3, nombre: 'Manuel Aguilar Rojas' },
    { id: 4, nombre: 'Francisco Negrete' }, { id: 5, nombre: 'Francisco Ulloa Díaz' }, { id: 6, nombre: 'Max García' },
  ];

  it('encuentra a quien aparece con menos apellidos en la planilla, sin importar tildes ni mayúsculas', () => {
    expect(coincidirPersona('Ricardo Mora', usuarios)?.id).toBe(1);
    expect(coincidirPersona('juan AGUILAR', usuarios)?.id).toBe(2);
    expect(coincidirPersona('Francisco negrete', usuarios)?.id).toBe(4);
    expect(coincidirPersona('Max garcia', usuarios)?.id).toBe(6);
  });

  it('distingue a dos personas con el mismo apellido', () => {
    expect(coincidirPersona('Manuel aguilar', usuarios)?.id).toBe(3);
  });

  it('también si el usuario tiene menos palabras que la planilla', () => {
    expect(coincidirPersona('Francisco Negrete Araya', usuarios)?.id).toBe(4);
  });

  it('con un solo nombre, con ambigüedad o sin parecido no elige a nadie', () => {
    expect(coincidirPersona('Francisco', usuarios)).toBeUndefined();
    expect(coincidirPersona('Aguilar', usuarios)).toBeUndefined();
    expect(coincidirPersona('Pedro Pérez', usuarios)).toBeUndefined();
    expect(coincidirPersona('', usuarios)).toBeUndefined();
    expect(coincidirPersona('Juan Aguilar', [{ nombre: 'Juan Aguilar Pérez' }, { nombre: 'Juan Aguilar Soto' }])).toBeUndefined();
  });
});
