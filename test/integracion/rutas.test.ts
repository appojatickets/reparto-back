import { afterAll, describe, expect, it } from 'vitest';
import { PostgresCamionRepository } from '../../src/adapters/out/postgres/repositorio-camiones.js';
import { PostgresClienteRepository } from '../../src/adapters/out/postgres/repositorio-clientes.js';
import { PostgresEmpresaRepository } from '../../src/adapters/out/postgres/repositorio-empresa.js';
import { PostgresEntregaRepository } from '../../src/adapters/out/postgres/repositorio-entregas.js';
import { PostgresFacturaRepository } from '../../src/adapters/out/postgres/repositorio-facturas.js';
import { PostgresJornadaRepository } from '../../src/adapters/out/postgres/repositorio-jornadas.js';
import { PostgresHorarioRepository } from '../../src/adapters/out/postgres/repositorio-horarios.js';
import { PostgresRegistroAprendizajeRepository } from '../../src/adapters/out/postgres/repositorio-registro-aprendizaje.js';
import { PostgresRutaRepository } from '../../src/adapters/out/postgres/repositorio-rutas.js';
import { crearRegistrarFactura, crearListarFacturas } from '../../src/application/use-cases/facturas.js';
import { crearResolverCamion } from '../../src/application/use-cases/jornada.js';
import { crearServiciosDeRuta } from '../../src/application/use-cases/rutas.js';
import { abrirDb, crearEmpresa, crearUsuario } from './utils.js';

const db = abrirDb();
const rutas = new PostgresRutaRepository(db);
const camiones = new PostgresCamionRepository(db);
const facturas = new PostgresFacturaRepository(db);
const clientes = new PostgresClienteRepository(db);
const empresas = new PostgresEmpresaRepository(db);
afterAll(() => db.destroy());

const FECHA = '2026-10-05'; // lunes
const pasarCamion = (_a: unknown, c: string | undefined) => Promise.resolve({ ok: true as const, value: c });

const sembrar = async () => {
  const empresa = await crearEmpresa(db);
  const usuario = await crearUsuario(db, empresa, 'despachador', `d${Math.random().toString(36).slice(2, 8)}`);
  await clientes.importar(empresa, [
    { claveCliente: 'a', razonSocial: 'Almacén A', locales: [{ claveLocal: 'a|1', direccion: 'Av. Providencia 2500', comuna: 'Providencia', lat: -33.43, lng: -70.61, indices: [0] }] },
    { claveCliente: 'b', razonSocial: 'Bazar B', locales: [{ claveLocal: 'b|1', direccion: 'Calle 1 10', comuna: 'Maipú', lat: -33.51, lng: -70.76, indices: [1] }] },
    { claveCliente: 'c', razonSocial: 'Kiosko C', locales: [{ claveLocal: 'c|1', direccion: 'Calle 2 20', comuna: 'Ñuñoa', lat: -33.46, lng: -70.6, indices: [2] }] },
    { claveCliente: 'd', razonSocial: 'Sin Pin D', locales: [{ claveLocal: 'd|1', direccion: 'Calle 3 30', comuna: 'Pudahuel', indices: [3] }] },
  ]);
  const locales = await db.selectFrom('local as l').innerJoin('cliente as c', 'c.id', 'l.cliente_id').select(['l.id', 'c.razon_social']).where('l.empresa_id', '=', empresa).execute();
  const local = (n: string) => locales.find((l) => l.razon_social === n)?.id ?? '';
  const camion = await camiones.crear(empresa, { patente: 'ABCD12' });
  if (!camion.ok) throw new Error('camión');
  return { empresa, usuario, camion: camion.value.id, local };
};

