import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

/** Código del vendedor: la letra V y su número (V6, V06 y v 06 son el mismo → V06). */
export const normalizarCodigoVendedor = (texto: string): Result<string, ErrorDominio> => {
  const m = /^V\s*0*(\d{1,3})$/.exec(texto.trim().toUpperCase());
  if (!m) return err(errorDominio('CODIGO_VENDEDOR_INVALIDO', 'El código del vendedor debe ser la letra V y su número (V12).'));
  return ok(`V${(m[1] ?? '').padStart(2, '0')}`);
};

export type VendedorDeCelda = { readonly codigo: string; readonly nombre?: string };

/**
 * Lee la celda de vendedores de la planilla: «V12 Mario Quiroz - V13 Oscar baeza», «V05 Rodrigo Mourgues  - V16 Cristian fernandez»
 * o solo «V14». Se separa en cada código V + número, así los guiones y las comas son opcionales.
 */
export const leerCeldaVendedores = (celda: string): readonly VendedorDeCelda[] => {
  const texto = celda.replace(/\s+/g, ' ').trim();
  if (texto === '' || texto === '-') return [];
  const partes = texto.split(/(?=\bV\s*\d{1,3}\b)/i).map((p) => p.trim()).filter((p) => p !== '');
  const vendedores: VendedorDeCelda[] = [];
  for (const parte of partes) {
    const m = /^(V\s*\d{1,3})\b[\s:.-]*(.*)$/i.exec(parte);
    if (!m) continue;
    const codigo = normalizarCodigoVendedor(m[1] ?? '');
    if (!codigo.ok) continue;
    const nombre = (m[2] ?? '').replace(/[\s,;/-]+$/u, '').trim();
    vendedores.push({ codigo: codigo.value, ...(nombre !== '' ? { nombre } : {}) });
  }
  return vendedores;
};
