import { normalizarTexto } from '../entidades/local.js';

export const usernameValido = (u: string): boolean => /^[a-z0-9]{3,30}$/.test(u);

const compacto = (texto: string): string => normalizarTexto(texto).replace(/\s+/g, '');

/**
 * Usuario = inicial del nombre + primer apellido (jperez). Si existe, se agrega la inicial del segundo apellido
 * (jperezg) y, si sigue chocando, un número.
 */
export const generarUsername = (
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno: string | undefined,
  existentes: ReadonlySet<string>,
): string => {
  const base = `${compacto(nombre).slice(0, 1)}${compacto(apellidoPaterno)}`.slice(0, 26).padEnd(3, 'x');
  const materno = apellidoMaterno ? compacto(apellidoMaterno).slice(0, 1) : '';
  const raiz = existentes.has(base) && materno ? `${base}${materno}` : base;
  if (!existentes.has(raiz)) return raiz;
  for (let n = 2; ; n++) {
    const candidato = `${raiz}${n}`;
    if (!existentes.has(candidato)) return candidato;
  }
};
