import type { ParametroAprendido } from '../../domain/aprendizaje/analisis.js';
import type { AnaliticaRepository, CalidadDeRuta, Cobertura, DiaDeTrabajo, EtiquetaLocal } from '../ports/out/analitica.js';
import type { AprendizajeRepository, EjecucionAnalisis } from '../ports/out/aprendizaje.js';
import type { CamionRepository } from '../ports/out/camiones.js';
import type { Clock } from '../ports/out/clock.js';

const DIAS_DEL_PANEL = 30;
const LOCALES_LENTOS = 15;

export type LocalLento = ParametroAprendido & { readonly etiqueta?: EtiquetaLocal };
export type CierreConEtiqueta = { readonly localId: string; readonly cerrados: number; readonly intentos: number; readonly horasCerrado: readonly number[]; readonly etiqueta?: EtiquetaLocal };

export type PanelAnalitica = {
  readonly desde: Date;
  readonly cobertura: Cobertura;
  readonly porDia: readonly DiaDeTrabajo[];
  readonly calidad: readonly (CalidadDeRuta & { readonly camion?: string })[];
  readonly aprendido: {
    readonly ritmo: readonly (ParametroAprendido & { readonly camion?: string })[];
    readonly capacidad: readonly (ParametroAprendido & { readonly camion?: string })[];
    readonly servicioGeneral?: ParametroAprendido;
    readonly localesLentos: readonly LocalLento[];
  };
  readonly cierres: readonly CierreConEtiqueta[];
  readonly ultimaEjecucion?: EjecucionAnalisis;
};

/** Lo que ve el admin: qué datos hay, con qué calidad se están capturando y qué aprendió el sistema. Solo lectura. */
export const crearVerAnalitica = ({ analitica, aprendizaje, camiones, clock }: { analitica: AnaliticaRepository; aprendizaje: AprendizajeRepository; camiones: CamionRepository; clock: Clock }) =>
  async (empresaId: string): Promise<PanelAnalitica> => {
    const desde = new Date(clock.now().getTime() - DIAS_DEL_PANEL * 86_400_000);
    const [cobertura, porDia, calidad, parametros, ultima, cams] = await Promise.all([
      analitica.cobertura(empresaId, desde), analitica.porDia(empresaId, desde), analitica.calidad(empresaId, desde, 20),
      aprendizaje.parametros(empresaId), aprendizaje.ultimaEjecucion(empresaId), camiones.listar(empresaId, {}),
    ]);
    const nombreCamion = new Map(cams.map((c) => [c.id, c.alias ?? c.patente]));
    const camionDe = (p: ParametroAprendido): { readonly camion?: string } => {
      const nombre = p.ambito.startsWith('camion:') ? nombreCamion.get(p.ambito.slice(7)) : undefined;
      return nombre !== undefined ? { camion: nombre } : {};
    };
    const lentos = parametros.filter((p) => p.clave === 'servicio_min' && p.ambito.startsWith('local:')).sort((a, b) => b.valor - a.valor).slice(0, LOCALES_LENTOS);
    const cierres = ultima?.resumen.cierresFrecuentes ?? [];
    const etiquetas = await analitica.etiquetasDeLocales(empresaId, [...lentos.map((p) => p.ambito.slice(6)), ...cierres.map((c) => c.localId)]);
    const servicioGeneral = parametros.find((p) => p.clave === 'servicio_min' && p.ambito === 'global');
    return {
      desde,
      cobertura,
      porDia,
      calidad: calidad.map((c) => { const camion = nombreCamion.get(c.camionId); return { ...c, ...(camion !== undefined ? { camion } : {}) }; }),
      aprendido: {
        ritmo: parametros.filter((p) => p.clave === 'ritmo').map((p) => ({ ...p, ...camionDe(p) })),
        capacidad: parametros.filter((p) => p.clave === 'capacidad_paradas' || p.clave === 'duracion_jornada_min').map((p) => ({ ...p, ...camionDe(p) })),
        ...(servicioGeneral ? { servicioGeneral } : {}),
        localesLentos: lentos.map((p) => { const e = etiquetas.get(p.ambito.slice(6)); return { ...p, ...(e ? { etiqueta: e } : {}) }; }),
      },
      cierres: cierres.map((c) => { const e = etiquetas.get(c.localId); return { localId: c.localId, cerrados: c.cerrados, intentos: c.intentos, horasCerrado: c.horasCerrado, ...(e ? { etiqueta: e } : {}) }; }),
      ...(ultima ? { ultimaEjecucion: ultima } : {}),
    };
  };

export type VerAnalitica = ReturnType<typeof crearVerAnalitica>;
