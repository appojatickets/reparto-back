import { validarEmergencia, type EmergenciaCruda } from '../../domain/entidades/emergencia.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { esFechaValida } from '../../domain/shared/fechas.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { EmergenciaRegistrada, EmergenciaRepository } from '../ports/out/emergencias.js';
import type { ResolverCamion } from './jornada.js';

/**
 * «Voy a un mecánico / vulcanización» (ADR 0048): queda anotada la parada de emergencia con la hora y dónde estaba el camión. No es una entrega
 * ni toca ninguna factura: explica el tiempo perdido del día. Siempre es del camión de la jornada de quien avisa.
 */
export const crearRegistrarEmergencia = ({ emergencias, resolverCamion }: { emergencias: EmergenciaRepository; resolverCamion: ResolverCamion }) =>
  async (actor: Usuario, entrada: EmergenciaCruda): Promise<Result<EmergenciaRegistrada, ErrorApp>> => {
    const v = validarEmergencia(entrada);
    if (!v.ok) return err(errorApp('VALIDACION', v.error.map((e) => e.mensaje).join(' '), { errores: v.error }));
    const camion = await resolverCamion(actor, undefined);
    if (!camion.ok) return camion;
    if (camion.value === undefined) return err(errorApp('VALIDACION', 'Primero elige el camión que manejas hoy.', { codigo: 'SIN_JORNADA' }));
    return ok(await emergencias.registrar(actor.empresaId, { ...v.value, camionId: camion.value, usuarioId: actor.id }));
  };

/** Las paradas de emergencia del día. El chofer solo ve las de su camión; despacho y admin, las del camión pedido o todas. */
export const crearListarEmergencias = ({ emergencias, resolverCamion }: { emergencias: EmergenciaRepository; resolverCamion: ResolverCamion }) =>
  async (actor: Usuario, entrada: { fecha: string; camionId?: string | undefined }): Promise<Result<readonly EmergenciaRegistrada[], ErrorApp>> => {
    if (!esFechaValida(entrada.fecha)) return err(errorApp('VALIDACION', 'La fecha no es válida.'));
    const camion = await resolverCamion(actor, entrada.camionId);
    if (!camion.ok) return camion;
    return ok(await emergencias.delDia(actor.empresaId, entrada.fecha, camion.value));
  };
