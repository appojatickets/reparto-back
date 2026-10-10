import { describe, expect, it, vi } from 'vitest';
import type { DatosContribucion } from '../../domain/entidades/contribuciones.js';
import type { ContribucionesRepository } from '../ports/out/contribuciones.js';
import { crearVerContribuyentes } from './contribuyentes-local.js';
import { fakeUsuarios, usuarioDe } from './fakes.test-util.js';

const chofer = usuarioDe({ id: 'u-ch', rol: 'chofer', username: 'jperez', nombre: 'Juan Pérez', fotoPath: 'e/perfil/u-ch/x.webp', fotoEn: new Date('2026-10-10T12:00:00.000Z') });
const ayudante = usuarioDe({ id: 'u-ay', rol: 'ayudante', username: 'mrojas', nombre: 'María Rojas' });
const completo: DatosContribucion = { tieneFoto: true, tienePin: true, pinVerificado: false, fotoPor: 'u-ay', entregasPor: [{ usuarioId: 'u-ch', entregas: 3 }, { usuarioId: 'u-ay', entregas: 1 }] };

const montar = (datos: DatosContribucion | undefined) => {
  const contribuciones = { datosDelLocal: vi.fn<ContribucionesRepository['datosDelLocal']>(() => Promise.resolve(datos)) };
  return { contribuciones, ver: crearVerContribuyentes({ contribuciones, usuarios: fakeUsuarios([chofer, ayudante, usuarioDe()]).repo }) };
};

describe('quiénes aportaron a un local (con nombre y foto de perfil)', () => {
  it('devuelve cada persona con su nombre, su foto de perfil (si tiene) y lo que aportó', async () => {
    const t = montar(completo);
    const r = await t.ver(usuarioDe(), 'l-1');
    expect(t.contribuciones.datosDelLocal).toHaveBeenCalledWith('empresa-1', 'l-1');
    expect(r.ok && r.value).toEqual([
      { usuarioId: 'u-ay', nombre: 'María Rojas', aportes: ['foto', 'entregas'], entregas: 1 },
      { usuarioId: 'u-ch', nombre: 'Juan Pérez', fotoEn: '2026-10-10T12:00:00.000Z', aportes: ['entregas'], entregas: 3 },
    ]);
  });

  it('un local que todavía no cumple (sin foto o con una sola entrega) devuelve una lista vacía, no un error', async () => {
    const r = await montar({ ...completo, entregasPor: [{ usuarioId: 'u-ch', entregas: 1 }] }).ver(usuarioDe(), 'l-1');
    expect(r).toEqual({ ok: true, value: [] });
  });

  it('un local que no existe es NO_ENCONTRADO', async () => {
    const r = await montar(undefined).ver(usuarioDe(), 'l-x');
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('una persona que ya no está en la lista de usuarios se omite', async () => {
    const r = await montar({ ...completo, entregasPor: [{ usuarioId: 'u-borrado', entregas: 5 }, { usuarioId: 'u-ch', entregas: 2 }] }).ver(usuarioDe(), 'l-1');
    expect(r.ok && r.value.map((c) => c.usuarioId)).toEqual(['u-ch', 'u-ay']);
  });
});
