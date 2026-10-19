import { visitaObservada } from '../../domain/seguimiento/visitas-observadas.js';
import { fechaEnChile } from '../../domain/shared/fechas.js';
import { ok } from '../../domain/shared/result.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import type { RegistroAprendizajeRepository } from '../ports/out/registro-aprendizaje.js';
import type { RutaRepository } from '../ports/out/rutas.js';
import type { Clock } from '../ports/out/clock.js';
import type { ResolverCamion } from './jornada.js';
export const crearVisitasPendientes=({registro,rutas,clock,resolverCamion}:{registro:RegistroAprendizajeRepository;rutas:RutaRepository;clock:Clock;resolverCamion:ResolverCamion})=>async(a:Usuario)=>{
 const camion=await resolverCamion(a,undefined);if(!camion.ok)return camion;
 if(!camion.value)return ok([]);
 const pendientes=await rutas.facturasPendientes(a.empresaId,camion.value,fechaEnChile(clock.now()));
 const pines=pendientes.flatMap(f=>f.lat!==undefined&&f.lng!==undefined&&!f.pinAproximado?[{facturaId:f.facturaId,localId:f.localId,lat:f.lat,lng:f.lng}]:[]);
 const puntos=await registro.posicionesDesde(a.empresaId,camion.value,new Date(clock.now().getTime()-6*3600_000));
 return ok(pines.flatMap(pin=>{const v=visitaObservada(puntos,pin,pines);const f=pendientes.find(f=>f.facturaId===pin.facturaId);return v&&f?[{facturaId:pin.facturaId,localId:pin.localId,cliente:f.razonSocial,llegada:v.llegada.toISOString(),estado:v.estado}]:[];}));
};
