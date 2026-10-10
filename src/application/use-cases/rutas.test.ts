import { describe, expect, it, vi } from 'vitest';
import { err } from '../../domain/shared/result.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeJornadas, fakeRegistro, resolverDePrueba } from './fakes-facturas.test-util.js';
import { CAMION_ID, CONFIG, FECHA, fakeCamionesRuta, fakeEmpresas, fakeEntregasRuta, fakeFacturasRuta, fakeRutas, paradaDe } from './fakes-rutas.test-util.js';
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

  it('si la dirección ya se buscó en el mapa y no se encontró, la parada sin pin lo dice (noEncontradaEnMapa); si aún no se busca, no', async () => {
    const { facturaId, localId, razonSocial, direccion, comuna, urgente, horarios } = paradaDe('Z');
    const base = { facturaId, localId, razonSocial, direccion, comuna, urgente, horarios };
    const s = montar({ pendientes: [paradaDe('A'), { ...base, busquedaSinResultado: true }, { ...base, facturaId: 'f-Y', busquedaSinResultado: false }] });
    const r = await s.planificar(despachador, entrada);
    const por = (id: string) => (r.ok ? r.value.paradas.find((p) => p.facturaId === id) : undefined);
    expect(por('f-Z')).toMatchObject({ ubicacionAproximada: true, noEncontradaEnMapa: true });
    expect(por('f-Y')?.noEncontradaEnMapa).toBeUndefined();
    expect(por('f-A')?.noEncontradaEnMapa).toBeUndefined();
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
    const ultima = vista?.paradas[vista.paradas.length - 1]?.facturaId ?? '';
    const m = await s.operar(despachador, { ...entrada, version: r.ok ? r.value.version ?? 0 : 0, operacion: { tipo: 'mover', facturaId: ultima, posicion: 0 } });
    expect(m.ok).toBe(true);
    expect(registro.registrarOperacion).toHaveBeenLastCalledWith('empresa-1', expect.objectContaining({ tipo: 'mover', facturaId: ultima, modo: 'manual' }));
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

describe('el orden en que el chofer cargó las facturas', () => {
  it('una factura sin pin queda entre las que se cargaron justo antes y justo después (y no en el centro de la comuna)', async () => {
    const { facturaId, localId, razonSocial, direccion, comuna, urgente, horarios } = paradaDe('X');
    const sinCoord = { facturaId, localId, razonSocial, direccion, comuna, urgente, horarios, cargadaEn: 2000 };
    // El centro de Santiago (-70.66) queda junto al depósito (-70.7): ahí la parada iría primera o última, no entre A y B.
    const oeste = paradaDe('A', { lat: -33.45, lng: -71.0, cargadaEn: 1000 });
    const este = paradaDe('B', { lat: -33.45, lng: -70.9, cargadaEn: 3000 });
    const s = montar({ pendientes: [este, sinCoord, oeste] });
    const r = await s.planificar(despachador, entrada);
    expect(r.ok && ids(r.value).indexOf('f-X')).toBe(1);
    expect(r.ok && r.value.paradas.find((x) => x.facturaId === 'f-X')).toMatchObject({ ubicacionAproximada: true });
    expect(s.rutas.repo.hechasConUbicacion).toHaveBeenCalled();
  });

  it('si no se pueden leer las ya entregadas, la ruta se calcula igual', async () => {
    const s = montar({ pendientes: [paradaDe('A', { cargadaEn: 1 }), paradaDe('B', { cargadaEn: 2 })] });
    s.rutas.repo.hechasConUbicacion.mockRejectedValueOnce(new Error('caída'));
    expect((await s.planificar(despachador, entrada)).ok).toBe(true);
  });
});

describe('la ruta con tiempos por calles', () => {
  it('pide los tiempos al servicio solo para el depósito, el origen y las paradas con pin, y usa lo que responde (sin el ritmo aprendido)', async () => {
    const viajes = vi.fn(() => Promise.resolve({ minutos: () => 100, conCalles: true }));
    const { facturaId, localId, razonSocial, direccion, comuna, urgente, horarios } = paradaDe('S');
    const sinCoord = { facturaId, localId, razonSocial, direccion, comuna, urgente, horarios };
    const rutas = fakeRutas([paradaDe('A', { lat: -33.45, lng: -70.65 }), paradaDe('B', { lat: -33.46, lng: -70.66 }), sinCoord]);
    const aprendizaje = { parametros: () => Promise.resolve([{ clave: 'ritmo' as const, ambito: 'global', valor: 2, muestras: 50, confianza: 1 }]) };
    const construir = (v?: typeof viajes) => crearServiciosDeRuta({ rutas: rutas.repo, empresas: fakeEmpresas(), camiones: fakeCamionesRuta(), facturas: fakeFacturasRuta(), entregas: fakeEntregasRuta(), jornadas: fakeJornadas(), registro: fakeRegistro(), aprendizaje, ...(v ? { viajes: v } : {}), clock: crearReloj('2026-10-05T10:00:00Z').clock, resolverCamion: resolverDePrueba() });
    const conCalles = await construir(viajes).planificar(despachador, entrada);
    const enLinea = await construir().planificar(despachador, entrada);
    const nodos = (viajes.mock.calls[0] as unknown as [readonly { id: string; rol: string }[]])[0];
    expect(nodos.map((n) => `${n.rol}:${n.id}`).sort()).toEqual(['deposito:__deposito__', 'origen:__origen__', 'parada:f-A', 'parada:f-B']);
    // 100 min por tramo: depósito→A→B→depósito = tres tramos de 100 más dos servicios de 8 min, desde las 08:00 (480).
    expect(conCalles.ok && conCalles.value.regreso).toBeGreaterThanOrEqual(480 + 300);
    expect(enLinea.ok && enLinea.value.regreso).toBeLessThan(480 + 300);
  });

  it('si el servicio de calles falla, la ruta se calcula igual en línea recta', async () => {
    const viajes = vi.fn(() => Promise.reject(new Error('sin red')));
    const servicios = crearServiciosDeRuta({ rutas: fakeRutas([paradaDe('A')]).repo, empresas: fakeEmpresas(), camiones: fakeCamionesRuta(), facturas: fakeFacturasRuta(), entregas: fakeEntregasRuta(), jornadas: fakeJornadas(), registro: fakeRegistro(), viajes, clock: crearReloj('2026-10-05T10:00:00Z').clock, resolverCamion: resolverDePrueba() });
    expect((await servicios.planificar(despachador, entrada)).ok).toBe(true);
  });
});

describe('insignias de verificación en la fila de la ruta', () => {
  it('cada parada dice si su pin y su foto están verificados', async () => {
    const s = montar({ pendientes: [paradaDe('A', { pinVerificado: true, fotoVerificada: true }), paradaDe('B')] });
    const r = await s.planificar(despachador, entrada);
    const por = (id: string) => (r.ok ? r.value.paradas.find((x) => x.facturaId === id) : undefined);
    expect(por('f-A')).toMatchObject({ pinVerificado: true, fotoVerificada: true });
    expect(por('f-B')).not.toHaveProperty('pinVerificado');
    expect(por('f-B')).not.toHaveProperty('fotoVerificada');
  });
});

describe('coordenadas para navegar', () => {
  it('cada parada trae el pin del local; las sin pin no traen coordenadas', async () => {
    const s = montar({ pendientes: [paradaDe('A', { lat: -33.45, lng: -70.65 }), paradaDe('B')] });
    const r = await s.planificar(despachador, entrada);
    expect(r.ok && r.value.paradas.find((x) => x.facturaId === 'f-A')).toMatchObject({ lat: -33.45, lng: -70.65 });
  });
});

describe('acomodar la ruta', () => {
  const planificada = async () => {
    const s = montar();
    const p = await s.planificar(despachador, entrada);
    if (!p.ok) throw new Error('no se planificó');
    return { s, orden: ids(p.value), version: p.value.version ?? 0 };
  };

  it('SUBIR y BAJAR mueven una posición, pasan a modo manual y suben la versión; lo de arriba queda fijado', async () => {
    const { s, orden, version } = await planificada();
    const tercero = orden[2] ?? '';
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'subir', facturaId: tercero } });
    expect(r.ok && ids(r.value).slice(0, 2)).toEqual([orden[0], tercero]);
    expect(r.ok && [...ids(r.value)].sort()).toEqual([...orden].sort());
    expect(r.ok && r.value.paradas.map((p) => p.fijada)).toEqual([true, true, false, false]);
    expect(r.ok && r.value).toMatchObject({ modo: 'manual', version: version + 1 });
    const debajo = r.ok ? (ids(r.value)[2] ?? '') : '';
    const b = await s.operar(despachador, { ...entrada, version: version + 1, operacion: { tipo: 'bajar', facturaId: tercero } });
    expect(b.ok && ids(b.value).slice(0, 3)).toEqual([orden[0], debajo, tercero]);
  });

  it('MOVER (arrastrar y soltar) deja la parada en la posición pedida, pasa a modo manual y sube la versión', async () => {
    const { s, orden, version } = await planificada();
    const ultimo = orden[orden.length - 1] ?? '';
    const alFrente = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'mover', facturaId: ultimo, posicion: 0 } });
    expect(alFrente.ok && ids(alFrente.value)[0]).toBe(ultimo);
    expect(alFrente.ok && alFrente.value).toMatchObject({ modo: 'manual', version: version + 1 });
    const actual = alFrente.ok ? ids(alFrente.value) : [];
    const alMedio = await s.operar(despachador, { ...entrada, version: version + 1, operacion: { tipo: 'mover', facturaId: ultimo, posicion: 2 } });
    expect(alMedio.ok && ids(alMedio.value).slice(0, 3)).toEqual([actual[1], actual[2], ultimo]);
  });

  it('al mover una parada a mano, lo de abajo se ordena solo desde ahí', async () => {
    // Cuatro locales en fila hacia el este del depósito: la ruta va A, B, C, D. Si el chofer pone D primero, lo que queda se ordena desde D.
    const enFila = ['A', 'B', 'C', 'D'].map((n, i) => paradaDe(n, { lat: -33.5, lng: -70.69 + i * 0.01 }));
    const s = montar({ pendientes: enFila });
    const p = await s.planificar(despachador, entrada);
    expect(p.ok && ids(p.value)).toEqual(['f-A', 'f-B', 'f-C', 'f-D']);
    const r = await s.operar(despachador, { ...entrada, version: p.ok ? (p.value.version ?? 0) : 0, operacion: { tipo: 'mover', facturaId: 'f-D', posicion: 0 } });
    expect(r.ok && ids(r.value)).toEqual(['f-D', 'f-C', 'f-B', 'f-A']);
    expect(r.ok && r.value.paradas[0]).toMatchObject({ fijada: true });
  });

  it('con lo de arriba fijado a mano, las facturas nuevas entran debajo y no lo mueven', async () => {
    const { s, orden, version } = await planificada();
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'mover', facturaId: orden[3] ?? '', posicion: 1 } });
    const arriba = r.ok ? ids(r.value).slice(0, 2) : [];
    s.rutas.estado.pendientes = [...s.rutas.estado.pendientes, paradaDe('E')];
    const i = await s.operar(despachador, { ...entrada, version: version + 1, operacion: { tipo: 'insertar' } });
    expect(i.ok && ids(i.value).slice(0, 2)).toEqual(arriba);
    expect(i.ok && ids(i.value)).toContain('f-E');
    expect(i.ok && i.value.modo).toBe('manual');
  });

  it('MOVER con una posición fuera de la lista deja la parada en el extremo', async () => {
    const { s, orden, version } = await planificada();
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'mover', facturaId: orden[0] ?? '', posicion: 99 } });
    expect(r.ok && ids(r.value)).toEqual([...orden.slice(1), orden[0]]);
  });

  it('en modo manual IR PRIMERO la deja al frente y lo que se fijó antes a mano sigue detrás de ella', async () => {
    const { s, orden, version } = await planificada();
    const m = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'subir', facturaId: orden[1] ?? '' } });
    const actual = m.ok ? ids(m.value) : [];
    const ultimo = actual[3] ?? '';
    const r = await s.operar(despachador, { ...entrada, version: version + 1, operacion: { tipo: 'primero', facturaId: ultimo } });
    expect(r.ok && ids(r.value).slice(0, 2)).toEqual([ultimo, orden[1]]);
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
    const mover = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'mover', facturaId: 'f-ZZZ', posicion: 0 } });
    expect(!mover.ok && mover.error.codigo).toBe('NO_ENCONTRADO');
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

