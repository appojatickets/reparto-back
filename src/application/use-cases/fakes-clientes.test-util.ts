import { vi } from 'vitest';
import { err, ok } from '../../domain/shared/result.js';
import type { AlmacenArchivos } from '../ports/out/archivos.js';
import type { ClienteRepository, CoincidenciaLocal, LocalDetalle, ResumenImportacion } from '../ports/out/clientes.js';
import type { FotoReporteRepository } from '../ports/out/fotos.js';
import type { IdGenerator } from '../ports/out/id-generator.js';
import type { PropuestaPinRepository } from '../ports/out/pines.js';

export const fakeClientes = (locales: LocalDetalle[] = []) => {
  const repo = {
    buscar: vi.fn<ClienteRepository['buscar']>(() => Promise.resolve([])),
    crearConLocal: vi.fn<ClienteRepository['crearConLocal']>(() => Promise.resolve(ok({ clienteId: 'c-1', localId: 'l-1', existente: false }))),
    importar: vi.fn<ClienteRepository['importar']>(
      (_e, clientes): Promise<ResumenImportacion> =>
        Promise.resolve({ clientesCreados: clientes.length, clientesActualizados: 0, localesCreados: clientes.reduce((s, c) => s + c.locales.length, 0), localesActualizados: 0 }),
    ),
    obtenerLocal: vi.fn<ClienteRepository['obtenerLocal']>((empresaId, id) => Promise.resolve(empresaId === 'empresa-1' ? locales.find((l) => l.id === id) : undefined)),
    actualizarLocal: vi.fn<ClienteRepository['actualizarLocal']>((empresaId, id) => Promise.resolve(empresaId === 'empresa-1' && locales.some((l) => l.id === id))),
    fijarPinSiFalta: vi.fn<ClienteRepository['fijarPinSiFalta']>(() => Promise.resolve(true)),
    exportarLocales: vi.fn<ClienteRepository['exportarLocales']>(() => Promise.resolve([])),
    quitarFoto: vi.fn<ClienteRepository['quitarFoto']>(() => Promise.resolve(true)),
    marcarFotoVerificada: vi.fn<ClienteRepository['marcarFotoVerificada']>((empresaId, id, fotoPath) => Promise.resolve(empresaId === 'empresa-1' && locales.some((l) => l.id === id && l.fotoPath === fotoPath))),
    localesSinPin: vi.fn<ClienteRepository['localesSinPin']>(() => Promise.resolve([])),
    contarLocalesSinPin: vi.fn<ClienteRepository['contarLocalesSinPin']>(() => Promise.resolve(0)),
    marcarIntentoGeocodificacion: vi.fn<ClienteRepository['marcarIntentoGeocodificacion']>(() => Promise.resolve()),
    fijarPinGeocodificado: vi.fn<ClienteRepository['fijarPinGeocodificado']>(() => Promise.resolve(true)),
    coincidenciaDeDireccion: vi.fn<ClienteRepository['coincidenciaDeDireccion']>((): Promise<CoincidenciaLocal | undefined> => Promise.resolve(undefined)),
  } satisfies ClienteRepository;
  return repo;
};

export const localDe = (extra: Partial<LocalDetalle> = {}): LocalDetalle => ({
  id: 'l-1',
  clienteId: 'c-1',
  razonSocial: 'Rabelo Mágica SpA',
  direccion: 'Av. Providencia 1234',
  comuna: 'Providencia',
  pinEstado: 'pendiente',
  ...extra,
});

export const fakePines = () =>
  ({
    crearLote: vi.fn<PropuestaPinRepository['crearLote']>((_e, _p, propuestas) => Promise.resolve(propuestas.length)),
    listar: vi.fn<PropuestaPinRepository['listar']>(() => Promise.resolve([])),
    resolver: vi.fn<PropuestaPinRepository['resolver']>(() => Promise.resolve(ok(undefined))),
  }) satisfies PropuestaPinRepository;

export const fakeAlmacen = () => {
  const almacen = {
    crearUrlSubida: vi.fn<AlmacenArchivos['crearUrlSubida']>((path) => Promise.resolve(ok({ url: `https://alm.test/subir/${path}?token=t` }))),
    crearUrlLectura: vi.fn<AlmacenArchivos['crearUrlLectura']>((path) => Promise.resolve(ok({ url: `https://alm.test/leer/${path}?token=t` }))),
    eliminar: vi.fn<AlmacenArchivos['eliminar']>(() => Promise.resolve(ok(undefined))),
  } satisfies AlmacenArchivos;
  return almacen;
};

export const fallaAlmacen = (): AlmacenArchivos => ({
  crearUrlSubida: () => Promise.resolve(err({ detalle: 'caído' })),
  crearUrlLectura: () => Promise.resolve(err({ detalle: 'caído' })),
  eliminar: () => Promise.resolve(err({ detalle: 'caído' })),
});

export const idsFijos = (...valores: string[]): IdGenerator => {
  let i = 0;
  return { uuid: () => valores[i++] ?? '00000000-0000-0000-0000-000000000000' };
};

export const fakeReportesFoto = () =>
  ({
    crear: vi.fn<FotoReporteRepository['crear']>(() => Promise.resolve()),
    abiertos: vi.fn<FotoReporteRepository['abiertos']>(() => Promise.resolve([])),
    porVerificar: vi.fn<FotoReporteRepository['porVerificar']>(() => Promise.resolve([])),
    verificadas: vi.fn<FotoReporteRepository['verificadas']>(() => Promise.resolve([])),
    obtener: vi.fn<FotoReporteRepository['obtener']>(() => Promise.resolve({ id: 'r-1', localId: 'l-1', fotoPath: 'empresa-1/l-1/x.webp', abierto: true })),
    resolver: vi.fn<FotoReporteRepository['resolver']>(() => Promise.resolve()),
    resolverDeFoto: vi.fn<FotoReporteRepository['resolverDeFoto']>(() => Promise.resolve()),
  }) satisfies FotoReporteRepository;
