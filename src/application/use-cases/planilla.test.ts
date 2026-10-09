import { describe, expect, it } from 'vitest';
import { crearReloj, fakeUsuarios, usuarioDe } from './fakes.test-util.js';
import { camionDe, fakeCamiones, fakeJornadas, fakePlanillas, fakeVendedores } from './fakes-facturas.test-util.js';
import { crearAplicarPlanilla, crearObtenerPlanilla } from './planilla.js';
import { ok } from '../../domain/shared/result.js';

const actor = usuarioDe({ id: 'u-d', rol: 'despachador' });
const juan = usuarioDe({ id: 'u-juan', rol: 'chofer', username: 'jperez', nombre: 'Juan Pérez Soto' });
const pedro = usuarioDe({ id: 'u-pedro', rol: 'ayudante', username: 'pgomez', nombre: 'Pedro Gómez' });

const armar = (opciones: { camiones?: ReturnType<typeof camionDe>[]; ahora?: string } = {}) => {
  const camiones = fakeCamiones();
  camiones.listar.mockResolvedValue(opciones.camiones ?? []);
  camiones.crear.mockImplementation((_e, d) => Promise.resolve(ok(camionDe({ id: `cam-${d.patente}`, patente: d.patente, ...(d.alias !== undefined ? { alias: d.alias } : {}) }))));
  const vendedores = fakeVendedores();
  const planillas = fakePlanillas();
  const jornadas = fakeJornadas();
  const { repo } = fakeUsuarios([actor, juan, pedro]);
  const { clock } = crearReloj(opciones.ahora);
  const aplicar = crearAplicarPlanilla({ camiones, vendedores, usuarios: repo, planillas, jornadas, clock });
  return { aplicar, camiones, vendedores, planillas, jornadas };
};

const FILA = { patente: 'ABCD12', chofer: 'Juan Pérez', ayudante: 'Pedro Gómez', vendedores: [{ codigo: 'v5', nombre: 'Ana' }], comunas: ['maipu'] };

