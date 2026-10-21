import { normalizarTexto } from '../entidades/local.js';
const genericas = new Set(['avenida', 'calle', 'camino', 'pasaje', 'ruta', 'del', 'las', 'los']);
const cerca = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    for (let j = 1; j <= b.length; j++) siguiente[j] = Math.min((fila[j] ?? 0) + 1, (siguiente[j - 1] ?? 0) + 1, (fila[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    fila = siguiente;
  }
  return (fila[b.length] ?? Infinity) <= (a.length >= 6 ? 2 : 1);
};
/** Conserva los números y cada palabra identificadora, admitiendo solo pequeños errores de escritura. */
export const alternativaConservaDireccion = (original: string, propuesta: string): boolean => {
  if ((original.match(/\d+/g) ?? []).join('|') !== (propuesta.match(/\d+/g) ?? []).join('|')) return false;
  const antes = normalizarTexto(original).split(' ').filter(p => /^\p{L}{3,}$/u.test(p) && !genericas.has(p));
  const despues = normalizarTexto(propuesta).split(' ');
  return antes.length > 0 && antes.every(p => despues.some(q => cerca(p, q)));
};
