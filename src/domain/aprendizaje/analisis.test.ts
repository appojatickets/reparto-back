import { describe, expect, it } from 'vitest';
import { atenciones, calidadDeJornada, capacidadAprendida, cierresFrecuentes, mediana, pinesSugeridos, ritmoAprendido, servicioAprendido, tramosDeViaje, type EventoObs, type LocalObs, type OperacionObs } from './analisis.js';

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
  it('necesita 3 jornadas y usa la mediana', () => {
    expect(capacidadAprendida([{ camionId: 'c1', atendidas: 30 }, { camionId: 'c1', atendidas: 20 }])).toEqual([]);
    const p = capacidadAprendida([{ camionId: 'c1', atendidas: 30, duracionMin: 480 }, { camionId: 'c1', atendidas: 20, duracionMin: 500 }, { camionId: 'c1', atendidas: 33, duracionMin: 520 }]);
    expect(p.find((q) => q.clave === 'capacidad_paradas' && q.ambito === 'camion:c1')?.valor).toBe(30);
    expect(p.find((q) => q.clave === 'duracion_jornada_min' && q.ambito === 'global')?.valor).toBe(500);
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

  it('con menos de 3 paradas en común no compara', () => {
    expect(calidadDeJornada(jornada, visitas(['f1', 'f2']), [sugerida], locales, DEPOSITO)).toBeUndefined();
  });
});

describe('pines corregidos por las visitas', () => {
  const locales = new Map([['l-p', local('l-p', -33.5, -70.7)]]);
  const visita = (dias: number, dLat = 0.012, extra: Partial<EventoObs> = {}): EventoObs => ({ facturaId: `p${dias}`, localId: 'l-p', tipo: 'llegada', lat: -33.5 + dLat, lng: -70.7, precisionM: 10, creadoEn: en(dias * 1440), usuarioId: 'u-1', ...extra });

  it('tres visitas coherentes en días distintos y lejos del pin proponen moverlo', () => {
    const r = pinesSugeridos([visita(0), visita(1), visita(2)], locales);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ localId: 'l-p', visitas: 3, usuarioId: 'u-1' });
    expect(r[0]?.desplazamientoM).toBeGreaterThan(1000);
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
