import { describe, expect, it } from 'vitest';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeAlmacen, fakeClientes, fakeReportesFoto, localDe } from './fakes-clientes.test-util.js';
import { crearFotosParaRevision, crearReportarFoto, crearResolverReporteFoto } from './fotos-revision.js';

const chofer = usuarioDe({ id: 'u-ch', rol: 'chofer' });
const admin = usuarioDe({ id: 'u-admin' });
const { clock } = crearReloj();
const FOTO = 'empresa-1/l-1/x.webp';

describe('reportar una foto', () => {
  it('queda un reporte de la foto que el local tiene ahora, con el motivo, la explicación y quién la reporta', async () => {
    const clientes = fakeClientes([localDe({ fotoPath: FOTO })]);
    const reportes = fakeReportesFoto();
    const r = await crearReportarFoto({ clientes, reportes })(chofer, 'l-1', { motivo: 'se_ven_personas', detalle: '  sale   el dueño ' });
    expect(r.ok).toBe(true);
    expect(reportes.crear).toHaveBeenCalledWith('empresa-1', { localId: 'l-1', fotoPath: FOTO, motivo: 'se_ven_personas', detalle: 'sale el dueño', reportadoPor: 'u-ch' });
  });

  it('exige un motivo de la lista; una explicación vacía no se guarda', async () => {
    const clientes = fakeClientes([localDe({ fotoPath: FOTO })]);
    const reportes = fakeReportesFoto();
    const malo = await crearReportarFoto({ clientes, reportes })(chofer, 'l-1', { motivo: 'porque sí' });
    expect(!malo.ok && malo.error.codigo).toBe('VALIDACION');
    const largo = await crearReportarFoto({ clientes, reportes })(chofer, 'l-1', { motivo: 'borrosa', detalle: 'x'.repeat(201) });
    expect(!largo.ok && largo.error.codigo).toBe('VALIDACION');
    await crearReportarFoto({ clientes, reportes })(chofer, 'l-1', { motivo: 'borrosa', detalle: '   ' });
    expect(reportes.crear).toHaveBeenLastCalledWith('empresa-1', { localId: 'l-1', fotoPath: FOTO, motivo: 'borrosa', reportadoPor: 'u-ch' });
  });

  it('un local sin foto, o que no existe, es NO_ENCONTRADO', async () => {
    const reportes = fakeReportesFoto();
    const sinFoto = await crearReportarFoto({ clientes: fakeClientes([localDe()]), reportes })(chofer, 'l-1', { motivo: 'borrosa' });
    expect(!sinFoto.ok && sinFoto.error.codigo).toBe('NO_ENCONTRADO');
    const noExiste = await crearReportarFoto({ clientes: fakeClientes([]), reportes })(chofer, 'l-9', { motivo: 'borrosa' });
    expect(!noExiste.ok && noExiste.error.codigo).toBe('NO_ENCONTRADO');
    expect(reportes.crear).not.toHaveBeenCalled();
  });
});

describe('fotos para revisar', () => {
  it('trae lo reportado y lo subido hace poco', async () => {
    const reportes = fakeReportesFoto();
    reportes.abiertos.mockResolvedValueOnce([{ id: 'r-1', localId: 'l-1', razonSocial: 'Rabelo', direccion: 'Calle 1', comuna: 'Maipú', motivo: 'borrosa', reportadoEn: new Date('2026-10-05T12:00:00Z') }]);
    reportes.recientes.mockResolvedValueOnce([{ localId: 'l-2', razonSocial: 'Kiosko', direccion: 'Calle 2', comuna: 'Paine', subidaPor: 'Juan Pérez', subidaEn: new Date('2026-10-05T11:00:00Z') }]);
    const r = await crearFotosParaRevision({ reportes })(admin);
    expect(r.reportadas.map((x) => x.id)).toEqual(['r-1']);
    expect(r.recientes.map((x) => x.subidaPor)).toEqual(['Juan Pérez']);
    expect(reportes.abiertos).toHaveBeenCalledWith('empresa-1', 100);
    expect(reportes.recientes).toHaveBeenCalledWith('empresa-1', 30);
  });
});

describe('decidir sobre un reporte', () => {
  it('eliminar: la foto sale del local y del almacenamiento y se cierran todos los reportes de esa foto', async () => {
    const clientes = fakeClientes([localDe({ fotoPath: FOTO })]);
    const reportes = fakeReportesFoto();
    const almacen = fakeAlmacen();
    const r = await crearResolverReporteFoto({ clientes, reportes, almacen, clock })(admin, 'r-1', 'eliminar');
    expect(r.ok).toBe(true);
    expect(clientes.quitarFoto).toHaveBeenCalledWith('empresa-1', 'l-1');
    expect(almacen.eliminar).toHaveBeenCalledWith(FOTO);
    expect(reportes.resolverDeFoto).toHaveBeenCalledWith('empresa-1', 'l-1', FOTO, 'u-admin', new Date('2026-10-05T12:00:00.000Z'));
  });

  it('si el local ya tiene otra foto, eliminar solo cierra el reporte y no toca la nueva', async () => {
    const clientes = fakeClientes([localDe({ fotoPath: 'empresa-1/l-1/nueva.webp' })]);
    const reportes = fakeReportesFoto();
    const almacen = fakeAlmacen();
    await crearResolverReporteFoto({ clientes, reportes, almacen, clock })(admin, 'r-1', 'eliminar');
    expect(clientes.quitarFoto).not.toHaveBeenCalled();
    expect(almacen.eliminar).not.toHaveBeenCalled();
    expect(reportes.resolverDeFoto).toHaveBeenCalledTimes(1);
  });

  it('dejarla descarta el reporte y la foto queda', async () => {
    const clientes = fakeClientes([localDe({ fotoPath: FOTO })]);
    const reportes = fakeReportesFoto();
    const almacen = fakeAlmacen();
    await crearResolverReporteFoto({ clientes, reportes, almacen, clock })(admin, 'r-1', 'descartar');
    expect(reportes.resolver).toHaveBeenCalledWith('empresa-1', 'r-1', 'u-admin', 'descartada', new Date('2026-10-05T12:00:00.000Z'));
    expect(clientes.quitarFoto).not.toHaveBeenCalled();
    expect(almacen.eliminar).not.toHaveBeenCalled();
  });

  it('un reporte ya resuelto no hace nada; uno que no existe es NO_ENCONTRADO', async () => {
    const reportes = fakeReportesFoto();
    reportes.obtener.mockResolvedValueOnce({ id: 'r-1', localId: 'l-1', fotoPath: FOTO, abierto: false });
    const clientes = fakeClientes([localDe({ fotoPath: FOTO })]);
    const ya = await crearResolverReporteFoto({ clientes, reportes, almacen: fakeAlmacen(), clock })(admin, 'r-1', 'eliminar');
    expect(ya.ok).toBe(true);
    expect(clientes.quitarFoto).not.toHaveBeenCalled();
    reportes.obtener.mockResolvedValueOnce(undefined);
    const no = await crearResolverReporteFoto({ clientes, reportes, almacen: fakeAlmacen(), clock })(admin, 'x', 'eliminar');
    expect(!no.ok && no.error.codigo).toBe('NO_ENCONTRADO');
  });
});
