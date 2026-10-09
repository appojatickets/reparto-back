import { describe, expect, it, vi } from 'vitest';
import type { FotoReporteRepository, ReporteFoto } from '../ports/out/fotos.js';
import type { LocalDetalle } from '../ports/out/clientes.js';
import type { ReporteLocal, ReporteLocalRepository } from '../ports/out/reportes-local.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeClientes } from './fakes-clientes.test-util.js';
import { crearReportarLocal, crearResolverReporteLocal, crearVerReportes } from './reportes-local.js';

const chofer = usuarioDe({ id: 'u-c', rol: 'chofer' });
const admin = usuarioDe({ id: 'u-a', rol: 'admin' });
const local = (extra: Partial<LocalDetalle> = {}): LocalDetalle => ({ id: 'l-1', clienteId: 'c-1', razonSocial: 'Kiosko', direccion: 'Calle 1', comuna: 'Maipú', lat: -33.5, lng: -70.7, pinEstado: 'validado', pinVerificado: true, pinVerificacion: 'persona', ...extra });
const sinPinLocal = (): LocalDetalle => ({ id: 'l-2', clienteId: 'c-1', razonSocial: 'Kiosko', direccion: 'Calle 1', comuna: 'Maipú', pinEstado: 'pendiente', pinVerificado: false });
const sinVerificar = (): LocalDetalle => ({ id: 'l-1', clienteId: 'c-1', razonSocial: 'Kiosko', direccion: 'Calle 1', comuna: 'Maipú', lat: -33.5, lng: -70.7, pinEstado: 'sugerido', pinVerificado: false });

const repoLocal = (abiertos: ReporteLocal[] = []) => ({
  crear: vi.fn<ReporteLocalRepository['crear']>(() => Promise.resolve()),
  abiertos: vi.fn<ReporteLocalRepository['abiertos']>(() => Promise.resolve(abiertos)),
  obtener: vi.fn<ReporteLocalRepository['obtener']>((_e, id) => Promise.resolve(id === 'r-1' ? { id, localId: 'l-1', tipo: 'ubicacion' as const, abierto: true } : id === 'r-n' ? { id, localId: 'l-1', tipo: 'nombre' as const, abierto: true } : id === 'r-cerrado' ? { id, localId: 'l-1', tipo: 'nombre' as const, abierto: false } : undefined)),
  resolver: vi.fn<ReporteLocalRepository['resolver']>(() => Promise.resolve()),
});

describe('reportar el nombre o la ubicación de un local', () => {
  it('guarda el reporte; si la ubicación estaba verificada, el pin vuelve a «por verificar»', async () => {
    const clientes = fakeClientes([local()]);
    const reportes = repoLocal();
    const r = await crearReportarLocal({ clientes, reportes })(chofer, 'l-1', { tipo: 'ubicacion', detalle: '  queda en la otra cuadra ' });
    expect(r.ok).toBe(true);
    expect(reportes.crear).toHaveBeenCalledWith('empresa-1', { localId: 'l-1', tipo: 'ubicacion', detalle: 'queda en la otra cuadra', reportadoPor: 'u-c' });
    expect(clientes.verificarPin).toHaveBeenCalledWith('empresa-1', 'l-1', undefined);
  });

  it('reportar el nombre no toca el pin y guarda cómo debería llamarse', async () => {
    const clientes = fakeClientes([local()]);
    const reportes = repoLocal();
    await crearReportarLocal({ clientes, reportes })(chofer, 'l-1', { tipo: 'nombre', sugerido: 'Bazar Sol' });
    expect(reportes.crear).toHaveBeenCalledWith('empresa-1', { localId: 'l-1', tipo: 'nombre', sugerido: 'Bazar Sol', reportadoPor: 'u-c' });
    expect(clientes.verificarPin).not.toHaveBeenCalled();
  });

  it('un tipo inválido es VALIDACION, un local inexistente NO_ENCONTRADO y un local sin pin no tiene ubicación que reportar', async () => {
    const reportar = crearReportarLocal({ clientes: fakeClientes([sinPinLocal()]), reportes: repoLocal() });
    expect((await reportar(chofer, 'l-2', { tipo: 'otro' })).ok).toBe(false);
    const noExiste = await reportar(chofer, 'l-x', { tipo: 'nombre' });
    expect(!noExiste.ok && noExiste.error.codigo).toBe('NO_ENCONTRADO');
    const sinPin = await reportar(chofer, 'l-2', { tipo: 'ubicacion' });
    expect(!sinPin.ok && sinPin.error.codigo).toBe('CONFLICTO');
  });
});