const factura = async (s: Awaited<ReturnType<typeof sembrar>>, folio: string, nombre: string, extra: object = {}) => {
  const r = await facturas.crear(s.empresa, { folio, localId: s.local(nombre), fecha: FECHA, camionId: s.camion, urgente: false, creadoPor: s.usuario, ...extra });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

describe('rutas en Postgres', () => {
  it('lista las pendientes del camión y día con pin, condiciones y el horario del local', async () => {
    const s = await sembrar();
    const a = await factura(s, '1', 'Almacén A', { antesDeMin: 720, nota: 'portón' });
    await factura(s, '2', 'Sin Pin D');
    await db.insertInto('horario_local').values({ empresa_id: s.empresa, local_id: s.local('Almacén A'), dias: [1, 2], desde: '09:30', hasta: '18:00', fuente: 'confirmado' }).execute();
    const r = await rutas.facturasPendientes(s.empresa, s.camion, FECHA);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ facturaId: a, folio: '1', razonSocial: 'Almacén A', lat: -33.43, antesDeMin: 720, nota: 'portón', urgente: false });
    expect(r[0]?.horarios).toEqual([{ dias: [1, 2], tramos: [{ apertura: 570, cierre: 1080 }], fuente: 'confirmado', confianza: 0.5 }]);
    expect(r[1]).not.toHaveProperty('lat');
    expect(await rutas.facturasPendientes(s.empresa, s.camion, '2026-10-06')).toEqual([]);
  });

  it('no incluye anuladas ni facturas de otra empresa', async () => {
    const s = await sembrar();
    const otra = await sembrar();
    const f = await factura(s, '1', 'Almacén A');
    await factura(s, '2', 'Bazar B');
    await facturas.actualizar(s.empresa, f, { estado: 'anulada' });
    expect((await rutas.facturasPendientes(s.empresa, s.camion, FECHA)).map((x) => x.folio)).toEqual(['2']);
    expect(await rutas.facturasPendientes(otra.empresa, s.camion, FECHA)).toEqual([]);
  });

  it('guarda, vuelve a leer en el mismo orden con las fijadas, y controla la versión', async () => {
    const s = await sembrar();
    const [a, b, c] = [await factura(s, '1', 'Almacén A'), await factura(s, '2', 'Bazar B'), await factura(s, '3', 'Kiosko C')];
    expect(await rutas.obtener(s.empresa, s.camion, FECHA)).toBeUndefined();
    const base = { camionId: s.camion, fecha: FECHA, salidaMin: 480, modo: 'sugerida' as const, usuarioId: s.usuario };
    const g1 = await rutas.guardar(s.empresa, { ...base, orden: [b, a, c], fijas: [b] });
    expect(g1.ok && g1.value).toMatchObject({ version: 1, orden: [b, a, c], fijas: [b] });
    expect(await rutas.obtener(s.empresa, s.camion, FECHA)).toMatchObject({ version: 1, salidaMin: 480, modo: 'sugerida', orden: [b, a, c], fijas: [b] });

    const g2 = await rutas.guardar(s.empresa, { ...base, modo: 'manual', salidaMin: 450, orden: [c, b, a], fijas: [], versionEsperada: 1 });
    expect(g2.ok && g2.value.version).toBe(2);
    expect(await rutas.obtener(s.empresa, s.camion, FECHA)).toMatchObject({ version: 2, salidaMin: 450, modo: 'manual', orden: [c, b, a], fijas: [] });
    // una segunda persona que partió de la versión 1 ya no puede pisar
    expect(await rutas.guardar(s.empresa, { ...base, orden: [a], fijas: [], versionEsperada: 1 })).toEqual({ ok: false, error: 'VERSION_DESACTUALIZADA' });
    // esperar versión sobre una ruta inexistente también falla
    expect(await rutas.guardar(s.empresa, { ...base, fecha: '2026-10-07', orden: [], fijas: [], versionEsperada: 1 })).toEqual({ ok: false, error: 'VERSION_DESACTUALIZADA' });
    // replanificar sin versión esperada reemplaza
    const g3 = await rutas.guardar(s.empresa, { ...base, orden: [a, b, c], fijas: [] });
    expect(g3.ok && g3.value.version).toBe(3);
  });

  it('de punta a punta: planificar, acomodar y volver a ver con servicios reales', async () => {
    const s = await sembrar();
    await empresas.guardarConfig(s.empresa, { deposito: { lat: -33.5, lng: -70.7 }, salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 });
    await factura(s, '1', 'Almacén A');
    await factura(s, '2', 'Bazar B');
    await factura(s, '3', 'Kiosko C');
    await factura(s, '4', 'Sin Pin D');
    const reloj = { now: () => new Date('2026-10-05T12:00:00Z') };
    const servicios = crearServiciosDeRuta({ rutas, empresas, camiones, facturas, entregas: new PostgresEntregaRepository(db), jornadas: new PostgresJornadaRepository(db), registro: new PostgresRegistroAprendizajeRepository(db), clock: reloj, resolverCamion: pasarCamion });
    const usuario = { id: s.usuario, empresaId: s.empresa, rol: 'despachador' as const, username: 'd', nombre: 'D', activo: true };

    const p = await servicios.planificar(usuario, { camionId: s.camion, fecha: FECHA });
    // Sin pin la ruta igual se calcula: «Sin Pin D» entra con la comuna como ubicación aproximada (ADR 0019).
    expect(p.ok && p.value.paradas).toHaveLength(4);
    expect(p.ok && p.value.sinPin).toEqual([]);
    expect(p.ok && p.value.paradas.filter((x) => x.ubicacionAproximada).map((x) => x.folio)).toEqual(['4']);
    const orden = p.ok ? p.value.paradas.map((x) => x.facturaId) : [];

    const m = await servicios.operar(usuario, { camionId: s.camion, fecha: FECHA, version: 1, operacion: { tipo: 'subir', facturaId: orden[2] ?? '' } });
    expect(m.ok && m.value).toMatchObject({ modo: 'manual', version: 2 });

    const v = await servicios.ver(usuario, { camionId: s.camion, fecha: FECHA });
    expect(v.ok && v.value.paradas.map((x) => x.facturaId)).toEqual([orden[0], orden[2], orden[1], orden[3]]);

    const q = await servicios.operar(usuario, { camionId: s.camion, fecha: FECHA, version: 2, operacion: { tipo: 'quitar', facturaId: orden[0] ?? '' } });
    expect(q.ok && q.value.paradas).toHaveLength(3);
    expect((await facturas.listar(s.empresa, { fecha: FECHA, sinCamion: true })).map((f) => f.id)).toEqual([orden[0]]);
  });
});

