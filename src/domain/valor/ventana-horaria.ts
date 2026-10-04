import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

/** Tramo en que un local atiende, en minutos desde las 00:00. `cierre` es inclusivo. */
export type VentanaHoraria = { readonly apertura: number; readonly cierre: number };

export const crearVentana = (apertura: number, cierre: number): Result<VentanaHoraria, ErrorDominio> => {
  if (!Number.isFinite(apertura) || !Number.isFinite(cierre) || apertura < 0 || cierre > 1440 || apertura >= cierre) {
    return err(errorDominio('VENTANA_INVALIDA', 'El tramo horario debe abrir antes de cerrar, dentro del día.'));
  }
  return ok(Object.freeze({ apertura, cierre }));
};

/** Ordena los tramos y fusiona los que se solapan o se tocan (la colación sigue separando dos tramos). */
export const normalizarTramos = (tramos: readonly VentanaHoraria[]): VentanaHoraria[] => {
  const ordenados = [...tramos].sort((a, b) => a.apertura - b.apertura);
  const salida: VentanaHoraria[] = [];
  for (const t of ordenados) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && t.apertura <= ultimo.cierre) {
      salida[salida.length - 1] = Object.freeze({ apertura: ultimo.apertura, cierre: Math.max(ultimo.cierre, t.cierre) });
    } else {
      salida.push(t);
    }
  }
  return salida;
};

/** Aplica una condición «antes de X»: recorta los cierres y descarta lo que quede vacío. */
export const intersectarConLimite = (tramos: readonly VentanaHoraria[], limite: number): VentanaHoraria[] =>
  tramos.flatMap((t) =>
    t.apertura >= limite ? [] : [t.cierre <= limite ? t : Object.freeze({ apertura: t.apertura, cierre: limite })],
  );
