import { describe, expect, it } from 'vitest';
import { atenciones, calidadDeJornada, capacidadAprendida, cierresFrecuentes, completarConVisitas, mediana, pinesDudosos, pinesSugeridos, ritmoAprendido, servicioAprendido, tramosDeViaje, visitasDeducidas, type EventoObs, type LocalObs, type OperacionObs, type PosicionObs } from './analisis.js';

const T0 = Date.parse('2026-10-05T13:00:00Z'); // 10:00 en Chile (verano)
const en = (min: number): Date => new Date(T0 + min * 60_000);
const ev = (facturaId: string, tipo: EventoObs['tipo'], min: number, extra: Partial<EventoObs> = {}): EventoObs => ({ facturaId, localId: `l-${facturaId}`, camionId: 'cam-1', tipo, creadoEn: en(min), ...extra });
const DEPOSITO = { lat: -33.5, lng: -70.7 };
const local = (id: string, lat: number, lng: number, comuna = 'San Bernardo'): LocalObs => ({ id, comuna, lat, lng });

describe('mediana', () => {
  it('toma el valor del medio y no la mueve un dato extremo', () => {
    expect(mediana([3, 1, 100])).toBe(3);
    expect(mediana([4, 2])).toBe(3);
    expect(mediana([])).toBeUndefined();
  });
});

describe('tiempo de atención por local', () => {
  it('mide desde que llegó hasta que entregó; no cuenta locales cerrados ni esperas de más de una hora', () => {
    const r = atenciones([
      ev('a', 'llegada', 0), ev('a', 'entregado', 10),
      ev('b', 'llegada', 0), ev('b', 'cerrado', 3), ev('b', 'no_entregado', 4),
      ev('c', 'llegada', 0), ev('c', 'entregado', 90),
      ev('d', 'entregado', 5),
    ]);
    expect(r.map((o) => [o.facturaId, o.minutos])).toEqual([['a', 10]]);
  });

  it('un local necesita al menos 2 visitas para tener tiempo propio y el valor se corre desde el de respaldo', () => {
    const obs = (id: string, minutos: number, dias: number) => ({ localId: id, facturaId: `${id}${dias}`, minutos, cuando: en(dias * 1440) });
    const p = servicioAprendido([obs('x', 20, 0), obs('y', 20, 0), obs('y', 20, 1)]);
    expect(p.find((q) => q.ambito === 'local:x')).toBeUndefined();
    const y = p.find((q) => q.ambito === 'local:y');
    expect(y?.valor).toBeCloseTo(14.12, 2); // 8 → 11,6 → 14,12 (alfa 0,3)
    expect(y).toMatchObject({ clave: 'servicio_min', muestras: 2 });
    expect(y?.confianza).toBeCloseTo(2 / 6, 2);
  });

  it('con 5 o más atenciones publica también la mediana general', () => {
    const obs = [8, 10, 12, 14, 30].map((m, i) => ({ localId: `l${i}`, facturaId: `f${i}`, minutos: m, cuando: en(i) }));
    expect(servicioAprendido(obs).find((q) => q.ambito === 'global')).toMatchObject({ valor: 12, muestras: 5 });
  });
});

