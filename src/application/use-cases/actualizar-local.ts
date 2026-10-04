import type { Usuario } from '../../domain/entidades/usuario.js';
import { leerPin, limpiarTexto } from '../../domain/importacion/fila-cliente.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { CambiosLocal, ClienteRepository } from '../ports/out/clientes.js';

export type EntradaActualizarLocal = {
  readonly nota?: string | undefined;
  readonly streetviewRumbo?: number | undefined;
  readonly lat?: number | undefined;
  readonly lng?: number | undefined;
};

/** Nota, rumbo de Street View (solo la referencia, nunca la imagen) y pin del local. Poner el pin a mano lo valida. */
export const crearActualizarLocal = ({ clientes }: { clientes: ClienteRepository }) =>
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
    const pin = leerPin(entrada.lat, entrada.lng);
    if (!pin.ok) return err(errorApp('VALIDACION', pin.error.mensaje, { codigo: pin.error.codigo }));
    if (pin.value) cambios.pin = { ...pin.value, estado: 'validado', fuente: 'manual' };

    if (Object.keys(cambios).length === 0) return err(errorApp('VALIDACION', 'No hay nada que actualizar.'));
    const existe = await clientes.actualizarLocal(actor.empresaId, localId, cambios);
    return existe ? ok(undefined) : err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
  };
