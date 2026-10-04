import { describe, expect, it } from 'vitest';
import { crearActualizarCamion, crearCrearCamion, crearListarCamiones } from './camiones.js';
import { crearActualizarFactura, crearListarFacturas, crearRegistrarFactura } from './facturas.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { err, fakeCamiones, fakeFacturas } from './fakes-facturas.test-util.js';

const despachador = usuarioDe({ id: 'u-d', rol: 'despachador' });
const admin = usuarioDe();
const LOCAL = '123e4567-e89b-42d3-a456-426614174000';

describe('camiones', () => {
  it('crea normalizando la patente y el alias', async () => {
    const camiones = fakeCamiones();
    const r = await crearCrearCamion({ camiones })(admin, { patente: 'ab-cd 12', alias: '  El   Rojo ' });
    expect(r.ok && r.value).toMatchObject({ patente: 'ABCD12', alias: 'El Rojo' });
    expect(camiones.crear).toHaveBeenCalledWith('empresa-1', { patente: 'ABCD12', alias: 'El Rojo' });
  });

  it('rechaza patente inválida o alias largo, y avisa si la patente ya existe', async () => {
    const camiones = fakeCamiones();
    const crear = crearCrearCamion({ camiones });
    const mala = await crear(admin, { patente: 'XYZ' });
    expect(!mala.ok && mala.error.codigo).toBe('VALIDACION');
    const larga = await crear(admin, { patente: 'ABCD12', alias: 'x'.repeat(41) });
    expect(!larga.ok && larga.error.codigo).toBe('VALIDACION');
    camiones.crear.mockResolvedValueOnce(err('PATENTE_DUPLICADA'));
    const dup = await crear(admin, { patente: 'ABCD12' });
    expect(!dup.ok && dup.error).toMatchObject({ codigo: 'CONFLICTO', mensaje: 'Ya existe un camión con la patente ABCD12.' });
  });

  it('lista por empresa y actualiza alias y estado (null borra el alias)', async () => {
    const camiones = fakeCamiones();
    await crearListarCamiones({ camiones })(despachador, { soloActivos: true });
    expect(camiones.listar).toHaveBeenCalledWith('empresa-1', { soloActivos: true });
    const actualizar = crearActualizarCamion({ camiones });
    expect((await actualizar(admin, 'cam-1', { alias: null, activo: false })).ok).toBe(true);
    expect(camiones.actualizar).toHaveBeenCalledWith('empresa-1', 'cam-1', { alias: null, activo: false });
    await actualizar(admin, 'cam-1', { alias: '   ' });
    expect(camiones.actualizar).toHaveBeenLastCalledWith('empresa-1', 'cam-1', { alias: null });
    expect((await actualizar(admin, 'cam-1', {})).ok).toBe(false);
  });

  it('actualizar un camión que no existe es NO_ENCONTRADO', async () => {
    const camiones = fakeCamiones();
    camiones.actualizar.mockResolvedValueOnce(undefined);
    const r = await crearActualizarCamion({ camiones })(admin, 'zzz', { activo: true });
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });
});

describe('registrarFactura', () => {
  const { clock } = crearReloj('2026-10-06T01:30:00Z'); // en Chile todavía es 5 de octubre

  it('usa la fecha de hoy en Chile, normaliza y guarda quién la ingresó', async () => {
    const facturas = fakeFacturas();
    const r = await crearRegistrarFactura({ facturas, clock })(despachador, { folio: ' 12 34 ', localId: LOCAL, camionId: 'cam-1', antesDeMin: 720, urgente: true, nota: 'portón verde' });
    expect(r.ok).toBe(true);
    expect(facturas.crear).toHaveBeenCalledWith('empresa-1', { folio: '1234', localId: LOCAL, fecha: '2026-10-05', camionId: 'cam-1', antesDeMin: 720, urgente: true, nota: 'portón verde', creadoPor: 'u-d' });
  });

  it('una fecha explícita manda sobre la de hoy', async () => {
    const facturas = fakeFacturas();
    await crearRegistrarFactura({ facturas, clock })(despachador, { folio: '1', localId: LOCAL, fecha: '2026-10-07' });
    expect(facturas.crear.mock.calls[0]?.[1].fecha).toBe('2026-10-07');
  });

  it('datos inválidos: VALIDACION con todos los mensajes y sin tocar la base', async () => {
    const facturas = fakeFacturas();
    const r = await crearRegistrarFactura({ facturas, clock })(despachador, { folio: '', localId: LOCAL, antesDeMin: 9999 });
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(!r.ok && r.error.mensaje).toContain('Falta el folio.');
    expect(facturas.crear).not.toHaveBeenCalled();
  });

  it.each([
    ['FOLIO_DUPLICADO', 'CONFLICTO', 'Ya existe una factura con el folio 1234.'],
    ['LOCAL_NO_EXISTE', 'NO_ENCONTRADO', 'El cliente no existe.'],
    ['CAMION_NO_DISPONIBLE', 'NO_ENCONTRADO', 'El camión no existe o está desactivado.'],
  ] as const)('traduce %s', async (falla, codigo, mensaje) => {
    const facturas = fakeFacturas();
    facturas.crear.mockResolvedValueOnce(err(falla));
    const r = await crearRegistrarFactura({ facturas, clock })(despachador, { folio: '1234', localId: LOCAL });
    expect(!r.ok && r.error).toMatchObject({ codigo, mensaje });
  });
});

