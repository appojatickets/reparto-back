import type { Usuario } from '../../domain/entidades/usuario.js';
import { esDeCamion } from '../../domain/permisos.js';
import { fechaEnChile } from '../../domain/shared/fechas.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { Clock } from '../ports/out/clock.js';
import type { Jornada, JornadaRepository } from '../ports/out/jornadas.js';

type Deps = { readonly jornadas: JornadaRepository; readonly clock: Clock };

export const crearIniciarJornada = ({ jornadas, clock }: Deps) =>
  async (actor: Usuario, camionId: string): Promise<Result<Jornada, ErrorApp>> => {
    const ahora = clock.now();
    const r = await jornadas.iniciar(actor.empresaId, actor.id, camionId, fechaEnChile(ahora), ahora);
    return r.ok ? ok(r.value) : err(errorApp('NO_ENCONTRADO', 'El camión no existe o está fuera de servicio.'));
  };

/** La jornada de hoy del usuario, o `undefined` si todavía no eligió camión. */
export const crearMiJornada = ({ jornadas, clock }: Deps) =>
  (actor: Usuario): Promise<Jornada | undefined> => jornadas.activa(actor.empresaId, actor.id, fechaEnChile(clock.now()));

export const crearTerminarJornada = ({ jornadas, clock }: Deps) =>
  async (actor: Usuario): Promise<void> => {
    await jornadas.terminar(actor.empresaId, actor.id, clock.now());
  };

/**
 * Un chofer solo puede tocar el camión de su jornada de hoy (ADR 0012). Devuelve el camión que corresponde usar:
 * para él, el de su jornada (y rechaza otro); para despachador y admin, el pedido tal cual.
 */
export const crearResolverCamion = ({ jornadas, clock }: Deps) =>
  async (actor: Usuario, pedido: string | undefined): Promise<Result<string | undefined, ErrorApp>> => {
    if (!esDeCamion(actor.rol)) return ok(pedido);
    const j = await jornadas.activa(actor.empresaId, actor.id, fechaEnChile(clock.now()));
    if (!j) return err(errorApp('VALIDACION', 'Primero elige el camión que manejas hoy.', { codigo: 'SIN_JORNADA' }));
    if (pedido !== undefined && pedido !== j.camion.id) return err(errorApp('SIN_PERMISO', 'Ese no es el camión que manejas hoy.'));
    return ok(j.camion.id);
  };

export type ResolverCamion = ReturnType<typeof crearResolverCamion>;
