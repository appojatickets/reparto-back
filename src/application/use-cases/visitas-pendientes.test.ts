import {describe,expect,it} from 'vitest';
import {crearVisitasPendientes} from './visitas-pendientes.js';
import {crearReloj,usuarioDe} from './fakes.test-util.js';
import {fakeRegistro,JORNADA,resolverDePrueba} from './fakes-facturas.test-util.js';
import {fakeRutas,paradaDe} from './fakes-rutas.test-util.js';
describe('visitas sin botones',()=>{
 it('devuelve visitas pendientes del camión propio sin confirmar resultados ni tocar facturas',async()=>{
  const registro=fakeRegistro();const rutas=fakeRutas([paradaDe('A',{lat:-33.5,lng:-70.7})]);const {clock}=crearReloj('2026-10-05T12:00:00Z');
  registro.posicionesDesde.mockResolvedValue([{lat:-33.5,lng:-70.7,precisionM:10,tomadoEn:new Date('2026-10-05T11:50:00Z')},{lat:-33.5,lng:-70.7,precisionM:10,tomadoEn:new Date('2026-10-05T11:51:00Z')},{lat:-33.51,lng:-70.7,precisionM:10,tomadoEn:new Date('2026-10-05T11:52:00Z')},{lat:-33.52,lng:-70.7,precisionM:10,tomadoEn:new Date('2026-10-05T11:52:30Z')}]);
  const r=await crearVisitasPendientes({registro,rutas:rutas.repo,clock,resolverCamion:resolverDePrueba(JORNADA)})(usuarioDe({rol:'chofer'}));
  expect(r.ok&&r.value).toEqual([expect.objectContaining({facturaId:'f-A',estado:'sin_confirmar'})]);expect(rutas.repo.facturasPendientes).toHaveBeenCalledWith('empresa-1','cam-1','2026-10-05');
 });
});
