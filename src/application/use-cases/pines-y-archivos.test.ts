import { describe, expect, it } from 'vitest';
import { crearObtenerUrlFoto, crearQuitarFotoLocal, crearRegistrarFotoLocal, crearSolicitarUrlSubida } from './archivos.js';
import { crearListarPropuestasPin, crearResolverPropuestaPin } from './pines.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeAlmacen, fakeClientes, fakePines, fallaAlmacen, idsFijos, localDe } from './fakes-clientes.test-util.js';

const chofer = usuarioDe({ id: 'u-ch', rol: 'chofer' });
const { clock } = crearReloj();
const admin = usuarioDe();
const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('revisión de propuestas de pin', () => {
  it('listar usa la empresa del actor y acota el límite', async () => {
    const pines = fakePines();
    await crearListarPropuestasPin({ pines })(admin, 'pendiente', 99999);
    expect(pines.listar).toHaveBeenCalledWith('empresa-1', 'pendiente', 500);
  });

  it('aceptar y rechazar pasan por el repositorio con quién y cuándo', async () => {
    const pines = fakePines();
    const { clock } = crearReloj();
    const resolver = crearResolverPropuestaPin({ pines, clock });
    expect((await resolver(admin, 'p-1', 'aceptar')).ok).toBe(true);
    expect(pines.resolver).toHaveBeenCalledWith('empresa-1', 'p-1', 'u-admin', true, clock.now());
    await resolver(admin, 'p-2', 'rechazar');
    expect(pines.resolver.mock.calls[1]?.[3]).toBe(false);
  });

  it.each([
    ['NO_ENCONTRADA', 'NO_ENCONTRADO'],
    ['YA_RESUELTA', 'CONFLICTO'],
    ['SIN_LOCAL', 'VALIDACION'],
  ] as const)('traduce %s a %s', async (falla, codigo) => {
    const pines = fakePines();
    pines.resolver.mockResolvedValueOnce({ ok: false, error: falla });
    const r = await crearResolverPropuestaPin({ pines, clock: crearReloj().clock })(admin, 'p-1', 'aceptar');
    expect(!r.ok && r.error.codigo).toBe(codigo);
  });
});

