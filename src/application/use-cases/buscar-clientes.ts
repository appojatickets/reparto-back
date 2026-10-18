import type { Usuario } from '../../domain/entidades/usuario.js';
import { normalizarTexto } from '../../domain/entidades/local.js';
import { COMUNAS_RM, resolverComuna } from '../../domain/comunas.js';
import { dichoComoRut } from '../../domain/valor/rut.js';
import type { ClienteRepository, ResultadoBusqueda } from '../ports/out/clientes.js';

export type EntradaBuscarClientes = { readonly q: string; readonly comuna?: string | undefined; readonly limite?: number | undefined };

const LIMITE_POR_DEFECTO = 8;
const LIMITE_MAXIMO = 20;

/** Autocompletado de clientes por razón social, dirección o RUT. Tolera tildes y mayúsculas; desde 3 letras. */
export const crearBuscarClientes = ({ clientes }: { clientes: ClienteRepository }) =>
  async (actor: Usuario, entrada: EntradaBuscarClientes): Promise<readonly ResultadoBusqueda[]> => {
    // Reconoce la comuna al final de una dirección con número o separada por coma.
    // No interpreta nombres comerciales sin evidencia de que sea una dirección.
    const original = normalizarTexto(entrada.q);
    const inferida = entrada.comuna === undefined && (/\d/.test(original) || original.includes(','))
      ? [...COMUNAS_RM].sort((a, b) => b.length - a.length).find((c) => original.endsWith(` ${normalizarTexto(c)}`)) : undefined;
    const comuna = entrada.comuna === undefined ? inferida : resolverComuna(entrada.comuna);
    const limite = Math.min(Math.max(entrada.limite ?? LIMITE_POR_DEFECTO, 1), LIMITE_MAXIMO);
    // El RUT no cambia: escribirlo (solo números) encuentra al cliente y todas sus direcciones.
    const rutDigitos = dichoComoRut(entrada.q);
    if (rutDigitos !== undefined) return clientes.buscar(actor.empresaId, { texto: '', rutDigitos, ...(comuna !== undefined ? { comuna } : {}), limite });
    const texto = inferida ? original.slice(0, -normalizarTexto(inferida).length).replace(/[,\s]+$/, '') : original;
    if (texto.replace(/\s/g, '').length < 3) return [];
    return clientes.buscar(actor.empresaId, { texto, ...(comuna !== undefined ? { comuna } : {}), limite });
  };