describe('lo que se hace manda: avisar una parada que no era la siguiente', () => {
  const enFila = () => ['A', 'B', 'C', 'D'].map((n, i) => paradaDe(n, { lat: -33.5, lng: -70.69 + i * 0.01 }));

  it('si el chofer entregó otra antes de la siguiente, lo que queda se ordena solo desde donde está', async () => {
    const rutas = fakeRutas(enFila());
    const entregas = fakeEntregasRuta();
    const registro = fakeRegistro();
    const s = crearServiciosDeRuta({ rutas: rutas.repo, empresas: fakeEmpresas(), camiones: fakeCamionesRuta(), facturas: fakeFacturasRuta(), entregas, jornadas: fakeJornadas(), registro, clock: crearReloj('2026-10-05T12:00:00Z').clock, resolverCamion: resolverDePrueba() });
    const p = await s.planificar(despachador, entrada);
    expect(p.ok && ids(p.value)).toEqual(['f-A', 'f-B', 'f-C', 'f-D']);
    // Fue directo a D (la última de la lista) y la entregó: el camión está ahí y D ya no está pendiente.
    rutas.estado.pendientes = rutas.estado.pendientes.filter((f) => f.facturaId !== 'f-D');
    entregas.ultimaPosicion.mockResolvedValue({ lat: -33.5, lng: -70.66, en: new Date('2026-10-05T12:00:00Z') });
    expect(await s.reordenarTrasVisita(despachador, CAMION_ID, FECHA, 'f-D')).toBe(true);
    expect(rutas.guardadaActual()?.orden).toEqual(['f-C', 'f-B', 'f-A']);
    expect(registro.registrarOperacion).toHaveBeenLastCalledWith('empresa-1', expect.objectContaining({ tipo: 'ordenar', orden: ['f-C', 'f-B', 'f-A'] }));
  });

  it('si siguió la lista, no se toca nada', async () => {
    const s = montar({ pendientes: enFila() });
    await s.planificar(despachador, entrada);
    s.rutas.estado.pendientes = s.rutas.estado.pendientes.filter((f) => f.facturaId !== 'f-A');
    const llamadas = s.rutas.repo.guardar.mock.calls.length;
    expect(await s.reordenarTrasVisita(despachador, CAMION_ID, FECHA, 'f-A')).toBe(false);
    expect(s.rutas.repo.guardar.mock.calls.length).toBe(llamadas);
  });
});

