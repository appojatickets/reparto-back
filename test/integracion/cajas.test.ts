import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { PostgresCajasRepository } from '../../src/adapters/out/postgres/repositorio-cajas.js';
import { PostgresJornadaRepository } from '../../src/adapters/out/postgres/repositorio-jornadas.js';
import { PostgresCamionRepository } from '../../src/adapters/out/postgres/repositorio-camiones.js';
import { abrirDb, crearEmpresa, crearUsuario } from './utils.js';
const db=abrirDb();afterAll(()=>db.destroy());
describe('cajas por persona y carga física compartida',()=>{
 it('no duplica carga, controla revisiones, preserva decimales y aísla empresas y personas',async()=>{
  const empresa=await crearEmpresa(db);const otra=await crearEmpresa(db);
  const u1=await crearUsuario(db,empresa,'chofer','cajas1');const u2=await crearUsuario(db,empresa,'chofer','cajas2');
  const camion=await new PostgresCamionRepository(db).crear(empresa,{patente:'CAJA12'});if(!camion.ok)throw Error('camion');
  const jornadas=new PostgresJornadaRepository(db);const desde=new Date('2026-10-19T12:00:00Z');
  const a=await jornadas.iniciar(empresa,u1,camion.value.id,'2026-10-19',desde);const b=await jornadas.iniciar(empresa,u2,camion.value.id,'2026-10-19',desde);if(!a.ok||!b.ok)throw Error('jornada');
  const cajas=new PostgresCajasRepository(db);
  expect(await cajas.guardar(empresa,a.value,desde,{cargadasCamion:100.5,cargadasUsuario:100.5,revision:0},desde)).toBe(true);
  expect(await cajas.actual(empresa,b.value.id,{camionId:camion.value.id,fecha:'2026-10-19',desde})).toMatchObject({registrada:false,cargadasCamion:100.5,cargadasUsuario:0,revision:1});
  expect(await cajas.guardar(empresa,b.value,desde,{cargadasCamion:100.5,cargadasUsuario:100.5,revision:0},desde)).toBe(false);
  expect(await cajas.guardar(empresa,b.value,desde,{cargadasCamion:100.5,cargadasUsuario:100.5,revision:1},desde)).toBe(true);
  expect(await cajas.actual(otra,a.value.id)).toBeUndefined();
  expect(await cajas.cerrar(empresa,a.value,{porCerrado:0.5,rebajes:3.5,rebajesCamion:4,ultimo:false},desde)).toBe(true);
  expect(await cajas.cerrar(empresa,b.value,{porCerrado:0.5,rebajes:3.5,rebajesCamion:4,ultimo:false},desde)).toBe(true);
  expect(await cajas.cerrar(empresa,a.value,{porCerrado:0.5,rebajes:3.5,rebajesCamion:4,ultimo:false},desde)).toBe(true);
  await db.insertInto('posicion_camion').values([u1,u2].flatMap((usuario_id,i)=>[
   {empresa_id:empresa,camion_id:camion.value.id,usuario_id,lat:-33.5,lng:-70.7,precision_m:10+i*10,velocidad_ms:null,tomado_en:desde},
   {empresa_id:empresa,camion_id:camion.value.id,usuario_id,lat:-33.501,lng:-70.7,precision_m:10+i*10,velocidad_ms:null,tomado_en:new Date('2026-10-19T12:01:00Z')},
  ])).execute();
  const historial=await cajas.historial(empresa,'2026-10');expect(historial).toHaveLength(2);
  expect(new Set(historial.map(f=>f.cargaId)).size).toBe(1);
  expect(historial[0]?.km).toBeCloseTo(0.111,2);expect(historial[0]?.kmCamion).toBeCloseTo(0.11,2);expect(historial[1]?.kmCamion).toBe(historial[0]?.kmCamion);
  expect(historial[0]).toMatchObject({cargadas:100.5,porCerrado:0.5,rebajes:3.5,cargadasCamion:100.5,rebajesCamion:4,tarifa:15});
  expect(await cajas.historial(empresa,'2026-10',u1)).toHaveLength(1);expect(await cajas.historial(otra,'2026-10')).toEqual([]);
  expect((await sql<{n:number}>`select count(*)::int n from caja_carga where empresa_id=${empresa}::uuid`.execute(db)).rows[0]?.n).toBe(1);
 });
});
