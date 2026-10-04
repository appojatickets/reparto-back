import { describe, expect, it } from 'vitest';
import { agregarParada, moverAlFrente, ordenarPendientes, posponer, quitar, type EstadoRuta } from './operaciones.js';
import { optimizar } from './optimizador.js';
import { verificarInvariantes } from './invariantes.js';
import { parada, problemaAleatorio, problemaPlano, tiemposFijos, v } from './problemas.test-util.js';

const estadoInicial = (): EstadoRuta => {
  const problema = problemaPlano([parada('A'), parada('B'), parada('C'), parada('D')]);
  return { problema, orden: optimizar(problema).orden };
};

describe('agregarParada (+ AGREGAR PARADA)', () => {
  it('inserta la parada nueva y devuelve su posición y ETA', () => {
    const e = estadoInicial();
    const r = agregarParada(e, parada('N'), tiemposFijos(10));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.solucion.orden).toHaveLength(5);
    expect(r.value.posicion).toBe(r.value.solucion.orden.indexOf('N'));
    expect(r.value.eta).toBe(r.value.solucion.detalle[r.value.posicion ?? 0]?.llegada);
    expect(verificarInvariantes(r.value.problema, r.value.solucion)).toEqual([]);
  });

  it('una parada con ventana dura cercana se coloca al frente', () => {
    const r = agregarParada(estadoInicial(), parada('N', { ventanas: [v(480, 495)] }), tiemposFijos(10));
    expect(r.ok && r.value.posicion).toBe(0);
  });

  it('una parada ya vencida no tiene posición y queda en no atendidas', () => {
    const e = { ...estadoInicial(), problema: { ...estadoInicial().problema, salida: 700 } };
    const r = agregarParada(e, parada('N', { ventanas: [v(480, 500)] }), tiemposFijos(10));
    expect(r.ok && r.value.posicion).toBeNull();
    expect(r.ok && r.value.eta).toBeNull();
    expect(r.ok && r.value.solucion.noAtendidas.map((x) => x.paradaId)).toEqual(['N']);
  });

  it('rechaza una parada repetida', () => {
    const r = agregarParada(estadoInicial(), parada('A'), tiemposFijos(10));
    expect(!r.ok && r.error.codigo).toBe('PARADA_DUPLICADA');
  });
});

describe('moverAlFrente (IR PRIMERO A ESTA)', () => {
  it('la parada pasa a ser la siguiente y queda fijada', () => {
    const e = estadoInicial();
    const ultima = e.orden[e.orden.length - 1] ?? '';
    const r = moverAlFrente(e, ultima);
    expect(r.ok && r.value.solucion.orden[0]).toBe(ultima);
    expect(r.ok && r.value.problema.fijas).toEqual([ultima]);
    expect(r.ok && r.value.solucion.detalle[0]?.motivos).toContain('FIJADA_POR_CHOFER');
  });

  it('una segunda petición pasa por delante de la anterior', () => {
    const e = estadoInicial();
    const primera = moverAlFrente(e, 'C');
    if (!primera.ok) throw new Error('falló');
    const segunda = moverAlFrente({ problema: primera.value.problema, orden: primera.value.solucion.orden }, 'D');
    expect(segunda.ok && segunda.value.solucion.orden.slice(0, 2)).toEqual(['D', 'C']);
  });

  it('una parada desconocida es un error de negocio', () => {
    const r = moverAlFrente(estadoInicial(), 'ZZZ');
    expect(!r.ok && r.error.codigo).toBe('PARADA_NO_ENCONTRADA');
  });
});

describe('posponer (DEJAR PARA DESPUÉS)', () => {
  it('saca la parada de la siguiente posición y la reinserta más atrás', () => {
    const e = estadoInicial();
    const siguiente = e.orden[0] ?? '';
    const r = posponer(e, siguiente);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.solucion.orden[0]).not.toBe(siguiente);
    expect(r.value.solucion.orden.indexOf(siguiente)).toBeGreaterThan(0);
    expect(r.value.solucion.orden).toHaveLength(4);
  });

  it('si estaba fijada deja de estarlo', () => {
    const base = estadoInicial();
    const f = moverAlFrente(base, 'D');
    if (!f.ok) throw new Error('falló');
    const r = posponer({ problema: f.value.problema, orden: f.value.solucion.orden }, 'D');
    expect(r.ok && r.value.problema.fijas).toEqual([]);
  });

  it('la última parada no puede retrasarse más: queda donde está', () => {
    const e = estadoInicial();
    const ultima = e.orden[e.orden.length - 1] ?? '';
    const r = posponer(e, ultima);
    expect(r.ok && r.value.solucion.orden).toEqual(e.orden);
  });

  it('una parada desconocida es un error de negocio', () => {
    const r = posponer(estadoInicial(), 'ZZZ');
    expect(!r.ok && r.error.codigo).toBe('PARADA_NO_ENCONTRADA');
  });
});

describe('quitar (QUITAR)', () => {
  it('retira la parada y deja una ruta válida', () => {
    const e = estadoInicial();
    const r = quitar(e, 'B');
    expect(r.ok && r.value.solucion.orden).not.toContain('B');
    expect(r.ok && r.value.solucion.orden).toHaveLength(3);
    expect(r.ok && verificarInvariantes(r.value.problema, r.value.solucion)).toEqual([]);
  });

  it('también la quita de las fijadas', () => {
    const f = moverAlFrente(estadoInicial(), 'B');
    if (!f.ok) throw new Error('falló');
    const r = quitar({ problema: f.value.problema, orden: f.value.solucion.orden }, 'B');
    expect(r.ok && r.value.problema.fijas).toEqual([]);
  });

  it('una parada desconocida es un error de negocio', () => {
    const r = quitar(estadoInicial(), 'ZZZ');
    expect(!r.ok && r.error.codigo).toBe('PARADA_NO_ENCONTRADA');
  });
});

describe('ordenarPendientes (ORDENAR LO QUE QUEDA)', () => {
  it('nunca empeora un orden dado y respeta las fijadas', () => {
    const problema = { ...problemaAleatorio(21, 12), fijas: ['p4'] };
    const malo = problema.paradas.map((p) => p.id); // orden arbitrario
    const antes = optimizar(problema, { ordenInicial: malo, presupuesto: { reloj: () => 10_000, limiteMs: 1 } });
    const r = ordenarPendientes({ problema, orden: malo });
    expect(r.solucion.costo).toBeLessThanOrEqual(antes.costo + 1e-6);
    expect(r.solucion.orden[0]).toBe('p4');
    expect(verificarInvariantes(r.problema, r.solucion)).toEqual([]);
  });
});