describe('por dónde parte la ruta (configuración de la empresa)', () => {
  // Tres locales hacia el este del depósito (-33.5, -70.7): el 1.º a ~2 km, el 2.º a ~7 km y el 3.º a ~15 km.
  const locales = () => [paradaDe('B', { lat: -33.5, lng: -70.62 }), paradaDe('C', { lat: -33.5, lng: -70.54 }), paradaDe('A', { lat: -33.5, lng: -70.68 })];
  const conOrden = (ordenInicio?: 'automatico' | 'lejano' | 'cercano') => montar({ pendientes: locales(), config: { ...CONFIG, ...(ordenInicio ? { ordenInicio } : {}) } });

  it('«más lejano» parte por lo más lejano del depósito', async () => {
    const r = await conOrden('lejano').planificar(despachador, entrada);
    expect(r.ok && ids(r.value)).toEqual(['f-C', 'f-B', 'f-A']);
  });

  it('«más cercano» parte por lo más cercano al depósito', async () => {
    const r = await conOrden('cercano').planificar(despachador, entrada);
    expect(r.ok && ids(r.value)).toEqual(['f-A', 'f-B', 'f-C']);
  });

  it('sin elegir, el sistema decide como siempre (hacia lo cercano)', async () => {
    const sinElegir = await conOrden().planificar(despachador, entrada);
    const automatico = await conOrden('automatico').planificar(despachador, entrada);
    expect(sinElegir.ok && ids(sinElegir.value)).toEqual(['f-A', 'f-B', 'f-C']);
    expect(automatico.ok && ids(automatico.value)).toEqual(sinElegir.ok ? ids(sinElegir.value) : []);
  });
});

