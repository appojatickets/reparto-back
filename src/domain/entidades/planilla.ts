import { resolverComuna } from '../comunas.js';
import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { parsearPatente } from '../valor/patente.js';
import { normalizarTexto } from './local.js';
import { normalizarCodigoVendedor } from './vendedor.js';

export type FilaPlanillaCruda = {
  readonly patente: string;
  readonly chofer?: string | undefined;
  readonly ayudante?: string | undefined;
  readonly vendedores?: readonly { readonly codigo: string; readonly nombre?: string | undefined }[] | undefined;
  readonly comunas?: readonly string[] | undefined;
};

export type FilaPlanilla = {
  readonly patente: string;
  readonly chofer?: string;
  readonly ayudante?: string;
  readonly vendedores: readonly { readonly codigo: string; readonly nombre?: string }[];
  readonly comunas: readonly string[];
};

const limpio = (t: string | undefined): string | undefined => {
  const l = t?.replace(/\s+/g, ' ').trim();
  return l === undefined || l === '' || l === '-' ? undefined : l;
};

/** Valida una fila de la planilla de la mañana. Junta todos los errores de la fila. */
export const validarFilaPlanilla = (f: FilaPlanillaCruda): Result<FilaPlanilla, ErrorDominio[]> => {
  const errores: ErrorDominio[] = [];
  const patente = parsearPatente(f.patente);
  if (!patente.ok) errores.push(errorDominio('PATENTE_INVALIDA', `«${f.patente.trim()}» no es una patente (por ejemplo ABCD12).`));

  const vendedores: { codigo: string; nombre?: string }[] = [];
  for (const v of f.vendedores ?? []) {
    const c = normalizarCodigoVendedor(v.codigo);
    if (!c.ok) {
      errores.push(errorDominio('CODIGO_VENDEDOR_INVALIDO', `«${v.codigo}» no es un código de vendedor (V12).`));
      continue;
    }
    if (vendedores.some((x) => x.codigo === c.value)) continue;
    const nombre = limpio(v.nombre);
    vendedores.push({ codigo: c.value, ...(nombre !== undefined ? { nombre } : {}) });
  }

  const comunas: string[] = [];
  for (const texto of f.comunas ?? []) {
    const c = resolverComuna(texto);
    if (c === undefined) errores.push(errorDominio('COMUNA_INVALIDA', `«${texto.trim()}» no es una comuna de la Región Metropolitana.`));
    else if (!comunas.includes(c)) comunas.push(c);
  }

  if (errores.length > 0 || !patente.ok) return err(errores);
  const chofer = limpio(f.chofer);
  const ayudante = limpio(f.ayudante);
  return ok({ patente: patente.value, ...(chofer !== undefined ? { chofer } : {}), ...(ayudante !== undefined ? { ayudante } : {}), vendedores, comunas });
};

/** Alias sugerido para un camión: los dos últimos dígitos de la patente (23, 81…). */
export const aliasSugerido = (patente: string): string => /(\d{2})$/.exec(patente)?.[1] ?? patente;

const tokens = (nombre: string): string[] => normalizarTexto(nombre).split(' ').filter((t) => t !== '');

/**
 * Busca a la persona de la planilla entre los usuarios por su nombre. Todas las palabras de un nombre deben estar en el otro
 * (pasa que en el sistema está con ambos apellidos y en la planilla con uno), con al menos dos palabras para no confundir.
 * Si hay dos candidatos igual de buenos, no se elige ninguno: mejor avisar que adivinar.
 */
export const coincidirPersona = <T extends { readonly nombre: string }>(nombre: string, candidatos: readonly T[]): T | undefined => {
  const buscado = tokens(nombre);
  if (buscado.length === 0) return undefined;
  const puntuados = candidatos.flatMap((c) => {
    const ct = tokens(c.nombre);
    const buscadoEnCandidato = buscado.every((t) => ct.includes(t)) && buscado.length >= 2;
    const candidatoEnBuscado = ct.every((t) => buscado.includes(t)) && ct.length >= 2;
    if (!buscadoEnCandidato && !candidatoEnBuscado) return [];
    // más palabras en común = mejor; a igualdad, el que tiene el mismo largo
    const comunes = buscado.filter((t) => ct.includes(t)).length;
    return [{ c, puntaje: comunes * 10 - Math.abs(ct.length - buscado.length) }];
  });
  const mejor = Math.max(...puntuados.map((p) => p.puntaje), -Infinity);
  const empatados = puntuados.filter((p) => p.puntaje === mejor);
  return empatados.length === 1 ? empatados[0]?.c : undefined;
};
