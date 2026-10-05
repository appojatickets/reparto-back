import type { Usuario } from '../../domain/entidades/usuario.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { Clock } from '../ports/out/clock.js';
import type { ColaGeocodificacion } from './cola-geocodificacion.js';
import { SIETE_DIAS_MS } from './geocodificar-local.js';

export const MAX_BUSQUEDA_PINES = 1000;

export type EstadoBusquedaPines = { readonly sinPin: number; readonly enCola: number; readonly enMarcha: boolean };

/** Pone en la cola a los locales sin pin (el admin lo pide una vez para toda la base, y también cuando carga clientes nuevos). */
export const crearBuscarPinesPendientes = ({ clientes, cola, clock }: { clientes: ClienteRepository; cola: ColaGeocodificacion; clock: Clock }) =>
  async (actor: Usuario): Promise<EstadoBusquedaPines & { readonly encolados: number }> => {
    const locales = await clientes.localesSinPin(actor.empresaId, MAX_BUSQUEDA_PINES, new Date(clock.now().getTime() - SIETE_DIAS_MS));
    const encolados = cola.encolar(actor.empresaId, locales.map((l) => l.id));
    return { encolados, sinPin: await clientes.contarLocalesSinPin(actor.empresaId), enCola: cola.pendientes(), enMarcha: cola.enMarcha() };
  };

export const crearEstadoBusquedaPines = ({ clientes, cola }: { clientes: ClienteRepository; cola: ColaGeocodificacion }) =>
  async (actor: Usuario): Promise<EstadoBusquedaPines> => ({
    sinPin: await clientes.contarLocalesSinPin(actor.empresaId),
    enCola: cola.pendientes(),
    enMarcha: cola.enMarcha(),
  });
