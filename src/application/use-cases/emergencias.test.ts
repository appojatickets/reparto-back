import { describe, expect, it, vi } from 'vitest';
import type { EmergenciaRegistrada, EmergenciaRepository } from '../ports/out/emergencias.js';
import { usuarioDe } from './fakes.test-util.js';
import { JORNADA, resolverDePrueba } from './fakes-facturas.test-util.js';
import { crearListarEmergencias, crearRegistrarEmergencia } from './emergencias.js';

const chofer = usuarioDe({ id: 'u-chofer', rol: 'chofer' });
const despachador = usuarioDe({ id: 'u-d', rol: 'despachador' });
const guardada = (extra: Partial<EmergenciaRegistrada> = {}): EmergenciaRegistrada => ({ id: 'e-1', camionId: 'cam-1', tipo: 'vulcanizacion', creadoEn: new Date('2026-10-05T15:00:00Z'), ...extra });
const fake = () => ({
  registrar: vi.fn<EmergenciaRepository['registrar']>((_e, n) => Promise.resolve({ id: 'e-1', ...n, creadoEn: new Date('2026-10-05T15:00:00Z') })),
  delDia: vi.fn<EmergenciaRepository['delDia']>(() => Promise.resolve([guardada()])),
});

describe('emergencia del camión', () => {
  it('queda registrada en el camión de la jornada de quien avisa, con la posición y a nombre suyo', async () => {
    const emergencias = fake();
    const r = await crearRegistrarEmergencia({ emergencias, resolverCamion: resolverDePrueba(JORNADA) })(chofer, { tipo: 'vulcanizacion', lat: -33.5, lng: -70.7, precisionM: 15 });
    expect(r.ok).toBe(true);
    expect(emergencias.registrar).toHaveBeenCalledWith('empresa-1', { tipo: 'vulcanizacion', lat: -33.5, lng: -70.7, precisionM: 15, camionId: 'cam-1', usuarioId: 'u-chofer' });
  });

  it('sin jornada de hoy no se registra (primero se elige el camión)', async () => {
    const emergencias = fake();
    const r = await crearRegistrarEmergencia({ emergencias, resolverCamion: resolverDePrueba() })(chofer, { tipo: 'mecanico' });
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(emergencias.registrar).not.toHaveBeenCalled();
  });

  it('un aviso inválido se rechaza sin guardar nada', async () => {
    const emergencias = fake();
    const r = await crearRegistrarEmergencia({ emergencias, resolverCamion: resolverDePrueba(JORNADA) })(chofer, { tipo: 'otro' });
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(emergencias.registrar).not.toHaveBeenCalled();
  });

  it('el chofer lista solo las de su camión; el despachador, las del camión que pida o todas', async () => {
    const emergencias = fake();
    const listar = crearListarEmergencias({ emergencias, resolverCamion: resolverDePrueba(JORNADA) });
    await listar(chofer, { fecha: '2026-10-05', camionId: 'cam-1' });
    expect(emergencias.delDia).toHaveBeenLastCalledWith('empresa-1', '2026-10-05', 'cam-1');
    const ajeno = await listar(chofer, { fecha: '2026-10-05', camionId: 'cam-9' });
    expect(!ajeno.ok && ajeno.error.codigo).toBe('SIN_PERMISO');
    await listar(despachador, { fecha: '2026-10-05' });
    expect(emergencias.delDia).toHaveBeenLastCalledWith('empresa-1', '2026-10-05', undefined);
  });

  it('rechaza una fecha inválida', async () => {
    const r = await crearListarEmergencias({ emergencias: fake(), resolverCamion: resolverDePrueba() })(despachador, { fecha: '2026-13-40' });
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
  });
});
