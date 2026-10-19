import type { Jornada } from './jornadas.js';
export type CajasActuales = { readonly bultos?:number|null; readonly registrada: boolean; readonly cargadasCamion: number; readonly cargadasUsuario: number; readonly porCerrado: number; readonly rebajes: number; readonly rebajesCamion: number | null; readonly revision: number; readonly cerrada: boolean };
export type FilaCajas = { readonly kmCamion?:number; readonly bultosCamion?:number|null; readonly jornadaId: string; readonly usuarioId: string; readonly usuario: string; readonly camionId: string; readonly camion: string; readonly fecha: string; readonly desde: string; readonly hasta: string | null; readonly cargadas: number; readonly porCerrado: number; readonly rebajes: number; readonly tarifa: number; readonly cerrada: boolean; readonly cargaId: string; readonly cargadasCamion: number; readonly rebajesCamion: number | null; readonly km: number; readonly comunas: readonly string[] };
export interface CajasRepository {
 actual(empresaId: string, jornadaId: string, compartida?: {camionId:string;fecha:string;desde:Date}): Promise<CajasActuales | undefined>;
 guardar(empresaId: string, j: Jornada, desde: Date, entrada: { bultos?:number|undefined; cargadasCamion: number; cargadasUsuario: number; revision: number }, ahora: Date): Promise<boolean>;
 cerrar(empresaId: string, j: Jornada, entrada: { porCerrado: number; rebajes: number; rebajesCamion: number; ultimo: boolean }, ahora: Date): Promise<boolean>;
 historial(empresaId: string, mes: string, usuarioId?: string): Promise<readonly FilaCajas[]>;
}
