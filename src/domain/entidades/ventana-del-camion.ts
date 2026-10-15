/** Un tramo de trabajo de una persona en el camión: abierto mientras no tenga `hasta`. */
export type TramoJornada = { readonly desde: Date; readonly hasta?: Date };

/**
 * El camión es el dueño de la ruta y puede tener a varias personas a la vez (chofer y ayudante, cada uno con su jornada). La «ventana» del
 * camión es la última tanda continua de trabajo del día: los tramos que se traslapan se juntan en uno. Lo hecho en la lista de la ruta
 * cuenta desde `desde`; si ya nadie sigue en el camión (`hasta`), la lista queda limpia.
 */
export const ventanaDelCamion = (tramos: readonly TramoJornada[]): TramoJornada | undefined => {
  const orden = [...tramos].sort((a, b) => a.desde.getTime() - b.desde.getTime());
  let actual: { desde: Date; hasta?: Date } | undefined;
  for (const t of orden) {
    if (!actual || (actual.hasta !== undefined && t.desde.getTime() > actual.hasta.getTime())) {
      actual = { desde: t.desde, ...(t.hasta ? { hasta: t.hasta } : {}) };
    } else if (actual.hasta !== undefined) {
      if (t.hasta === undefined) actual = { desde: actual.desde };
      else if (t.hasta.getTime() > actual.hasta.getTime()) actual = { desde: actual.desde, hasta: t.hasta };
    }
  }
  return actual;
};