describe('listarFacturas', () => {
  const { clock } = crearReloj('2026-10-06T01:30:00Z');

  it('por defecto lista el día de hoy en Chile; pasa los filtros', async () => {
    const facturas = fakeFacturas();
    const listar = crearListarFacturas({ facturas, clock });
    await listar(despachador);
    expect(facturas.listar).toHaveBeenLastCalledWith('empresa-1', { fecha: '2026-10-05' });
    await listar(despachador, { fecha: '2026-10-07', camionId: 'cam-1', incluirAnuladas: true });
    expect(facturas.listar).toHaveBeenLastCalledWith('empresa-1', { fecha: '2026-10-07', camionId: 'cam-1', incluirAnuladas: true });
    await listar(despachador, { sinCamion: true });
    expect(facturas.listar).toHaveBeenLastCalledWith('empresa-1', { fecha: '2026-10-05', sinCamion: true });
  });

  it('una fecha inválida es VALIDACION', async () => {
    const r = await crearListarFacturas({ facturas: fakeFacturas(), clock })(despachador, { fecha: '2026-02-31' });
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
  });
});

describe('actualizarFactura', () => {
  it('cambia de camión, quita la hora límite (null) y anula', async () => {
    const facturas = fakeFacturas();
    const actualizar = crearActualizarFactura({ facturas });
    await actualizar(despachador, 'f-1', { camionId: 'cam-2', antesDeMin: null, estado: 'anulada', nota: '   ' });
    expect(facturas.actualizar).toHaveBeenCalledWith('empresa-1', 'f-1', { camionId: 'cam-2', antesDeMin: null, nota: null, estado: 'anulada' });
    await actualizar(despachador, 'f-1', { camionId: null });
    expect(facturas.actualizar).toHaveBeenLastCalledWith('empresa-1', 'f-1', { camionId: null });
  });

  it.each([
    [{}, 'nada que actualizar'],
    [{ fecha: '2026-13-01' }, 'fecha'],
    [{ total: 1.5 }, 'total'],
    [{ antesDeMin: 1500 }, 'hora límite'],
    [{ nota: 'x'.repeat(301) }, 'nota'],
  ])('rechaza %j', async (entrada, texto) => {
    const facturas = fakeFacturas();
    const r = await crearActualizarFactura({ facturas })(despachador, 'f-1', entrada);
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(!r.ok && r.error.mensaje.toLowerCase()).toContain(texto);
    expect(facturas.actualizar).not.toHaveBeenCalled();
  });

  it('traduce factura inexistente y camión no disponible', async () => {
    const facturas = fakeFacturas();
    facturas.actualizar.mockResolvedValueOnce(err('NO_ENCONTRADA')).mockResolvedValueOnce(err('CAMION_NO_DISPONIBLE'));
    const actualizar = crearActualizarFactura({ facturas });
    expect((await actualizar(despachador, 'f', { urgente: true }))).toMatchObject({ ok: false, error: { codigo: 'NO_ENCONTRADO', mensaje: 'La factura no existe.' } });
    expect((await actualizar(despachador, 'f', { camionId: 'x' }))).toMatchObject({ ok: false, error: { mensaje: 'El camión no existe o está desactivado.' } });
  });
});
