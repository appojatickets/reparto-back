/** Centésimas de caja; el dinero se calcula en centavos de peso, sin redondear cajas decimales. */
export const TARIFA_CAJA_PESOS = 15;
export const centesimasDeCaja = (n: number): number | undefined => {
  const c = Math.round(n * 100);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 && Math.abs(n * 100 - c) < 0.000001 ? c : undefined;
};
export const balanceCajas = (cargadas: number, cerrado: number, rebaje: number) => {
  const c = centesimasDeCaja(cargadas), a = centesimasDeCaja(cerrado), b = centesimasDeCaja(rebaje);
  if (c === undefined || a === undefined || b === undefined || a + b > c) return undefined;
  return { cargadas: c / 100, porCerrado: a / 100, rebajes: b / 100, entregadas: (c - a - b) / 100, descuentoPesos: (a + b) * TARIFA_CAJA_PESOS / 100, montoPesos: (c - a - b) * TARIFA_CAJA_PESOS / 100 };
};
