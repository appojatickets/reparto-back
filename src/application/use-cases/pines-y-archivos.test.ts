import { describe, expect, it } from 'vitest';
import { crearObtenerUrlFoto, crearRegistrarFotoLocal, crearSolicitarUrlSubida } from './archivos.js';
import { crearImportarPines, crearListarPropuestasPin, crearResolverPropuestaPin } from './pines.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeAlmacen, fakeClientes, fakePines, fallaAlmacen, idsFijos, localDe } from './fakes-clientes.test-util.js';

const chofer = usuarioDe({ id: 'u-ch', rol: 'chofer' });
const admin = usuarioDe();
const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('importarPines', () => {
  const pin = { rut: '12.345.678-5', direccion: 'Av. Providencia 1234', lat: -33.4372, lng: -70.6506 };

  it('un pin con local asociado queda pendiente, con la distancia al pin actual', async () => {
    const clientes = fakeClientes();
    clientes.coincidenciaDeDireccion.mockResolvedValue({ localId: 'l-1', lat: -33.4372, lng: -70.6496 });
    const pines = fakePines();
    const r = await crearImportarPines({ clientes, pines })(chofer, [pin]);
    expect(r.ok && r.value).toMatchObject({ recibidas: 1, pendientes: 1, sinLocal: 0, errores: [] });
    const [empresa, proponente, propuestas] = pines.crearLote.mock.calls[0] ?? [];
    expect([empresa, proponente]).toEqual(['empresa-1', 'u-ch']);
    expect(propuestas?.[0]).toMatchObject({ localId: 'l-1', estado: 'pendiente', rut: '12345678-5' });
    expect(propuestas?.[0]?.distanciaActualM).toBeGreaterThan(80);
  });

  it('sin local coincidente queda «sin_local»; las filas inválidas se informan y no se guardan', async () => {
    const pines = fakePines();
    const r = await crearImportarPines({ clientes: fakeClientes(), pines })(chofer, [pin, { direccion: '', lat: 1, lng: 1 }]);
    expect(r.ok && r.value).toMatchObject({ recibidas: 2, pendientes: 0, sinLocal: 1 });
    expect(r.ok && r.value.errores).toHaveLength(1);
    expect(r.ok && r.value.errores[0]?.fila).toBe(2);
    expect(pines.crearLote.mock.calls[0]?.[2]).toHaveLength(1);
  });

  it('un lote vacío o gigante se rechaza; si todo es inválido no guarda nada', async () => {
    const pines = fakePines();
    const importar = crearImportarPines({ clientes: fakeClientes(), pines });
    expect((await importar(chofer, [])).ok).toBe(false);
    expect((await importar(chofer, Array.from({ length: 501 }, () => pin))).ok).toBe(false);
    await importar(chofer, [{ direccion: '' }]);
    expect(pines.crearLote).not.toHaveBeenCalled();
  });
});

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
    const registrar = crearRegistrarFotoLocal({ clientes });
    expect((await registrar(chofer, 'l-1', `empresa-1/l-1/${UUID}.webp`)).ok).toBe(true);
    expect(clientes.actualizarLocal).toHaveBeenCalledWith('empresa-1', 'l-1', { fotoPath: `empresa-1/l-1/${UUID}.webp` });
    for (const malo of [`otra/l-1/${UUID}.webp`, `empresa-1/l-2/${UUID}.webp`, `empresa-1/l-1/${UUID}.png`, `empresa-1/l-1/../x/${UUID}.webp`, 'x']) {
      const r = await registrar(chofer, 'l-1', malo);
      expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    }
  });

  it('registrar en un local inexistente es NO_ENCONTRADO', async () => {
    const r = await crearRegistrarFotoLocal({ clientes: fakeClientes([]) })(chofer, 'l-1', `empresa-1/l-1/${UUID}.webp`);
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
