import type { Usuario } from '../../domain/entidades/usuario.js';
import { validarConfig, type ConfigCruda, type ConfigEmpresa } from '../../domain/entidades/config-empresa.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { EmpresaRepository } from '../ports/out/empresa.js';

export const crearObtenerConfigEmpresa = ({ empresas }: { empresas: EmpresaRepository }) =>
  async (actor: Usuario): Promise<Result<ConfigEmpresa, ErrorApp>> => {
    const c = await empresas.obtenerConfig(actor.empresaId);
    return c ? ok(c) : err(errorApp('NO_ENCONTRADO', 'La empresa no existe.'));
  };

export const crearGuardarConfigEmpresa = ({ empresas }: { empresas: EmpresaRepository }) =>
  async (actor: Usuario, entrada: ConfigCruda): Promise<Result<ConfigEmpresa, ErrorApp>> => {
    // Un cliente que no conoce el orden de inicio ni el interruptor de lo aprendido (una pantalla vieja) no debe borrarlos al guardar lo demás.
    const previa = entrada.ordenInicio === undefined || entrada.usarCierresAprendidos === undefined ? await empresas.obtenerConfig(actor.empresaId) : undefined;
    const ordenInicio = entrada.ordenInicio ?? previa?.ordenInicio;
    const usarCierresAprendidos = entrada.usarCierresAprendidos ?? previa?.usarCierresAprendidos;
    const v = validarConfig({ ...entrada, ...(ordenInicio !== undefined ? { ordenInicio } : {}), ...(usarCierresAprendidos !== undefined ? { usarCierresAprendidos } : {}) });
    if (!v.ok) return err(errorApp('VALIDACION', v.error.map((e) => e.mensaje).join(' '), { errores: v.error }));
    await empresas.guardarConfig(actor.empresaId, v.value);
    return ok(v.value);
  };
