import type { Usuario } from '../../domain/entidades/usuario.js';
import { leerPin, limpiarTexto } from '../../domain/importacion/fila-cliente.js';
import { resolverComuna } from '../../domain/comunas.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { CambiosLocal, ClienteRepository } from '../ports/out/clientes.js';

export type EntradaActualizarLocal = {
  readonly direccion?: string | undefined;
  readonly comuna?: string | undefined;
  readonly nota?: string | undefined;
  readonly streetviewRumbo?: number | undefined;
  readonly lat?: number | undefined;
  readonly lng?: number | undefined;
};

/**
 * Dirección y comuna, nota, rumbo de Street View (solo la referencia, nunca la imagen) y pin del local. Poner el pin a mano lo valida.
 * Cambiar la dirección vuelve a buscar el pin si el que había lo puso el buscador y nadie lo verificó (`programarPines`).
 */
export const crearActualizarLocal = ({ clientes, programarPines }: { clientes: ClienteRepository; programarPines?: (empresaId: string, localIds: readonly string[]) => void }) =>
  async (actor: Usuario, localId: string, entrada: EntradaActualizarLocal): Promise<Result<void, ErrorApp>> => {
    const cambios: { -readonly [K in keyof CambiosLocal]: CambiosLocal[K] } = {};

    if (entrada.nota !== undefined) {
      const nota = limpiarTexto(entrada.nota);
      if (nota.length > 500) return err(errorApp('VALIDACION', 'La nota supera 500 caracteres.'));
      cambios.nota = nota;
    }
    if (entrada.streetviewRumbo !== undefined) {
      if (!Number.isInteger(entrada.streetviewRumbo) || entrada.streetviewRumbo < 0 || entrada.streetviewRumbo > 359) {
        return err(errorApp('VALIDACION', 'El rumbo debe ser un entero entre 0 y 359.'));
      }
      cambios.streetviewRumbo = entrada.streetviewRumbo;
    }
    let direccionNueva: { direccion: string; comuna: string } | undefined;
    if (entrada.direccion !== undefined || entrada.comuna !== undefined) {
      const actual = await clientes.obtenerLocal(actor.empresaId, localId);
      if (!actual) return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
      const direccion = entrada.direccion !== undefined ? limpiarTexto(entrada.direccion) : actual.direccion;
      if (direccion === '') return err(errorApp('VALIDACION', 'Falta la dirección.'));
      if (direccion.length > 300) return err(errorApp('VALIDACION', 'La dirección supera 300 caracteres.'));
      const comuna = entrada.comuna !== undefined ? resolverComuna(entrada.comuna) : actual.comuna;
      if (comuna === undefined) return err(errorApp('VALIDACION', 'La comuna no es de la Región Metropolitana.'));
      direccionNueva = { direccion, comuna };
    }
    const pin = leerPin(entrada.lat, entrada.lng);
    if (!pin.ok) return err(errorApp('VALIDACION', pin.error.mensaje, { codigo: pin.error.codigo }));
    if (pin.value) cambios.pin = { ...pin.value, estado: 'validado', fuente: 'manual' };

    if (Object.keys(cambios).length === 0 && direccionNueva === undefined) return err(errorApp('VALIDACION', 'No hay nada que actualizar.'));
    if (direccionNueva) {
      const r = await clientes.corregirDireccion(actor.empresaId, localId, direccionNueva);
      if (r === 'NO_ENCONTRADO') return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
      if (r === 'DUPLICADO') return err(errorApp('CONFLICTO', 'Este cliente ya tiene un local con esa dirección.'));
      programarPines?.(actor.empresaId, [localId]);
      if (Object.keys(cambios).length === 0) return ok(undefined);
    }
    const existe = await clientes.actualizarLocal(actor.empresaId, localId, cambios);
    return existe ? ok(undefined) : err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
  };
