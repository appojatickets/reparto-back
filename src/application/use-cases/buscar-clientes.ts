import type { Usuario } from '../../domain/entidades/usuario.js';
import { normalizarTexto } from '../../domain/entidades/local.js';
import { resolverComuna } from '../../domain/comunas.js';
import { dichoComoRut } from '../../domain/valor/rut.js';
import type { ClienteRepository, ResultadoBusqueda } from '../ports/out/clientes.js';

export type EntradaBuscarClientes = { readonly q: string; readonly comuna?: string | undefined; readonly limite?: number | undefined };

const LIMITE_POR_DEFECTO = 8;
const LIMITE_MAXIMO = 20;

/** Autocompletado de clientes por razón social, dirección o RUT. Tolera tildes y mayúsculas; desde 2 letras. */
export const crearBuscarClientes = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, entrada: EntradaBuscarClientes): Promise<readonly ResultadoBusqueda[]> => {
    const comuna = entrada.comuna === undefined ? undefined : resolverComuna(entrada.comuna);
    const limite = Math.min(Math.max(entrada.limite ?? LIMITE_POR_DEFECTO, 1), LIMITE_MAXIMO);
    // El RUT no cambia: escribirlo (solo números) encuentra al cliente y todas sus direcciones.
    const rutDigitos = dichoComoRut(entrada.q);
    if (rutDigitos !== undefined) return clientes.buscar(actor.empresaId, { texto: '', rutDigitos, ...(comuna !== undefined ? { comuna } : {}), limite });
    const texto = normalizarTexto(entrada.q);
    if (texto.length < 2) return [];
    return clientes.buscar(actor.empresaId, { texto, ...(comuna !== undefined ? { comuna } : {}), limite });
  };
