import { CONFIG_POR_DEFECTO, ORDENES_DE_INICIO, type ConfigEmpresa, type Deposito, type OrdenInicio } from '../../../domain/entidades/config-empresa.js';
import type { EmpresaRepository } from '../../../application/ports/out/empresa.js';
import type { Db } from './client.js';

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const numero = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);

const leerDeposito = (x: unknown): Deposito | undefined => {
  if (!esObjeto(x)) return undefined;
  const lat = numero(x['lat']);
  const lng = numero(x['lng']);
  if (lat === undefined || lng === undefined) return undefined;
  return typeof x['nombre'] === 'string' && x['nombre'] !== '' ? { lat, lng, nombre: x['nombre'] } : { lat, lng };
};

const leerOrdenInicio = (x: unknown): OrdenInicio | undefined => ORDENES_DE_INICIO.find((o) => o === x);

/** La configuración vive en `empresa.config` (jsonb). Se lee con tolerancia: lo que falte o venga roto usa el valor por defecto. */
export const leerConfig = (json: unknown): ConfigEmpresa => {
  const c = esObjeto(json) ? json : {};
  const deposito = leerDeposito(c['deposito']);
  const ordenInicio = leerOrdenInicio(c['ordenInicio']);
  return {
    ...(deposito ? { deposito } : {}),
    ...(ordenInicio ? { ordenInicio } : {}),
    salidaPorDefectoMin: numero(c['salidaPorDefectoMin']) ?? CONFIG_POR_DEFECTO.salidaPorDefectoMin,
    horaLimiteRegresoMin: numero(c['horaLimiteRegresoMin']) ?? CONFIG_POR_DEFECTO.horaLimiteRegresoMin,
  };
};

export class PostgresEmpresaRepository implements EmpresaRepository {
  constructor(private readonly db: Db) {}

  async obtenerConfig(empresaId: string): Promise<ConfigEmpresa | undefined> {
    const f = await this.db.selectFrom('empresa').select('config').where('id', '=', empresaId).executeTakeFirst();
    return f && leerConfig(f.config);
  }

  async guardarConfig(empresaId: string, config: ConfigEmpresa): Promise<void> {
    // Se mezcla con lo que ya hubiera (p. ej. los parámetros del motor, que viven en la misma columna).
    const actual = await this.db.selectFrom('empresa').select('config').where('id', '=', empresaId).executeTakeFirst();
    const previo = actual && esObjeto(actual.config) ? actual.config : {};
    const resto = Object.fromEntries(Object.entries(previo).filter(([k]) => k !== 'deposito' && k !== 'ordenInicio'));
    const nuevo = { ...resto, ...(config.deposito ? { deposito: config.deposito } : {}), ...(config.ordenInicio ? { ordenInicio: config.ordenInicio } : {}), salidaPorDefectoMin: config.salidaPorDefectoMin, horaLimiteRegresoMin: config.horaLimiteRegresoMin };
    await this.db
      .updateTable('empresa')
      .set((eb) => ({ config: JSON.stringify(nuevo), config_version: eb('config_version', '+', 1) }))
      .where('id', '=', empresaId)
      .execute();
  }
}
