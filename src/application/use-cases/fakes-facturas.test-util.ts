import { vi } from 'vitest';
import { err, ok } from '../../domain/shared/result.js';
import type { Camion, CamionRepository } from '../ports/out/camiones.js';
import type { FacturaDetallada, FacturaRepository } from '../ports/out/facturas.js';
import type { Jornada, JornadaRepository } from '../ports/out/jornadas.js';
import { crearReloj } from './fakes.test-util.js';
import { crearResolverCamion } from './jornada.js';

export const camionDe = (extra: Partial<Camion> = {}): Camion => ({ id: 'cam-1', patente: 'ABCD12', activo: true, ...extra });

export const facturaDe = (extra: Partial<FacturaDetallada> = {}): FacturaDetallada => ({
  id: 'f-1',
  folio: '1234',
  fecha: '2026-10-05',
  estado: 'pendiente',
  urgente: false,
  local: { id: 'l-1', razonSocial: 'Rabelo Mágica SpA', direccion: 'Av. Providencia 2500', comuna: 'Providencia', tienePin: true },
  ...extra,
});

export const fakeCamiones = () =>
  ({
    listar: vi.fn<CamionRepository['listar']>(() => Promise.resolve([camionDe()])),
    crear: vi.fn<CamionRepository['crear']>((_e, d) => Promise.resolve(ok(camionDe({ patente: d.patente, ...(d.alias !== undefined ? { alias: d.alias } : {}) })))),
    actualizar: vi.fn<CamionRepository['actualizar']>(() => Promise.resolve(camionDe())),
  }) satisfies CamionRepository;

export const fakeFacturas = () =>
  ({
    crear: vi.fn<FacturaRepository['crear']>(() => Promise.resolve(ok(facturaDe()))),
    obtener: vi.fn<FacturaRepository['obtener']>(() => Promise.resolve(facturaDe())),
    listar: vi.fn<FacturaRepository['listar']>(() => Promise.resolve([facturaDe()])),
    actualizar: vi.fn<FacturaRepository['actualizar']>(() => Promise.resolve(ok(facturaDe()))),
    soltarPendientesDelCamion: vi.fn<FacturaRepository['soltarPendientesDelCamion']>(() => Promise.resolve(0)),
  }) satisfies FacturaRepository;

export { err, ok };

export const JORNADA: Jornada = { id: 'j-1', usuarioId: 'u-chofer', fecha: '2026-10-05', desde: new Date('2026-10-05T11:00:00Z'), camion: { id: 'cam-1', patente: 'ABCD12' } };

export const fakeJornadas = (activa?: Jornada) =>
  ({
    activa: vi.fn<JornadaRepository['activa']>(() => Promise.resolve(activa)),
    iniciar: vi.fn<JornadaRepository['iniciar']>((_e, usuarioId, camionId, fecha, ahora) => Promise.resolve(ok({ ...JORNADA, usuarioId, fecha, desde: ahora, camion: { id: camionId, patente: 'ABCD12' } }))),
    terminar: vi.fn<JornadaRepository['terminar']>(() => Promise.resolve(true)),
    ultimaDelCamion: vi.fn<JornadaRepository['ultimaDelCamion']>(() => Promise.resolve(activa && { desde: activa.desde })),
  }) satisfies JornadaRepository;

/** El resolvedor real con una jornada fija (reloj de prueba: 2026-10-05 12:00 UTC). Despachador y admin pasan sin jornada. */
export const resolverDePrueba = (activa?: Jornada) => crearResolverCamion({ jornadas: fakeJornadas(activa), clock: crearReloj().clock });
