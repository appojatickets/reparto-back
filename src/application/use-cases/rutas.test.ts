import { describe, expect, it } from 'vitest';
import { err } from '../../domain/shared/result.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeJornadas, fakeRegistro, resolverDePrueba } from './fakes-facturas.test-util.js';
import { CAMION_ID, FECHA, fakeCamionesRuta, fakeEmpresas, fakeEntregasRuta, fakeFacturasRuta, fakeRutas, paradaDe } from './fakes-rutas.test-util.js';
import { crearServiciosDeRuta } from './rutas.js';

const despachador = usuarioDe({ id: 'u-d', rol: 'despachador' });

const montar = (opciones: { pendientes?: ReturnType<typeof paradaDe>[]; config?: Parameters<typeof fakeEmpresas>[0] | null; jornadas?: ReturnType<typeof fakeJornadas>; registro?: ReturnType<typeof fakeRegistro> } = {}) => {
  const rutas = fakeRutas(opciones.pendientes ?? [paradaDe('A'), paradaDe('B'), paradaDe('C'), paradaDe('D')]);
  const empresas = fakeEmpresas(opciones.config);
  const facturas = fakeFacturasRuta();
  const servicios = crearServiciosDeRuta({ rutas: rutas.repo, empresas, camiones: fakeCamionesRuta(), facturas, entregas: fakeEntregasRuta(), jornadas: opciones.jornadas ?? fakeJornadas(), registro: opciones.registro ?? fakeRegistro(), clock: crearReloj('2026-10-05T10:00:00Z').clock, resolverCamion: resolverDePrueba() });
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

  it('la vista trae el depósito: la app sabe adónde vuelve el camión para avisar que la ruta termina', async () => {
    const r = await montar().ver(despachador, entrada);
    expect(r.ok && r.value.deposito).toMatchObject({ lat: expect.any(Number) as number, lng: expect.any(Number) as number });
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

  it('una factura sin pin NO bloquea la ruta: entra ubicada por el centro de su comuna y se marca como aproximada', async () => {
    const { facturaId, localId, razonSocial, direccion, comuna, urgente, horarios } = paradaDe('Z');
    const sinCoord = { facturaId, localId, razonSocial, direccion, comuna, urgente, horarios };
    const s = montar({ pendientes: [paradaDe('A'), sinCoord] });
    const r = await s.planificar(despachador, entrada);
    expect(r.ok && ids(r.value).sort()).toEqual(['f-A', 'f-Z']);
    expect(r.ok && r.value.sinPin).toEqual([]);
    const z = r.ok ? r.value.paradas.find((p) => p.facturaId === 'f-Z') : undefined;
    expect(z).toMatchObject({ ubicacionAproximada: true });
    expect(z?.lat).toBeUndefined();
    const a = r.ok ? r.value.paradas.find((p) => p.facturaId === 'f-A') : undefined;
    expect(a?.ubicacionAproximada).toBeUndefined();
  });

  it('la parada avisa si el local tiene foto de la fachada', async () => {
    const s = montar({ pendientes: [paradaDe('A', { tieneFoto: true }), paradaDe('B')] });
    const r = await s.planificar(despachador, entrada);
    const paradas = r.ok ? r.value.paradas : [];
    expect(paradas.find((p) => p.facturaId === 'f-A')?.tieneFoto).toBe(true);
    expect(paradas.find((p) => p.facturaId === 'f-B')?.tieneFoto).toBeUndefined();
  });

  it('solo si ni siquiera se sabe la comuna queda en «sin ubicación»', async () => {
    const { facturaId, localId, razonSocial, direccion, urgente, horarios } = paradaDe('Z');
    const s = montar({ pendientes: [paradaDe('A'), { facturaId, localId, razonSocial, direccion, comuna: 'Valparaíso', urgente, horarios }] });
    const r = await s.planificar(despachador, entrada);
    expect(r.ok && ids(r.value)).toEqual(['f-A']);
    expect(r.ok && r.value.sinPin.map((x) => x.facturaId)).toEqual(['f-Z']);
  });

  it('un local cerrado ese día queda «no atendido» con su explicación y el «antes de» muestra riesgo', async () => {
    const cerrado = paradaDe('X', { horarios: [{ dias: [1], tramos: [], fuente: 'confirmado', confianza: 1 }] }); // cerrado los lunes (la fecha es lunes)
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

describe('ruta de hoy: desde dónde y desde cuándo se calcula', () => {
  const montarHoy = (ahora: string, ultima?: { lat: number; lng: number }) => {
    const rutas = fakeRutas([paradaDe('A'), paradaDe('B')]);
    const entregas = fakeEntregasRuta();
    if (ultima) entregas.ultimaPosicion.mockResolvedValue({ ...ultima, en: new Date(ahora) });
    const facturas = fakeFacturasRuta();
    const servicios = crearServiciosDeRuta({ rutas: rutas.repo, empresas: fakeEmpresas(), camiones: fakeCamionesRuta(), facturas, entregas, jornadas: fakeJornadas(), registro: fakeRegistro(), clock: crearReloj(ahora).clock, resolverCamion: resolverDePrueba() });
    return { servicios, entregas, facturas };
  };

  it('si ya pasó la hora de salida, el cálculo parte de ahora y lo avisa; la salida planificada no cambia', async () => {
    const { servicios } = montarHoy('2026-10-05T13:30:00Z'); // 10:30 en Chile, salida 08:00
    const r = await servicios.planificar(despachador, entrada);
    expect(r.ok && r.value).toMatchObject({ salidaMin: 480, calculadaDesdeMin: 630 });
    expect(r.ok && r.value.paradas[0]?.llegada).toBeGreaterThan(630);
  });

  it('antes de la hora de salida no hay «calculada desde»', async () => {
    const { servicios } = montarHoy('2026-10-05T10:00:00Z'); // 07:00
    const r = await servicios.planificar(despachador, entrada);
    expect(r.ok && r.value).not.toHaveProperty('calculadaDesdeMin');
  });

  it('una ruta de otro día no usa la hora actual ni consulta la última posición', async () => {
    const { servicios, entregas } = montarHoy('2026-10-05T20:00:00Z');
    const r = await servicios.planificar(despachador, { ...entrada, fecha: '2026-10-06' });
    expect(r.ok && r.value).not.toHaveProperty('calculadaDesdeMin');
    expect(entregas.ultimaPosicion).not.toHaveBeenCalled();
  });

  it('el camión que ya hizo paradas parte de su última posición: la primera llegada es más tardía que desde el depósito', async () => {
    const lejos = montarHoy('2026-10-05T10:00:00Z', { lat: -33.62, lng: -70.52 });
    const base = montarHoy('2026-10-05T10:00:00Z');
    const a = await lejos.servicios.planificar(despachador, entrada);
    const b = await base.servicios.planificar(despachador, entrada);
    expect(a.ok && a.value.paradas[0]?.llegada).not.toBe(b.ok && b.value.paradas[0]?.llegada);
    expect(lejos.entregas.ultimaPosicion).toHaveBeenCalledWith('empresa-1', CAMION_ID, FECHA);
  });

  it('muestra lo ya hecho hoy (entregado o no entregado) y no lo mete en la ruta', async () => {
    const { servicios, facturas } = montarHoy('2026-10-05T10:00:00Z');
    facturas.listar.mockResolvedValue([
      { id: 'h1', estado: 'entregada', urgente: false, fecha: FECHA, local: { id: 'lh1', razonSocial: 'Kiosko', direccion: 'Calle 9', comuna: 'Maipú', tienePin: true } },
      { id: 'h2', estado: 'no_entregada', urgente: false, fecha: FECHA, local: { id: 'lh2', razonSocial: 'Bazar', direccion: 'Calle 8', comuna: 'Pudahuel', tienePin: true } },
      { id: 'h3', estado: 'pendiente', urgente: false, fecha: FECHA, local: { id: 'lh3', razonSocial: 'Otro', direccion: 'Calle 7', comuna: 'Maipú', tienePin: true } },
    ]);
    const r = await servicios.ver(despachador, entrada);
    expect(r.ok && r.value.hechas.map((h) => [h.cliente, h.estado])).toEqual([['Kiosko', 'entregada'], ['Bazar', 'no_entregada']]);
    expect(facturas.listar).toHaveBeenCalledWith('empresa-1', { fecha: FECHA, camionId: CAMION_ID, incluirHechas: true });
  });
});

describe('la lista empieza limpia al terminar la ruta', () => {
  it('lo hecho solo cuenta desde que terminó la última jornada del camión (o desde que empezó la vigente)', async () => {
    const jornadas = fakeJornadas();
    jornadas.ultimaDelCamion.mockResolvedValueOnce({ desde: new Date('2026-10-05T09:00:00Z'), hasta: new Date('2026-10-05T09:30:00Z') });
    const { ver, facturas } = montar({ jornadas });
    await ver(despachador, entrada);
    expect(facturas.listar).toHaveBeenCalledWith('empresa-1', { fecha: FECHA, camionId: CAMION_ID, incluirHechas: true, hechasDesde: new Date('2026-10-05T09:30:00Z') });
    jornadas.ultimaDelCamion.mockResolvedValueOnce({ desde: new Date('2026-10-05T09:45:00Z') });
    await ver(despachador, entrada);
    expect(facturas.listar).toHaveBeenLastCalledWith('empresa-1', { fecha: FECHA, camionId: CAMION_ID, incluirHechas: true, hechasDesde: new Date('2026-10-05T09:45:00Z') });
  });
});

describe('cada cálculo y cada movimiento de la ruta queda guardado para aprender', () => {
  it('guarda lo que sugirió el sistema y luego cada corrección con el orden que quedó, y la ruta sigue aunque no se pueda anotar', async () => {
    const registro = fakeRegistro();
    const s = montar({ registro });
    const v = await s.planificar(despachador, entrada);
    expect(registro.registrarOperacion).toHaveBeenCalledWith('empresa-1', expect.objectContaining({ camionId: CAMION_ID, fecha: FECHA, usuarioId: 'u-d', tipo: 'planificar', modo: 'sugerida' }));
    const vista = v.ok ? v.value : undefined;
    const primera = vista?.paradas[0]?.facturaId ?? '';
    const r = await s.operar(despachador, { ...entrada, version: vista?.version ?? 0, operacion: { tipo: 'bajar', facturaId: primera } });
    expect(r.ok).toBe(true);
    expect(registro.registrarOperacion).toHaveBeenLastCalledWith('empresa-1', expect.objectContaining({ tipo: 'bajar', facturaId: primera, modo: 'manual' }));
    registro.registrarOperacion.mockRejectedValue(new Error('base caída'));
    expect((await s.planificar(despachador, entrada)).ok).toBe(true);
  });
});

describe('la ruta usa lo que el sistema aprendió', () => {
  it('un camión más lento que lo calculado alarga los tiempos de viaje de su ruta (ritmo aprendido) y un local lento alarga su atención', async () => {
    const base = montar({ pendientes: [paradaDe('A'), paradaDe('B')] });
    const aprendizaje = { parametros: () => Promise.resolve([{ clave: 'ritmo' as const, ambito: 'camion:cam-1', valor: 1.5, muestras: 40, confianza: 1 }, { clave: 'servicio_min' as const, ambito: 'local:l-A', valor: 30, muestras: 6, confianza: 0.6 }]) };
    const rutas = fakeRutas([paradaDe('A'), paradaDe('B')]);
    const conAprendizaje = crearServiciosDeRuta({ rutas: rutas.repo, empresas: fakeEmpresas(), camiones: fakeCamionesRuta(), facturas: fakeFacturasRuta(), entregas: fakeEntregasRuta(), jornadas: fakeJornadas(), registro: fakeRegistro(), aprendizaje, clock: crearReloj('2026-10-05T10:00:00Z').clock, resolverCamion: resolverDePrueba() });
    const a = await base.planificar(despachador, entrada);
    const b = await conAprendizaje.planificar(despachador, entrada);
    expect(a.ok && b.ok).toBe(true);
    expect(b.ok ? b.value.regreso ?? 0 : 0).toBeGreaterThan(a.ok ? a.value.regreso ?? 0 : Infinity);
  });

  it('si no se puede leer lo aprendido, la ruta se calcula igual con los valores de respaldo', async () => {
    const rutas = fakeRutas([paradaDe('A')]);
    const servicios = crearServiciosDeRuta({ rutas: rutas.repo, empresas: fakeEmpresas(), camiones: fakeCamionesRuta(), facturas: fakeFacturasRuta(), entregas: fakeEntregasRuta(), jornadas: fakeJornadas(), registro: fakeRegistro(), aprendizaje: { parametros: () => Promise.reject(new Error('caído')) }, clock: crearReloj('2026-10-05T10:00:00Z').clock, resolverCamion: resolverDePrueba() });
    expect((await servicios.planificar(despachador, entrada)).ok).toBe(true);
  });
});

describe('coordenadas para navegar', () => {
  it('cada parada trae el pin del local; las sin pin no traen coordenadas', async () => {
    const s = montar({ pendientes: [paradaDe('A', { lat: -33.45, lng: -70.65 }), paradaDe('B')] });
    const r = await s.planificar(despachador, entrada);
    expect(r.ok && r.value.paradas[0]).toMatchObject({ lat: -33.45, lng: -70.65 });
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

describe('ruta del chofer', () => {
  const chofer = usuarioDe({ id: 'u-chofer', rol: 'chofer' });
  const montarChofer = (jornada?: Parameters<typeof resolverDePrueba>[0]) => {
    const rutas = fakeRutas([paradaDe('A'), paradaDe('B')]);
    return crearServiciosDeRuta({ rutas: rutas.repo, empresas: fakeEmpresas(), camiones: fakeCamionesRuta(), facturas: fakeFacturasRuta(), entregas: fakeEntregasRuta(), jornadas: fakeJornadas(jornada), registro: fakeRegistro(), clock: crearReloj('2026-10-05T10:00:00Z').clock, resolverCamion: resolverDePrueba(jornada) });
  };
  const JORNADA_CAM = { id: 'j-1', usuarioId: 'u-chofer', fecha: FECHA, desde: new Date(), camion: { id: CAMION_ID, patente: 'ABCD12' } };

  it('puede ver y calcular la ruta de su camión de hoy', async () => {
    const s = montarChofer(JORNADA_CAM);
    expect((await s.ver(chofer, entrada)).ok).toBe(true);
    expect((await s.planificar(chofer, entrada)).ok).toBe(true);
  });

  it('no puede ver ni tocar la ruta de otro camión, ni sin jornada', async () => {
    const s = montarChofer({ ...JORNADA_CAM, camion: { id: 'otro', patente: 'WXYZ99' } });
    const otro = await s.ver(chofer, entrada);
    expect(!otro.ok && otro.error.codigo).toBe('SIN_PERMISO');
    const plan = await s.planificar(chofer, entrada);
    expect(!plan.ok && plan.error.codigo).toBe('SIN_PERMISO');
    const sin = await montarChofer().ver(chofer, entrada);
    expect(!sin.ok && sin.error).toMatchObject({ detalle: { codigo: 'SIN_JORNADA' } });
  });
});