describe('ritmo de viaje', () => {
  const locales = new Map([['l-a', local('l-a', -33.5, -70.7)], ['l-b', local('l-b', -33.545, -70.7, 'Buin')]]);
  it('compara lo que tardó el camión entre dos paradas con lo que calculaba el motor', () => {
    const t = tramosDeViaje([ev('a', 'llegada', 0), ev('a', 'entregado', 10), ev('b', 'llegada', 40), ev('b', 'entregado', 50)], locales);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ camionId: 'cam-1', comunaDestino: 'Buin', minutosReales: 30 });
    expect(t[0]?.minutosPlanificados).toBeGreaterThan(5); // ≈ 5 km × 1,35 a 30 km/h ≈ 13,5 min
    expect(t[0]?.minutosPlanificados).toBeLessThan(25);
  });

  it('no mide paradas sin pin ni tramos sin llegada registrada', () => {
    expect(tramosDeViaje([ev('a', 'llegada', 0), ev('a', 'entregado', 10), ev('z', 'llegada', 40), ev('z', 'entregado', 50)], locales)).toHaveLength(0);
    expect(tramosDeViaje([ev('a', 'llegada', 0), ev('a', 'entregado', 10), ev('b', 'entregado', 50)], locales)).toHaveLength(0);
  });

  const tramos = (n: number, factor: number) => Array.from({ length: n }, () => ({ minutosReales: 10 * factor, minutosPlanificados: 10, camionId: 'cam-1', comunaDestino: 'Buin' }));
  it('con pocos tramos no publica nada; con algunos se acerca a 1,0 y con muchos al observado', () => {
    expect(ritmoAprendido(tramos(4, 2))).toEqual([]);
    const poco = ritmoAprendido(tramos(5, 2)).find((p) => p.ambito === 'global');
    expect(poco?.valor).toBeCloseTo(1.2, 2); // (5·2 + 20·1) / 25
    const mucho = ritmoAprendido(tramos(40, 2)).find((p) => p.ambito === 'camion:cam-1');
    expect(mucho?.valor).toBeCloseTo(1.667, 2); // (40·2 + 20) / 60
    expect(mucho?.confianza).toBe(1);
    expect(ritmoAprendido(tramos(5, 2)).map((p) => p.ambito).sort()).toEqual(['camion:cam-1', 'comuna:Buin', 'global']);
  });

  it('un tramo con pausa larga (almuerzo) no cuenta como ritmo', () => {
    const t = [...tramos(5, 1), { minutosReales: 90, minutosPlanificados: 10, camionId: 'cam-1', comunaDestino: 'Buin' }];
    expect(ritmoAprendido(t).find((p) => p.ambito === 'global')?.muestras).toBe(5);
  });

  it('el ritmo queda acotado para que un dato raro no vuelva absurda la ruta', () => {
    expect(ritmoAprendido(tramos(200, 3.9)).find((p) => p.ambito === 'global')?.valor).toBe(2.5);
  });
});

describe('capacidad del camión', () => {
  const r = (fecha: string, atendidas: number, duracionMin?: number, camionId = 'c1') => ({ camionId, fecha, atendidas, ...(duracionMin !== undefined ? { duracionMin } : {}) });

  it('necesita 3 días con entregas y usa la mediana', () => {
    expect(capacidadAprendida([r('2026-10-01', 30), r('2026-10-02', 20)])).toEqual([]);
    const p = capacidadAprendida([r('2026-10-01', 30, 480), r('2026-10-02', 20, 500), r('2026-10-03', 33, 520)]);
    expect(p.find((q) => q.clave === 'capacidad_paradas' && q.ambito === 'camion:c1')?.valor).toBe(30);
    expect(p.find((q) => q.clave === 'duracion_jornada_min' && q.ambito === 'global')?.valor).toBe(500);
  });

  it('si el chofer cierra y abre la ruta varias veces en el día, se suma por día y no por jornada; las jornadas de segundos no cuentan', () => {
    const p = capacidadAprendida([
      r('2026-10-01', 13, 190), r('2026-10-01', 22, 170), r('2026-10-01', 3, 2), // un día de 38 entregas en 360 min
      r('2026-10-02', 30, 400), r('2026-10-03', 28, 380),
    ]);
    expect(p.find((q) => q.clave === 'capacidad_paradas' && q.ambito === 'global')).toMatchObject({ valor: 30, muestras: 3 });
    expect(p.find((q) => q.clave === 'duracion_jornada_min' && q.ambito === 'global')?.valor).toBe(380);
  });

  it('un día con casi nada (probar la app) no dice cuántas entregas caben', () => {
    expect(capacidadAprendida([r('2026-10-01', 1), r('2026-10-02', 2), r('2026-10-03', 1)])).toEqual([]);
  });
});

