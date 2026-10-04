import { describe, expect, it } from 'vitest';
import { err } from '../../domain/shared/result.js';
import { v } from '../../domain/ruteo/problemas.test-util.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { CAMION_ID, FECHA, fakeCamionesRuta, fakeEmpresas, fakeFacturasRuta, fakeRutas, paradaDe } from './fakes-rutas.test-util.js';
import { crearServiciosDeRuta } from './rutas.js';

const despachador = usuarioDe({ id: 'u-d', rol: 'despachador' });

const montar = (opciones: { pendientes?: ReturnType<typeof paradaDe>[]; config?: Parameters<typeof fakeEmpresas>[0] | null } = {}) => {
  const rutas = fakeRutas(opciones.pendientes ?? [paradaDe('A'), paradaDe('B'), paradaDe('C'), paradaDe('D')]);
  const empresas = fakeEmpresas(opciones.config);
  const facturas = fakeFacturasRuta();
  const servicios = crearServiciosDeRuta({ rutas: rutas.repo, empresas, camiones: fakeCamionesRuta(), facturas, clock: crearReloj().clock });
  return { ...servicios, rutas, facturas, empresas };
};
const entrada = { camionId: CAMION_ID, fecha: FECHA };
const ids = (r: { paradas: readonly { facturaId: string }[] }) => r.paradas.map((p) => p.facturaId);

describe('ver ruta', () => {
  it('sin ruta planificada informa las pendientes como «nuevas» y no inventa horas', async () => {
    const s = montar();
    const r = await s.ver(despachador, entrada);
    expect(r.ok && r.value).toMatchObject({ planificada: false, salidaMin: 480, paradas: [] });
    expect(r.ok && r.value.nuevas.map((n) => n.folio)).toEqual(['100A', '100B', '100C', '100D']);
  });

  it('exige el depósito configurado, un camión que exista y una fecha válida', async () => {
    const sinDeposito = await montar({ config: { salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 } }).ver(despachador, entrada);
    expect(!sinDeposito.ok && sinDeposito.error).toMatchObject({ codigo: 'VALIDACION', detalle: { codigo: 'SIN_DEPOSITO' } });
    const sinEmpresa = await montar({ config: null }).ver(despachador, entrada);
    expect(!sinEmpresa.ok && sinEmpresa.error.codigo).toBe('VALIDACION');
    const camion = await montar().ver(despachador, { camionId: 'otro', fecha: FECHA });
    expect(!camion.ok && camion.error.codigo).toBe('NO_ENCONTRADO');
    const fecha = await montar().ver(despachador, { camionId: CAMION_ID, fecha: '2026-13-40' });
    expect(!fecha.ok && fecha.error.codigo).toBe('VALIDACION');
  });
});

