import { aliasSugerido, coincidirPersona, validarFilaPlanilla, type FilaPlanillaCruda } from '../../domain/entidades/planilla.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { esFechaValida, fechaEnChile } from '../../domain/shared/fechas.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { CamionRepository } from '../ports/out/camiones.js';
import type { Clock } from '../ports/out/clock.js';
import type { JornadaRepository } from '../ports/out/jornadas.js';
import type { AsignacionDia, NuevaAsignacion, PersonaDeCamion, PlanillaRepository } from '../ports/out/planillas.js';
import type { UsuarioRepository } from '../ports/out/usuarios.js';
import type { VendedorRepository } from '../ports/out/vendedores.js';

export type EstadoPersona = 'enlazada' | 'sin_usuario';
export type ResultadoFila = {
  readonly patente: string;
  readonly valida: boolean;
  readonly errores: readonly string[];
  readonly camionCreado: boolean;
  /** Nombre puesto al camión nuevo (los dos últimos dígitos); falta si ya lo usa otro camión. */
  readonly alias?: string;
  readonly vendedoresCreados: number;
  readonly chofer?: { readonly nombre: string; readonly estado: EstadoPersona };
  readonly ayudante?: { readonly nombre: string; readonly estado: EstadoPersona };
  /** Quiénes quedaron con su camión ya elegido en la app (solo si la planilla es de hoy). */
  readonly jornadasAbiertas: number;
};

type Dependencias = {
  readonly camiones: CamionRepository;
  readonly vendedores: VendedorRepository;
  readonly usuarios: UsuarioRepository;
  readonly planillas: PlanillaRepository;
  readonly jornadas: JornadaRepository;
  readonly clock: Clock;
};

/**
 * Aplica la planilla de la mañana pegada desde Excel: crea los camiones y vendedores que falten, enlaza chofer y ayudante con
 * sus usuarios (por nombre) y, si es de hoy, deja a cada uno con su camión ya elegido. Lo que no se pueda enlazar se informa,
 * no se inventa. Cada fila se aplica por separado: una fila mala no frena a las demás.
 */
export const crearAplicarPlanilla = ({ camiones, vendedores, usuarios, planillas, jornadas, clock }: Dependencias) =>
  async (actor: Usuario, entrada: { fecha: string; filas: readonly FilaPlanillaCruda[] }): Promise<Result<{ filas: readonly ResultadoFila[] }, ErrorApp>> => {
    if (!esFechaValida(entrada.fecha)) return err(errorApp('VALIDACION', 'La fecha no es válida.'));
    if (entrada.filas.length === 0) return err(errorApp('VALIDACION', 'La planilla no tiene filas.'));

    const ahora = clock.now();
    const esHoy = entrada.fecha === fechaEnChile(ahora);
    const camionesActuales = [...(await camiones.listar(actor.empresaId, {}))];
    const personas = (await usuarios.listar(actor.empresaId)).filter((u) => u.activo && (u.rol === 'chofer' || u.rol === 'ayudante'));

    const resultados: ResultadoFila[] = [];
    const nuevas: NuevaAsignacion[] = [];
    const jornadasPorAbrir: { usuarioId: string; camionId: string }[] = [];

    for (const cruda of entrada.filas) {
      const v = validarFilaPlanilla(cruda);
      if (!v.ok) {
        resultados.push({ patente: cruda.patente.trim(), valida: false, errores: v.error.map((e) => e.mensaje), camionCreado: false, vendedoresCreados: 0, jornadasAbiertas: 0 });
        continue;
      }
      const f = v.value;

      let camion = camionesActuales.find((c) => c.patente === f.patente);
      let camionCreado = false;
      let alias: string | undefined;
      if (!camion) {
        const sugerido = aliasSugerido(f.patente);
        const ocupado = camionesActuales.some((c) => c.alias === sugerido);
        const r = await camiones.crear(actor.empresaId, { patente: f.patente, ...(ocupado ? {} : { alias: sugerido }) });
        if (!r.ok) {
          resultados.push({ patente: f.patente, valida: false, errores: ['No se pudo crear el camión.'], camionCreado: false, vendedoresCreados: 0, jornadasAbiertas: 0 });
          continue;
        }
        camion = r.value;
        camionesActuales.push(camion);
        camionCreado = true;
        if (!ocupado) alias = sugerido;
      } else if (!camion.activo) {
        // Si la planilla lo manda a la calle, está en servicio.
        camion = (await camiones.actualizar(actor.empresaId, camion.id, { activo: true })) ?? camion;
      }

      const asegurados = await vendedores.asegurar(actor.empresaId, f.vendedores);
      const elegir = (nombre: string | undefined): { persona?: PersonaDeCamion; estado?: EstadoPersona } => {
        if (nombre === undefined) return {};
        const u = coincidirPersona(nombre, personas);
        return u ? { persona: { nombre, usuarioId: u.id }, estado: 'enlazada' } : { persona: { nombre }, estado: 'sin_usuario' };
      };
      const chofer = elegir(f.chofer);
      const ayudante = elegir(f.ayudante);

      nuevas.push({
        camionId: camion.id,
        ...(chofer.persona ? { chofer: chofer.persona } : {}),
        ...(ayudante.persona ? { ayudante: ayudante.persona } : {}),
        comunas: f.comunas,
        vendedorIds: asegurados.vendedores.map((x) => x.id),
      });
      let abiertas = 0;
      for (const p of [chofer.persona, ayudante.persona]) {
        if (esHoy && p?.usuarioId !== undefined) {
          jornadasPorAbrir.push({ usuarioId: p.usuarioId, camionId: camion.id });
          abiertas++;
        }
      }
      resultados.push({
        patente: f.patente,
        valida: true,
        errores: [],
        camionCreado,
        ...(alias !== undefined ? { alias } : {}),
        vendedoresCreados: asegurados.creados,
        ...(chofer.persona && chofer.estado ? { chofer: { nombre: chofer.persona.nombre, estado: chofer.estado } } : {}),
        ...(ayudante.persona && ayudante.estado ? { ayudante: { nombre: ayudante.persona.nombre, estado: ayudante.estado } } : {}),
        jornadasAbiertas: abiertas,
      });
    }

    if (nuevas.length > 0) await planillas.guardar(actor.empresaId, entrada.fecha, nuevas, actor.id);
    for (const j of jornadasPorAbrir) await jornadas.iniciar(actor.empresaId, j.usuarioId, j.camionId, entrada.fecha, ahora);
    return ok({ filas: resultados });
  };

export const crearObtenerPlanilla = ({ planillas, clock }: { planillas: PlanillaRepository; clock: Clock }) =>
  async (actor: Usuario, fecha?: string): Promise<Result<readonly AsignacionDia[], ErrorApp>> => {
    const f = fecha ?? fechaEnChile(clock.now());
    if (!esFechaValida(f)) return err(errorApp('VALIDACION', 'La fecha no es válida.'));
    return ok(await planillas.obtener(actor.empresaId, f));
  };
