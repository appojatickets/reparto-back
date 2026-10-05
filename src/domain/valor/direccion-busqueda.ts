/**
 * Deja la dirección de una factura en algo que un buscador de mapas entienda: sin «parcela», «sitio», «lote», «local», «casa»,
 * «S/N» ni números de loteo (los mapas no los conocen) y con las abreviaturas escritas completas. Devuelve undefined si no queda
 * una calle o camino reconocible (por ejemplo «Ubicación en el mapa (...)» o «Sin dirección»).
 */
const ABREVIATURAS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bav\.?(?=\s)/gi, 'Avenida'],
  [/\bavda\.?(?=\s)/gi, 'Avenida'],
  [/\bcam\.?(?=\s)/gi, 'Camino'],
  [/\b(?:pje|psj|pja)\.?(?=\s)/gi, 'Pasaje'],
  [/\bsta\.?(?=\s)/gi, 'Santa'],
  [/\bsto\.?(?=\s)/gi, 'Santo'],
  [/\bgral\.?(?=\s)/gi, 'General'],
  [/\bpte\.?(?=\s|$)/gi, 'Poniente'],
];

const SIN_SENTIDO = /^(ubicaci[oó]n en el mapa|sin direcci[oó]n|sin nombre)/i;
const LOTEO = /\b(?:parcela|parc|sitio|siti|lote|lt|local|loc|casa|depto|dpto|oficina|of|st|pc|km|kilometro|kil[oó]metro)\.?\s*(?:n[°ºo]\.?\s*)?[\dA-Za-z-]*/gi;

export const direccionParaBuscar = (direccion: string): string | undefined => {
  const original = direccion.replace(/\s+/g, ' ').trim();
  if (original === '' || SIN_SENTIDO.test(original)) return undefined;
  let t = ` ${original} `;
  for (const [re, nuevo] of ABREVIATURAS) t = t.replace(re, nuevo);
  t = t
    .replace(/\bs\/n\b|\bs-n\b/gi, ' ')
    .replace(LOTEO, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bn[°º]\s*(?=\d)/gi, ' ')
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Tiene que quedar al menos una palabra con letras (el nombre de la calle o del camino).
  const letras = t.split(' ').filter((p) => /\p{L}{3,}/u.test(p) && !/^(?:avenida|camino|calle|pasaje|ruta|poniente|norte|sur|oriente)$/i.test(p));
  return letras.length > 0 ? t : undefined;
};