describe('planificar', () => {
  it('ordena, guarda como «sugerida» y devuelve horas de llegada crecientes y el regreso', async () => {
    const s = montar();
    const r = await s.planificar(despachador, entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ planificada: true, modo: 'sugerida', version: 1, salidaMin: 480 });
    expect([...ids(r.value)].sort()).toEqual(['f-A', 'f-B', 'f-C', 'f-D']);
    const llegadas = r.value.paradas.map((p) => p.llegada);
    expect(llegadas).toEqual([...llegadas].sort((a, b) => a - b));
    expect(llegadas[0]).toBeGreaterThan(480);
    expect(r.value.regreso).toBeGreaterThan(llegadas[3] ?? 0);
    expect(s.rutas.guardadaActual()?.orden).toEqual(ids(r.value));
    expect(s.rutas.repo.guardar.mock.calls[0]?.[1]).toMatchObject({ camionId: CAMION_ID, fecha: FECHA, usuarioId: 'u-d', modo: 'sugerida' });
  });

  it('las facturas sin pin salen aparte y no entran a la ruta', async () => {
    const { facturaId, folio, localId, razonSocial, direccion, comuna, urgente, horarios } = paradaDe('Z');
    const sinCoord = { facturaId, folio, localId, razonSocial, direccion, comuna, urgente, horarios };
    const s = montar({ pendientes: [paradaDe('A'), sinCoord] });
    const r = await s.planificar(despachador, entrada);
    expect(r.ok && ids(r.value)).toEqual(['f-A']);
    expect(r.ok && r.value.sinPin.map((x) => x.facturaId)).toEqual(['f-Z']);
  });

  it('un local cerrado ese día queda «no atendido» con su explicación y el «antes de» muestra riesgo', async () => {
    const cerrado = paradaDe('X', { horarios: [{ dias: [2], tramos: [v(540, 1080)], fuente: 'confirmado', confianza: 1 }] }); // solo martes; la fecha es lunes
    const s = montar({ pendientes: [paradaDe('A'), cerrado] });
    const r = await s.planificar(despachador, entrada);
    expect(r.ok && r.value.noAtendidas.map((n) => n.facturaId)).toEqual(['f-X']);
    expect(r.ok && ids(r.value)).toEqual(['f-A']);
  });

  it('la hora de salida pedida se guarda y rechaza valores imposibles', async () => {
    const s = montar();
    const r = await s.planificar(despachador, { ...entrada, salidaMin: 420 });
    expect(r.ok && r.value.salidaMin).toBe(420);
    expect(r.ok && r.value.paradas[0]?.llegada).toBeLessThan(480 + 60);
    const mala = await s.planificar(despachador, { ...entrada, salidaMin: 2000 });
    expect(!mala.ok && mala.error.codigo).toBe('VALIDACION');
  });

  it('volver a ver la ruta la evalúa con lo guardado y detecta facturas agregadas después', async () => {
    const s = montar({ pendientes: [paradaDe('A'), paradaDe('B')] });
    await s.planificar(despachador, entrada);
    s.rutas.estado.pendientes = [paradaDe('A'), paradaDe('B'), paradaDe('E')];
    const r = await s.ver(despachador, entrada);
    expect(r.ok && r.value.planificada).toBe(true);
    expect(r.ok && r.value.nuevas.map((n) => n.facturaId)).toEqual(['f-E']);
    s.rutas.estado.pendientes = [paradaDe('B')];
    const sin = await s.ver(despachador, entrada);
    expect(sin.ok && ids(sin.value)).toEqual(['f-B']); // la factura A ya no está en el camión
  });
});

