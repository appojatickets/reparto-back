import { describe, expect, it, vi } from 'vitest';
import type { HorarioRepository } from '../ports/out/horarios.js';
import { usuarioDe } from './fakes.test-util.js';
import { crearGuardarHorario, crearObtenerHorario } from './horarios.js';

const despachador = usuarioDe({ id: 'u-d', rol: 'despachador' });
const fake = () => ({
  obtenerManual: vi.fn<HorarioRepository['obtenerManual']>(() => Promise.resolve([{ dia: 1, cerrado: false, tramos: [{ desde: 600, hasta: 1080 }] }])),
  reemplazarManual: vi.fn<HorarioRepository['reemplazarManual']>(() => Promise.resolve(true)),
});

describe('horario manual del local', () => {
  it('obtiene el horario de la empresa del usuario; local ajeno o inexistente → NO_ENCONTRADO', async () => {
    const horarios = fake();
    const r = await crearObtenerHorario({ horarios })(despachador, 'l-1');
    expect(r.ok && r.value).toHaveLength(1);
    expect(horarios.obtenerManual).toHaveBeenCalledWith('empresa-1', 'l-1');
    horarios.obtenerManual.mockResolvedValueOnce(undefined);
    const n = await crearObtenerHorario({ horarios })(despachador, 'l-2');
    expect(!n.ok && n.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('valida antes de guardar y guarda ordenado', async () => {
    const horarios = fake();
    const guardar = crearGuardarHorario({ horarios });
    const r = await guardar(despachador, 'l-1', [{ dia: 2, cerrado: true, tramos: [] }, { dia: 1, cerrado: false, tramos: [{ desde: 840, hasta: 1080 }, { desde: 600, hasta: 780 }] }]);
    expect(r.ok && r.value.map((d) => d.dia)).toEqual([1, 2]);
    expect(horarios.reemplazarManual).toHaveBeenCalledWith('empresa-1', 'l-1', [
      { dia: 1, cerrado: false, tramos: [{ desde: 600, hasta: 780 }, { desde: 840, hasta: 1080 }] },
      { dia: 2, cerrado: true, tramos: [] },
    ]);
    const mala = await guardar(despachador, 'l-1', [{ dia: 1, cerrado: false, tramos: [{ desde: 900, hasta: 800 }] }]);
    expect(!mala.ok && mala.error.codigo).toBe('VALIDACION');
    expect(horarios.reemplazarManual).toHaveBeenCalledTimes(1);
  });

  it('un local inexistente al guardar es NO_ENCONTRADO', async () => {
    const horarios = fake();
    horarios.reemplazarManual.mockResolvedValueOnce(false);
    const r = await crearGuardarHorario({ horarios })(despachador, 'l-9', []);
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });
});
