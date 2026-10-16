export type Cobertura = {
  readonly jornadas: number;
  readonly jornadasTerminadas: number;
  readonly avisos: number;
  readonly avisosConGps: number;
  readonly avisosAutomaticos: number;
  readonly paradasConLlegada: number;
  readonly paradasResueltas: number;
  readonly puntosGps: number;
  readonly ultimoPuntoGps?: Date;
  readonly operacionesRuta: number;
  readonly correccionesManuales: number;
};

export type DiaDeTrabajo = { readonly fecha: string; readonly jornadas: number; readonly atendidas: number; readonly sinHacer: number };

export type CalidadDeRuta = {
  readonly fecha: string;
  readonly camionId: string;
  readonly distSugeridaM: number;
  readonly distRealM: number;
  readonly inversiones: number;
  /** `chofer`: el día se armó en orden manual y `distSugeridaM` es lo que habría sugerido el sistema; `sistema`: el orden lo calculó el sistema. */
  readonly origen: 'sistema' | 'chofer';
  /** Cuántas veces se movió una parada a mano ese día. */
  readonly cambios: number;
  /** Cuántas paradas se entregaron ese día y cuántos pares quedaron en distinto orden que el que había al salir (con lo acomodado a mano). Null si el día es anterior a este registro. */
  readonly entregadas?: number;
  readonly inversionesSalida?: number;
  /** El orden con que salió el camión es el mismo que sugirió el sistema (nadie lo acomodó). */
  readonly salioComoSugeria?: boolean;
};

/** Cuánto del día de reparto quedó con GPS: minutos con al menos un punto, entre la primera y la última entrega de ese camión (ADR 0052). */
export type CoberturaGpsDia = { readonly fecha: string; readonly camionId: string; readonly minutosConGps: number; readonly minutosEnRuta: number };

export type EtiquetaLocal = { readonly razonSocial: string; readonly direccion: string; readonly comuna: string };

/** Lecturas agregadas para el panel de analítica del admin (lo registrado, resumido). */
export interface AnaliticaRepository {
  cobertura(empresaId: string, desde: Date): Promise<Cobertura>;
  porDia(empresaId: string, desde: Date): Promise<readonly DiaDeTrabajo[]>;
  calidad(empresaId: string, desde: Date, limite: number): Promise<readonly CalidadDeRuta[]>;
  /** Los últimos días de reparto (con 5 o más entregas), del más reciente al más antiguo. */
  coberturaGps(empresaId: string, desde: Date, limite: number): Promise<readonly CoberturaGpsDia[]>;
  etiquetasDeLocales(empresaId: string, ids: readonly string[]): Promise<ReadonlyMap<string, EtiquetaLocal>>;
}
