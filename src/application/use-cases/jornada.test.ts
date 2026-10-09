import { describe, expect, it } from 'vitest';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeFacturas, fakeJornadas, fakePlanillas, fakeRegistro, JORNADA, facturaDe, resolverDePrueba } from './fakes-facturas.test-util.js';
import { crearActualizarFactura, crearListarFacturas, crearRegistrarFactura } from './facturas.js';
import { fakeRutas } from './fakes-rutas.test-util.js';
import { crearIniciarJornada, crearMiJornada, crearResolverCamion, crearTerminarJornada } from './jornada.js';
import { err } from '../../domain/shared/result.js';

const chofer = usuarioDe({ id: 'u-chofer', rol: 'chofer', username: 'jperez' });
const despachador = usuarioDe({ id: 'u-d', rol: 'despachador' });
const LOCAL = '123e4567-e89b-42d3-a456-426614174000';
const { clock } = crearReloj();

describe('jornada', () => {
  it('iniciar usa la fecha de hoy en Chile y el reloj inyectado; cerrar y consultar pasan por el repositorio', async () => {
    const jornadas = fakeJornadas();
    const r = await crearIniciarJornada({ jornadas, rutas: fakeRutas().repo, planillas: fakePlanillas(), clock })(chofer, 'cam-7');
    expect(r.ok && r.value.camion.id).toBe('cam-7');
    expect(jornadas.iniciar).toHaveBeenCalledWith('empresa-1', 'u-chofer', 'cam-7', '2026-10-05', new Date('2026-10-05T12:00:00.000Z'));
    await crearTerminarJornada({ jornadas, facturas: fakeFacturas(), rutas: fakeRutas().repo, registro: fakeRegistro(), clock })(chofer);
    expect(jornadas.terminar).toHaveBeenCalledWith('empresa-1', 'u-chofer', new Date('2026-10-05T12:00:00.000Z'));
    await crearMiJornada({ jornadas, planillas: fakePlanillas(), clock })(chofer);
    expect(jornadas.activa).toHaveBeenCalledWith('empresa-1', 'u-chofer', '2026-10-05');
  });

  it('la jornada trae lo que dice la planilla de hoy para ese camión (quiénes van, comunas y vendedores), si la hay', async () => {
    const asignacion = {
      fecha: '2026-10-05',
      camion: { id: 'cam-7', patente: 'ABCD12', alias: '12' },
      chofer: { nombre: 'Juan Pérez', usuarioId: 'u-chofer' },
      comunas: ['Maipú'],
      vendedores: [{ id: 'v-1', codigo: 'V12', nombre: 'Ana', celular: '56912345678', activo: true }],
    };
    const planillas = fakePlanillas(asignacion);
    const r = await crearIniciarJornada({ jornadas: fakeJornadas(), rutas: fakeRutas().repo, planillas, clock })(chofer, 'cam-7');
    expect(r.ok && r.value.asignacion).toEqual(asignacion);
    expect(planillas.deCamion).toHaveBeenCalledWith('empresa-1', '2026-10-05', 'cam-7');
    const mi = await crearMiJornada({ jornadas: fakeJornadas(JORNADA), planillas: fakePlanillas(asignacion), clock })(chofer);
    expect(mi?.asignacion).toEqual(asignacion);
    const sin = await crearMiJornada({ jornadas: fakeJornadas(JORNADA), planillas: fakePlanillas(), clock })(chofer);
    expect(sin).toEqual(JORNADA);
    expect(sin && 'asignacion' in sin).toBe(false);
  });

  it('un camión que no existe o está fuera de servicio es NO_ENCONTRADO', async () => {
    const jornadas = fakeJornadas();
    jornadas.iniciar.mockResolvedValueOnce(err('CAMION_NO_DISPONIBLE'));
    const r = await crearIniciarJornada({ jornadas, rutas: fakeRutas().repo, planillas: fakePlanillas(), clock })(chofer, 'cam-x');
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });
});

