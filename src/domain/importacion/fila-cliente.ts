import { dentroDeRegionMetropolitana, crearCoordenada } from '../valor/coordenada.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { err, ok, type Result } from '../shared/result.js';
import { normalizarTexto } from '../entidades/local.js';
import { resolverComuna } from '../comunas.js';
import { normalizarRut, parsearRut } from '../valor/rut.js';

export type FilaClienteCruda = {
  readonly rut?: string | undefined;
  readonly razonSocial?: string | undefined;
  readonly giro?: string | undefined;
  readonly direccion?: string | undefined;
  readonly comuna?: string | undefined;
  readonly lat?: number | string | undefined;
  readonly lng?: number | string | undefined;
  readonly nota?: string | undefined;
};

export type FilaClienteValida = {
  readonly rut?: string;
  readonly razonSocial: string;
  readonly giro?: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly nota?: string;
  /** RUT, o razón social normalizada si no hay RUT. */
  readonly claveCliente: string;
  readonly claveLocal: string;
};

export const limpiarTexto = (t: string | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();

const aNumero = (v: number | string | undefined): number | undefined | 'invalido' => {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 'invalido';
  const t = v.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : 'invalido';
};

/** Lee un par lat/lng. Devuelve el par, `undefined` si no vienen, o los errores. */
export const leerPin = (
  latCruda: number | string | undefined,
  lngCruda: number | string | undefined,
): Result<{ lat: number; lng: number } | undefined, ErrorDominio> => {
  const lat = aNumero(latCruda);
  const lng = aNumero(lngCruda);
  if (lat === undefined && lng === undefined) return ok(undefined);
  if (lat === undefined || lng === undefined) return err(errorDominio('PIN_INCOMPLETO', 'Faltan la latitud o la longitud.'));
  if (lat === 'invalido' || lng === 'invalido') return err(errorDominio('PIN_INVALIDO', 'La latitud y la longitud deben ser números.'));
  const c = crearCoordenada(lat, lng);
  if (!c.ok) return err(errorDominio('PIN_INVALIDO', 'La latitud o la longitud están fuera de rango.'));
  if (!dentroDeRegionMetropolitana(c.value)) {
    return err(errorDominio('PIN_FUERA_DE_REGION', 'El pin cae fuera de la Región Metropolitana.'));
  }
  return ok({ lat, lng });
};

export const validarFilaCliente = (f: FilaClienteCruda): Result<FilaClienteValida, ErrorDominio[]> => {
  const errores: ErrorDominio[] = [];
  const razonSocial = limpiarTexto(f.razonSocial);
  const direccion = limpiarTexto(f.direccion);
  const giro = limpiarTexto(f.giro);
  const nota = limpiarTexto(f.nota);

  if (razonSocial === '') errores.push(errorDominio('RAZON_SOCIAL_REQUERIDA', 'Falta la razón social.'));
  else if (razonSocial.length > 200) errores.push(errorDominio('RAZON_SOCIAL_LARGA', 'La razón social supera 200 caracteres.'));
  if (direccion === '') errores.push(errorDominio('DIRECCION_REQUERIDA', 'Falta la dirección.'));
  else if (direccion.length > 300) errores.push(errorDominio('DIRECCION_LARGA', 'La dirección supera 300 caracteres.'));

  const comuna = resolverComuna(f.comuna ?? '');
  if (comuna === undefined) errores.push(errorDominio('COMUNA_INVALIDA', 'La comuna no es de la Región Metropolitana.'));

  let rut: string | undefined;
  if (limpiarTexto(f.rut) !== '') {
    const r = parsearRut(f.rut ?? '');
    if (r.ok) rut = normalizarRut(r.value);
    else errores.push(r.error);
  }

  const pin = leerPin(f.lat, f.lng);
  if (!pin.ok) errores.push(pin.error);
  if (giro.length > 100) errores.push(errorDominio('GIRO_LARGO', 'El giro supera 100 caracteres.'));
  if (nota.length > 500) errores.push(errorDominio('NOTA_LARGA', 'La nota supera 500 caracteres.'));

  if (errores.length > 0 || comuna === undefined || !pin.ok) return err(errores);

  const claveCliente = rut ?? `sin-rut:${normalizarTexto(razonSocial)}`;
  return ok({
    ...(rut !== undefined ? { rut } : {}),
    razonSocial,
    ...(giro !== '' ? { giro } : {}),
    direccion,
    comuna,
    ...(pin.value ? { lat: pin.value.lat, lng: pin.value.lng } : {}),
    ...(nota !== '' ? { nota } : {}),
    claveCliente,
    claveLocal: `${claveCliente}|${normalizarTexto(direccion)}`,
  });
};

export type FilaConsolidada = { readonly fila: FilaClienteValida; readonly indices: readonly number[] };

/** Une las filas con la misma clave de local (la última gana, sin borrar datos con campos vacíos). */
export const consolidarFilas = (filas: readonly FilaClienteValida[]): FilaConsolidada[] => {
  const porClave = new Map<string, { fila: FilaClienteValida; indices: number[] }>();
  filas.forEach((fila, i) => {
    const previa = porClave.get(fila.claveLocal);
    porClave.set(fila.claveLocal, { fila: previa ? { ...previa.fila, ...fila } : fila, indices: [...(previa?.indices ?? []), i] });
  });
  return [...porClave.values()];
};

export type LocalImportable = {
  readonly claveLocal: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly nota?: string;
  readonly indices: readonly number[];
};

export type ClienteImportable = {
  readonly claveCliente: string;
  readonly rut?: string;
  readonly razonSocial: string;
  readonly giro?: string;
  readonly locales: readonly LocalImportable[];
};

/** Agrupa los locales por cliente; así el repositorio inserta cada cliente una sola vez por lote. */
export const agruparPorCliente = (consolidadas: readonly FilaConsolidada[]): ClienteImportable[] => {
  const clientes = new Map<string, { base: FilaClienteValida; locales: LocalImportable[] }>();
  for (const { fila, indices } of consolidadas) {
    const actual = clientes.get(fila.claveCliente) ?? { base: fila, locales: [] };
    actual.base = { ...actual.base, razonSocial: fila.razonSocial, ...(fila.giro !== undefined ? { giro: fila.giro } : {}) };
    actual.locales.push({
      claveLocal: fila.claveLocal,
      direccion: fila.direccion,
      comuna: fila.comuna,
      ...(fila.lat !== undefined && fila.lng !== undefined ? { lat: fila.lat, lng: fila.lng } : {}),
      ...(fila.nota !== undefined ? { nota: fila.nota } : {}),
      indices,
    });
    clientes.set(fila.claveCliente, actual);
  }
  return [...clientes.entries()].map(([claveCliente, { base, locales }]) => ({
    claveCliente,
    ...(base.rut !== undefined ? { rut: base.rut } : {}),
    razonSocial: base.razonSocial,
    ...(base.giro !== undefined ? { giro: base.giro } : {}),
    locales,
  }));
};