describe('«las agrego en orden»: la ruta es el orden en que el chofer cargó las facturas', () => {
  // Cargadas D, A, C, B: un orden que el sistema no elegiría por cercanía.
  const cargadas = () => [paradaDe('B', { cargadaEn: 4000 }), paradaDe('D', { cargadaEn: 1000 }), paradaDe('C', { cargadaEn: 3000 }), paradaDe('A', { cargadaEn: 2000 })];
  const enOrden = async () => {
    const s = montar({ pendientes: cargadas() });
    const p = await s.planificar(despachador, { ...entrada, orden: 'carga' });
    if (!p.ok) throw new Error('no se planificó');
    return { s, version: p.value.version ?? 0, vista: p.value };
  };

  it('planificar con orden «carga» respeta el orden de carga, lo guarda en modo «carga» y lo anota para aprender', async () => {
    const registro = fakeRegistro();
    const s = montar({ pendientes: cargadas(), registro });
    const r = await s.planificar(despachador, { ...entrada, orden: 'carga' });
    expect(r.ok && ids(r.value)).toEqual(['f-D', 'f-A', 'f-C', 'f-B']);
    expect(r.ok && r.value).toMatchObject({ planificada: true, modo: 'carga', version: 1 });
    expect(s.rutas.repo.guardar.mock.calls[0]?.[1]).toMatchObject({ modo: 'carga', orden: ['f-D', 'f-A', 'f-C', 'f-B'], fijas: [] });
    expect(registro.registrarOperacion).toHaveBeenCalledWith('empresa-1', expect.objectContaining({ tipo: 'planificar', modo: 'carga' }));
    // las horas de llegada siguen siendo reales y crecientes
    const llegadas = r.ok ? r.value.paradas.map((p) => p.llegada) : [];
    expect(llegadas).toEqual([...llegadas].sort((a, b) => a - b));
  });

  it('sin indicar el orden se calcula como siempre', async () => {
    const s = montar({ pendientes: cargadas() });
    const r = await s.planificar(despachador, { ...entrada, orden: 'calcular' });
    expect(r.ok && r.value.modo).toBe('sugerida');
  });

  it('lo que el chofer mueve a mano queda donde lo dejó: nada se reordena solo y sigue en modo «carga»', async () => {
    const { s, version } = await enOrden();
    const a = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'mover', facturaId: 'f-B', posicion: 1 } });
    expect(a.ok && ids(a.value)).toEqual(['f-D', 'f-B', 'f-A', 'f-C']);
    expect(a.ok && a.value.modo).toBe('carga');
    const b = await s.operar(despachador, { ...entrada, version: version + 1, operacion: { tipo: 'subir', facturaId: 'f-C' } });
    expect(b.ok && ids(b.value)).toEqual(['f-D', 'f-B', 'f-C', 'f-A']);
    const c = await s.operar(despachador, { ...entrada, version: version + 2, operacion: { tipo: 'primero', facturaId: 'f-A' } });
    expect(c.ok && ids(c.value)).toEqual(['f-A', 'f-D', 'f-B', 'f-C']);
    const d = await s.operar(despachador, { ...entrada, version: version + 3, operacion: { tipo: 'despues', facturaId: 'f-A' } });
    expect(d.ok && ids(d.value)).toEqual(['f-D', 'f-B', 'f-C', 'f-A']);
    expect(d.ok && d.value.modo).toBe('carga');
  });

  it('las facturas que se agregan después entran al final, en su orden de carga', async () => {
    const { s, version } = await enOrden();
    s.rutas.estado.pendientes = [...cargadas(), paradaDe('F', { cargadaEn: 6000 }), paradaDe('E', { cargadaEn: 5000 })];
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'insertar' } });
    expect(r.ok && ids(r.value)).toEqual(['f-D', 'f-A', 'f-C', 'f-B', 'f-E', 'f-F']);
    expect(r.ok && r.value.modo).toBe('carga');
  });

  it('quitar una parada no reordena las demás', async () => {
    const { s, version } = await enOrden();
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'quitar', facturaId: 'f-A' } });
    expect(r.ok && ids(r.value)).toEqual(['f-D', 'f-C', 'f-B']);
    expect(r.ok && r.value.modo).toBe('carga');
  });

  it('CALCULAR MI RUTA («ordenar») saca la ruta del orden de carga: la ordena el sistema', async () => {
    const { s, version } = await enOrden();
    const r = await s.operar(despachador, { ...entrada, version, operacion: { tipo: 'ordenar' } });
    expect(r.ok && r.value.modo).toBe('sugerida');
    expect(r.ok && [...ids(r.value)].sort()).toEqual(['f-A', 'f-B', 'f-C', 'f-D']);
  });

  it('avisar una parada fuera de orden no reordena lo que queda', async () => {
    const { s } = await enOrden();
    const antes = s.rutas.guardadaActual()?.orden;
    const reordenada = await s.reordenarTrasVisita(despachador, CAMION_ID, FECHA, 'f-C');
    expect(reordenada).toBe(false);
    expect(s.rutas.guardadaActual()?.orden).toEqual(antes);
  });

  it('volver a planificar sin indicar el orden reemplaza la ruta por una calculada', async () => {
    const { s } = await enOrden();
    const r = await s.planificar(despachador, entrada);
    expect(r.ok && r.value.modo).toBe('sugerida');
  });
});
