import type { Usuario } from '../../domain/entidades/usuario.js';
import { fechaEnChile } from '../../domain/shared/fechas.js';
import { ok, type Result } from '../../domain/shared/result.js';
import { detectarLlegada, type PuntoGps } from '../../domain/seguimiento/llegada.js';
import { crearCoordenada, dentroDeRegionMetropolitana } from '../../domain/valor/coordenada.js';
import type { ErrorApp } from '../errores.js';
import type { Clock } from '../ports/out/clock.js';
import type { EntregaRepository } from '../ports/out/entregas.js';
import type { RegistroAprendizajeRepository } from '../ports/out/registro-aprendizaje.js';
import type { RutaRepository } from '../ports/out/rutas.js';
import type { ResolverCamion } from './jornada.js';

export type PuntoEntrante = {
  readonly lat: number;
  readonly lng: number;
  readonly precisionM?: number | undefined;
  readonly velocidadMs?: number | undefined;
  readonly tomadoEn: Date;
};

export type ResultadoPosiciones = {
  readonly guardados: number;
  /** Puntos que no sirvieron (fuera de la región, del futuro o demasiado viejos). */
  readonly descartados: number;
  /** Entregas en las que el servidor detectó que el camión llegó solo (por cercanía al pin). */
  readonly llegadasAutomaticas: readonly string[];
};

const MAX_ANTIGUEDAD_MS = 6 * 3_600_000;
const TOLERANCIA_FUTURO_MS = 2 * 60_000;
/** Para detectar la llegada se miran los puntos de los últimos minutos. */
const VENTANA_LLEGADA_MS = 10 * 60_000;

/**
 * El teléfono del camión informa dónde está mientras la app está abierta (se sigue al camión, no a la persona). Se guarda todo punto
 * válido para aprender (recorridos reales, ritmo) y, de paso, si el camión se quedó junto al pin de una entrega pendiente, el servidor
 * anota la llegada solo. Un aviso de llegada hecho por una persona manda: si ya existe, no se repite.
 */
export const crearRegistrarPosiciones = ({ registro, rutas, entregas, resolverCamion, clock }: { registro: RegistroAprendizajeRepository; rutas: RutaRepository; entregas: EntregaRepository; resolverCamion: ResolverCamion; clock: Clock }) =>
  async (actor: Usuario, puntos: readonly PuntoEntrante[]): Promise<Result<ResultadoPosiciones, ErrorApp>> => {
    const camion = await resolverCamion(actor, undefined);
    if (!camion.ok) return camion;
    const camionId = camion.value;
    if (camionId === undefined) return ok({ guardados: 0, descartados: puntos.length, llegadasAutomaticas: [] });

    const ahora = clock.now().getTime();
    const validos: PuntoGps[] = [];
    for (const p of puntos) {
      const c = crearCoordenada(p.lat, p.lng);
      const edad = ahora - p.tomadoEn.getTime();
      if (!c.ok || !dentroDeRegionMetropolitana(c.value) || Number.isNaN(edad) || edad > MAX_ANTIGUEDAD_MS || edad < -TOLERANCIA_FUTURO_MS) continue;
      validos.push({ lat: p.lat, lng: p.lng, ...(p.precisionM !== undefined ? { precisionM: p.precisionM } : {}), ...(p.velocidadMs !== undefined ? { velocidadMs: p.velocidadMs } : {}), tomadoEn: p.tomadoEn });
    }
    if (validos.length === 0) return ok({ guardados: 0, descartados: puntos.length, llegadasAutomaticas: [] });
    validos.sort((a, b) => a.tomadoEn.getTime() - b.tomadoEn.getTime());
    await registro.registrarPosiciones(actor.empresaId, camionId, actor.id, validos);

    // Llegada automática: solo hacia entregas pendientes con pin preciso (un pin aproximado de calle no sirve para decir «llegó»).
    const fecha = fechaEnChile(clock.now());
    const pendientes = (await rutas.facturasPendientes(actor.empresaId, camionId, fecha)).filter((f) => f.lat !== undefined && f.lng !== undefined && !f.pinAproximado);
    const llegadasAutomaticas: string[] = [];
    if (pendientes.length > 0) {
      const recientes = await registro.posicionesDesde(actor.empresaId, camionId, new Date(ahora - VENTANA_LLEGADA_MS));
      const yaLlego = await entregas.conLlegada(actor.empresaId, pendientes.map((f) => f.facturaId));
      const ruta = await rutas.obtener(actor.empresaId, camionId, fecha);
      for (const f of pendientes) {
        if (yaLlego.has(f.facturaId) || f.lat === undefined || f.lng === undefined) continue;
        const punto = detectarLlegada(recientes, { lat: f.lat, lng: f.lng });
        if (!punto) continue;
        const lugar = ruta ? ruta.orden.indexOf(f.facturaId) + 1 : 0;
        await entregas.registrar(actor.empresaId, {
          tipo: 'llegada', facturaId: f.facturaId, localId: f.localId, camionId, usuarioId: actor.id, origen: 'auto',
          lat: punto.lat, lng: punto.lng, ...(punto.precisionM !== undefined ? { precisionM: punto.precisionM } : {}),
          ...(ruta && lugar > 0 ? { posicionEnRuta: lugar, paradasEnRuta: ruta.orden.length } : {}),
        });
        llegadasAutomaticas.push(f.facturaId);
      }
    }
    return ok({ guardados: validos.length, descartados: puntos.length - validos.length, llegadasAutomaticas });
  };

export type RegistrarPosiciones = ReturnType<typeof crearRegistrarPosiciones>;
