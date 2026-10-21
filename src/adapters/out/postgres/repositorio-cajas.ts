import { distanciaKm } from '../../../domain/valor/coordenada.js';
import { fechaEnChile } from '../../../domain/shared/fechas.js';
import { sql } from 'kysely';
import type { CajasActuales, CajasRepository, FilaCajas } from '../../../application/ports/out/cajas.js';
import type { Jornada } from '../../../application/ports/out/jornadas.js';
import type { Db } from './client.js';
export class PostgresCajasRepository implements CajasRepository {
 constructor(private readonly db: Db) {}
 async actual(empresaId: string, jornadaId: string, compartida?: {camionId:string;fecha:string;desde:Date}): Promise<CajasActuales | undefined> {
  const r = await sql<CajasActuales>`select c.bultos::float8 as bultos,true as registrada,c.cargadas::float8 as "cargadasCamion", u.cargadas::float8 as "cargadasUsuario", u.cerrado::float8 as "porCerrado", u.rebajes::float8 as rebajes, c.rebajes::float8 as "rebajesCamion", c.revision, u.cerrado_en is not null as cerrada from caja_cuenta u join caja_carga c on c.id=u.carga_id where u.empresa_id=${empresaId}::uuid and u.jornada_id=${jornadaId}::uuid`.execute(this.db);
  if(r.rows[0] || !compartida) return r.rows[0];
  const c=await sql<CajasActuales>`select bultos::float8 as bultos,false as registrada,cargadas::float8 as "cargadasCamion",0 as "cargadasUsuario",0 as "porCerrado",0 as rebajes,rebajes::float8 as "rebajesCamion",revision,false as cerrada from caja_carga where empresa_id=${empresaId}::uuid and camion_id=${compartida.camionId}::uuid and fecha=${compartida.fecha}::date and desde=${compartida.desde}`.execute(this.db);
  return c.rows[0];
 }
 async guardar(empresaId: string, j: Jornada, desde: Date, e: { bultos?:number|undefined; cargadasCamion: number; cargadasUsuario: number; revision: number }, ahora: Date): Promise<boolean> {
  return this.db.transaction().execute(async trx => {
   // Serializar por camión y jornada física; chofer y pioneta comparten una carga, nunca dos.
   await sql`select pg_advisory_xact_lock(hashtextextended(${empresaId + j.camion.id + j.fecha},0))`.execute(trx);
   const anterior = await sql<{ id: string; revision: number; cargadas: number; rebajes: number | null }>`select id,revision,cargadas::float8,rebajes::float8 from caja_carga where empresa_id=${empresaId}::uuid and camion_id=${j.camion.id}::uuid and fecha=${j.fecha}::date and desde=${desde} for update`.execute(trx);
   const c = anterior.rows[0];
   const propia = await sql<{ cerrada: boolean }>`select cerrado_en is not null as cerrada from caja_cuenta where empresa_id=${empresaId}::uuid and jornada_id=${j.id}::uuid for update`.execute(trx);
   if (propia.rows[0]?.cerrada || (c && (c.revision !== e.revision || c.rebajes !== null)) || (!c && e.revision !== 0)) return false;
   if (c) {
    const otras = await sql<{ n: number }>`select count(*)::int as n from caja_cuenta where carga_id=${c.id}::uuid and cargadas>${e.cargadasCamion}`.execute(trx);
    if ((otras.rows[0]?.n ?? 0) > 0) return false;
   }
   const carga = await sql<{ id: string }>`insert into caja_carga(empresa_id,camion_id,fecha,desde,bultos,cargadas,actualizado_por,actualizado_en) values(${empresaId}::uuid,${j.camion.id}::uuid,${j.fecha}::date,${desde},${e.bultos??null},${e.cargadasCamion},${j.usuarioId}::uuid,${ahora}) on conflict(empresa_id,camion_id,fecha,desde) do update set bultos=coalesce(excluded.bultos,caja_carga.bultos),cargadas=excluded.cargadas,revision=caja_carga.revision+1,actualizado_por=excluded.actualizado_por,actualizado_en=excluded.actualizado_en returning id`.execute(trx);
   const id = carga.rows[0]?.id; if (!id) throw new Error('No se pudo guardar la carga');
   await sql`insert into caja_cuenta(jornada_id,carga_id,empresa_id,usuario_id,cargadas,actualizado_en) values(${j.id}::uuid,${id}::uuid,${empresaId}::uuid,${j.usuarioId}::uuid,${e.cargadasUsuario},${ahora}) on conflict(jornada_id) do update set cargadas=excluded.cargadas,actualizado_en=excluded.actualizado_en`.execute(trx);
   await sql`insert into caja_auditoria(empresa_id,usuario_id,jornada_id,datos,creado_en) values(${empresaId}::uuid,${j.usuarioId}::uuid,${j.id}::uuid,${JSON.stringify({ accion: 'carga', anterior: c, ...e })}::jsonb,${ahora})`.execute(trx);
   return true;
  });
 }
 async cerrar(empresaId: string, j: Jornada, e: { porCerrado: number; rebajes: number; rebajesCamion: number; ultimo: boolean }, ahora: Date): Promise<boolean> {
  return this.db.transaction().execute(async trx => {
   await sql`select pg_advisory_xact_lock(hashtextextended(${empresaId + j.camion.id + j.fecha},0))`.execute(trx);
   const r = await sql<{ carga_id: string; cerrado_en: Date | null; cerrado: number; rebajes: number }>`select carga_id,cerrado_en,cerrado::float8,rebajes::float8 from caja_cuenta where empresa_id=${empresaId}::uuid and jornada_id=${j.id}::uuid for update`.execute(trx);
   const c = r.rows[0]; if (!c) return false;
   if (c.cerrado_en) return c.cerrado === e.porCerrado && c.rebajes === e.rebajes;
   const otras = await sql<{ n: number }>`select count(*)::int as n from jornada j left join caja_cuenta c on c.jornada_id=j.id where j.empresa_id=${empresaId}::uuid and j.camion_id=${j.camion.id}::uuid and j.fecha_reparto=${j.fecha}::date and j.hasta is null and j.id<>${j.id}::uuid and c.cerrado_en is null`.execute(trx);
   if (e.ultimo || (otras.rows[0]?.n ?? 0) === 0) {
    const carga = await sql<{ id: string }>`update caja_carga set rebajes=${e.rebajesCamion},revision=revision+1,actualizado_por=${j.usuarioId}::uuid,actualizado_en=${ahora} where id=${c.carga_id}::uuid and empresa_id=${empresaId}::uuid and cargadas>=${e.rebajesCamion} returning id`.execute(trx);
    if (!carga.rows[0]) return false;
   }
   await sql`update caja_cuenta set cerrado=${e.porCerrado},rebajes=${e.rebajes},cerrado_en=${ahora},actualizado_en=${ahora} where jornada_id=${j.id}::uuid and empresa_id=${empresaId}::uuid`.execute(trx);
   await sql`insert into caja_auditoria(empresa_id,usuario_id,jornada_id,datos,creado_en) values(${empresaId}::uuid,${j.usuarioId}::uuid,${j.id}::uuid,${JSON.stringify({ accion: 'cierre', ...e })}::jsonb,${ahora})`.execute(trx);
   return true;
  });
 }
 async historial(empresaId: string, mes: string, usuarioId?: string): Promise<readonly FilaCajas[]> {
  const filtro = usuarioId ? sql`and j.usuario_id=${usuarioId}::uuid` : sql``;
  const r = await sql<FilaCajas>`select l.bultos::float8 as "bultosCamion",j.id as "jornadaId",j.usuario_id as "usuarioId",u.nombre as usuario,j.camion_id as "camionId",k.patente as camion,to_char(j.fecha_reparto,'YYYY-MM-DD') as fecha,j.desde::text as desde,j.hasta::text as hasta,coalesce(c.cargadas,0)::float8 as cargadas,coalesce(c.cerrado,0)::float8 as "porCerrado",coalesce(c.rebajes,0)::float8 as rebajes,coalesce(c.tarifa,15)::float8 as tarifa,c.cerrado_en is not null as cerrada,coalesce(l.id::text,'') as "cargaId",coalesce(l.cargadas,0)::float8 as "cargadasCamion",l.rebajes::float8 as "rebajesCamion",
  coalesce((select sum(d.metros)/1000 from (select 6371000*2*asin(least(1,sqrt(power(sin(radians(p.lat-lag(p.lat) over w)/2),2)+cos(radians(p.lat))*cos(radians(lag(p.lat) over w))*power(sin(radians(p.lng-lag(p.lng) over w)/2),2)))) as metros,extract(epoch from (p.tomado_en-lag(p.tomado_en) over w)) as segundos from posicion_camion p where p.empresa_id=j.empresa_id and p.camion_id=j.camion_id and p.usuario_id=j.usuario_id and p.tomado_en>=j.desde and p.tomado_en<=coalesce(j.hasta,now()) and p.precision_m<=50 window w as(order by p.tomado_en)) d where d.segundos between 1 and 120 and d.metros/d.segundos<=40),0)::float8 as km,
  coalesce((select array_agg(distinct loc.comuna) from entrega_evento ev join local loc on loc.id=ev.local_id where ev.empresa_id=j.empresa_id and ev.camion_id=j.camion_id and ev.usuario_id=j.usuario_id and ev.creado_en>=j.desde and ev.creado_en<=coalesce(j.hasta,now())),array[]::text[]) as comunas
  from jornada j join usuario u on u.id=j.usuario_id join camion k on k.id=j.camion_id left join caja_cuenta c on c.jornada_id=j.id left join caja_carga l on l.id=c.carga_id where j.empresa_id=${empresaId}::uuid and j.fecha_reparto>=(${mes + '-01'})::date and j.fecha_reparto<(${mes + '-01'})::date+interval '1 month' ${filtro} order by j.desde desc limit 2000`.execute(this.db);
  if(usuarioId || r.rows.length===0)return r.rows;
  // Una sola trayectoria física por camión: tomar la mejor precisión por intervalo de 15 s evita sumar chofer y pioneta dos veces.
  const gps=await sql<{camionId:string;lat:number;lng:number;precisionM:number;tomadoEn:Date}>`select camion_id as "camionId",lat,lng,precision_m as "precisionM",tomado_en as "tomadoEn" from posicion_camion where empresa_id=${empresaId}::uuid and tomado_en>=(${mes+'-01'})::date-interval '1 day' and tomado_en<(${mes+'-01'})::date+interval '1 month 1 day' and precision_m<=50 order by tomado_en`.execute(this.db);
  const muestras=new Map<string,typeof gps.rows[number]>();
  for(const p of gps.rows){const key=`${p.camionId}|${Math.floor(p.tomadoEn.getTime()/15000)}`;const previo=muestras.get(key);if(!previo||p.precisionM<previo.precisionM)muestras.set(key,p);}
  const ultimos=new Map<string,typeof gps.rows[number]>();const kms=new Map<string,number>();
  for(const p of [...muestras.values()].sort((a,b)=>a.tomadoEn.getTime()-b.tomadoEn.getTime())){const key=p.camionId+'|'+fechaEnChile(p.tomadoEn);const previo=ultimos.get(key);if(previo){const s=(p.tomadoEn.getTime()-previo.tomadoEn.getTime())/1000;const km=distanciaKm(previo,p);if(s>0&&s<=120&&km*1000/s<=40)kms.set(key,(kms.get(key)??0)+km);}ultimos.set(key,p);}
  return r.rows.map(f=>({...f,kmCamion:Math.round((kms.get(f.camionId+'|'+f.fecha)??0)*100)/100}));
 }
}
