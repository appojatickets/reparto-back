import type { Usuario } from '../../domain/entidades/usuario.js';
import { validarHorarioSemanal, type DiaHorario, type DiaHorarioCrudo } from '../../domain/entidades/horario-semanal.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { HorarioRepository } from '../ports/out/horarios.js';

const noExiste = () => errorApp('NO_ENCONTRADO', 'El local no existe.');

export const crearObtenerHorario = ({ horarios }: { horarios: HorarioRepository }) =>
  async (actor: Usuario, localId: string): Promise<Result<readonly DiaHorario[], ErrorApp>> => {
    const h = await horarios.obtenerManual(actor.empresaId, localId);
    return h ? ok(h) : err(noExiste());
  };

export const crearGuardarHorario = ({ horarios }: { horarios: HorarioRepository }) =>
  async (actor: Usuario, localId: string, dias: readonly DiaHorarioCrudo[]): Promise<Result<readonly DiaHorario[], ErrorApp>> => {
    const v = validarHorarioSemanal(dias);
    if (!v.ok) return err(errorApp('VALIDACION', v.error.map((e) => e.mensaje).join(' '), { errores: v.error }));
    const existe = await horarios.reemplazarManual(actor.empresaId, localId, v.value);
    return existe ? ok(v.value) : err(noExiste());
  };