describe('horario manual en Postgres', () => {
  const horarios = new PostgresHorarioRepository(db);
  const dias = [
    { dia: 1 as const, cerrado: false, tramos: [{ desde: 600, hasta: 1080 }] },
    { dia: 2 as const, cerrado: false, tramos: [{ desde: 600, hasta: 1080 }] },
    { dia: 3 as const, cerrado: false, tramos: [{ desde: 600, hasta: 780 }, { desde: 840, hasta: 1080 }] },
    { dia: 0 as const, cerrado: true, tramos: [] },
  ];

  it('guarda con colación y cerrado, lee igual, reemplaza y aísla por empresa', async () => {
    const s = await sembrar();
    const local = s.local('Almacén A');
    expect(await horarios.obtenerManual(s.empresa, local)).toEqual([]);
    expect(await horarios.reemplazarManual(s.empresa, local, dias)).toBe(true);
    expect((await horarios.obtenerManual(s.empresa, local))?.map((d) => d.dia)).toEqual([0, 1, 2, 3]);
    expect((await horarios.obtenerManual(s.empresa, local))?.find((d) => d.dia === 3)?.tramos).toEqual([{ desde: 600, hasta: 780 }, { desde: 840, hasta: 1080 }]);
    expect((await horarios.obtenerManual(s.empresa, local))?.find((d) => d.dia === 0)).toMatchObject({ cerrado: true, tramos: [] });

    await horarios.reemplazarManual(s.empresa, local, [{ dia: 5, cerrado: true, tramos: [] }]);
    expect(await horarios.obtenerManual(s.empresa, local)).toEqual([{ dia: 5, cerrado: true, tramos: [] }]);

    const otra = await sembrar();
    expect(await horarios.obtenerManual(otra.empresa, local)).toBeUndefined();
    expect(await horarios.reemplazarManual(otra.empresa, local, dias)).toBe(false);
    expect(await horarios.obtenerManual(s.empresa, '00000000-0000-4000-8000-000000000000')).toBeUndefined();
  });

  it('no toca los horarios aprendidos y el cerrado manual saca la parada de la ruta', async () => {
    const s = await sembrar();
    await db.insertInto('horario_local').values({ empresa_id: s.empresa, local_id: s.local('Almacén A'), dias: [1], desde: '09:00', hasta: '20:00', fuente: 'aprendido' }).execute();
    await horarios.reemplazarManual(s.empresa, s.local('Almacén A'), [{ dia: 1, cerrado: true, tramos: [] }]);
    expect(await db.selectFrom('horario_local').select('fuente').where('local_id', '=', s.local('Almacén A')).orderBy('fuente').execute()).toEqual([{ fuente: 'aprendido' }, { fuente: 'confirmado' }]);

    await empresas.guardarConfig(s.empresa, { deposito: { lat: -33.5, lng: -70.7 }, salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 });
    await factura(s, '1', 'Almacén A');
    await factura(s, '2', 'Bazar B');
    const servicios = crearServiciosDeRuta({ rutas, empresas, camiones, facturas, entregas: new PostgresEntregaRepository(db), jornadas: new PostgresJornadaRepository(db), registro: new PostgresRegistroAprendizajeRepository(db), clock: { now: () => new Date('2026-10-05T12:00:00Z') }, resolverCamion: pasarCamion });
    const usuario = { id: s.usuario, empresaId: s.empresa, rol: 'despachador' as const, username: 'd', nombre: 'D', activo: true };
    const p = await servicios.planificar(usuario, { camionId: s.camion, fecha: FECHA }); // 2026-10-05 es lunes: Almacén A está cerrado
    expect(p.ok && p.value.paradas.map((x) => x.cliente)).toEqual(['Bazar B']);
    expect(p.ok && p.value.noAtendidas.map((x) => x.cliente)).toEqual(['Almacén A']);
  });
});