describe('aplicar la planilla del día', () => {
  it('crea el camión que falta con los dos últimos dígitos como nombre, los vendedores, enlaza a las personas y deja la asignación', async () => {
    const t = armar();
    const r = await t.aplicar(actor, { fecha: '2026-10-05', filas: [FILA] });
    expect(r.ok && r.value.filas).toEqual([
      {
        patente: 'ABCD12',
        valida: true,
        errores: [],
        camionCreado: true,
        alias: '12',
        vendedoresCreados: 1,
        chofer: { nombre: 'Juan Pérez', estado: 'enlazada' },
        ayudante: { nombre: 'Pedro Gómez', estado: 'enlazada' },
        jornadasAbiertas: 2,
      },
    ]);
    expect(t.camiones.crear).toHaveBeenCalledWith('empresa-1', { patente: 'ABCD12', alias: '12' });
    expect(t.vendedores.asegurar).toHaveBeenCalledWith('empresa-1', [{ codigo: 'V05', nombre: 'Ana' }]);
    expect(t.planillas.guardar).toHaveBeenCalledWith(
      'empresa-1',
      '2026-10-05',
      [
        {
          camionId: 'cam-ABCD12',
          chofer: { nombre: 'Juan Pérez', usuarioId: 'u-juan' },
          ayudante: { nombre: 'Pedro Gómez', usuarioId: 'u-pedro' },
          comunas: ['Maipú'],
          vendedorIds: ['v-1'],
        },
      ],
      'u-d',
    );
  });

  it('si es la planilla de hoy deja a cada uno con su camión elegido; si es de otro día, no abre jornadas', async () => {
    const hoy = armar();
    await hoy.aplicar(actor, { fecha: '2026-10-05', filas: [FILA] });
    expect(hoy.jornadas.iniciar).toHaveBeenCalledWith('empresa-1', 'u-juan', 'cam-ABCD12', '2026-10-05', new Date('2026-10-05T12:00:00.000Z'));
    expect(hoy.jornadas.iniciar).toHaveBeenCalledWith('empresa-1', 'u-pedro', 'cam-ABCD12', '2026-10-05', new Date('2026-10-05T12:00:00.000Z'));

    const manana = armar();
    const r = await manana.aplicar(actor, { fecha: '2026-10-06', filas: [FILA] });
    expect(manana.jornadas.iniciar).not.toHaveBeenCalled();
    expect(r.ok && r.value.filas[0]?.jornadasAbiertas).toBe(0);
    expect(manana.planillas.guardar).toHaveBeenCalled();
  });

  it('un camión que ya existe se reutiliza (y se reactiva si estaba fuera de servicio)', async () => {
    const t = armar({ camiones: [camionDe({ id: 'cam-1', patente: 'ABCD12', alias: 'gris', activo: false })] });
    const r = await t.aplicar(actor, { fecha: '2026-10-05', filas: [FILA] });
    expect(t.camiones.crear).not.toHaveBeenCalled();
    expect(t.camiones.actualizar).toHaveBeenCalledWith('empresa-1', 'cam-1', { activo: true });
    expect(r.ok && r.value.filas[0]).toMatchObject({ camionCreado: false });
    expect(r.ok && r.value.filas[0] && 'alias' in r.value.filas[0]).toBe(false);
    expect(t.planillas.guardar).toHaveBeenCalledWith('empresa-1', '2026-10-05', [expect.objectContaining({ camionId: 'cam-1' })], 'u-d');
  });

  it('si los dos últimos dígitos ya los usa otro camión, el nuevo queda sin nombre para que se ponga a mano', async () => {
    const t = armar({ camiones: [camionDe({ id: 'cam-23a', patente: 'LZYS23', alias: '23' })] });
    const r = await t.aplicar(actor, { fecha: '2026-10-05', filas: [{ patente: 'SDTS23' }] });
    expect(t.camiones.crear).toHaveBeenCalledWith('empresa-1', { patente: 'SDTS23' });
    expect(r.ok && r.value.filas[0]).toMatchObject({ camionCreado: true });
    expect(r.ok && r.value.filas[0] && 'alias' in r.value.filas[0]).toBe(false);
  });

  it('una persona sin usuario se informa y no se inventa; la fila igual se guarda', async () => {
    const t = armar();
    const r = await t.aplicar(actor, { fecha: '2026-10-05', filas: [{ patente: 'ABCD12', chofer: 'Luis Rojas Pino', ayudante: 'Pedro Gómez' }] });
    expect(r.ok && r.value.filas[0]).toMatchObject({ chofer: { nombre: 'Luis Rojas Pino', estado: 'sin_usuario' }, ayudante: { estado: 'enlazada' }, jornadasAbiertas: 1 });
    expect(t.planillas.guardar).toHaveBeenCalledWith('empresa-1', '2026-10-05', [expect.objectContaining({ chofer: { nombre: 'Luis Rojas Pino' } })], 'u-d');
    expect(t.jornadas.iniciar).toHaveBeenCalledTimes(1);
  });

  it('una fila inválida se informa y no frena a las demás', async () => {
    const t = armar();
    const r = await t.aplicar(actor, { fecha: '2026-10-05', filas: [{ patente: 'XX', comunas: ['Narnia'] }, { patente: 'ZZZZ99' }] });
    expect(r.ok && r.value.filas[0]).toMatchObject({ patente: 'XX', valida: false, camionCreado: false });
    expect(r.ok && r.value.filas[0]?.errores.length).toBeGreaterThan(0);
    expect(r.ok && r.value.filas[1]).toMatchObject({ patente: 'ZZZZ99', valida: true });
    expect(t.camiones.crear).toHaveBeenCalledTimes(1);
    expect(t.planillas.guardar).toHaveBeenCalledWith('empresa-1', '2026-10-05', [expect.objectContaining({ camionId: 'cam-ZZZZ99' })], 'u-d');
  });

  it('si todas las filas son inválidas no guarda nada', async () => {
    const t = armar();
    await t.aplicar(actor, { fecha: '2026-10-05', filas: [{ patente: 'XX' }] });
    expect(t.planillas.guardar).not.toHaveBeenCalled();
  });

  it('rechaza una fecha inválida y una planilla vacía', async () => {
    const t = armar();
    const f = await t.aplicar(actor, { fecha: '2026-13-45', filas: [FILA] });
    expect(!f.ok && f.error.codigo).toBe('VALIDACION');
    const v = await t.aplicar(actor, { fecha: '2026-10-05', filas: [] });
    expect(!v.ok && v.error.codigo).toBe('VALIDACION');
  });

  it('un camión que no se pudo crear (patente repetida en carrera) se informa como fila mala', async () => {
    const t = armar();
    t.camiones.crear.mockResolvedValueOnce({ ok: false, error: 'PATENTE_DUPLICADA' });
    const r = await t.aplicar(actor, { fecha: '2026-10-05', filas: [{ patente: 'ABCD12' }] });
    expect(r.ok && r.value.filas[0]).toMatchObject({ valida: false, camionCreado: false });
    expect(t.planillas.guardar).not.toHaveBeenCalled();
  });
});

describe('ver la planilla', () => {
  it('sin fecha usa hoy en Chile y con fecha inválida avisa', async () => {
    const planillas = fakePlanillas();
    const obtener = crearObtenerPlanilla({ planillas, clock: crearReloj().clock });
    await obtener(actor);
    expect(planillas.obtener).toHaveBeenCalledWith('empresa-1', '2026-10-05');
    await obtener(actor, '2026-10-01');
    expect(planillas.obtener).toHaveBeenLastCalledWith('empresa-1', '2026-10-01');
    const mala = await obtener(actor, 'ayer');
    expect(!mala.ok && mala.error.codigo).toBe('VALIDACION');
  });
});
