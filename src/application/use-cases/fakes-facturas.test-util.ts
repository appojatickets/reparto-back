import { vi } from 'vitest';
import { err, ok } from '../../domain/shared/result.js';
import type { Camion, CamionRepository } from '../ports/out/camiones.js';
import type { FacturaDetallada, FacturaRepository } from '../ports/out/facturas.js';
import type { RegistroAprendizajeRepository } from '../ports/out/registro-aprendizaje.js';
import type { Jornada, JornadaRepository } from '../ports/out/jornadas.js';
import type { AsignacionDia, PlanillaRepository } from '../ports/out/planillas.js';
import type { Vendedor, VendedorRepository } from '../ports/out/vendedores.js';
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

export const fakePlanillas = (deCamion?: AsignacionDia) =>
  ({
    guardar: vi.fn<PlanillaRepository['guardar']>(() => Promise.resolve()),
    obtener: vi.fn<PlanillaRepository['obtener']>(() => Promise.resolve(deCamion ? [deCamion] : [])),
    deCamion: vi.fn<PlanillaRepository['deCamion']>(() => Promise.resolve(deCamion)),
  }) satisfies PlanillaRepository;

export const vendedorDe = (extra: Partial<Vendedor> = {}): Vendedor => ({ id: 'v-1', codigo: 'V12', nombre: 'V12', activo: true, ...extra });

export const fakeVendedores = () =>
  ({
    listar: vi.fn<VendedorRepository['listar']>(() => Promise.resolve([vendedorDe()])),
    crear: vi.fn<VendedorRepository['crear']>((_e, d) => Promise.resolve(ok(vendedorDe({ codigo: d.codigo, nombre: d.nombre, ...(d.celular !== undefined ? { celular: d.celular } : {}) })))),
    actualizar: vi.fn<VendedorRepository['actualizar']>(() => Promise.resolve(vendedorDe())),
    asegurar: vi.fn<VendedorRepository['asegurar']>((_e, vs) =>
      Promise.resolve({ vendedores: vs.map((v, i) => vendedorDe({ id: `v-${String(i + 1)}`, codigo: v.codigo, nombre: v.nombre ?? v.codigo })), creados: vs.length }),
    ),
  }) satisfies VendedorRepository;

/** El resolvedor real con una jornada fija (reloj de prueba: 2026-10-05 12:00 UTC). Despachador y admin pasan sin jornada. */
export const resolverDePrueba = (activa?: Jornada) => crearResolverCamion({ jornadas: fakeJornadas(activa), clock: crearReloj().clock });

export const fakeRegistro = () =>
  ({
    registrarOperacion: vi.fn<RegistroAprendizajeRepository['registrarOperacion']>(() => Promise.resolve()),
    registrarPosiciones: vi.fn<RegistroAprendizajeRepository['registrarPosiciones']>(() => Promise.resolve()),
    posicionesDesde: vi.fn<RegistroAprendizajeRepository['posicionesDesde']>(() => Promise.resolve([])),
    guardarResumenDeJornada: vi.fn<RegistroAprendizajeRepository['guardarResumenDeJornada']>(() => Promise.resolve()),
  }) satisfies RegistroAprendizajeRepository;
