import { checkHealth } from './application/use-cases/check-health.js';
import { crearActualizarLocal } from './application/use-cases/actualizar-local.js';
import { crearObtenerUrlFoto, crearRegistrarFotoLocal, crearSolicitarUrlSubida } from './application/use-cases/archivos.js';
import { crearActualizarCamion, crearCrearCamion, crearListarCamiones } from './application/use-cases/camiones.js';
import { crearActualizarFactura, crearListarFacturas, crearRegistrarFactura } from './application/use-cases/facturas.js';
import { crearGuardarConfigEmpresa, crearObtenerConfigEmpresa } from './application/use-cases/config-empresa.js';
import { crearServiciosDeRuta } from './application/use-cases/rutas.js';
import { crearGuardarHorario, crearObtenerHorario } from './application/use-cases/horarios.js';
import { crearIniciarJornada, crearMiJornada, crearResolverCamion, crearTerminarJornada } from './application/use-cases/jornada.js';
import { crearRegistrarEvento } from './application/use-cases/entregas.js';
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
import { PostgresEmpresaRepository } from './adapters/out/postgres/repositorio-empresa.js';
import { PostgresRutaRepository } from './adapters/out/postgres/repositorio-rutas.js';
import { PostgresHorarioRepository } from './adapters/out/postgres/repositorio-horarios.js';
import { PostgresJornadaRepository } from './adapters/out/postgres/repositorio-jornadas.js';
import { PostgresEntregaRepository } from './adapters/out/postgres/repositorio-entregas.js';
import { crearActualizarVendedor, crearCrearVendedor, crearListarVendedores } from './application/use-cases/vendedores.js';
import { PostgresVendedorRepository } from './adapters/out/postgres/repositorio-vendedores.js';
import { PostgresCamionRepository } from './adapters/out/postgres/repositorio-camiones.js';
import { PostgresFacturaRepository } from './adapters/out/postgres/repositorio-facturas.js';
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
const camiones = new PostgresCamionRepository(db);
const vendedores = new PostgresVendedorRepository(db);
const facturas = new PostgresFacturaRepository(db);
const empresas = new PostgresEmpresaRepository(db);
const rutas = new PostgresRutaRepository(db);
const horarios = new PostgresHorarioRepository(db);
const jornadas = new PostgresJornadaRepository(db);
const entregas = new PostgresEntregaRepository(db);
const identidad = new IdentidadSupabase({ urlBase: env.SUPABASE_URL, claveServicio: env.SUPABASE_SERVICE_ROLE_KEY, clavePublica: env.SUPABASE_ANON_KEY });
const almacen = new AlmacenSupabase({ urlBase: env.SUPABASE_URL, claveServicio: env.SUPABASE_SERVICE_ROLE_KEY });
const dbHealth = new PostgresDatabaseHealth(db);
const clock = relojDelSistema;

// Casos de uso con sus puertos inyectados
const resolverCamion = crearResolverCamion({ jornadas, clock });
const serviciosDeRuta = crearServiciosDeRuta({ rutas, empresas, camiones, facturas, entregas, clock, resolverCamion });
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
  listarCamiones: crearListarCamiones({ camiones }),
  crearCamion: crearCrearCamion({ camiones }),
  actualizarCamion: crearActualizarCamion({ camiones }),
  listarVendedores: crearListarVendedores({ vendedores }),
  crearVendedor: crearCrearVendedor({ vendedores }),
  actualizarVendedor: crearActualizarVendedor({ vendedores }),
  registrarFactura: crearRegistrarFactura({ facturas, clock, resolverCamion }),
  listarFacturas: crearListarFacturas({ facturas, clock, resolverCamion }),
  actualizarFactura: crearActualizarFactura({ facturas, resolverCamion }),
  verRuta: serviciosDeRuta.ver,
  planificarRuta: serviciosDeRuta.planificar,
  operarRuta: serviciosDeRuta.operar,
  miJornada: crearMiJornada({ jornadas, clock }),
  iniciarJornada: crearIniciarJornada({ jornadas, clock }),
  terminarJornada: crearTerminarJornada({ jornadas, clock }),
  registrarEvento: crearRegistrarEvento({ facturas, entregas, clientes, resolverCamion }),
  obtenerHorario: crearObtenerHorario({ horarios }),
  guardarHorario: crearGuardarHorario({ horarios }),
  obtenerConfigEmpresa: crearObtenerConfigEmpresa({ empresas }),
  guardarConfigEmpresa: crearGuardarConfigEmpresa({ empresas }),
};

const app = await buildServer({ frontOrigin: env.FRONT_ORIGIN, casos, logger: true });

const shutdown = async (): Promise<void> => {
  await app.close();
  await db.destroy();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: env.PORT, host: '0.0.0.0' });
