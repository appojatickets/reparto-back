import { afterAll, describe, expect, it } from 'vitest';
import { PostgresClienteRepository } from '../../src/adapters/out/postgres/repositorio-clientes.js';
import { PostgresFotoReporteRepository } from '../../src/adapters/out/postgres/repositorio-fotos.js';
import { abrirDb, crearEmpresa, crearUsuario } from './utils.js';

const db = abrirDb();
const clientes = new PostgresClienteRepository(db);
const fotos = new PostgresFotoReporteRepository(db);
afterAll(() => db.destroy());

const DIA = (d: number) => new Date(`2026-10-0${d}T12:00:00.000Z`);

/** Una empresa con tres locales; cada uno con foto subida por el chofer en un día distinto (el 1, el 2 y el 3 de octubre). */
const escenario = async () => {
  const empresa = await crearEmpresa(db);
  const admin = await crearUsuario(db, empresa, 'admin', `admin${empresa.slice(0, 6).replaceAll('-', '')}`);
  const chofer = await crearUsuario(db, empresa, 'chofer', `chofer${empresa.slice(0, 6).replaceAll('-', '')}`);
  await clientes.importar(
    empresa,
    [1, 2, 3].map((n) => ({ claveCliente: `c${n}`, razonSocial: `Cliente ${n}`, locales: [{ claveLocal: `c${n}|d`, direccion: `Calle ${n} 100`, comuna: 'Maipú', indices: [n] }] })),
  );
  const filas = await db.selectFrom('local').select(['id', 'direccion']).where('empresa_id', '=', empresa).orderBy('direccion').execute();
  const locales = filas.map((f) => f.id);
  const paths = locales.map((l, i) => `${empresa}/${l}/foto-${i + 1}.webp`);
  for (const [i, l] of locales.entries()) await clientes.actualizarLocal(empresa, l, { fotoPath: paths[i] ?? '', fotoPor: chofer, fotoEn: DIA(i + 1) });
  return { empresa, admin, chofer, locales, paths };
};

describe('verificación de fotos', () => {
  it('toda foto nueva queda por verificar, la más reciente primero, con quién y cuándo la subió', async () => {
    const { empresa, locales, paths } = await escenario();
    const lista = await fotos.porVerificar(empresa, 10);
    expect(lista.map((f) => f.localId)).toEqual([locales[2], locales[1], locales[0]]);
    expect(lista[0]).toMatchObject({ fotoPath: paths[2], razonSocial: 'Cliente 3', comuna: 'Maipú', subidaEn: DIA(3) });
    expect(lista[0]?.subidaPor).toMatch(/^chofer/);
    expect(await fotos.verificadas(empresa, 10)).toEqual([]);
  });

  it('verificar saca la foto de «por verificar» y la pasa a «verificadas», con quién la verificó y cuándo', async () => {
    const { empresa, admin, locales, paths } = await escenario();
    expect(await clientes.marcarFotoVerificada(empresa, locales[1] ?? '', paths[1] ?? '', { por: admin, en: DIA(5) })).toBe(true);
    expect((await fotos.porVerificar(empresa, 10)).map((f) => f.localId)).toEqual([locales[2], locales[0]]);
    const verificadas = await fotos.verificadas(empresa, 10);
    expect(verificadas).toHaveLength(1);
    expect(verificadas[0]).toMatchObject({ localId: locales[1], fotoPath: paths[1], verificadaEn: DIA(5), subidaEn: DIA(2) });
    expect(verificadas[0]?.verificadaPor).toMatch(/^admin/);
  });

  it('las verificadas salen por fecha de verificación, la más reciente primero', async () => {
    const { empresa, admin, locales, paths } = await escenario();
    await clientes.marcarFotoVerificada(empresa, locales[0] ?? '', paths[0] ?? '', { por: admin, en: DIA(6) });
    await clientes.marcarFotoVerificada(empresa, locales[2] ?? '', paths[2] ?? '', { por: admin, en: DIA(5) });
    expect((await fotos.verificadas(empresa, 10)).map((f) => f.localId)).toEqual([locales[0], locales[2]]);
    expect(await fotos.verificadas(empresa, 1)).toHaveLength(1);
  });

  it('se puede devolver a «por verificar», y repetir lo mismo no falla', async () => {
    const { empresa, admin, locales, paths } = await escenario();
    const [l, p] = [locales[0] ?? '', paths[0] ?? ''];
    expect(await clientes.marcarFotoVerificada(empresa, l, p, { por: admin, en: DIA(5) })).toBe(true);
    expect(await clientes.marcarFotoVerificada(empresa, l, p, { por: admin, en: DIA(5) })).toBe(true);
    expect(await clientes.marcarFotoVerificada(empresa, l, p, undefined)).toBe(true);
    expect(await clientes.marcarFotoVerificada(empresa, l, p, undefined)).toBe(true);
    expect(await fotos.verificadas(empresa, 10)).toEqual([]);
    expect(await fotos.porVerificar(empresa, 10)).toHaveLength(3);
  });

  it('no verifica una foto distinta de la que el admin vio, ni la de otra empresa', async () => {
    const { empresa, admin, locales, paths } = await escenario();
    expect(await clientes.marcarFotoVerificada(empresa, locales[0] ?? '', paths[1] ?? '', { por: admin, en: DIA(5) })).toBe(false);
    expect(await clientes.marcarFotoVerificada(await crearEmpresa(db), locales[0] ?? '', paths[0] ?? '', { por: admin, en: DIA(5) })).toBe(false);
    expect(await fotos.verificadas(empresa, 10)).toEqual([]);
  });

  it('una foto nueva en el local llega sin verificar; quitar la foto también borra la verificación', async () => {
    const { empresa, admin, chofer, locales, paths } = await escenario();
    const [l, p] = [locales[0] ?? '', paths[0] ?? ''];
    await clientes.marcarFotoVerificada(empresa, l, p, { por: admin, en: DIA(5) });
    const nueva = `${empresa}/${l}/nueva.webp`;
    await clientes.actualizarLocal(empresa, l, { fotoPath: nueva, fotoPor: chofer, fotoEn: DIA(7) });
    expect(await fotos.verificadas(empresa, 10)).toEqual([]);
    expect((await fotos.porVerificar(empresa, 10))[0]).toMatchObject({ localId: l, fotoPath: nueva });
    // La verificación de la foto vieja ya no aplica a la nueva.
    expect(await clientes.marcarFotoVerificada(empresa, l, p, { por: admin, en: DIA(8) })).toBe(false);

    await clientes.marcarFotoVerificada(empresa, l, nueva, { por: admin, en: DIA(8) });
    await clientes.quitarFoto(empresa, l);
    expect(await fotos.verificadas(empresa, 10)).toEqual([]);
    expect((await fotos.porVerificar(empresa, 10)).map((f) => f.localId)).not.toContain(l);
    await expect(db.updateTable('local').set({ foto_verificada_en: DIA(9) }).where('id', '=', l).execute()).rejects.toThrow(/local_foto_verificada_con_foto/);
  });

  it('cambiar otros datos del local (nota, pin) no toca la verificación', async () => {
    const { empresa, admin, locales, paths } = await escenario();
    const [l, p] = [locales[0] ?? '', paths[0] ?? ''];
    await clientes.marcarFotoVerificada(empresa, l, p, { por: admin, en: DIA(5) });
    await clientes.actualizarLocal(empresa, l, { nota: 'portón verde' });
    expect((await fotos.verificadas(empresa, 10)).map((f) => f.localId)).toEqual([l]);
  });
});
