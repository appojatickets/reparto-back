import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { crearCoordenada, dentroDeRegionMetropolitana, type Coordenada } from '../valor/coordenada.js';

export type Deposito = Coordenada & { readonly nombre?: string };

/** Por dónde parte la ruta: `automatico` (el sistema decide), `lejano` (por lo más lejano del depósito, volviendo acercándose) o `cercano`. */
export const ORDENES_DE_INICIO = ['automatico', 'lejano', 'cercano'] as const;
export type OrdenInicio = (typeof ORDENES_DE_INICIO)[number];

/** Lo que el ruteo necesita saber de la empresa. Sin depósito no se puede calcular ninguna ruta. */
export type ConfigEmpresa = {
  readonly deposito?: Deposito;
  /** Hora de salida habitual del depósito (minutos del día). Cada ruta puede salir a otra hora. */
  readonly salidaPorDefectoMin: number;
  /** Hora de regreso desde la cual se avisa (minutos del día). */
  readonly horaLimiteRegresoMin: number;
  /** Sin indicar, el sistema decide (`automatico`). */
  readonly ordenInicio?: OrdenInicio;
};

export const CONFIG_POR_DEFECTO: ConfigEmpresa = Object.freeze({ salidaPorDefectoMin: 8 * 60, horaLimiteRegresoMin: 21 * 60 });

export type ConfigCruda = {
  readonly deposito?: { readonly lat: number; readonly lng: number; readonly nombre?: string | undefined } | undefined;
  readonly salidaPorDefectoMin: number;
  readonly horaLimiteRegresoMin: number;
  readonly ordenInicio?: OrdenInicio | undefined;
};

const minutoValido = (m: number): boolean => Number.isInteger(m) && m >= 0 && m <= 1439;

export const validarConfig = (c: ConfigCruda): Result<ConfigEmpresa, readonly ErrorDominio[]> => {
  const errores: ErrorDominio[] = [];
  let deposito: Deposito | undefined;
  if (c.deposito) {
    const coord = crearCoordenada(c.deposito.lat, c.deposito.lng);
    if (!coord.ok) errores.push(errorDominio('DEPOSITO_INVALIDO', 'La ubicación del depósito no es válida.'));
    else if (!dentroDeRegionMetropolitana(coord.value)) errores.push(errorDominio('DEPOSITO_FUERA_DE_RM', 'El depósito debe estar en la Región Metropolitana.'));
    else {
      const nombre = c.deposito.nombre?.replace(/\s+/g, ' ').trim();
      deposito = nombre ? { ...coord.value, nombre } : coord.value;
    }
  }
  if (!minutoValido(c.salidaPorDefectoMin)) errores.push(errorDominio('SALIDA_INVALIDA', 'La hora de salida no es válida.'));
  if (!minutoValido(c.horaLimiteRegresoMin)) errores.push(errorDominio('LIMITE_INVALIDO', 'La hora límite de regreso no es válida.'));
  else if (minutoValido(c.salidaPorDefectoMin) && c.horaLimiteRegresoMin <= c.salidaPorDefectoMin) {
    errores.push(errorDominio('LIMITE_ANTES_DE_SALIDA', 'La hora límite de regreso debe ser después de la salida.'));
  }
  if (c.ordenInicio !== undefined && !ORDENES_DE_INICIO.includes(c.ordenInicio)) errores.push(errorDominio('ORDEN_INICIO_INVALIDO', 'El orden de inicio no es válido (automático, más lejano o más cercano).'));
  if (errores.length > 0) return err(errores);
  return ok({ ...(deposito ? { deposito } : {}), salidaPorDefectoMin: c.salidaPorDefectoMin, horaLimiteRegresoMin: c.horaLimiteRegresoMin, ...(c.ordenInicio !== undefined ? { ordenInicio: c.ordenInicio } : {}) });
};