describe('acomodar la ruta', () => {
  const planificada = async () => {
    const s = montar();
    const p = await s.planificar(despachador, entrada);
    if (!p.ok) throw new Error('no se planificó');
    return { s, orden: ids(p.value), version: p.value.version ?? 0 };
  };

  it('SUBIR y BAJAR mueven una posición, pasan a modo manual y suben la versión', async () => {
    const { s, orden, version } = await planificada();
    const tercero = orden[2] ?? '';
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'subir', facturaId: tercero } });
    expect(r.ok && ids(r.value)).toEqual([orden[0], tercero, orden[1], orden[3]]);
    expect(r.ok && r.value).toMatchObject({ modo: 'manual', version: version + 1 });
    const b = await s.operar(despachador, { ...entrada, version: version + 1, operacion: { tipo: 'bajar', facturaId: tercero } });
    expect(b.ok && ids(b.value)).toEqual(orden);
  });

  it('en modo manual IR PRIMERO solo pasa al frente, sin reordenar el resto', async () => {
    const { s, orden, version } = await planificada();
    const m = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'subir', facturaId: orden[1] ?? '' } });
    const actual = m.ok ? ids(m.value) : [];
    const ultimo = actual[3] ?? '';
    const r = await s.operar(despachador, { ...entrada, version: version + 1, operacion: { tipo: 'primero', facturaId: ultimo } });
    expect(r.ok && ids(r.value)).toEqual([ultimo, ...actual.slice(0, 3)]);
    expect(r.ok && r.value.paradas[0]).toMatchObject({ fijada: true });
    expect(r.ok && r.value.modo).toBe('manual');
  });

  it('IR PRIMERO en modo sugerida deja la parada al frente y fijada', async () => {
    const { s, orden, version } = await planificada();
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'primero', facturaId: orden[3] ?? '' } });
    expect(r.ok && r.value.paradas[0]).toMatchObject({ facturaId: orden[3], fijada: true });
    expect(r.ok && r.value.modo).toBe('sugerida');
  });

  it('DEJAR PARA DESPUÉS la mueve más atrás', async () => {
    const { s, orden, version } = await planificada();
    const primera = orden[0] ?? '';
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'despues', facturaId: primera } });
    expect(r.ok && ids(r.value).indexOf(primera)).toBeGreaterThan(0);
  });

  it('QUITAR saca la factura del camión y de la ruta', async () => {
    const { s, orden, version } = await planificada();
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'quitar', facturaId: orden[1] ?? '' } });
    expect(s.facturas.actualizar).toHaveBeenCalledWith('empresa-1', orden[1], { camionId: null });
    expect(r.ok && ids(r.value)).not.toContain(orden[1]);
    expect(r.ok && r.value.paradas).toHaveLength(3);
  });

  it('INSERTAR mete las nuevas sin tocar el orden que ya había', async () => {
    const { s, orden, version } = await planificada();
    s.rutas.estado.pendientes = [...s.rutas.estado.pendientes, paradaDe('E')];
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'insertar' } });
    expect(r.ok && ids(r.value).filter((x) => x !== 'f-E')).toEqual(orden);
    expect(r.ok && r.value.nuevas).toEqual([]);
  });

  it('ORDENAR vuelve a modo sugerida y CAMBIAR SALIDA recalcula las horas', async () => {
    const { s, orden, version } = await planificada();
    const m = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'subir', facturaId: orden[1] ?? '' } });
    expect(m.ok && m.value.modo).toBe('manual');
    const o = await s.operar(despachador, { ...entrada, version: version + 1, operacion: { tipo: 'ordenar' } });
    expect(o.ok && o.value.modo).toBe('sugerida');
    const antes = o.ok ? (o.value.paradas[0]?.llegada ?? 0) : 0;
    const t = await s.operar(despachador, { ...entrada, version: version + 2, operacion: { tipo: 'salida', salidaMin: 420 } });
    expect(t.ok && t.value.salidaMin).toBe(420);
    expect(t.ok && (t.value.paradas[0]?.llegada ?? 0)).toBeLessThan(antes);
  });

  it('si la versión no coincide (otra persona cambió la ruta) responde conflicto y no guarda', async () => {
    const { s, orden, version } = await planificada();
    const r = await s.operar(despachador, { ...entrada, version: version + 5, operacion: { tipo: 'subir', facturaId: orden[1] ?? '' } });
    expect(!r.ok && r.error).toMatchObject({ codigo: 'CONFLICTO', detalle: { codigo: 'RUTA_DESACTUALIZADA' } });
    expect(s.rutas.repo.guardar).toHaveBeenCalledTimes(1);
  });

  it('si el guardado detecta una versión nueva (carrera) también responde conflicto', async () => {
    const { s, orden, version } = await planificada();
    s.rutas.repo.guardar.mockResolvedValueOnce(err('VERSION_DESACTUALIZADA'));
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'subir', facturaId: orden[1] ?? '' } });
    expect(!r.ok && r.error.codigo).toBe('CONFLICTO');
  });

  it('sin ruta planificada o con una factura que no está, informa claramente', async () => {
    const sin = await montar().operar(despachador, { ...entrada, version: 1, operacion: { tipo: 'ordenar' } });
    expect(!sin.ok && sin.error).toMatchObject({ codigo: 'NO_ENCONTRADO' });
    const { s, version } = await planificada();
    const ajena = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'subir', facturaId: 'f-ZZZ' } });
    expect(!ajena.ok && ajena.error.codigo).toBe('NO_ENCONTRADO');
    const q = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'quitar', facturaId: 'f-ZZZ' } });
    expect(!q.ok && q.error.codigo).toBe('NO_ENCONTRADO');
    const salida = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'salida', salidaMin: -5 } });
    expect(!salida.ok && salida.error.codigo).toBe('VALIDACION');
  });
});
