import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { parsearCelular } from '../../domain/valor/telefono.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { Vendedor, VendedorRepository } from '../ports/out/vendedores.js';

const limpiar = (t: string): string => t.replace(/\s+/g, ' ').trim();

const nombreValido = (nombre: string): ErrorApp | undefined =>
  nombre.length === 0 || nombre.length > 60 ? errorApp('VALIDACION', 'El nombre debe tener entre 1 y 60 caracteres.') : undefined;

/** «v1», «V 01» → V1, V01: solo letras, números y guion, en mayúsculas. */
const codigoDe = (texto: string): string => texto.replace(/\s+/g, '').toUpperCase();

export const crearCrearVendedor = ({ vendedores }: { vendedores: VendedorRepository }) =>
  async (actor: Usuario, entrada: { codigo: string; nombre: string; celular?: string | undefined }): Promise<Result<Vendedor, ErrorApp>> => {
    const codigo = codigoDe(entrada.codigo);
    if (!/^[A-Z0-9-]{1,10}$/.test(codigo)) return err(errorApp('VALIDACION', 'El código debe tener hasta 10 letras, números o guiones (por ejemplo V01).'));
    const nombre = limpiar(entrada.nombre);
    const malNombre = nombreValido(nombre);
    if (malNombre) return err(malNombre);
    let celular: string | undefined;
    if (entrada.celular !== undefined && entrada.celular.trim() !== '') {
      const c = parsearCelular(entrada.celular);
      if (!c.ok) return err(errorApp('VALIDACION', c.error.mensaje, { codigo: c.error.codigo }));
      celular = c.value;
    }
    const r = await vendedores.crear(actor.empresaId, { codigo, nombre, ...(celular !== undefined ? { celular } : {}) });
    return r.ok ? ok(r.value) : err(errorApp('CONFLICTO', `Ya existe un vendedor con el código ${codigo}.`));
  };

export const crearListarVendedores = ({ vendedores }: { vendedores: VendedorRepository }) =>
  (actor: Usuario, opciones: { soloActivos?: boolean } = {}): Promise<readonly Vendedor[]> => vendedores.listar(actor.empresaId, opciones);

export const crearActualizarVendedor = ({ vendedores }: { vendedores: VendedorRepository }) =>
  async (
    actor: Usuario,
    id: string,
    cambios: { nombre?: string | undefined; celular?: string | null | undefined; activo?: boolean | undefined },
  ): Promise<Result<Vendedor, ErrorApp>> => {
    if (cambios.nombre === undefined && cambios.celular === undefined && cambios.activo === undefined) return err(errorApp('VALIDACION', 'No hay nada que actualizar.'));
    let nombre: string | undefined;
    if (cambios.nombre !== undefined) {
      nombre = limpiar(cambios.nombre);
      const mal = nombreValido(nombre);
      if (mal) return err(mal);
    }
    let celular: string | null | undefined;
    if (cambios.celular === null || (cambios.celular !== undefined && cambios.celular.trim() === '')) celular = null;
    else if (cambios.celular !== undefined) {
      const c = parsearCelular(cambios.celular);
      if (!c.ok) return err(errorApp('VALIDACION', c.error.mensaje, { codigo: c.error.codigo }));
      celular = c.value;
    }
    const r = await vendedores.actualizar(actor.empresaId, id, {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(celular !== undefined ? { celular } : {}),
      ...(cambios.activo !== undefined ? { activo: cambios.activo } : {}),
    });
    return r ? ok(r) : err(errorApp('NO_ENCONTRADO', 'El vendedor no existe.'));
  };
