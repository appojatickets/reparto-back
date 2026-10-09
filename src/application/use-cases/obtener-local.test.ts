import { describe, expect, it } from 'vitest';
import type { VisitaConGps } from '../../domain/entidades/respaldo-del-pin.js';
import { usuarioDe } from './fakes.test-util.js';
import { fakeClientes, localDe } from './fakes-clientes.test-util.js';
import { fakeEntregasRuta } from './fakes-rutas.test-util.js';
import { crearObtenerLocal } from './obtener-local.js';

const admin = usuarioDe({ id: 'u-admin' });
const conPin = { lat: -33.5, lng: -70.7, pinEstado: 'sugerido' as const };
const visita = (dia: string, dLat = 0): VisitaConGps => ({ lat: -33.5 + dLat, lng: -70.7, precisionM: 10, en: new Date(`${dia}T15:00:00Z`) });

describe('ficha del local: qué tan firme es su pin', () => {
  it('con entregas que coinciden en días distintos el pin sale «respaldado» y trae cuántas y a qué distancia', async () => {
    const entregas = fakeEntregasRuta();
    entregas.visitasConGps.mockResolvedValueOnce([visita('2026-10-07'), visita('2026-10-06', 0.0001)]);
    const r = await crearObtenerLocal({ clientes: fakeClientes([localDe(conPin)]), entregas })(admin, 'l-1');
    expect(r.ok && r.value.pinRespaldo).toMatchObject({ nivel: 'respaldado', entregas: 2, dias: 2 });
    expect(entregas.visitasConGps).toHaveBeenCalledWith('empresa-1', 'l-1', expect.any(Number));
  });

  it('un pin que una persona verificó sale «verificado»', async () => {
    const r = await crearObtenerLocal({ clientes: fakeClientes([localDe({ ...conPin, pinVerificado: true })]), entregas: fakeEntregasRuta() })(admin, 'l-1');
    expect(r.ok && r.value.pinRespaldo?.nivel).toBe('verificado');
  });

  it('un pin sin entregas sale «sin respaldo»', async () => {
    const r = await crearObtenerLocal({ clientes: fakeClientes([localDe(conPin)]), entregas: fakeEntregasRuta() })(admin, 'l-1');
    expect(r.ok && r.value.pinRespaldo).toEqual({ nivel: 'sin_respaldo', entregas: 0, dias: 0 });
  });

  it('un local sin pin no trae nivel y ni siquiera consulta las entregas', async () => {
    const entregas = fakeEntregasRuta();
    const r = await crearObtenerLocal({ clientes: fakeClientes([localDe()]), entregas })(admin, 'l-1');
    expect(r.ok && r.value.pinRespaldo).toBeUndefined();
    expect(entregas.visitasConGps).not.toHaveBeenCalled();
  });

  it('si no se pueden leer las entregas, la ficha igual se entrega (sin el nivel)', async () => {
    const entregas = fakeEntregasRuta();
    entregas.visitasConGps.mockRejectedValueOnce(new Error('base lenta'));
    const r = await crearObtenerLocal({ clientes: fakeClientes([localDe(conPin)]), entregas })(admin, 'l-1');
    expect(r.ok && r.value.id).toBe('l-1');
    expect(r.ok && r.value.pinRespaldo).toBeUndefined();
  });

  it('un local que no existe (o es de otra empresa) es NO_ENCONTRADO', async () => {
    const r = await crearObtenerLocal({ clientes: fakeClientes([]), entregas: fakeEntregasRuta() })(admin, 'l-9');
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });
});
