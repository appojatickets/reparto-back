import { vi } from 'vitest';
import type { ConfigEmpresa } from '../../domain/entidades/config-empresa.js';
import { err, ok } from '../../domain/shared/result.js';
import type { EmpresaRepository } from '../ports/out/empresa.js';
import type { EntregaRepository } from '../ports/out/entregas.js';
import type { FacturaParaRuta, GuardarRuta, RutaGuardada, RutaRepository, HechaConUbicacion } from '../ports/out/rutas.js';
import { camionDe, facturaDe } from './fakes-facturas.test-util.js';
import type { CamionRepository } from '../ports/out/camiones.js';
import type { FacturaRepository } from '../ports/out/facturas.js';

export const CAMION_ID = 'cam-1';
export const FECHA = '2026-10-05'; // lunes
export const CONFIG: ConfigEmpresa = { deposito: { lat: -33.5, lng: -70.7 }, salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 };

export const paradaDe = (n: string, extra: Partial<FacturaParaRuta> = {}): FacturaParaRuta => ({
  facturaId: `f-${n}`,
  folio: `100${n}`,
  localId: `l-${n}`,
  razonSocial: `Local ${n}`,
  direccion: `Calle ${n}`,
  comuna: 'Santiago',
  lat: -33.45 - (n.charCodeAt(0) % 7) / 100,
  lng: -70.65 - (n.charCodeAt(0) % 5) / 100,
  urgente: false,
  horarios: [],
  ...extra,
});

/** Repositorio de rutas en memoria con control de versión, como el real. */
export const fakeRutas = (pendientes: FacturaParaRuta[] = [], hechas: HechaConUbicacion[] = []) => {
  let guardada: RutaGuardada | undefined;
  const estado = { pendientes, hechas };
  const repo = {
    obtener: vi.fn<RutaRepository['obtener']>(() => Promise.resolve(guardada)),
    facturasPendientes: vi.fn<RutaRepository['facturasPendientes']>(() => Promise.resolve(estado.pendientes)),
    hechasConUbicacion: vi.fn<RutaRepository['hechasConUbicacion']>(() => Promise.resolve(estado.hechas)),
    guardar: vi.fn<RutaRepository['guardar']>((_e, d: GuardarRuta) => {
      if (d.versionEsperada !== undefined && d.versionEsperada !== guardada?.version) return Promise.resolve(err('VERSION_DESACTUALIZADA' as const));
      guardada = { id: 'r-1', camionId: d.camionId, fecha: d.fecha, salidaMin: d.salidaMin, modo: d.modo, version: (guardada?.version ?? 0) + 1, orden: d.orden, fijas: d.fijas };
      return Promise.resolve(ok(guardada));
    }),
    borrar: vi.fn<RutaRepository['borrar']>(() => {
      guardada = undefined;
      return Promise.resolve();
    }),
    borrarAnteriores: vi.fn<RutaRepository['borrarAnteriores']>(() => Promise.resolve()),
  } satisfies RutaRepository;
  return { repo, estado, guardadaActual: () => guardada };
};

/** `null` = la empresa no existe. */
export const fakeEmpresas = (config: ConfigEmpresa | null = CONFIG) =>
  ({
    obtenerConfig: vi.fn<EmpresaRepository['obtenerConfig']>(() => Promise.resolve(config ?? undefined)),
    guardarConfig: vi.fn<EmpresaRepository['guardarConfig']>(() => Promise.resolve()),
  }) satisfies EmpresaRepository;

export const fakeCamionesRuta = () =>
  ({
    listar: vi.fn<CamionRepository['listar']>(() => Promise.resolve([camionDe({ id: CAMION_ID })])),
    crear: vi.fn<CamionRepository['crear']>(),
    actualizar: vi.fn<CamionRepository['actualizar']>(),
  }) satisfies CamionRepository;

export const fakeFacturasRuta = () =>
  ({
    crear: vi.fn<FacturaRepository['crear']>(),
    obtener: vi.fn<FacturaRepository['obtener']>(),
    listar: vi.fn<FacturaRepository['listar']>(() => Promise.resolve([])),
    actualizar: vi.fn<FacturaRepository['actualizar']>(() => Promise.resolve(ok(facturaDe()))),
    soltarPendientesDelCamion: vi.fn<FacturaRepository['soltarPendientesDelCamion']>(() => Promise.resolve(0)),
  }) satisfies FacturaRepository;

export const fakeEntregasRuta = () =>
  ({
    registrar: vi.fn<EntregaRepository['registrar']>(() => Promise.resolve()),
    ultimaPosicion: vi.fn<EntregaRepository['ultimaPosicion']>(() => Promise.resolve(undefined)),
    conLlegada: vi.fn<EntregaRepository['conLlegada']>(() => Promise.resolve(new Set<string>())),
    posicionesDeEntrega: vi.fn<EntregaRepository['posicionesDeEntrega']>(() => Promise.resolve([])),
    visitasConGps: vi.fn<EntregaRepository['visitasConGps']>(() => Promise.resolve([])),
    visitasConGpsDeLocales: vi.fn<EntregaRepository['visitasConGpsDeLocales']>(() => Promise.resolve(new Map())),
  }) satisfies EntregaRepository;