describe('terminar la ruta: queda el resumen del día', () => {
  it('cuenta lo entregado, lo no entregado y lo que quedó pendiente de ese camión y ese día, con la hora de inicio y de término', async () => {
    const jornadas = fakeJornadas(JORNADA);
    const facturas = fakeFacturas();
    facturas.listar.mockResolvedValueOnce([
      facturaDe({ id: 'f1', estado: 'entregada' }), facturaDe({ id: 'f2', estado: 'entregada' }), facturaDe({ id: 'f3', estado: 'no_entregada' }),
      facturaDe({ id: 'f4', estado: 'pendiente' }), facturaDe({ id: 'f5', estado: 'pendiente' }),
    ]);
    const r = await crearTerminarJornada({ jornadas, facturas, rutas: fakeRutas().repo, registro: fakeRegistro(), clock })(chofer);
    expect(facturas.listar).toHaveBeenCalledWith('empresa-1', { fecha: '2026-10-05', camionId: 'cam-1', incluirHechas: true });
    expect(jornadas.terminar).toHaveBeenCalledWith('empresa-1', 'u-chofer', new Date('2026-10-05T12:00:00.000Z'));
    expect(r).toEqual({
      fecha: '2026-10-05', camionId: 'cam-1', desde: new Date('2026-10-05T11:00:00Z'), hasta: new Date('2026-10-05T12:00:00.000Z'),
      entregadas: 2, noEntregadas: 1, pendientes: 2,
    });
  });

  it('deja la lista limpia al instante: borra la ruta guardada y suelta lo pendiente del camión; también barre las rutas de días anteriores', async () => {
    const jornadas = fakeJornadas(JORNADA);
    const facturas = fakeFacturas();
    const { repo: rutas } = fakeRutas();
    await crearTerminarJornada({ jornadas, facturas, rutas, registro: fakeRegistro(), clock })(chofer);
    expect(facturas.soltarPendientesDelCamion).toHaveBeenCalledWith('empresa-1', 'cam-1', '2026-10-05');
    expect(rutas.borrar).toHaveBeenCalledWith('empresa-1', 'cam-1', '2026-10-05');
    expect(rutas.borrarAnteriores).toHaveBeenCalledWith('empresa-1', '2026-10-05');
  });

  it('guarda el resumen de la jornada para aprender: cuántas había, cuántas se hicieron y cuáles no se alcanzaron (aunque se suelten del camión)', async () => {
    const jornadas = fakeJornadas(JORNADA);
    const facturas = fakeFacturas();
    facturas.listar.mockResolvedValueOnce([facturaDe({ id: 'f1', estado: 'entregada' }), facturaDe({ id: 'f2', estado: 'no_entregada' }), facturaDe({ id: 'f3', estado: 'pendiente' })]);
    const registro = fakeRegistro();
    await crearTerminarJornada({ jornadas, facturas, rutas: fakeRutas().repo, registro, clock })(chofer);
    expect(registro.guardarResumenDeJornada).toHaveBeenCalledWith('empresa-1', {
      jornadaId: 'j-1', camionId: 'cam-1', fecha: '2026-10-05', paradas: 3, entregadas: 1, noEntregadas: 1, sinHacer: 1, sinHacerIds: ['f3'], duracionMin: 60,
    });
  });

  it('sin jornada de hoy igual cierra lo que hubiera abierto y no inventa un resumen', async () => {
    const jornadas = fakeJornadas();
    const facturas = fakeFacturas();
    const r = await crearTerminarJornada({ jornadas, facturas, rutas: fakeRutas().repo, registro: fakeRegistro(), clock })(chofer);
    expect(r).toBeUndefined();
    expect(jornadas.terminar).toHaveBeenCalledTimes(1);
    expect(facturas.listar).not.toHaveBeenCalled();
    expect(facturas.soltarPendientesDelCamion).not.toHaveBeenCalled();
  });
});

describe('empezar el día: la ruta no se reutiliza', () => {
  it('al iniciar la jornada se borran las rutas guardadas de días anteriores', async () => {
    const rutas = fakeRutas().repo;
    await crearIniciarJornada({ jornadas: fakeJornadas(), rutas, planillas: fakePlanillas(), clock })(chofer, 'cam-7');
    expect(rutas.borrarAnteriores).toHaveBeenCalledWith('empresa-1', '2026-10-05');
  });
});

describe('resolver camión (el chofer solo toca el de su jornada)', () => {
  it('despachador y admin usan el camión pedido tal cual (o ninguno)', async () => {
    const resolver = resolverDePrueba();
    expect(await resolver(despachador, 'cam-9')).toEqual({ ok: true, value: 'cam-9' });
    expect(await resolver(despachador, undefined)).toEqual({ ok: true, value: undefined });
  });

  it('el chofer sin jornada de hoy recibe SIN_JORNADA', async () => {
    const r = await resolverDePrueba()(chofer, undefined);
    expect(!r.ok && r.error).toMatchObject({ codigo: 'VALIDACION', detalle: { codigo: 'SIN_JORNADA' } });
  });

  it('con jornada usa su camión, aunque no lo pida, y rechaza cualquier otro', async () => {
    const resolver = resolverDePrueba(JORNADA);
    expect(await resolver(chofer, undefined)).toEqual({ ok: true, value: 'cam-1' });
    expect(await resolver(chofer, 'cam-1')).toEqual({ ok: true, value: 'cam-1' });
    const otro = await resolver(chofer, 'cam-2');
    expect(!otro.ok && otro.error.codigo).toBe('SIN_PERMISO');
  });

  it('la jornada se busca con la fecha de hoy: la de otro día no vale', async () => {
    const jornadas = fakeJornadas();
    await crearResolverCamion({ jornadas, clock: crearReloj('2026-10-06T02:30:00Z').clock })(chofer, undefined); // en Chile aún es 5 de octubre
    expect(jornadas.activa).toHaveBeenCalledWith('empresa-1', 'u-chofer', '2026-10-05');
  });
});

