import { vi } from 'vitest';
import type { Usuario } from '../../domain/entidades/usuario.js';
import { err, ok } from '../../domain/shared/result.js';
import type { Clock } from '../ports/out/clock.js';
import type { ErrorIdentidad, ProveedorIdentidad } from '../ports/out/identidad.js';
import type { EstadoIntentos, IntentosLoginRepository, UsuarioRepository } from '../ports/out/usuarios.js';

export const EMPRESA = 'empresa-1';

export const crearReloj = (inicio = '2026-10-05T12:00:00.000Z') => {
  let t = Date.parse(inicio);
  const clock: Clock = { now: () => new Date(t) };
  return { clock, avanzar: (ms: number) => { t += ms; } };
};

export const usuarioDe = (extra: Partial<Usuario> = {}): Usuario => ({
  id: 'u-admin',
  empresaId: EMPRESA,
  rol: 'admin',
  username: 'admin',
  nombre: 'Administrador',
  activo: true,
  editor: false,
  ...extra,
});

export const fakeUsuarios = (semilla: Usuario[] = []) => {
  const filas = new Map(semilla.map((u) => [u.id, u]));
  const repo: UsuarioRepository = {
    porId: (id) => Promise.resolve(filas.get(id)),
    porUsername: (username) => Promise.resolve([...filas.values()].find((u) => u.username === username)),
    listar: (empresaId) => Promise.resolve([...filas.values()].filter((u) => u.empresaId === empresaId)),
    usernamesDeEmpresa: (empresaId) => Promise.resolve(new Set([...filas.values()].filter((u) => u.empresaId === empresaId).map((u) => u.username))),
    crear: (u) => {
      filas.set(u.id, u);
      return Promise.resolve();
    },
    cambiarActivo: (empresaId, id, activo) => {
      const u = filas.get(id);
      if (u?.empresaId !== empresaId) return Promise.resolve(false);
      filas.set(id, { ...u, activo });
      return Promise.resolve(true);
    },
    cambiarEditor: (empresaId, id, editor) => {
      const u = filas.get(id);
      if (u?.empresaId !== empresaId) return Promise.resolve(false);
      filas.set(id, { ...u, editor });
      return Promise.resolve(true);
    },
  };
  return { repo, filas };
};

export const fakeIntentos = () => {
  const estado = new Map<string, { intentos: number; bloqueadoHasta?: Date }>();
  const repo: IntentosLoginRepository = {
    obtener: (id) => Promise.resolve(estado.get(id) ?? { intentos: 0 }),
    registrarFallo: (id, ahora, max, bloqueoMs) => {
      const intentos = (estado.get(id)?.intentos ?? 0) + 1;
      const nuevo: EstadoIntentos = intentos >= max ? { intentos, bloqueadoHasta: new Date(ahora.getTime() + bloqueoMs) } : { intentos };
      estado.set(id, nuevo);
      return Promise.resolve(nuevo);
    },
    reiniciar: (id) => {
      estado.delete(id);
      return Promise.resolve();
    },
  };
  return { repo, estado };
};

export const fakeIdentidad = () => {
  const cuentas = new Map<string, { id: string; clave: string }>();
  const tokens = new Map<string, string>();
  const eliminadas: string[] = [];
  const verificaciones = { n: 0 };
  let n = 0;
  let caido = false;
  const falla = (kind: ErrorIdentidad['kind']) => err<ErrorIdentidad>({ kind });
  const proveedor: ProveedorIdentidad = {
    iniciarSesion: (correo, clave) => {
      if (caido) return Promise.resolve(falla('NO_DISPONIBLE'));
      const c = cuentas.get(correo);
      if (c?.clave !== clave) return Promise.resolve(falla('CREDENCIALES_INVALIDAS'));
      const accessToken = `at-${c.id}`;
      tokens.set(accessToken, c.id);
      return Promise.resolve(ok({ accessToken, refreshToken: `rt-${c.id}`, expiraEnSegundos: 3600 }));
    },
    refrescarSesion: (rt) => {
      const id = rt.startsWith('rt-') ? rt.slice(3) : undefined;
      if (!id || ![...cuentas.values()].some((c) => c.id === id)) return Promise.resolve(falla('TOKEN_INVALIDO'));
      return Promise.resolve(ok({ accessToken: `at-${id}`, refreshToken: rt, expiraEnSegundos: 3600 }));
    },
    verificarToken: (token) => {
      verificaciones.n++;
      if (caido) return Promise.resolve(falla('NO_DISPONIBLE'));
      const id = tokens.get(token);
      return Promise.resolve(id ? ok({ usuarioId: id }) : falla('TOKEN_INVALIDO'));
    },
    crearCuenta: (correo, clave) => {
      if (caido) return Promise.resolve(falla('NO_DISPONIBLE'));
      if (cuentas.has(correo)) return Promise.resolve(falla('YA_EXISTE'));
      const id = `cuenta-${++n}`;
      cuentas.set(correo, { id, clave });
      return Promise.resolve(ok({ usuarioId: id }));
    },
    cambiarClave: vi.fn((id: string, clave: string) => {
      const entrada = [...cuentas.entries()].find(([, c]) => c.id === id);
      if (!entrada) return Promise.resolve(falla('RECHAZADO'));
      cuentas.set(entrada[0], { id, clave });
      return Promise.resolve(ok(undefined));
    }),
    eliminarCuenta: (id) => {
      eliminadas.push(id);
      return Promise.resolve(ok(undefined));
    },
  };
  return { proveedor, cuentas, tokens, eliminadas, verificaciones, caer: () => { caido = true; } };
};
