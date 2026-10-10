import { contribuciones as quienesAportaron, type Aporte } from '../../domain/entidades/contribuciones.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ContribucionesRepository } from '../ports/out/contribuciones.js';
import type { UsuarioRepository } from '../ports/out/usuarios.js';

export type Contribuyente = {
  readonly usuarioId: string;
  readonly nombre: string;
  /** Cuándo puso su foto de perfil (no viene si no tiene). */
  readonly fotoEn?: string;
  readonly aportes: readonly Aporte[];
  readonly entregas: number;
};

/**
 * Quiénes aportaron a un local con foto y pin (y más de una entrega, o el pin verificado), para reconocerlos: nombre, foto de perfil y qué
 * aportó cada uno. Un local que aún no cumple devuelve una lista vacía.
 */
export const crearVerContribuyentes = ({ contribuciones, usuarios }: { contribuciones: ContribucionesRepository; usuarios: UsuarioRepository }) =>
  async (actor: Usuario, localId: string): Promise<Result<readonly Contribuyente[], ErrorApp>> => {
    const datos = await contribuciones.datosDelLocal(actor.empresaId, localId);
    if (!datos) return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
    const aportaron = quienesAportaron(datos);
    if (aportaron.length === 0) return ok([]);
    const personas = new Map((await usuarios.listar(actor.empresaId)).map((u) => [u.id, u]));
    return ok(
      aportaron.flatMap((c): Contribuyente[] => {
        const u = personas.get(c.usuarioId);
        if (!u) return [];
        return [{ usuarioId: u.id, nombre: u.nombre, ...(u.fotoPath !== undefined && u.fotoEn !== undefined ? { fotoEn: u.fotoEn.toISOString() } : {}), aportes: c.aportes, entregas: c.entregas }];
      }),
    );
  };
