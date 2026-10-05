import { describe, expect, it } from 'vitest';
import { esDeCamion, puede, TODOS_LOS_PERMISOS, type Permiso, type Rol } from './permisos.js';

const roles: Rol[] = ['admin', 'despachador', 'chofer', 'ayudante'];

describe('permisos por rol', () => {
  it('solo el admin exporta datos', () => {
    expect(roles.filter((r) => puede(r, 'datos:exportar'))).toEqual(['admin']);
  });

  it('el admin puede todo', () => {
    for (const p of TODOS_LOS_PERMISOS) expect(puede('admin', p)).toBe(true);
  });

  it('el chofer NO accede a métricas, usuarios, importaciones, edición de clientes, camiones ni configuración', () => {
    const prohibidos: Permiso[] = ['metricas:leer', 'usuarios:gestionar', 'clientes:importar', 'clientes:escribir', 'pines:revisar', 'camiones:gestionar', 'empresa:configurar'];
    for (const p of prohibidos) expect(puede('chofer', p)).toBe(false);
  });

  it('el chofer carga sus facturas, ve su ruta, busca clientes y elige su camión del día', () => {
    for (const p of ['facturas:leer', 'facturas:escribir', 'rutas:leer', 'rutas:escribir', 'clientes:leer', 'clientes:crear', 'jornada:gestionar'] as const) expect(puede('chofer', p)).toBe(true);
  });

  it('chofer y ayudante (los del camión) tienen exactamente los mismos permisos', () => {
    expect([...TODOS_LOS_PERMISOS].filter((p) => puede('ayudante', p))).toEqual([...TODOS_LOS_PERMISOS].filter((p) => puede('chofer', p)));
    expect(esDeCamion('ayudante')).toBe(true);
    expect(esDeCamion('despachador')).toBe(false);
  });

  it('jornada y avisos de entrega: los del camión y el admin (el despachador solo avisa, no tiene jornada)', () => {
    expect(roles.filter((r) => puede(r, 'jornada:gestionar'))).toEqual(['admin', 'chofer', 'ayudante']);
    expect(roles.filter((r) => puede(r, 'entregas:registrar'))).toEqual(['admin', 'despachador', 'chofer', 'ayudante']);
  });

  it('el despachador gestiona clientes y pines, pero no usuarios ni métricas', () => {
    expect(puede('despachador', 'clientes:leer')).toBe(true);
    expect(puede('despachador', 'clientes:escribir')).toBe(true);
    expect(puede('despachador', 'pines:revisar')).toBe(true);
    expect(puede('despachador', 'usuarios:gestionar')).toBe(false);
    expect(puede('despachador', 'metricas:leer')).toBe(false);
    expect(puede('despachador', 'clientes:importar')).toBe(false);
    expect(puede('despachador', 'facturas:escribir')).toBe(true);
    expect(puede('despachador', 'facturas:leer')).toBe(true);
    expect(puede('despachador', 'camiones:gestionar')).toBe(false);
    expect(puede('despachador', 'rutas:escribir')).toBe(true);
    expect(puede('despachador', 'empresa:configurar')).toBe(false);
  });

  it('solo el admin ve métricas (regla de negocio central)', () => {
    expect(roles.filter((r) => puede(r, 'metricas:leer'))).toEqual(['admin']);
  });

  it('chofer y despachador pueden proponer pines y subir archivos', () => {
    for (const r of ['chofer', 'despachador'] as const) {
      expect(puede(r, 'pines:proponer')).toBe(true);
      expect(puede(r, 'archivos:subir')).toBe(true);
    }
  });
});
