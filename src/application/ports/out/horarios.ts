import type { DiaHorario } from '../../../domain/entidades/horario-semanal.js';

/** Horario que una persona declara a mano (fuente «confirmado»): manda sobre lo aprendido, sugerido o por giro. */
export interface HorarioRepository {
  /** `undefined` si el local no existe en la empresa. Los días sin dato no aparecen. */
  obtenerManual(empresaId: string, localId: string): Promise<readonly DiaHorario[] | undefined>;
  /** Reemplaza todo el horario manual del local. Devuelve false si el local no existe. */
  reemplazarManual(empresaId: string, localId: string, dias: readonly DiaHorario[]): Promise<boolean>;
}
