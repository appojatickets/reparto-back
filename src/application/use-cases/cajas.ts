import { balanceCajas, centesimasDeCaja } from '../../domain/entidades/cajas.js';
import { fechaEnChile } from '../../domain/shared/fechas.js';
import { err, ok } from '../../domain/shared/result.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { errorApp } from '../errores.js';
import type { CajasRepository } from '../ports/out/cajas.js';
import type { JornadaRepository } from '../ports/out/jornadas.js';
import type { Clock } from '../ports/out/clock.js';
export const crearControlCajas = ({ cajas, jornadas, clock }: { cajas: CajasRepository; jornadas: JornadaRepository; clock: Clock }) => {
 const jornada = (a: Usuario) => jornadas.activa(a.empresaId, a.id, fechaEnChile(clock.now()));
 return {
  async actual(a: Usuario) { const j = await jornada(a); if(!j)return null; const ventana=await jornadas.ultimaDelCamion(a.empresaId,j.camion.id,j.fecha);return await cajas.actual(a.empresaId,j.id,{camionId:j.camion.id,fecha:j.fecha,desde:ventana?.desde??j.desde})??null; },
  async guardar(a: Usuario, e: { bultos?:number|undefined; cargadasCamion: number; cargadasUsuario: number; revision: number }) {
   if ((e.bultos !== undefined && centesimasDeCaja(e.bultos) === undefined) || centesimasDeCaja(e.cargadasCamion) === undefined || centesimasDeCaja(e.cargadasUsuario) === undefined || e.cargadasUsuario > e.cargadasCamion) return err(errorApp('VALIDACION', 'Revisa las cajas: hasta dos decimales y tu cantidad no puede superar la carga del camión.'));
   const j = await jornada(a); if (!j) return err(errorApp('VALIDACION', 'Primero elige tu camión de hoy.'));
   const ventana = await jornadas.ultimaDelCamion(a.empresaId, j.camion.id, j.fecha);
   const r = await cajas.guardar(a.empresaId, j, ventana?.desde ?? j.desde, e, clock.now());
   return r ? ok(await cajas.actual(a.empresaId, j.id)) : err(errorApp('CONFLICTO', 'La carga cambió o ya fue cerrada. Actualiza antes de guardar.'));
  },
  async cerrar(a: Usuario, e: { porCerrado: number; rebajes: number; rebajesCamion: number }) {
   const j = await jornada(a); if (!j) return err(errorApp('VALIDACION', 'Primero elige tu camión de hoy.'));
   const c = await cajas.actual(a.empresaId, j.id);
   if (!c || !balanceCajas(c.cargadasUsuario, e.porCerrado, e.rebajes) || !balanceCajas(c.cargadasCamion, 0, e.rebajesCamion)) return err(errorApp('VALIDACION', 'Registra la carga y revisa los rebajes: no pueden superar las cajas cargadas.'));
   const ultimo = await jornadas.abiertasEnCamion(a.empresaId, j.camion.id, j.fecha) <= 1;
   return await cajas.cerrar(a.empresaId, j, { ...e, ultimo }, clock.now()) ? ok(true) : err(errorApp('CONFLICTO', 'El cierre cambió. Actualiza el control de cajas.'));
  },
  async historial(a: Usuario, mes: string) { return cajas.historial(a.empresaId, mes, a.rol === 'admin' ? undefined : a.id); },
 };
};