describe('ver todo lo reportado', () => {
  it('junta fotos, nombres y ubicaciones, del más nuevo al más antiguo', async () => {
    const foto: ReporteFoto = { id: 'f1', localId: 'l-1', razonSocial: 'Kiosko', direccion: 'Calle 1', comuna: 'Maipú', motivo: 'borrosa', reportadoEn: new Date('2026-10-08T12:00:00Z'), fotoReemplazada: true };
    const nombre: ReporteLocal = { id: 'n1', tipo: 'nombre', localId: 'l-1', razonSocial: 'Kiosko', direccion: 'Calle 1', comuna: 'Maipú', sugerido: 'Bazar', reportadoEn: new Date('2026-10-08T13:00:00Z'), cambioDesdeElReporte: false };
    const ubic: ReporteLocal = { id: 'u1', tipo: 'ubicacion', localId: 'l-1', razonSocial: 'Kiosko', direccion: 'Calle 1', comuna: 'Maipú', lat: -33.5, lng: -70.7, reportadoEn: new Date('2026-10-08T11:00:00Z'), cambioDesdeElReporte: true };
    const fotos = { abiertos: vi.fn(() => Promise.resolve([foto])) } as unknown as FotoReporteRepository;
    const r = await crearVerReportes({ fotos, locales: repoLocal([nombre, ubic]) })(admin);
    expect(r.total).toBe(3);
    expect(r.reportes.map((x) => `${x.tipo}:${x.id}:${String(x.yaCambio)}`)).toEqual(['nombre:n1:false', 'foto:f1:true', 'ubicacion:u1:true']);
    expect(r.reportes[1]).toMatchObject({ motivo: 'borrosa' });
    expect(r.reportes[2]).toMatchObject({ lat: -33.5, lng: -70.7 });
  });
});

describe('cerrar un reporte de nombre o ubicación', () => {
  const montar = () => {
    const clientes = fakeClientes([sinVerificar()]);
    const reportes = repoLocal();
    return { clientes, reportes, resolver: crearResolverReporteLocal({ clientes, reportes, clock: crearReloj('2026-10-08T15:00:00Z').clock }) };
  };

  it('verificar_pin deja el pin verificado por quien lo vio y cierra el reporte como corregido', async () => {
    const t = montar();
    expect((await t.resolver(admin, 'r-1', 'verificar_pin')).ok).toBe(true);
    expect(t.clientes.verificarPin).toHaveBeenCalledWith('empresa-1', 'l-1', { por: 'u-a', en: new Date('2026-10-08T15:00:00Z') });
    expect(t.reportes.resolver).toHaveBeenCalledWith('empresa-1', 'r-1', 'u-a', 'corregido', new Date('2026-10-08T15:00:00Z'));
  });

  it('descartar cierra sin tocar el pin; verificar el pin de un reporte de nombre es VALIDACION; uno ya cerrado no falla; uno inexistente es NO_ENCONTRADO', async () => {
    const t = montar();
    await t.resolver(admin, 'r-1', 'descartar');
    expect(t.clientes.verificarPin).not.toHaveBeenCalled();
    expect(t.reportes.resolver).toHaveBeenCalledWith('empresa-1', 'r-1', 'u-a', 'descartado', expect.any(Date));
    const mal = await t.resolver(admin, 'r-n', 'verificar_pin');
    expect(!mal.ok && mal.error.codigo).toBe('VALIDACION');
    t.reportes.resolver.mockClear();
    expect((await t.resolver(admin, 'r-cerrado', 'descartar')).ok).toBe(true);
    expect(t.reportes.resolver).not.toHaveBeenCalled();
    const no = await t.resolver(admin, 'r-x', 'descartar');
    expect(!no.ok && no.error.codigo).toBe('NO_ENCONTRADO');
  });
});