describe('jornada en Postgres', () => {
  const jornadas = new PostgresJornadaRepository(db);
  const ahora = new Date('2026-10-05T12:00:00Z');

  it('una sola jornada abierta por usuario: al cambiar de camión se cierra la anterior', async () => {
    const s = await sembrar();
    const otro = await camiones.crear(s.empresa, { patente: 'WXYZ99', alias: 'El Blanco' });
    if (!otro.ok) throw new Error('camión');
    expect(await jornadas.activa(s.empresa, s.usuario, FECHA)).toBeUndefined();
    const a = await jornadas.iniciar(s.empresa, s.usuario, s.camion, FECHA, ahora);
    expect(a.ok && a.value.camion.patente).toBe('ABCD12');
    expect((await jornadas.activa(s.empresa, s.usuario, FECHA))?.camion.id).toBe(s.camion);
    const b = await jornadas.iniciar(s.empresa, s.usuario, otro.value.id, FECHA, new Date('2026-10-05T16:00:00Z'));
    expect(b.ok && b.value.camion).toEqual({ id: otro.value.id, patente: 'WXYZ99', alias: 'El Blanco' });
    expect((await jornadas.activa(s.empresa, s.usuario, FECHA))?.camion.id).toBe(otro.value.id);
    const filas = await db.selectFrom('jornada').select(['camion_id', 'hasta']).where('usuario_id', '=', s.usuario).orderBy('desde').execute();
    expect(filas.map((f) => f.hasta !== null)).toEqual([true, false]);
  });

  it('terminar cierra la jornada; una abierta de otro día no cuenta', async () => {
    const s = await sembrar();
    await jornadas.iniciar(s.empresa, s.usuario, s.camion, FECHA, ahora);
    expect(await jornadas.activa(s.empresa, s.usuario, '2026-10-06')).toBeUndefined();
    expect(await jornadas.terminar(s.empresa, s.usuario, ahora)).toBe(true);
    expect(await jornadas.activa(s.empresa, s.usuario, FECHA)).toBeUndefined();
    expect(await jornadas.terminar(s.empresa, s.usuario, ahora)).toBe(false);
  });

  it('rechaza camiones inactivos o de otra empresa', async () => {
    const s = await sembrar();
    const ajena = await sembrar();
    expect(await jornadas.iniciar(s.empresa, s.usuario, ajena.camion, FECHA, ahora)).toEqual({ ok: false, error: 'CAMION_NO_DISPONIBLE' });
    await camiones.actualizar(s.empresa, s.camion, { activo: false });
    expect(await jornadas.iniciar(s.empresa, s.usuario, s.camion, FECHA, ahora)).toEqual({ ok: false, error: 'CAMION_NO_DISPONIBLE' });
  });

  it('de punta a punta: el chofer carga una factura y ve su ruta solo en el camión de su jornada', async () => {
    const s = await sembrar();
    const chofer = { id: s.usuario, empresaId: s.empresa, rol: 'chofer' as const, username: 'c', nombre: 'C', activo: true };
    const reloj = { now: () => new Date('2026-10-05T12:00:00Z') };
    const resolverCamion = crearResolverCamion({ jornadas, clock: reloj });
    const registrar = crearRegistrarFactura({ facturas, clock: reloj, resolverCamion });
    const sin = await registrar(chofer, { folio: '9001', localId: s.local('Almacén A') });
    expect(!sin.ok && sin.error.detalle).toMatchObject({ codigo: 'SIN_JORNADA' });

    await jornadas.iniciar(s.empresa, s.usuario, s.camion, FECHA, ahora);
    const r = await registrar(chofer, { folio: '9001', localId: s.local('Almacén A') });
    expect(r.ok && r.value.camion?.id).toBe(s.camion);
    expect(r.ok && r.value.fecha).toBe(FECHA);
    const lista = await crearListarFacturas({ facturas, clock: reloj, resolverCamion })(chofer, {});
    expect(lista.ok && lista.value.map((f) => f.folio)).toEqual(['9001']);
  });
});
