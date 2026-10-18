import { describe, expect, it } from 'vitest';
import { crearObtenerUrlFotoUsuario, crearQuitarFotoPerfil, crearRegistrarFotoPerfil, crearSolicitarUrlSubidaPerfil } from './foto-perfil.js';
import { crearReloj, fakeUsuarios, usuarioDe } from './fakes.test-util.js';
import { fakeAlmacen, fallaAlmacen, idsFijos } from './fakes-clientes.test-util.js';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const PATH = `empresa-1/perfil/u-ch/${UUID}.webp`;
const chofer = usuarioDe({ id: 'u-ch', rol: 'chofer', username: 'jperez', nombre: 'Juan' });
const { clock } = crearReloj();

describe('foto de perfil', () => {
  it('pide una URL de subida en la carpeta de quien la pide (la empresa y el usuario salen del servidor)', async () => {
    const almacen = fakeAlmacen();
    const r = await crearSolicitarUrlSubidaPerfil({ almacen, ids: idsFijos(UUID) })(chofer, { tipo: 'webp' });
    expect(r.ok && r.value.path).toBe(PATH);
    expect(almacen.crearUrlSubida).toHaveBeenCalledWith(PATH);
  });

  it('si el almacenamiento falla es un error de servicio', async () => {
    const r = await crearSolicitarUrlSubidaPerfil({ almacen: fallaAlmacen(), ids: idsFijos(UUID) })(chofer, { tipo: 'jpeg' });
    expect(!r.ok && r.error.codigo).toBe('SERVICIO_EXTERNO');
  });

  it('registra la foto subida con la hora, y borra la anterior del almacenamiento', async () => {
    const { repo, filas } = fakeUsuarios([{ ...chofer, fotoPath: `empresa-1/perfil/u-ch/vieja.webp` }]);
    const almacen = fakeAlmacen();
    const r = await crearRegistrarFotoPerfil({ usuarios: repo, almacen, clock })(chofer, PATH);
    expect(r.ok).toBe(true);
    expect(filas.get('u-ch')).toMatchObject({ fotoPath: PATH, fotoEn: clock.now() });
    expect(almacen.eliminar).toHaveBeenCalledWith('empresa-1/perfil/u-ch/vieja.webp');
  });

  it('sin foto anterior no borra nada; si el borrado falla igual queda la nueva', async () => {
    const { repo, filas } = fakeUsuarios([chofer]);
    const almacen = fakeAlmacen();
    expect((await crearRegistrarFotoPerfil({ usuarios: repo, almacen, clock })(chofer, PATH)).ok).toBe(true);
    expect(almacen.eliminar).not.toHaveBeenCalled();
    const otra = `empresa-1/perfil/u-ch/${UUID.replace('123e', '999e')}.jpeg`;
    expect((await crearRegistrarFotoPerfil({ usuarios: repo, almacen: fallaAlmacen(), clock })(chofer, otra)).ok).toBe(true);
    expect(filas.get('u-ch')?.fotoPath).toBe(otra);
  });

  it.each([
    ['la de otro usuario', `empresa-1/perfil/u-otro/${UUID}.webp`],
    ['la de otra empresa', `empresa-2/perfil/u-ch/${UUID}.webp`],
    ['una foto de local', `empresa-1/l-1/${UUID}.webp`],
    ['otra extensión', `empresa-1/perfil/u-ch/${UUID}.png`],
    ['una ruta con ..', `empresa-1/perfil/u-ch/../${UUID}.webp`],
  ])('no acepta %s', async (_n, path) => {
    const { repo, filas } = fakeUsuarios([chofer]);
    const r = await crearRegistrarFotoPerfil({ usuarios: repo, almacen: fakeAlmacen(), clock })(chofer, path);
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(filas.get('u-ch')?.fotoPath).toBeUndefined();
  });

  it('quitar la foto la saca del perfil y del almacenamiento; repetirlo no falla', async () => {
    const { repo, filas } = fakeUsuarios([{ ...chofer, fotoPath: PATH, fotoEn: clock.now() }]);
    const almacen = fakeAlmacen();
    const quitar = crearQuitarFotoPerfil({ usuarios: repo, almacen });
    expect((await quitar({ ...chofer, fotoPath: PATH })).ok).toBe(true);
    expect(filas.get('u-ch')?.fotoPath).toBeUndefined();
    expect(filas.get('u-ch')?.fotoEn).toBeUndefined();
    expect(almacen.eliminar).toHaveBeenCalledWith(PATH);
    expect((await quitar(chofer)).ok).toBe(true);
    expect(almacen.eliminar).toHaveBeenCalledTimes(1);
  });

  describe('ver la foto de un usuario', () => {
    const colega = usuarioDe({ id: 'u-co', rol: 'ayudante', username: 'mrojas', fotoPath: 'empresa-1/perfil/u-co/x.webp' });
    const ajeno = usuarioDe({ id: 'u-aj', empresaId: 'empresa-2', username: 'zz', fotoPath: 'empresa-2/perfil/u-aj/x.webp' });
    const sinFoto = usuarioDe({ id: 'u-sf', username: 'sf' });

    it('devuelve una URL firmada de 5 minutos para cualquiera de la misma empresa', async () => {
      const almacen = fakeAlmacen();
      const r = await crearObtenerUrlFotoUsuario({ usuarios: fakeUsuarios([colega]).repo, almacen })(chofer, 'u-co');
      expect(r.ok && r.value).toEqual({ url: 'https://alm.test/leer/empresa-1/perfil/u-co/x.webp?token=t', expiraEnSegundos: 300 });
      expect(almacen.crearUrlLectura).toHaveBeenCalledWith('empresa-1/perfil/u-co/x.webp', 300);
    });

    it('un usuario sin foto, uno de otra empresa o uno que no existe son NO_ENCONTRADO', async () => {
      const obtener = crearObtenerUrlFotoUsuario({ usuarios: fakeUsuarios([sinFoto, ajeno]).repo, almacen: fakeAlmacen() });
      for (const id of ['u-sf', 'u-aj', 'u-nadie']) {
        const r = await obtener(chofer, id);
        expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
      }
    });

    it('si el almacenamiento falla es un error de servicio', async () => {
      const r = await crearObtenerUrlFotoUsuario({ usuarios: fakeUsuarios([colega]).repo, almacen: fallaAlmacen() })(chofer, 'u-co');
      expect(!r.ok && r.error.codigo).toBe('SERVICIO_EXTERNO');
    });
  });
});
