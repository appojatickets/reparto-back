import { sql } from 'kysely';
import type { Usuario } from '../../../domain/entidades/usuario.js';
import type { IntentosLoginRepository, UsuarioRepository, EstadoIntentos } from '../../../application/ports/out/usuarios.js';
import type { Db } from './client.js';

type Fila = { id: string; empresa_id: string; rol: Usuario['rol']; username: string; nombre: string; activo: boolean; editor: boolean };

const aUsuario = (f: Fila): Usuario => ({ id: f.id, empresaId: f.empresa_id, rol: f.rol, username: f.username, nombre: f.nombre, activo: f.activo, editor: f.editor });
const COLUMNAS = ['id', 'empresa_id', 'rol', 'username', 'nombre', 'activo', 'editor'] as const;

export class PostgresUsuarioRepository implements UsuarioRepository {
  constructor(private readonly db: Db) {}

  async porId(id: string): Promise<Usuario | undefined> {
    const f = await this.db.selectFrom('usuario').select(COLUMNAS).where('id', '=', id).executeTakeFirst();
    return f && aUsuario(f);
  }

  async porUsername(username: string): Promise<Usuario | undefined> {
    const f = await this.db.selectFrom('usuario').select(COLUMNAS).where('username', '=', username).executeTakeFirst();
    return f && aUsuario(f);
  }

  async listar(empresaId: string): Promise<readonly Usuario[]> {
    const filas = await this.db.selectFrom('usuario').select(COLUMNAS).where('empresa_id', '=', empresaId).orderBy('nombre').execute();
    return filas.map(aUsuario);
  }

  async usernamesDeEmpresa(empresaId: string): Promise<ReadonlySet<string>> {
    const filas = await this.db.selectFrom('usuario').select('username').where('empresa_id', '=', empresaId).execute();
    return new Set(filas.map((f) => f.username));
  }

  async crear(u: Usuario): Promise<void> {
    await this.db.insertInto('usuario').values({ id: u.id, empresa_id: u.empresaId, rol: u.rol, username: u.username, nombre: u.nombre, activo: u.activo, editor: u.editor }).execute();
  }

  async cambiarActivo(empresaId: string, id: string, activo: boolean): Promise<boolean> {
    const r = await this.db.updateTable('usuario').set({ activo }).where('id', '=', id).where('empresa_id', '=', empresaId).executeTakeFirst();
    return r.numUpdatedRows > 0n;
  }

  async cambiarEditor(empresaId: string, id: string, editor: boolean): Promise<boolean> {
    const r = await this.db.updateTable('usuario').set({ editor }).where('id', '=', id).where('empresa_id', '=', empresaId).executeTakeFirst();
    return r.numUpdatedRows > 0n;
  }
}

export class PostgresIntentosLoginRepository implements IntentosLoginRepository {
  constructor(private readonly db: Db) {}

  async obtener(usuarioId: string): Promise<EstadoIntentos> {
    const f = await this.db.selectFrom('login_intento').select(['intentos', 'bloqueado_hasta']).where('usuario_id', '=', usuarioId).executeTakeFirst();
    return f ? { intentos: f.intentos, ...(f.bloqueado_hasta ? { bloqueadoHasta: f.bloqueado_hasta } : {}) } : { intentos: 0 };
  }

  /**
   * Atómico: dos fallos simultáneos no se pisan y el bloqueo se decide en la misma sentencia. Si el bloqueo anterior ya
   * venció, el conteo vuelve a empezar en 1 (si no, el primer error tras la espera bloquearía otra vez).
   */
  async registrarFallo(usuarioId: string, ahora: Date, maxIntentos: number, bloqueoMs: number): Promise<EstadoIntentos> {
    const hasta = new Date(ahora.getTime() + bloqueoMs);
    const vencido = sql`(login_intento.bloqueado_hasta is not null and login_intento.bloqueado_hasta <= ${ahora})`;
    const siguiente = sql`(case when ${vencido} then 1 else login_intento.intentos + 1 end)`;
    const r = await sql<{ intentos: number; bloqueado_hasta: Date | null }>`
      insert into login_intento (usuario_id, intentos, bloqueado_hasta)
      values (${usuarioId}, 1, ${maxIntentos <= 1 ? hasta : null})
      on conflict (usuario_id) do update set
        intentos = ${siguiente},
        bloqueado_hasta = case
          when ${siguiente} >= ${maxIntentos} then ${hasta}::timestamptz
          when ${vencido} then null
          else login_intento.bloqueado_hasta end
      returning intentos, bloqueado_hasta`.execute(this.db);
    const f = r.rows[0];
    if (!f) throw new Error('registrarFallo no devolvió fila');
    return { intentos: f.intentos, ...(f.bloqueado_hasta ? { bloqueadoHasta: f.bloqueado_hasta } : {}) };
  }

  async reiniciar(usuarioId: string): Promise<void> {
    await this.db.deleteFrom('login_intento').where('usuario_id', '=', usuarioId).execute();
  }
}
