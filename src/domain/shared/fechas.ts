/** Fechas de calendario como texto `YYYY-MM-DD` (sin hora ni zona), que es como se reparte: «el día 5». */
export type Fecha = string;

export const ZONA_CHILE = 'America/Santiago';

const PATRON = /^(\d{4})-(\d{2})-(\d{2})$/;

export const esFechaValida = (texto: string): boolean => {
  const m = PATRON.exec(texto);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
};

/** Fecha de hoy en Chile para un instante dado (el servidor corre en UTC: a las 22:00 en Chile ya es «mañana» en UTC). */
export const fechaEnChile = (instante: Date): Fecha =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CHILE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante);

export const sumarDias = (fecha: Fecha, dias: number): Fecha => {
  const m = PATRON.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: ${fecha}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  return d.toISOString().slice(0, 10);
};

/** 0 = domingo … 6 = sábado (igual que `horario_local.dias`). */
export const diaDeSemana = (fecha: Fecha): 0 | 1 | 2 | 3 | 4 | 5 | 6 => {
  const m = PATRON.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: ${fecha}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

/** Minutos transcurridos del día en Chile (0..1439) para un instante dado. */
export const minutosEnChile = (instante: Date): number => {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_CHILE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instante);
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
};
