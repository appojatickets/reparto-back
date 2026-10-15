import { aObservaciones, fichaAprendida, type FichaAprendida } from '../../domain/aprendizaje/ficha-aprendida.js';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { errorApp, type ErrorApp } from '../errores.js';
import type { ClienteRepository } from '../ports/out/clientes.js';
import type { Clock } from '../ports/out/clock.js';
import type { EntregaRepository } from '../ports/out/entregas.js';

/** Solo se mira lo reciente: lo viejo ya no representa cómo atiende el local hoy. */
export const DIAS_DE_LA_FICHA = 180;

/** Lo que se aprendió de un local: a qué hora suele entregarse y con qué probabilidad está cerrado a cada hora (ADR 0049). Se calcula al pedirla. */
export const crearVerFichaAprendida = ({ clientes, entregas, clock }: { clientes: ClienteRepository; entregas: Pick<EntregaRepository, 'eventosDeLocal'>; clock: Clock }) =>
  async (actor: Usuario, localId: string): Promise<Result<FichaAprendida, ErrorApp>> => {
    const local = await clientes.obtenerLocal(actor.empresaId, localId);
    if (!local) return err(errorApp('NO_ENCONTRADO', 'El local no existe.'));
    const eventos = await entregas.eventosDeLocal(actor.empresaId, localId, new Date(clock.now().getTime() - DIAS_DE_LA_FICHA * 86_400_000));
    return ok(fichaAprendida(aObservaciones(eventos)));
  };