describe('calidad de la ruta: lo sugerido frente a lo manejado', () => {
  // Cuatro paradas sobre una línea hacia el este del depósito.
  const locales = new Map([1, 2, 3, 4].map((n) => [`l-f${n}`, local(`l-f${n}`, -33.5, -70.7 + n * 0.02)] as const));
  const jornada = { id: 'j-1', camionId: 'cam-1', fecha: '2026-10-05', desde: en(-30), hasta: en(200) };
  const sugerida: OperacionObs = { camionId: 'cam-1', fecha: '2026-10-05', tipo: 'planificar', modo: 'sugerida', orden: ['f1', 'f2', 'f3', 'f4'], creadoEn: en(-20) };
  const visitas = (orden: string[]): EventoObs[] => orden.flatMap((id, i) => [ev(id, 'llegada', i * 20), ev(id, 'entregado', i * 20 + 5)]);

  it('si se maneja en el orden sugerido no hay diferencias', () => {
    const q = calidadDeJornada(jornada, visitas(['f1', 'f2', 'f3', 'f4']), [sugerida], locales, DEPOSITO);
    expect(q).toMatchObject({ jornadaId: 'j-1', comparadas: 4, inversiones: 0 });
    expect(q?.distRealM).toBe(q?.distSugeridaM);
  });

  it('si se cambia el orden cuenta los pares invertidos y el largo real sube', () => {
    const q = calidadDeJornada(jornada, visitas(['f1', 'f3', 'f2', 'f4']), [sugerida], locales, DEPOSITO);
    expect(q?.inversiones).toBe(1);
    expect(q?.distRealM).toBeGreaterThan(q?.distSugeridaM ?? Infinity);
  });

  it('usa lo último que calculó el sistema antes de salir, no los movimientos manuales de la persona', () => {
    const manual: OperacionObs = { ...sugerida, tipo: 'subir', modo: 'manual', orden: ['f2', 'f1', 'f3', 'f4'], creadoEn: en(-10) };
    const q = calidadDeJornada(jornada, visitas(['f2', 'f1', 'f3', 'f4']), [sugerida, manual], locales, DEPOSITO);
    expect(q?.inversiones).toBe(1);
  });

  it('«ir primero» lo recalcula el sistema: cuenta como lo que sugirió, no como corrección de la persona', () => {
    const primero: OperacionObs = { ...sugerida, tipo: 'primero', modo: 'sugerida', orden: ['f3', 'f1', 'f2', 'f4'], creadoEn: en(-15) };
    const q = calidadDeJornada(jornada, visitas(['f3', 'f1', 'f2', 'f4']), [sugerida, primero], locales, DEPOSITO);
    expect(q?.inversiones).toBe(0);
  });

  it('con menos de 3 paradas en común no compara', () => {
    expect(calidadDeJornada(jornada, visitas(['f1', 'f2']), [sugerida], locales, DEPOSITO)).toBeUndefined();
  });
});

describe('pines corregidos por las visitas', () => {
  const locales = new Map<string, LocalObs>([['l-p', { ...local('l-p', -33.5, -70.7), pinVerificado: true }]]);
  const visita = (dias: number, dLat = 0.012, extra: Partial<EventoObs> = {}): EventoObs => ({ facturaId: `p${dias}`, localId: 'l-p', tipo: 'llegada', lat: -33.5 + dLat, lng: -70.7, precisionM: 10, creadoEn: en(dias * 1440), usuarioId: 'u-1', ...extra });

  it('tres visitas coherentes en días distintos y lejos del pin proponen moverlo', () => {
    const r = pinesSugeridos([visita(0), visita(1), visita(2)], locales);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ localId: 'l-p', visitas: 3, usuarioId: 'u-1' });
    expect(r[0]?.desplazamientoM).toBeGreaterThan(1000);
  });

  it('un pin por verificar no se propone: se ajusta solo con las entregas', () => {
    const porVerificar = new Map<string, LocalObs>([['l-p', local('l-p', -33.5, -70.7)]]);
    expect(pinesSugeridos([visita(0), visita(1), visita(2)], porVerificar)).toEqual([]);
  });

  it('no propone si las visitas son pocas, del mismo día, imprecisas, dispersas o ya coinciden con el pin', () => {
    expect(pinesSugeridos([visita(0), visita(1)], locales)).toEqual([]);
    expect(pinesSugeridos([visita(0), visita(0, 0.012, { facturaId: 'x' }), visita(0, 0.012, { facturaId: 'y' })], locales)).toEqual([]);
    expect(pinesSugeridos([visita(0, 0.012, { precisionM: 300 }), visita(1, 0.012, { precisionM: 300 }), visita(2, 0.012, { precisionM: 300 })], locales)).toEqual([]);
    expect(pinesSugeridos([visita(0, 0.012), visita(1, -0.02), visita(2, 0.05)], locales)).toEqual([]);
    expect(pinesSugeridos([visita(0, 0.0003), visita(1, 0.0003), visita(2, 0.0003)], locales)).toEqual([]);
  });
});