describe('facturas del chofer', () => {
  it('cargar: siempre queda en el camión de su jornada, incluso si manda otro', async () => {
    const facturas = fakeFacturas();
    const registrar = crearRegistrarFactura({ facturas, clock, resolverCamion: resolverDePrueba(JORNADA) });
    await registrar(chofer, { folio: '1234', localId: LOCAL });
    expect(facturas.crear).toHaveBeenLastCalledWith('empresa-1', expect.objectContaining({ camionId: 'cam-1', creadoPor: 'u-chofer' }));
    const otro = await registrar(chofer, { folio: '1235', localId: LOCAL, camionId: 'cam-2' });
    expect(!otro.ok && otro.error.codigo).toBe('SIN_PERMISO');
    expect(facturas.crear).toHaveBeenCalledTimes(1);
  });

  it('cargar sin elegir camión pide elegirlo y no guarda', async () => {
    const facturas = fakeFacturas();
    const r = await crearRegistrarFactura({ facturas, clock, resolverCamion: resolverDePrueba() })(chofer, { folio: '1234', localId: LOCAL });
    expect(!r.ok && r.error).toMatchObject({ detalle: { codigo: 'SIN_JORNADA' } });
    expect(facturas.crear).not.toHaveBeenCalled();
  });

  it('listar: solo las de su camión; ignora «sin camión»', async () => {
    const facturas = fakeFacturas();
    const listar = crearListarFacturas({ facturas, clock, resolverCamion: resolverDePrueba(JORNADA) });
    await listar(chofer, { sinCamion: true });
    expect(facturas.listar).toHaveBeenLastCalledWith('empresa-1', { fecha: '2026-10-05', camionId: 'cam-1' });
    const ajeno = await listar(chofer, { camionId: 'cam-2' });
    expect(!ajeno.ok && ajeno.error.codigo).toBe('SIN_PERMISO');
  });

  it('actualizar: solo facturas de su camión; no puede cambiarlas de camión; sí anular', async () => {
    const facturas = fakeFacturas();
    const actualizar = crearActualizarFactura({ facturas, resolverCamion: resolverDePrueba(JORNADA) });
    facturas.obtener.mockResolvedValue(facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' } }));
    expect((await actualizar(chofer, 'f-1', { estado: 'anulada' })).ok).toBe(true);
    const mover = await actualizar(chofer, 'f-1', { camionId: 'cam-2' });
    expect(!mover.ok && mover.error.codigo).toBe('SIN_PERMISO');

    facturas.obtener.mockResolvedValue(facturaDe({ camion: { id: 'cam-2', patente: 'WXYZ99' } }));
    const ajena = await actualizar(chofer, 'f-1', { urgente: true });
    expect(!ajena.ok && ajena.error).toMatchObject({ codigo: 'SIN_PERMISO', mensaje: 'Esa factura no es de tu camión de hoy.' });

    facturas.obtener.mockResolvedValue(facturaDe());
    const sinCamion = await actualizar(chofer, 'f-1', { urgente: true });
    expect(!sinCamion.ok && sinCamion.error.codigo).toBe('SIN_PERMISO');

    facturas.obtener.mockResolvedValue(undefined);
    const noExiste = await actualizar(chofer, 'f-1', { urgente: true });
    expect(!noExiste.ok && noExiste.error.codigo).toBe('NO_ENCONTRADO');
    expect(facturas.actualizar).toHaveBeenCalledTimes(1);
  });

  it('el despachador no queda limitado por jornada', async () => {
    const facturas = fakeFacturas();
    const r = await crearListarFacturas({ facturas, clock, resolverCamion: resolverDePrueba() })(despachador, { camionId: 'cam-9', sinCamion: true });
    expect(r.ok).toBe(true);
    expect(facturas.listar).toHaveBeenLastCalledWith('empresa-1', { fecha: '2026-10-05', camionId: 'cam-9', sinCamion: true });
  });
});

