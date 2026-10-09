import { describe, expect, it } from 'vitest';
import { validarReporteLocal } from './reporte-local.js';

describe('validarReporteLocal', () => {
  it('acepta nombre o ubicación, con la explicación limpia y el nombre sugerido solo en «nombre»', () => {
    expect(validarReporteLocal({ tipo: 'nombre', detalle: '  Se llama   otro ', sugerido: ' Bazar  Sol ' })).toEqual({ ok: true, value: { tipo: 'nombre', detalle: 'Se llama otro', sugerido: 'Bazar Sol' } });
    expect(validarReporteLocal({ tipo: 'ubicacion', sugerido: 'ignorado' })).toEqual({ ok: true, value: { tipo: 'ubicacion' } });
  });

  it('rechaza un tipo desconocido y textos demasiado largos', () => {
    expect(validarReporteLocal({ tipo: 'foto' }).ok).toBe(false);
    expect(validarReporteLocal({}).ok).toBe(false);
    const largo = validarReporteLocal({ tipo: 'nombre', detalle: 'x'.repeat(201), sugerido: 'y'.repeat(121) });
    expect(!largo.ok && largo.error.map((e) => e.codigo)).toEqual(['DETALLE_LARGO', 'NOMBRE_LARGO']);
  });
});
