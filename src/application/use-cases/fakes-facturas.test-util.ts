import { vi } from 'vitest';
import { err, ok } from '../../domain/shared/result.js';
import type { Camion, CamionRepository } from '../ports/out/camiones.js';
import type { FacturaDetallada, FacturaRepository } from '../ports/out/facturas.js';

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
    listar: vi.fn<FacturaRepository['listar']>(() => Promise.resolve([facturaDe()])),
    actualizar: vi.fn<FacturaRepository['actualizar']>(() => Promise.resolve(ok(facturaDe()))),
  }) satisfies FacturaRepository;

export { err, ok };
