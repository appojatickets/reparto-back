import { checkHealth } from './application/use-cases/check-health.js';
import { crearActualizarLocal } from './application/use-cases/actualizar-local.js';
import { crearObtenerUrlFoto, crearRegistrarFotoLocal, crearSolicitarUrlSubida } from './application/use-cases/archivos.js';
import { crearAutenticarUsuario } from './application/use-cases/autenticar-usuario.js';
import { crearBuscarClientes } from './application/use-cases/buscar-clientes.js';
import { crearCrearClienteNuevo } from './application/use-cases/crear-cliente-nuevo.js';
import { crearCrearUsuario } from './application/use-cases/crear-usuario.js';
import { crearCambiarEstadoUsuario, crearListarUsuarios, crearResetearPin } from './application/use-cases/gestionar-usuarios.js';
import { crearImportarClientes } from './application/use-cases/importar-clientes.js';
import { crearIniciarSesion } from './application/use-cases/iniciar-sesion.js';
import { crearObtenerLocal } from './application/use-cases/obtener-local.js';
import { crearImportarPines, crearListarPropuestasPin, crearResolverPropuestaPin } from './application/use-cases/pines.js';
import { crearRefrescarSesion } from './application/use-cases/refrescar-sesion.js';
import { buildServer } from './adapters/in/http/server.js';
import type { CasosDeUso } from './adapters/in/http/casos-de-uso.js';
import { createDb } from './adapters/out/postgres/client.js';
import { PostgresDatabaseHealth } from './adapters/out/postgres/database-health.js';
import { PostgresClienteRepository } from './adapters/out/postgres/repositorio-clientes.js';
import { PostgresPropuestaPinRepository } from './adapters/out/postgres/repositorio-pines.js';
import { PostgresIntentosLoginRepository, PostgresUsuarioRepository } from './adapters/out/postgres/repositorio-usuarios.js';
import { generadorDeIds, relojDelSistema } from './adapters/out/sistema/reloj-e-ids.js';
import { AlmacenSupabase } from './adapters/out/supabase/almacen-supabase.js';
import { IdentidadSupabase } from './adapters/out/supabase/identidad-supabase.js';
import { loadEnv } from './config/env.js';

const env = loadEnv(process.env);

// Adaptadores de salida
const db = createDb(env.DATABASE_URL);
const clientes = new PostgresClienteRepository(db);
const usuarios = new PostgresUsuarioRepository(db);
const intentos = new PostgresIntentosLoginRepository(db);
const pines = new PostgresPropuestaPinRepository(db);
const identidad = new IdentidadSupabase({ urlBase: env.SUPABASE_URL, claveServicio: env.SUPABASE_SERVICE_ROLE_KEY, clavePublica: env.SUPABASE_ANON_KEY });
const almacen = new AlmacenSupabase({ urlBase: env.SUPABASE_URL, claveServicio: env.SUPABASE_SERVICE_ROLE_KEY });
const dbHealth = new PostgresDatabaseHealth(db);
const clock = relojDelSistema;

// Casos de uso con sus puertos inyectados
const casos: CasosDeUso = {
  checkHealth: () => checkHealth({ db: dbHealth, clock }),
  autenticar: crearAutenticarUsuario({ identidad, usuarios, clock }),
  iniciarSesion: crearIniciarSesion({ identidad, usuarios, intentos, clock, dominioCorreo: env.AUTH_EMAIL_DOMAIN }),
  refrescarSesion: crearRefrescarSesion({ identidad }),
  crearUsuario: crearCrearUsuario({ identidad, usuarios, dominioCorreo: env.AUTH_EMAIL_DOMAIN }),
  listarUsuarios: crearListarUsuarios({ usuarios }),
  resetearPin: crearResetearPin({ identidad, usuarios, intentos }),
  cambiarEstadoUsuario: crearCambiarEstadoUsuario({ usuarios }),
  buscarClientes: crearBuscarClientes({ clientes }),
  crearClienteNuevo: crearCrearClienteNuevo({ clientes }),
  importarClientes: crearImportarClientes({ clientes }),
  obtenerLocal: crearObtenerLocal({ clientes }),
  actualizarLocal: crearActualizarLocal({ clientes }),
  importarPines: crearImportarPines({ clientes, pines }),
  listarPropuestasPin: crearListarPropuestasPin({ pines }),
  resolverPropuestaPin: crearResolverPropuestaPin({ pines, clock }),
  solicitarUrlSubida: crearSolicitarUrlSubida({ clientes, almacen, ids: generadorDeIds }),
  registrarFotoLocal: crearRegistrarFotoLocal({ clientes }),
  obtenerUrlFoto: crearObtenerUrlFoto({ clientes, almacen }),
};

const app = await buildServer({ frontOrigin: env.FRONT_ORIGIN, casos, logger: true });

const shutdown = async (): Promise<void> => {
  await app.close();
  await db.destroy();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: env.PORT, host: '0.0.0.0' });
