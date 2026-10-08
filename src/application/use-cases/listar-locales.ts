import { resolverComuna } from '../../domain/comunas.js';
import { limpiarTexto } from '../../domain/importacion/fila-cliente.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import type { ClienteRepository, LocalParaLista, ResumenComuna } from '../ports/out/clientes.js';

export const MAX_LOCALES_POR_LISTA = 500;

/**
 * La sección «Locales»: los de una comuna (o los que coinciden con un texto: razón social, RUT o dirección), con lo entregado por cada uno.
 * Primero salen los de pin por verificar. Sin filtros trae de todas las comunas, hasta el límite.
 */
export const crearListarLocales = ({ clientes }: { clientes: ClienteRepository }) =>
  (actor: Usuario, filtro: { readonly comuna?: string | undefined; readonly texto?: string | undefined }, limite = 300): Promise<{ readonly total: number; readonly locales: readonly LocalParaLista[] }> => {
    const texto = limpiarTexto(filtro.texto);
    const comunaPedida = limpiarTexto(filtro.comuna);
    const comuna = comunaPedida === '' ? undefined : (resolverComuna(comunaPedida) ?? comunaPedida);
    return clientes.listarLocales(
      actor.empresaId,
      { ...(comuna !== undefined ? { comuna } : {}), ...(texto !== '' ? { texto } : {}) },
      Math.min(Math.max(Math.trunc(limite), 1), MAX_LOCALES_POR_LISTA),
    );
  };

export const crearResumenComunas = ({ clientes }: { clientes: ClienteRepository }) =>
  (actor: Usuario): Promise<readonly ResumenComuna[]> => clientes.resumenPorComuna(actor.empresaId);
