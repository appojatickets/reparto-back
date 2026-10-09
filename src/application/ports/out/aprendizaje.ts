import type { CalidadJornada, CierreFrecuente, EventoObs, JornadaObs, LocalObs, OperacionObs, ParametroAprendido, PinDudoso, PosicionObs, SeguimientoRuta } from '../../../domain/aprendizaje/analisis.js';

/** Todo lo registrado desde `desde`, listo para que el analizador lo recorra (el volumen es chico: unas decenas de avisos por camión y día). */
export type DatosAnalisis = {
  readonly eventos: readonly EventoObs[];
  readonly locales: readonly (LocalObs & { readonly direccion: string })[];
  readonly jornadas: readonly JornadaObs[];
  readonly operaciones: readonly OperacionObs[];
  /** El recorrido del camión (para deducir las llegadas que nadie avisó). */
  readonly posiciones: readonly PosicionObs[];
};

export type ResumenAnalisis = {
  readonly eventos: number;
  readonly jornadas: number;
  readonly parametros: number;
  readonly jornadasComparadas: number;
  readonly pinesSugeridos: number;
  readonly pinesProponidos: number;
  /** Qué tanto se hace lo que la ruta mostraba (lo que se hace manda sobre lo sugerido). */
  readonly seguimientoRuta: SeguimientoRuta;
  /** Cuántas llegadas se dedujeron del recorrido porque nadie avisó LLEGUÉ. */
  readonly llegadasDeducidas: number;
  /** Locales donde se entregó lejos del pin (los 20 más lejanos). */
  readonly pinesDudosos: readonly PinDudoso[];
  /** Los locales encontrados cerrados con más frecuencia (los 20 primeros). */
  readonly cierresFrecuentes: readonly CierreFrecuente[];
};

export type EjecucionAnalisis = { readonly iniciadoEn: Date; readonly terminadoEn: Date; readonly resumen: ResumenAnalisis };

export interface AprendizajeRepository {
  /** Las empresas que tienen datos que analizar. */
  empresas(): Promise<readonly string[]>;
  datosParaAnalizar(empresaId: string, desde: Date): Promise<DatosAnalisis>;
  parametros(empresaId: string): Promise<readonly ParametroAprendido[]>;
  /** Reemplaza lo aprendido: lo que ya no tiene datos que lo respalden desaparece. */
  guardarParametros(empresaId: string, parametros: readonly ParametroAprendido[], ahora: Date): Promise<void>;
  /** Guarda en el resumen de cada jornada cuánto se parecieron lo sugerido y lo manejado. */
  guardarCalidad(empresaId: string, calidad: readonly CalidadJornada[], ahora: Date): Promise<void>;
  registrarEjecucion(empresaId: string, ejecucion: EjecucionAnalisis): Promise<void>;
  ultimaEjecucion(empresaId: string): Promise<EjecucionAnalisis | undefined>;
}