describe('locales encontrados cerrados', () => {
  it('lista los que se encontraron cerrados 2 o más veces, con las horas en que pasó', () => {
    const r = cierresFrecuentes([
      ev('a', 'cerrado', 0), ev('a', 'cerrado', 1440 + 60), ev('a', 'entregado', 2 * 1440),
      ev('b', 'cerrado', 0), ev('b', 'entregado', 1440),
      ev('c', 'no_entregado', 0, { motivo: 'cerrado' }), ev('c', 'no_entregado', 1440, { motivo: 'cerrado' }),
    ]);
    expect(r.map((x) => [x.localId, x.cerrados, x.intentos])).toEqual([['l-a', 2, 3], ['l-c', 2, 2]]);
    expect(r[0]?.horasCerrado).toEqual([10, 11]);
    expect(r[0]?.confianzaAbierto).toBeCloseTo(2 / 5, 2);
  });
});

describe('visitas que se deducen del recorrido', () => {
  const LOCAL = local('l-fa', -33.5, -70.7);
  const locales = new Map([['l-fa', LOCAL]]);
  const punto = (min: number, dLat: number, extra: Partial<PosicionObs> = {}): PosicionObs => ({ camionId: 'cam-1', lat: -33.5 + dLat, lng: -70.7, tomadoEn: en(min), ...extra });
  const LEJOS = 0.02;
  const CERCA = 0.0002;
  // El chofer toca ENTREGADO apenas llega (minuto 5) y se queda hasta el 11.
  const entrega = ev('fa', 'entregado', 5);

  it('llegó a mitad de camino entre el último punto lejos y el primero cerca, y se fue a mitad entre el último cerca y el primero lejos', () => {
    const v = visitasDeducidas([entrega], locales, [punto(0, LEJOS), punto(4, CERCA), punto(8, CERCA), punto(12, LEJOS)]);
    expect(v).toHaveLength(1);
    expect(v[0]?.llegada.getTime()).toBe(en(2).getTime());
    expect(v[0]?.salida.getTime()).toBe(en(10).getTime());
  });

  it('con una entrega avisada al llegar, la atención sale del tiempo junto al pin y no de los segundos hasta el aviso', () => {
    const v = visitasDeducidas([entrega], locales, [punto(0, LEJOS), punto(4, CERCA), punto(8, CERCA), punto(12, LEJOS)]);
    const { eventos, salidas } = completarConVisitas([entrega], v);
    expect(atenciones(eventos, salidas).map((a) => a.minutos)).toEqual([8]);
    expect(atenciones(eventos).map((a) => a.minutos)).toEqual([3]); // sin recorrido solo se sabe hasta el aviso
  });

  it('si el camión pasó antes por el lugar y volvió, vale el último tramo', () => {
    const v = visitasDeducidas([ev('fa', 'entregado', 9)], locales, [punto(1, CERCA), punto(3, LEJOS), punto(7, CERCA), punto(9, CERCA), punto(13, LEJOS)]);
    expect(v[0]?.llegada.getTime()).toBe(en(5).getTime());
    expect(v[0]?.salida.getTime()).toBe(en(11).getTime());
  });

  it('con un hueco grande en el recorrido (la app estuvo cerrada) no inventa la mitad: usa el primer punto cerca', () => {
    const v = visitasDeducidas([entrega], locales, [punto(-30, LEJOS), punto(4, CERCA), punto(8, CERCA), punto(40, LEJOS)]);
    expect(v[0]?.llegada.getTime()).toBe(en(4).getTime());
    expect(v[0]?.salida.getTime()).toBe(en(8).getTime());
  });

  it('no inventa visitas: sin pin, sin recorrido cerca, con GPS impreciso, de otro camión o con un solo punto sin vecinos', () => {
    const recorrido = [punto(0, LEJOS), punto(4, CERCA), punto(8, CERCA), punto(12, LEJOS)];
    expect(visitasDeducidas([entrega], new Map([['l-fa', { id: 'l-fa', comuna: 'X' }]]), recorrido)).toEqual([]);
    expect(visitasDeducidas([entrega], locales, [punto(0, LEJOS), punto(12, LEJOS)])).toEqual([]);
    expect(visitasDeducidas([entrega], locales, [punto(4, CERCA, { precisionM: 300 }), punto(8, CERCA, { precisionM: 300 })])).toEqual([]);
    expect(visitasDeducidas([entrega], locales, recorrido.map((p) => ({ ...p, camionId: 'otro' })))).toEqual([]);
    expect(visitasDeducidas([entrega], locales, [punto(4, CERCA)])).toEqual([]);
  });

  it('respeta el aviso de llegada que dio una persona y solo agrega las que faltan', () => {
    const v = visitasDeducidas([entrega, ev('fa', 'llegada', 3)], locales, [punto(0, LEJOS), punto(4, CERCA), punto(8, CERCA), punto(12, LEJOS)]);
    const r = completarConVisitas([entrega, ev('fa', 'llegada', 3)], v);
    expect(r.llegadasDeducidas).toBe(0);
    expect(r.eventos.filter((e) => e.tipo === 'llegada')).toHaveLength(1);
    expect(r.salidas.get('fa')?.getTime()).toBe(en(10).getTime());
  });

  it('el viaje entre paradas se mide desde que el camión se fue de la anterior, no desde que se avisó la entrega', () => {
    const dos = new Map([['l-fa', LOCAL], ['l-fb', local('l-fb', -33.545, -70.7, 'Buin')]]);
    const eventos = [ev('fa', 'entregado', 5), ev('fb', 'entregado', 40)];
    const recorrido = [punto(0, LEJOS), punto(4, CERCA), punto(8, CERCA), punto(12, LEJOS), { camionId: 'cam-1', lat: -33.545 + 0.0002, lng: -70.7, tomadoEn: en(36) }, { camionId: 'cam-1', lat: -33.545 + 0.0002, lng: -70.7, tomadoEn: en(42) }, { camionId: 'cam-1', lat: -33.5, lng: -70.7, tomadoEn: en(60) }];
    const { eventos: conLlegadas, salidas } = completarConVisitas(eventos, visitasDeducidas(eventos, dos, recorrido));
    const t = tramosDeViaje(conLlegadas, dos, salidas);
    expect(t).toHaveLength(1);
    expect(t[0]?.minutosReales).toBeLessThan(30); // 10 → ~34 con las mitades: menos que los 35 min entre avisos
    expect(tramosDeViaje(conLlegadas, dos)[0]?.minutosReales).toBeGreaterThan(t[0]?.minutosReales ?? Infinity);
  });
});

