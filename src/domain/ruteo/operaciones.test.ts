import { describe, expect, it } from 'vitest';
import { agregarParada, insertarNuevas, moverAlFrente, moverAPosicion, moverParada, ordenarPendientes, posponer, quitar, type EstadoRuta } from './operaciones.js';
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

describe('moverParada (SUBIR / BAJAR)', () => {
  const fijo = (): EstadoRuta => {
    const problema = problemaPlano([parada('A'), parada('B'), parada('C'), parada('D')]);
    return { problema, orden: ['A', 'B', 'C', 'D'] };
  };

  it('sube y baja una posición exactamente, sin reordenar el resto', () => {
    const arriba = moverParada(fijo(), 'C', -1);
    expect(arriba.ok && arriba.value.solucion.orden).toEqual(['A', 'C', 'B', 'D']);
    const abajo = moverParada(fijo(), 'A', 1);
    expect(abajo.ok && abajo.value.solucion.orden).toEqual(['B', 'A', 'C', 'D']);
  });

  it('en los extremos no cambia nada', () => {
    const a = moverParada(fijo(), 'A', -1);
    const d = moverParada(fijo(), 'D', 1);
    expect(a.ok && a.value.solucion.orden).toEqual(['A', 'B', 'C', 'D']);
    expect(d.ok && d.value.solucion.orden).toEqual(['A', 'B', 'C', 'D']);
  });

  it('recalcula las horas con el nuevo orden y respeta las fijadas que siguen al frente', () => {
    const e = { problema: { ...fijo().problema, fijas: ['A'] }, orden: ['A', 'B', 'C', 'D'] };
    const r = moverParada(e, 'C', -1);
    expect(r.ok && r.value.problema.fijas).toEqual(['A']);
    const sube = moverParada(e, 'B', -1); // B pasa delante de A: A deja de ser prefijo, ya no está fijada
    expect(sube.ok && sube.value.solucion.orden).toEqual(['B', 'A', 'C', 'D']);
    expect(sube.ok && sube.value.problema.fijas).toEqual([]);
    expect(r.ok && r.value.solucion.detalle.map((d) => d.llegada)).toEqual([490, 505, 520, 535]);
  });

  it('una parada desconocida es un error', () => {
    const r = moverParada(fijo(), 'Z', 1);
    expect(!r.ok && r.error.codigo).toBe('PARADA_NO_ENCONTRADA');
  });
});

describe('moverAPosicion (arrastrar y soltar)', () => {
  const fijo = (): EstadoRuta => {
    const problema = problemaPlano([parada('A'), parada('B'), parada('C'), parada('D')]);
    return { problema, orden: ['A', 'B', 'C', 'D'] };
  };

  it('deja la parada exactamente en la posición pedida, sin reordenar el resto', () => {
    const alMedio = moverAPosicion(fijo(), 'A', 2);
    expect(alMedio.ok && alMedio.value.solucion.orden).toEqual(['B', 'C', 'A', 'D']);
    const alFrente = moverAPosicion(fijo(), 'D', 0);
    expect(alFrente.ok && alFrente.value.solucion.orden).toEqual(['D', 'A', 'B', 'C']);
    const alFinal = moverAPosicion(fijo(), 'B', 3);
    expect(alFinal.ok && alFinal.value.solucion.orden).toEqual(['A', 'C', 'D', 'B']);
  });

  it('soltarla donde estaba no cambia nada', () => {
    const r = moverAPosicion(fijo(), 'C', 2);
    expect(r.ok && r.value.solucion.orden).toEqual(['A', 'B', 'C', 'D']);
  });

  it('una posición fuera de la lista se acota a los extremos', () => {
    const abajo = moverAPosicion(fijo(), 'A', 99);
    expect(abajo.ok && abajo.value.solucion.orden).toEqual(['B', 'C', 'D', 'A']);
    const arriba = moverAPosicion(fijo(), 'D', -5);
    expect(arriba.ok && arriba.value.solucion.orden).toEqual(['D', 'A', 'B', 'C']);
  });

  it('recalcula las horas con el nuevo orden y cumple las invariantes', () => {
    const r = moverAPosicion(fijo(), 'C', 0);
    expect(r.ok && r.value.solucion.orden).toEqual(['C', 'A', 'B', 'D']);
    expect(r.ok && r.value.solucion.detalle.map((d) => d.llegada)).toEqual([490, 505, 520, 535]);
    expect(r.ok && verificarInvariantes(r.value.problema, r.value.solucion)).toEqual([]);
  });

  it('una fijada solo sigue fijada mientras siga encabezando la ruta', () => {
    const e = { problema: { ...fijo().problema, fijas: ['A'] }, orden: ['A', 'B', 'C', 'D'] };
    const debajo = moverAPosicion(e, 'D', 2);
    expect(debajo.ok && debajo.value.solucion.orden).toEqual(['A', 'B', 'D', 'C']);
    expect(debajo.ok && debajo.value.problema.fijas).toEqual(['A']);
    const encima = moverAPosicion(e, 'C', 0); // C pasa delante de A: A deja de encabezar y ya no está fijada
    expect(encima.ok && encima.value.solucion.orden).toEqual(['C', 'A', 'B', 'D']);
    expect(encima.ok && encima.value.problema.fijas).toEqual([]);
  });

  it('una parada desconocida es un error', () => {
    const r = moverAPosicion(fijo(), 'Z', 1);
    expect(!r.ok && r.error.codigo).toBe('PARADA_NO_ENCONTRADA');
  });
});

describe('insertarNuevas (solo insertar, sin reordenar lo que ya está)', () => {
  it('mantiene el orden existente y coloca la nueva en su mejor lugar', () => {
    const problema = problemaPlano([parada('A'), parada('B'), parada('C'), parada('N')]);
    const r = insertarNuevas({ problema, orden: ['C', 'A', 'B'] });
    expect(r.solucion.orden.filter((x) => x !== 'N')).toEqual(['C', 'A', 'B']);
    expect(r.solucion.orden).toHaveLength(4);
    expect(verificarInvariantes(r.problema, r.solucion)).toEqual([]);
  });

  it('sin paradas nuevas devuelve el mismo orden', () => {
    const problema = problemaPlano([parada('A'), parada('B')]);
    expect(insertarNuevas({ problema, orden: ['B', 'A'] }).solucion.orden).toEqual(['B', 'A']);
  });

  it('una nueva con ventana dura temprana entra al frente sin tocar el resto', () => {
    const problema = problemaPlano([parada('A'), parada('B'), parada('N', { ventanas: [v(480, 495)] })]);
    expect(insertarNuevas({ problema, orden: ['B', 'A'] }).solucion.orden).toEqual(['N', 'B', 'A']);
  });
});