describe('fotos de fachada (URL firmada)', () => {
  const setup = () => {
    const clientes = fakeClientes([localDe()]);
    const almacen = fakeAlmacen();
    return { clientes, almacen, subir: crearSolicitarUrlSubida({ clientes, almacen, ids: idsFijos(UUID) }) };
  };

  it('arma el path con empresa/local/uuid del servidor y devuelve la URL de subida', async () => {
    const { subir, almacen } = setup();
    const r = await subir(chofer, { localId: 'l-1', tipo: 'webp' });
    expect(r.ok && r.value.path).toBe(`empresa-1/l-1/${UUID}.webp`);
    expect(r.ok && r.value.url).toContain('token=');
    expect(almacen.crearUrlSubida).toHaveBeenCalledWith(`empresa-1/l-1/${UUID}.webp`);
  });

  it('un local inexistente o de otra empresa no genera URL', async () => {
    const { subir, almacen } = setup();
    expect((await subir(usuarioDe({ empresaId: 'otra' }), { localId: 'l-1', tipo: 'jpeg' })).ok).toBe(false);
    expect((await subir(chofer, { localId: 'zzz', tipo: 'jpeg' })).ok).toBe(false);
    expect(almacen.crearUrlSubida).not.toHaveBeenCalled();
  });

  it('si el almacenamiento falla es un error de servicio', async () => {
    const clientes = fakeClientes([localDe()]);
    const r = await crearSolicitarUrlSubida({ clientes, almacen: fallaAlmacen(), ids: idsFijos(UUID) })(chofer, { localId: 'l-1', tipo: 'webp' });
    expect(!r.ok && r.error.codigo).toBe('SERVICIO_EXTERNO');
  });

  it('registrar la foto solo acepta un path de este local y empresa', async () => {
    const clientes = fakeClientes([localDe()]);
    const registrar = crearRegistrarFotoLocal({ clientes, clock });
    expect((await registrar(chofer, 'l-1', `empresa-1/l-1/${UUID}.webp`)).ok).toBe(true);
    expect(clientes.actualizarLocal).toHaveBeenCalledWith('empresa-1', 'l-1', { fotoPath: `empresa-1/l-1/${UUID}.webp`, fotoPor: 'u-ch', fotoEn: new Date('2026-10-05T12:00:00.000Z') });
    for (const malo of [`otra/l-1/${UUID}.webp`, `empresa-1/l-2/${UUID}.webp`, `empresa-1/l-1/${UUID}.png`, `empresa-1/l-1/../x/${UUID}.webp`, 'x']) {
      const r = await registrar(chofer, 'l-1', malo);
      expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    }
  });

  it('al cambiar la foto se borra la anterior del almacenamiento (y si falla el borrado igual queda la nueva)', async () => {
    const almacen = fakeAlmacen();
    const nueva = `empresa-1/l-1/${UUID}.webp`;
    const clientes = fakeClientes([localDe({ fotoPath: 'empresa-1/l-1/vieja.webp' })]);
    expect((await crearRegistrarFotoLocal({ clientes, almacen, clock })(chofer, 'l-1', nueva)).ok).toBe(true);
    expect(almacen.eliminar).toHaveBeenCalledWith('empresa-1/l-1/vieja.webp');
    const sinAnterior = fakeAlmacen();
    await crearRegistrarFotoLocal({ clientes: fakeClientes([localDe()]), almacen: sinAnterior, clock })(chofer, 'l-1', nueva);
    expect(sinAnterior.eliminar).not.toHaveBeenCalled();
    const r = await crearRegistrarFotoLocal({ clientes: fakeClientes([localDe({ fotoPath: 'x' })]), almacen: fallaAlmacen(), clock })(chofer, 'l-1', nueva);
    expect(r.ok).toBe(true);
  });

  it('quitar la foto la saca del local y del almacenamiento; repetirlo no falla; un local inexistente es NO_ENCONTRADO', async () => {
    const almacen = fakeAlmacen();
    const clientes = fakeClientes([localDe({ fotoPath: 'empresa-1/l-1/x.webp' })]);
    const quitar = crearQuitarFotoLocal({ clientes, almacen });
    expect((await quitar(admin, 'l-1')).ok).toBe(true);
    expect(clientes.quitarFoto).toHaveBeenCalledWith('empresa-1', 'l-1');
    expect(almacen.eliminar).toHaveBeenCalledWith('empresa-1/l-1/x.webp');
    const sinFoto = fakeClientes([localDe()]);
    expect((await crearQuitarFotoLocal({ clientes: sinFoto, almacen })(admin, 'l-1')).ok).toBe(true);
    expect(sinFoto.quitarFoto).not.toHaveBeenCalled();
    const no = await quitar(admin, 'otro');
    expect(!no.ok && no.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('registrar en un local inexistente es NO_ENCONTRADO', async () => {
    const r = await crearRegistrarFotoLocal({ clientes: fakeClientes([]), clock })(chofer, 'l-1', `empresa-1/l-1/${UUID}.webp`);
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('obtener la URL de lectura: firma 5 minutos; sin foto es NO_ENCONTRADO', async () => {
    const almacen = fakeAlmacen();
    const conFoto = crearObtenerUrlFoto({ clientes: fakeClientes([localDe({ fotoPath: 'empresa-1/l-1/x.webp' })]), almacen });
    const r = await conFoto(admin, 'l-1');
    expect(r.ok && r.value.expiraEnSegundos).toBe(300);
    expect(almacen.crearUrlLectura).toHaveBeenCalledWith('empresa-1/l-1/x.webp', 300);
    const sinFoto = await crearObtenerUrlFoto({ clientes: fakeClientes([localDe()]), almacen })(admin, 'l-1');
    expect(!sinFoto.ok && sinFoto.error.codigo).toBe('NO_ENCONTRADO');
    const caido = await crearObtenerUrlFoto({ clientes: fakeClientes([localDe({ fotoPath: 'p' })]), almacen: fallaAlmacen() })(admin, 'l-1');
    expect(!caido.ok && caido.error.codigo).toBe('SERVICIO_EXTERNO');
  });
});
