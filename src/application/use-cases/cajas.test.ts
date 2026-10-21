import { describe,expect,it,vi } from 'vitest';
import { crearControlCajas } from './cajas.js';
import { crearReloj,usuarioDe } from './fakes.test-util.js';
import { fakeJornadas,JORNADA } from './fakes-facturas.test-util.js';
import type { CajasRepository } from '../ports/out/cajas.js';
const montar=()=>{
 const cajas={actual:vi.fn<CajasRepository['actual']>().mockResolvedValue({registrada:true,cargadasCamion:100,cargadasUsuario:50,porCerrado:0,rebajes:0,rebajesCamion:null,revision:1,cerrada:false}),guardar:vi.fn<CajasRepository['guardar']>().mockResolvedValue(true),cerrar:vi.fn<CajasRepository['cerrar']>().mockResolvedValue(true),historial:vi.fn<CajasRepository['historial']>().mockResolvedValue([])};
 const jornadas=fakeJornadas(JORNADA);const {clock}=crearReloj();return{cajas,jornadas,caso:crearControlCajas({cajas,jornadas,clock})};
};
describe('control de cajas ligado a jornadas reales',()=>{
 it('el panel personal y de editor no pueden pedir datos ajenos, el admin consulta la empresa',async()=>{
  const t=montar();await t.caso.historial(usuarioDe({id:'persona',rol:'chofer',editor:true}),'2026-10');expect(t.cajas.historial).toHaveBeenLastCalledWith('empresa-1','2026-10','persona');await t.caso.historial(usuarioDe(),'2026-10');expect(t.cajas.historial).toHaveBeenLastCalledWith('empresa-1','2026-10',undefined);
 });
 it('no admite cantidades imposibles ni modifica repositorio con rebajes excesivos',async()=>{
  const t=montar();expect((await t.caso.guardar(usuarioDe(),{cargadasCamion:10,cargadasUsuario:11,revision:0})).ok).toBe(false);expect((await t.caso.cerrar(usuarioDe(),{porCerrado:20,rebajes:40,rebajesCamion:60})).ok).toBe(false);expect(t.cajas.guardar).not.toHaveBeenCalled();expect(t.cajas.cerrar).not.toHaveBeenCalled();
 });
 it('guarda cantidades fraccionadas en la jornada y camión, sin asumir que una persona representa al equipo',async()=>{
  const t=montar();expect((await t.caso.guardar(usuarioDe(),{cargadasCamion:100.5,cargadasUsuario:30.5,revision:1})).ok).toBe(true);expect(t.cajas.guardar).toHaveBeenCalledWith('empresa-1',JORNADA,expect.any(Date),{cargadasCamion:100.5,cargadasUsuario:30.5,revision:1},expect.any(Date));
 });
});
