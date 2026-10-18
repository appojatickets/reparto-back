/**
 * Quiénes aportaron a un local: la foto de la fachada, el pin (verificado por una persona) y las entregas hechas ahí.
 * Solo se muestran en locales «completos» —con foto y pin— y respaldados: más de una entrega, o el pin verificado. Es el reconocimiento
 * a quien ayuda a que el local esté bien cargado.
 */
export type Aporte = 'foto' | 'pin' | 'entregas';

export type DatosContribucion = {
  readonly tieneFoto: boolean;
  readonly tienePin: boolean;
  readonly pinVerificado: boolean;
  /** Quién subió la foto actual. */
  readonly fotoPor?: string;
  /** Quién verificó el pin a mano (si lo verificaron las entregas, nadie). */
  readonly pinVerificadoPor?: string;
  /** Cuántas entregas distintas hizo cada persona en este local. */
  readonly entregasPor: readonly { readonly usuarioId: string; readonly entregas: number }[];
};

export type Contribucion = { readonly usuarioId: string; readonly aportes: readonly Aporte[]; readonly entregas: number };

export const MAXIMO_CONTRIBUYENTES = 10;
const ORDEN_APORTES: readonly Aporte[] = ['foto', 'pin', 'entregas'];

export const contribuciones = (d: DatosContribucion): readonly Contribucion[] => {
  if (!d.tieneFoto || !d.tienePin) return [];
  const totalEntregas = d.entregasPor.reduce((s, e) => s + e.entregas, 0);
  if (!d.pinVerificado && totalEntregas < 2) return [];

  const porPersona = new Map<string, { aportes: Set<Aporte>; entregas: number }>();
  const de = (id: string) => {
    const actual = porPersona.get(id) ?? { aportes: new Set<Aporte>(), entregas: 0 };
    porPersona.set(id, actual);
    return actual;
  };
  if (d.fotoPor !== undefined) de(d.fotoPor).aportes.add('foto');
  if (d.pinVerificadoPor !== undefined) de(d.pinVerificadoPor).aportes.add('pin');
  for (const e of d.entregasPor) {
    if (e.entregas <= 0) continue;
    const p = de(e.usuarioId);
    p.aportes.add('entregas');
    p.entregas += e.entregas;
  }
  return [...porPersona.entries()]
    .map(([usuarioId, p]): Contribucion => ({ usuarioId, aportes: ORDEN_APORTES.filter((a) => p.aportes.has(a)), entregas: p.entregas }))
    .sort((a, b) => b.aportes.length - a.aportes.length || b.entregas - a.entregas || (a.usuarioId < b.usuarioId ? -1 : a.usuarioId > b.usuarioId ? 1 : 0))
    .slice(0, MAXIMO_CONTRIBUYENTES);
};
