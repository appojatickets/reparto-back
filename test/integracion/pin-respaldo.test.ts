import { afterAll, describe, expect, it } from 'vitest';
import { PostgresCamionRepository } from '../../src/adapters/out/postgres/repositorio-camiones.js';
import { PostgresClienteRepository } from '../../src/adapters/out/postgres/repositorio-clientes.js';
import { PostgresEntregaRepository } from '../../src/adapters/out/postgres/repositorio-entregas.js';
import { PostgresFacturaRepository } from '../../src/adapters/out/postgres/repositorio-facturas.js';
import { crearObtenerLocal } from '../../src/application/use-cases/obtener-local.js';
import { abrirDb, crearEmpresa, crearUsuario } from './utils.js';

const db = abrirDb();
const clientes = new PostgresClienteRepository(db);
const entregas = new PostgresEntregaRepository(db);
const facturas = new PostgresFacturaRepository(db);
const camiones = new PostgresCamionRepository(db);
afterAll(() => db.destroy());

const PIN = { lat: -33.5, lng: -70.7 };

/** Un local con pin, y una forma de anotar entregas suyas en la fecha y el lugar que se quiera. */
const sembrar = async () => {
  const empresa = await crearEmpresa(db);
  const usuario = await crearUsuario(db, empresa, 'chofer', `c${Math.random().toString(36).slice(2, 8)}`);
  await clientes.importar(empresa, [{ claveCliente: 'a', razonSocial: 'Kiosko Sol', locales: [{ claveLocal: 'a|1', direccion: 'Calle 1 10', comuna: 'Maipú', ...PIN, indices: [0] }] }]);
  const local = (await db.selectFrom('local').select('id').where('empresa_id', '=', empresa).executeTakeFirstOrThrow()).id;
  const camion = await camiones.crear(empresa, { patente: 'ABCD12' });
  if (!camion.ok) throw new Error('camión');
  const entregar = async (dia: string, dLat: number, precisionM = 10, tipo: 'entregado' | 'llegada' = 'entregado') => {
    const f = await facturas.crear(empresa, { localId: local, fecha: dia, camionId: camion.value.id, urgente: false, creadoPor: usuario });
    if (!f.ok) throw new Error('factura');
    await entregas.registrar(empresa, { tipo, facturaId: f.value.id, localId: local, camionId: camion.value.id, usuarioId: usuario, lat: PIN.lat + dLat, lng: PIN.lng, precisionM });
    await db.updateTable('entrega_evento').set({ creado_en: new Date(`${dia}T15:00:00Z`) }).where('factura_id', '=', f.value.id).execute();
  };
  const actor = { id: usuario, empresaId: empresa, rol: 'admin' as const, username: 'admin', nombre: 'Admin', activo: true, editor: false };
  return { empresa, local, entregar, actor };
};

describe('qué tan firme es el pin según las entregas (Postgres real)', () => {
  it('trae solo ENTREGADO con buen GPS, la más reciente primero, con su fecha, y respeta el límite y la empresa', async () => {
    const s = await sembrar();
    await s.entregar('2026-10-05', 0);
    await s.entregar('2026-10-07', 0.0001);
    await s.entregar('2026-10-06', 0, 10, 'llegada'); // una llegada no es una entrega
    const todas = await entregas.visitasConGps(s.empresa, s.local, 10);
    expect(todas.map((v) => v.en.toISOString().slice(0, 10))).toEqual(['2026-10-07', '2026-10-05']);
    expect(todas[0]).toMatchObject({ lat: PIN.lat + 0.0001, precisionM: 10 });
    expect(await entregas.visitasConGps(s.empresa, s.local, 1)).toHaveLength(1);
    expect(await entregas.visitasConGps((await sembrar()).empresa, s.local, 10)).toEqual([]);
  });

  it('la ficha del local trae el nivel: sin respaldo con una entrega, respaldado con dos en días distintos, en conflicto si se contradicen', async () => {
    const s = await sembrar();
    const obtener = crearObtenerLocal({ clientes, entregas });
    const inicial = await obtener(s.actor, s.local);
    expect(inicial.ok && inicial.value.pinRespaldo?.nivel).toBe('sin_respaldo');

    await s.entregar('2026-10-05', 0);
    await s.entregar('2026-10-06', 0.0001);
    const respaldado = await obtener(s.actor, s.local);
    expect(respaldado.ok && respaldado.value.pinRespaldo).toMatchObject({ nivel: 'respaldado', entregas: 2, dias: 2 });

    const otra = await sembrar();
    await otra.entregar('2026-10-05', 0.004);
    await otra.entregar('2026-10-06', -0.004); // ~900 m entre sí: no coinciden
    const conflicto = await crearObtenerLocal({ clientes, entregas })(otra.actor, otra.local);
    expect(conflicto.ok && conflicto.value.pinRespaldo?.nivel).toBe('en_conflicto');
  });
});
