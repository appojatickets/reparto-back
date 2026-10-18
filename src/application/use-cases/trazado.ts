import type { Usuario } from '../../domain/entidades/usuario.js';
import { ok } from '../../domain/shared/result.js';
import type { ProveedorTrazado, TramoMapa } from '../ports/out/trazado.js';
import type { PuntoGeo } from '../ports/out/viajes.js';
import type { crearServiciosDeRuta } from './rutas.js';

/** Solo traza la ruta autorizada del camión; nunca acepta puntos arbitrarios del cliente. */
export const crearVerTrazado = ({ ver, proveedor }: { ver: ReturnType<typeof crearServiciosDeRuta>['ver']; proveedor: ProveedorTrazado }) =>
  async (actor: Usuario, entrada: Parameters<typeof ver>[1]) => {
    const r = await ver(actor, entrada);
    if (!r.ok) return r;
    const tramos: TramoMapa[] = [];
    // No conectar saltándose una parada sin pin: cada tramo conserva su posición original.
    const puntos: (PuntoGeo | undefined)[] = [r.value.deposito, ...r.value.paradas.map((p) =>
      p.lat !== undefined && p.lng !== undefined && !p.ubicacionAproximada ? { lat: p.lat, lng: p.lng } : undefined), r.value.deposito];
    let perfil = 'sin configurar';
    for (let i = 0; i < puntos.length - 1;) {
      const a = puntos[i]; const b = puntos[i + 1];
      if (!a || !b) { tramos.push({ coordenadas: [], porCalles: false }); i++; continue; }
      const bloque: PuntoGeo[] = [a];
      while (i + bloque.length < puntos.length && bloque.length < 50) {
        const siguiente = puntos[i + bloque.length];
        if (!siguiente) break;
        bloque.push(siguiente);
      }
      const trazado = await proveedor.trazar(bloque);
      perfil = trazado.perfil;
      tramos.push(...trazado.tramos);
      i += bloque.length - 1;
    }
    return ok({ tramos, perfil, ...(r.value.version !== undefined ? { version: r.value.version } : {}) });
  };
