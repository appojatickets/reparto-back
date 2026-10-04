import { distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { err, ok, type Result } from '../shared/result.js';
import { normalizarRut, parsearRut } from '../valor/rut.js';
import { leerPin, limpiarTexto } from './fila-cliente.js';

export type PropuestaPinCruda = {
  readonly rut?: string | undefined;
  readonly direccion?: string | undefined;
  readonly lat?: number | string | undefined;
  readonly lng?: number | string | undefined;
};

export type PropuestaPinValida = { readonly rut?: string; readonly direccion: string; readonly lat: number; readonly lng: number };

export const validarPropuestaPin = (p: PropuestaPinCruda): Result<PropuestaPinValida, ErrorDominio[]> => {
  const errores: ErrorDominio[] = [];
  const direccion = limpiarTexto(p.direccion);
  if (direccion === '') errores.push(errorDominio('DIRECCION_REQUERIDA', 'Falta la dirección.'));

  let rut: string | undefined;
  if (limpiarTexto(p.rut) !== '') {
    const r = parsearRut(p.rut ?? '');
    if (r.ok) rut = normalizarRut(r.value);
    else errores.push(r.error);
  }

  const pin = leerPin(p.lat, p.lng);
  if (!pin.ok) errores.push(pin.error);
  else if (pin.value === undefined) errores.push(errorDominio('PIN_INCOMPLETO', 'Faltan la latitud y la longitud.'));

  if (errores.length > 0 || !pin.ok || pin.value === undefined) return err(errores);
  return ok({ ...(rut !== undefined ? { rut } : {}), direccion, lat: pin.value.lat, lng: pin.value.lng });
};

export const distanciaMetros = (a: Coordenada, b: Coordenada): number => distanciaKm(a, b) * 1000;
