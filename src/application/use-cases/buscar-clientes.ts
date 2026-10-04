import type { Usuario } from '../../domain/entidades/usuario.js';
import { normalizarTexto } from '../../domain/entidades/local.js';
import { resolverComuna } from '../../domain/comunas.js';
import type { ClienteRepository, ResultadoBusqueda } from '../ports/out/clientes.js';

export type EntradaBuscarClientes = { readonly q: string; readonly comuna?: string | undefined; readonly limite?: number | undefined };

const LIMITE_POR_DEFECTO = 8;
const LIMITE_MAXIMO = 20;

/** Autocompletado de clientes por razón social o dirección. Tolera tildes y mayúsculas; desde 2 letras. */
export const crearBuscarClientes = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, entrada: EntradaBuscarClientes): Promise<readonly ResultadoBusqueda[]> => {
    const texto = normalizarTexto(entrada.q);
    if (texto.length < 2) return [];
    const comuna = entrada.comuna === undefined ? undefined : resolverComuna(entrada.comuna);
    const limite = Math.min(Math.max(entrada.limite ?? LIMITE_POR_DEFECTO, 1), LIMITE_MAXIMO);
    return clientes.buscar(actor.empresaId, { texto, ...(comuna !== undefined ? { comuna } : {}), limite });
  };