describe('entregas avisadas lejos del pin', () => {
  const locales = new Map<string, LocalObs>([['l-x', { id: 'l-x', comuna: 'Buin', lat: -33.5, lng: -70.7, pinFuente: 'manual', pinVerificado: true }], ['l-y', { ...local('l-y', -33.5, -70.7), pinVerificado: true }], ['l-z', local('l-z', -33.5, -70.7)]]);
  const entrega = (id: string, localId: string, dLat: number, extra: Partial<EventoObs> = {}): EventoObs => ({ facturaId: id, localId, camionId: 'cam-1', tipo: 'entregado', lat: -33.5 + dLat, lng: -70.7, precisionM: 10, creadoEn: en(0), ...extra });

  it('lista los locales donde se entregó a más de 150 m del pin, con la distancia y de dónde vino el pin', () => {
    const r = pinesDudosos([entrega('a', 'l-x', 0.0162), entrega('b', 'l-x', 0.0001), entrega('c', 'l-y', 0.0002)], locales);
    expect(r).toEqual([{ localId: 'l-x', distanciaM: 1801, visitas: 2, fuente: 'manual' }]);
    expect(pinesDudosos([entrega('a', 'l-z', 0.0162)], locales)).toEqual([]); // por verificar: ya se corrige solo
  });

  it('ignora el GPS impreciso y los locales sin pin', () => {
    expect(pinesDudosos([entrega('a', 'l-x', 0.0162, { precisionM: 300 })], locales)).toEqual([]);
    expect(pinesDudosos([entrega('a', 'sin-pin', 0.0162)], new Map())).toEqual([]);
  });
});
