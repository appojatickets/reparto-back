import { describe, expect, it, vi } from 'vitest';
import type { EmpresaRepository } from '../ports/out/empresa.js';
import { crearGuardarConfigEmpresa, crearObtenerConfigEmpresa } from './config-empresa.js';
import { usuarioDe } from './fakes.test-util.js';

const admin = usuarioDe();
const fake = (): { [K in keyof EmpresaRepository]: ReturnType<typeof vi.fn<EmpresaRepository[K]>> } => ({
  obtenerConfig: vi.fn<EmpresaRepository['obtenerConfig']>(() => Promise.resolve({ salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 })),
  guardarConfig: vi.fn<EmpresaRepository['guardarConfig']>(() => Promise.resolve()),
});

describe('configuración de la empresa', () => {
  it('obtiene la configuración de la empresa del usuario; si no existe, NO_ENCONTRADO', async () => {
    const empresas = fake();
    const r = await crearObtenerConfigEmpresa({ empresas })(admin);
    expect(r.ok && r.value.salidaPorDefectoMin).toBe(480);
    expect(empresas.obtenerConfig).toHaveBeenCalledWith('empresa-1');
    empresas.obtenerConfig.mockResolvedValueOnce(undefined);
    const nada = await crearObtenerConfigEmpresa({ empresas })(admin);
    expect(!nada.ok && nada.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('guarda solo si es válida y devuelve lo guardado', async () => {
    const empresas = fake();
    const guardar = crearGuardarConfigEmpresa({ empresas });
    const ok = await guardar(admin, { deposito: { lat: -33.45, lng: -70.66, nombre: ' Bodega ' }, salidaPorDefectoMin: 450, horaLimiteRegresoMin: 1230 });
    expect(ok.ok && ok.value.deposito?.nombre).toBe('Bodega');
    expect(empresas.guardarConfig).toHaveBeenCalledWith('empresa-1', { deposito: { lat: -33.45, lng: -70.66, nombre: 'Bodega' }, salidaPorDefectoMin: 450, horaLimiteRegresoMin: 1230 });
    const mala = await guardar(admin, { salidaPorDefectoMin: 450, horaLimiteRegresoMin: 400 });
    expect(!mala.ok && mala.error.codigo).toBe('VALIDACION');
    expect(empresas.guardarConfig).toHaveBeenCalledTimes(1);
  });
});
