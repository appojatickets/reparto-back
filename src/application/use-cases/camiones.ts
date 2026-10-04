import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { parsearPatente } from '../../domain/valor/patente.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { Camion, CamionRepository } from '../ports/out/camiones.js';

const alias = (a: string | undefined): string | undefined => {
  const limpio = a?.replace(/\s+/g, ' ').trim();
  return limpio === '' ? undefined : limpio;
};

export const crearCrearCamion = ({ camiones }: { camiones: CamionRepository }) =>
  async (actor: Usuario, entrada: { patente: string; alias?: string | undefined }): Promise<Result<Camion, ErrorApp>> => {
    const patente = parsearPatente(entrada.patente);
    if (!patente.ok) return err(errorApp('VALIDACION', patente.error.mensaje, { codigo: patente.error.codigo }));
    const a = alias(entrada.alias);
    if (a !== undefined && a.length > 40) return err(errorApp('VALIDACION', 'El alias supera 40 caracteres.'));
    const r = await camiones.crear(actor.empresaId, { patente: patente.value, ...(a !== undefined ? { alias: a } : {}) });
    return r.ok ? ok(r.value) : err(errorApp('CONFLICTO', `Ya existe un camión con la patente ${patente.value}.`));
  };

export const crearListarCamiones = ({ camiones }: { camiones: CamionRepository }) =>
  (actor: Usuario, opciones: { soloActivos?: boolean } = {}): Promise<readonly Camion[]> => camiones.listar(actor.empresaId, opciones);

export const crearActualizarCamion = ({ camiones }: { camiones: CamionRepository }) =>
  async (actor: Usuario, id: string, cambios: { alias?: string | null | undefined; activo?: boolean | undefined }): Promise<Result<Camion, ErrorApp>> => {
    const a = cambios.alias === null ? null : alias(cambios.alias ?? undefined);
    if (typeof a === 'string' && a.length > 40) return err(errorApp('VALIDACION', 'El alias supera 40 caracteres.'));
    if (cambios.alias === undefined && cambios.activo === undefined) return err(errorApp('VALIDACION', 'No hay nada que actualizar.'));
    const r = await camiones.actualizar(actor.empresaId, id, {
      ...(cambios.alias !== undefined ? { alias: a === undefined ? null : a } : {}),
      ...(cambios.activo !== undefined ? { activo: cambios.activo } : {}),
    });
    return r ? ok(r) : err(errorApp('NO_ENCONTRADO', 'El camión no existe.'));
  };
