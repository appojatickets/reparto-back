import { distanciaKm } from '../valor/coordenada.js';
import { diaDeSemana, fechaEnChile } from '../shared/fechas.js';
import type { EventoObs, LocalObs, JornadaObs } from './analisis.js';
export type PatronRecorrido={ readonly etiquetas?:readonly string[]; readonly tipo:'local'|'comuna'|'inicio_comuna'; readonly antes:readonly string[]; readonly despues:string; readonly ambito:string; readonly dia:number|null; readonly dias:number; readonly frecuencia:number };
/** La unidad de evidencia es un día de recorrido real, nunca cada ping, factura o botón repetido. */
export const patronesRecorrido=(eventos:readonly EventoObs[],locales:ReadonlyMap<string,LocalObs>,jornadas:readonly JornadaObs[]=[]):readonly PatronRecorrido[]=>{
 const grupos=new Map<string,EventoObs[]>();
 for(const e of eventos){if(!e.camionId||e.lat===undefined||e.lng===undefined||e.precisionM===undefined||e.precisionM>50||!['llegada','entregado','cerrado','no_entregado'].includes(e.tipo))continue;const local=locales.get(e.localId);if(local?.lat===undefined||local.lng===undefined||distanciaKm({lat:e.lat,lng:e.lng},{lat:local.lat,lng:local.lng})*1000>80)continue;const k=JSON.stringify([e.camionId,fechaEnChile(e.creadoEn)]);grupos.set(k,[...(grupos.get(k)??[]),e]);}
 const casos=new Map<string,{antes:readonly string[];despues:string;tipo:PatronRecorrido['tipo'];ambito:string;dia:number|null;fechas:Set<string>;rutas:Set<string>}>();
 const bases=new Map<string,Set<string>>();
 let recorrido='';
 const agregar=(tipo:PatronRecorrido['tipo'],antes:readonly string[],despues:string,ambito:string,dia:number|null,fecha:string):void=>{
  const b=JSON.stringify([tipo,antes,ambito,dia]);const k=JSON.stringify([tipo,antes,despues,ambito,dia]);
  const c=casos.get(k)??{antes,despues,tipo,ambito,dia,fechas:new Set<string>(),rutas:new Set<string>()};c.fechas.add(fecha);c.rutas.add(recorrido);casos.set(k,c);
  const base=bases.get(b)??new Set<string>();base.add(recorrido);bases.set(b,base);
 };
 for(const lista of grupos.values()){
  const orden=[...lista].sort((a,b)=>a.creadoEn.getTime()-b.creadoEn.getTime());const primero=orden[0];if(!primero)continue;
  const fecha=fechaEnChile(primero.creadoEn);recorrido=JSON.stringify([primero.camionId,fecha]);const vistos=new Set<string>();const unicos=orden.filter(e=>{if(vistos.has(e.localId))return false;vistos.add(e.localId);return true;});
  const participantes=jornadas.filter(j=>j.camionId===primero.camionId&&j.fecha===fecha);
  const usuarios=[...new Set([...lista.flatMap(e=>e.usuarioId?[e.usuarioId]:[]),...participantes.flatMap(j=>j.usuarioId?[j.usuarioId]:[])])];
  const ambitos=['global',`camion:${primero.camionId}`,...usuarios.map(id=>`usuario:${id}`)];
  for(const ambito of ambitos){
   const idUsuario=ambito.startsWith('usuario:')?ambito.slice(8):undefined;
   const tramos=idUsuario?participantes.filter(j=>j.usuarioId===idUsuario):[];
   const observados=idUsuario?unicos.filter(e=>tramos.length?tramos.some(j=>e.creadoEn>=j.desde&&(!j.hasta||e.creadoEn<=j.hasta)):e.usuarioId===idUsuario):unicos;
   const comunas=observados.flatMap(e=>{const c=locales.get(e.localId)?.comuna;return c?[c]:[];}).filter((c,i,a)=>i===0||a[i-1]!==c);
   for(const dia of [null,diaDeSemana(fecha)]){
    for(let i=1;i<observados.length;i++){const previo=observados[i-1],actual=observados[i];if(!previo||!actual||actual.creadoEn.getTime()-previo.creadoEn.getTime()>90*60_000)continue;agregar('local',[previo.localId],actual.localId,ambito,dia,fecha);const anteprevio=observados[i-2];if(anteprevio)agregar('local',[anteprevio.localId,previo.localId],actual.localId,ambito,dia,fecha);}
    for(let i=1;i<comunas.length;i++){const a=comunas[i-1],b=comunas[i];if(a&&b)agregar('comuna',[a],b,ambito,dia,fecha);}
    if(comunas[0])for(const otra of new Set(comunas.slice(1)))if(otra!==comunas[0])agregar('inicio_comuna',[otra],comunas[0],ambito,dia,fecha);
   }
  }
 }
 return [...casos.values()].flatMap(c=>{const total=bases.get(JSON.stringify([c.tipo,c.antes,c.ambito,c.dia]))?.size??0;const frecuencia=total?c.rutas.size/total:0;return c.fechas.size>=3&&frecuencia>=0.7?[{tipo:c.tipo,antes:c.antes,despues:c.despues,ambito:c.ambito,dia:c.dia,dias:c.fechas.size,frecuencia}]:[];}).sort((a,b)=>b.dias-a.dias);
};
export type PreferenciaRecorrido={ readonly antes:string; readonly despues:string; readonly peso:number };
/** Las secuencias son pistas blandas, acotadas; jamás restricciones que anulen horarios o decisiones manuales. */
export const preferenciasRecorrido=(patrones:readonly PatronRecorrido[],items:readonly {readonly facturaId:string;readonly localId:string;readonly comuna:string}[],camionId:string,usuarioId:string,fecha:string):readonly PreferenciaRecorrido[]=>{
 const relevantes=patrones.filter(p=>(p.dia===null||p.dia===diaDeSemana(fecha))&&['global',`camion:${camionId}`,`usuario:${usuarioId}`].includes(p.ambito)&&p.dias>=3&&p.frecuencia>=0.7&&p.antes.length<=1);
 const elegidas=new Map<string,{p:PatronRecorrido;especificidad:number}>();
 for(const p of relevantes){const key=JSON.stringify([p.tipo,p.antes]);const especificidad=(p.dia!==null?4:0)+(p.ambito.startsWith('usuario:')?2:p.ambito.startsWith('camion:')?1:0);const anterior=elegidas.get(key);if(!anterior||especificidad>anterior.especificidad||(especificidad===anterior.especificidad&&p.dias>anterior.p.dias))elegidas.set(key,{p,especificidad});}
 const resultado:PreferenciaRecorrido[]=[];
 for(const {p} of elegidas.values())for(const a of items)for(const b of items){if(a.facturaId===b.facturaId)continue;const coincide=p.tipo==='local'?a.localId===p.antes[0]&&b.localId===p.despues:p.tipo==='comuna'?a.comuna===p.antes[0]&&b.comuna===p.despues:a.comuna===p.despues&&b.comuna===p.antes[0];if(coincide)resultado.push({antes:a.facturaId,despues:b.facturaId,peso:1.5*p.frecuencia});}
 return resultado;
};
