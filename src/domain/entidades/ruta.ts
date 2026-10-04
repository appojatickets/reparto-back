import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { transicionarParada, type EventoParada, type Parada } from './parada.js';

export type Ruta = { readonly id: string; readonly paradas: readonly Parada[] };

export const pendientes = (ruta: Ruta): Parada[] =>
  ruta.paradas.filter((p) => p.estado === 'pendiente').sort((a, b) => a.ordenPlan - b.ordenPlan);

export const siguienteParada = (ruta: Ruta): Parada | undefined => pendientes(ruta)[0];

export const aplicarEvento = (ruta: Ruta, paradaId: string, evento: EventoParada): Result<Ruta, ErrorDominio> => {
  const parada = ruta.paradas.find((p) => p.id === paradaId);
  if (!parada) return err(errorDominio('PARADA_NO_ENCONTRADA', 'La parada no existe en esta ruta.'));
  const estado = transicionarParada(parada.estado, evento);
  if (!estado.ok) return estado;
  return ok({ ...ruta, paradas: ruta.paradas.map((p) => (p.id === paradaId ? { ...p, estado: estado.value } : p)) });
};

/** Resumen de fin de ruta (pantalla C7): solo conteos, sin tiempos ni comparaciones. */
export const conteoFinal = (ruta: Ruta): { hechas: number; noHechas: number; pendientes: number } => ({
  hechas: ruta.paradas.filter((p) => p.estado === 'entregada' || p.estado === 'parcial').length,
  noHechas: ruta.paradas.filter((p) => p.estado === 'no_pudo').length,
  pendientes: ruta.paradas.filter((p) => p.estado === 'pendiente').length,
});
