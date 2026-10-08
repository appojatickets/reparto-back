import { checkHealth } from './application/use-cases/check-health.js';
import { crearActualizarLocal } from './application/use-cases/actualizar-local.js';
import { crearObtenerUrlFoto, crearQuitarFotoLocal, crearRegistrarFotoLocal, crearSolicitarUrlSubida } from './application/use-cases/archivos.js';
import { crearActualizarCamion, crearCrearCamion, crearListarCamiones } from './application/use-cases/camiones.js';
import { crearActualizarFactura, crearListarFacturas, crearRegistrarFactura } from './application/use-cases/facturas.js';
import { crearGuardarConfigEmpresa, crearObtenerConfigEmpresa } from './application/use-cases/config-empresa.js';
import { crearServiciosDeRuta } from './application/use-cases/rutas.js';
import { crearGuardarHorario, crearObtenerHorario } from './application/use-cases/horarios.js';
import { crearIniciarJornada, crearMiJornada, crearResolverCamion, crearTerminarJornada } from './application/use-cases/jornada.js';
import { crearVerificarPin } from './application/use-cases/pin-verificado.js';
import { crearVerAnalitica } from './application/use-cases/analitica.js';
import { crearAnalizarAprendizaje } from './application/use-cases/analizar-aprendizaje.js';
import { crearRegistrarPosiciones } from './application/use-cases/seguimiento.js';
import { crearRegistrarEvento } from './application/use-cases/entregas.js';
import { crearAutenticarUsuario } from './application/use-cases/autenticar-usuario.js';
import { crearBuscarClientes } from './application/use-cases/buscar-clientes.js';
import { crearCrearClienteNuevo } from './application/use-cases/crear-cliente-nuevo.js';
import { crearCrearUsuario } from './application/use-cases/crear-usuario.js';
import { crearCambiarEditorUsuario, crearCambiarEstadoUsuario, crearListarUsuarios, crearResetearPin } from './application/use-cases/gestionar-usuarios.js';
import { crearImportarClientes } from './application/use-cases/importar-clientes.js';
import { crearIniciarSesion } from './application/use-cases/iniciar-sesion.js';
import { crearCambiarRazonSocial, crearEliminarLocal } from './application/use-cases/corregir-clientes.js';
import { crearObtenerLocal } from './application/use-cases/obtener-local.js';
import { crearImportarPines, crearListarPropuestasPin, crearResolverPropuestaPin } from './application/use-cases/pines.js';
import { crearRefrescarSesion } from './application/use-cases/refrescar-sesion.js';
import { buildServer } from './adapters/in/http/server.js';
import type { CasosDeUso } from './adapters/in/http/casos-de-uso.js';
import { createDb } from './adapters/out/postgres/client.js';
import { PostgresDatabaseHealth } from './adapters/out/postgres/database-health.js';
import { PostgresEmpresaRepository } from './adapters/out/postgres/repositorio-empresa.js';
import { PostgresCacheDeViajes } from './adapters/out/postgres/repositorio-viajes.js';
import { crearProveedorOrs } from './adapters/out/red/ors-viajes.js';
import { crearViajesPorCalle } from './application/use-cases/viajes-por-calle.js';
import { PostgresAnaliticaRepository } from './adapters/out/postgres/repositorio-analitica.js';
import { PostgresAprendizajeRepository } from './adapters/out/postgres/repositorio-aprendizaje.js';
import { PostgresRegistroAprendizajeRepository } from './adapters/out/postgres/repositorio-registro-aprendizaje.js';
import { PostgresRutaRepository } from './adapters/out/postgres/repositorio-rutas.js';
import { PostgresHorarioRepository } from './adapters/out/postgres/repositorio-horarios.js';
import { PostgresJornadaRepository } from './adapters/out/postgres/repositorio-jornadas.js';
import { PostgresEntregaRepository } from './adapters/out/postgres/repositorio-entregas.js';
import { crearFotosParaRevision, crearReportarFoto, crearResolverReporteFoto, crearVerificarFoto } from './application/use-cases/fotos-revision.js';
import { crearActualizarVendedor, crearCrearVendedor, crearListarVendedores } from './application/use-cases/vendedores.js';
import { crearExportarLocales } from './application/use-cases/exportar-locales.js';
import { crearBuscarPinesPendientes, crearEstadoBusquedaPines } from './application/use-cases/buscar-pines.js';
import { crearColaGeocodificacion } from './application/use-cases/cola-geocodificacion.js';
import { crearGeocodificarLocal } from './application/use-cases/geocodificar-local.js';
import { crearNominatimGeocodificador } from './adapters/out/red/nominatim-geocodificador.js';
import { crearFijarPinDesdeEnlace } from './application/use-cases/pin-desde-enlace.js';
import { crearResolvedorEnlacesHttp } from './adapters/out/red/resolvedor-enlaces-http.js';
import { PostgresFotoReporteRepository } from './adapters/out/postgres/repositorio-fotos.js';
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
const reportesFoto = new PostgresFotoReporteRepository(db);
const facturas = new PostgresFacturaRepository(db);
const empresas = new PostgresEmpresaRepository(db);
const rutas = new PostgresRutaRepository(db);
const horarios = new PostgresHorarioRepository(db);
const jornadas = new PostgresJornadaRepository(db);
const entregas = new PostgresEntregaRepository(db);
const registro = new PostgresRegistroAprendizajeRepository(db);
const identidad = new IdentidadSupabase({ urlBase: env.SUPABASE_URL, claveServicio: env.SUPABASE_SERVICE_ROLE_KEY, clavePublica: env.SUPABASE_ANON_KEY });
const almacen = new AlmacenSupabase({ urlBase: env.SUPABASE_URL, claveServicio: env.SUPABASE_SERVICE_ROLE_KEY });
const dbHealth = new PostgresDatabaseHealth(db);
const clock = relojDelSistema;

// Casos de uso con sus puertos inyectados
const resolverCamion = crearResolverCamion({ jornadas, clock });
// Búsqueda del pin por la dirección: una cola en memoria, de a uno por segundo, que no hace esperar a nadie.
const colaDePines = crearColaGeocodificacion({
  geocodificar: crearGeocodificarLocal({ clientes, geocodificador: crearNominatimGeocodificador(env.GEOCODER_USER_AGENT), clock }),
  esperar: (ms) => new Promise((resolver) => { setTimeout(resolver, ms); }),
});
const programarPines = (empresaId: string, localIds: readonly string[]): void => { colaDePines.encolar(empresaId, localIds); };
const aprendizaje = new PostgresAprendizajeRepository(db);
const analitica = new PostgresAnaliticaRepository(db);
// Tiempos por calles: solo si hay clave de OpenRouteService; sin ella la ruta mide en línea recta.
const viajes = crearViajesPorCalle({ proveedor: env.ORS_API_KEY ? crearProveedorOrs(env.ORS_API_KEY) : undefined, cache: new PostgresCacheDeViajes(db) });
const serviciosDeRuta = crearServiciosDeRuta({ rutas, empresas, camiones, facturas, entregas, jornadas, registro, aprendizaje, viajes, clock, resolverCamion, programarPines });
const analizarAprendizaje = crearAnalizarAprendizaje({ aprendizaje, empresas, pines, clock });

// El analizador corre en segundo plano: poco después de terminar una ruta (con calma, juntando varias) y cada pocas horas. Nunca bloquea una petición.
const CADA_HORAS = 3;
let analizando = false;
let programado: NodeJS.Timeout | undefined;
const analizarTodo = async (): Promise<void> => {
  if (analizando) return;
  analizando = true;
  try {
    for (const empresaId of await aprendizaje.empresas()) await analizarAprendizaje(empresaId);
  } catch (e) {
    console.error('El análisis de aprendizaje falló', e);
  } finally {
    analizando = false;
  }
};
const analizarPronto = (): void => {
  if (programado) return;
  programado = setTimeout(() => { programado = undefined; void analizarTodo(); }, 30_000);
  programado.unref();
};
const terminarJornada = crearTerminarJornada({ jornadas, facturas, rutas, registro, clock });
const casos: CasosDeUso = {
  checkHealth: () => checkHealth({ db: dbHealth, clock }),
  autenticar: crearAutenticarUsuario({ identidad, usuarios, clock }),
  iniciarSesion: crearIniciarSesion({ identidad, usuarios, intentos, clock, dominioCorreo: env.AUTH_EMAIL_DOMAIN }),
  refrescarSesion: crearRefrescarSesion({ identidad }),
  crearUsuario: crearCrearUsuario({ identidad, usuarios, dominioCorreo: env.AUTH_EMAIL_DOMAIN }),
  listarUsuarios: crearListarUsuarios({ usuarios }),
  resetearPin: crearResetearPin({ identidad, usuarios, intentos }),
  cambiarEstadoUsuario: crearCambiarEstadoUsuario({ usuarios }),
  cambiarEditorUsuario: crearCambiarEditorUsuario({ usuarios }),
  buscarClientes: crearBuscarClientes({ clientes }),
  crearClienteNuevo: crearCrearClienteNuevo({ clientes }),
  importarClientes: crearImportarClientes({ clientes }),
  obtenerLocal: crearObtenerLocal({ clientes, entregas }),
  actualizarLocal: crearActualizarLocal({ clientes }),
  importarPines: crearImportarPines({ clientes, pines }),
  listarPropuestasPin: crearListarPropuestasPin({ pines }),
  resolverPropuestaPin: crearResolverPropuestaPin({ pines, clock }),
  solicitarUrlSubida: crearSolicitarUrlSubida({ clientes, almacen, ids: generadorDeIds }),
  registrarFotoLocal: crearRegistrarFotoLocal({ clientes, almacen, clock }),
  quitarFotoLocal: crearQuitarFotoLocal({ clientes, almacen }),
  cambiarRazonSocial: crearCambiarRazonSocial({ clientes }),
  eliminarLocal: crearEliminarLocal({ clientes, almacen }),
  reportarFoto: crearReportarFoto({ clientes, reportes: reportesFoto }),
  fotosParaRevision: crearFotosParaRevision({ reportes: reportesFoto }),
  verificarFoto: crearVerificarFoto({ clientes, clock }),
  verificarPin: crearVerificarPin({ clientes, clock }),
  resolverReporteFoto: crearResolverReporteFoto({ clientes, reportes: reportesFoto, almacen, clock }),
  exportarLocales: crearExportarLocales({ clientes }),
  obtenerUrlFoto: crearObtenerUrlFoto({ clientes, almacen }),
  listarCamiones: crearListarCamiones({ camiones }),
  crearCamion: crearCrearCamion({ camiones }),
  actualizarCamion: crearActualizarCamion({ camiones }),
  fijarPinDesdeEnlace: crearFijarPinDesdeEnlace({ clientes, pines, resolvedor: crearResolvedorEnlacesHttp() }),
  listarVendedores: crearListarVendedores({ vendedores }),
  crearVendedor: crearCrearVendedor({ vendedores }),
  actualizarVendedor: crearActualizarVendedor({ vendedores }),
  registrarFactura: crearRegistrarFactura({ facturas, clock, resolverCamion, programarPines }),
  buscarPinesPendientes: crearBuscarPinesPendientes({ clientes, cola: colaDePines, clock }),
  estadoBusquedaPines: crearEstadoBusquedaPines({ clientes, cola: colaDePines }),
  listarFacturas: crearListarFacturas({ facturas, clock, resolverCamion }),
  actualizarFactura: crearActualizarFactura({ facturas, resolverCamion }),
  verRuta: serviciosDeRuta.ver,
  planificarRuta: serviciosDeRuta.planificar,
  operarRuta: serviciosDeRuta.operar,
  miJornada: crearMiJornada({ jornadas, clock }),
  iniciarJornada: crearIniciarJornada({ jornadas, rutas, clock }),
  terminarJornada: async (actor) => {
    const resumen = await terminarJornada(actor);
    analizarPronto();
    return resumen;
  },
  verAnalitica: crearVerAnalitica({ analitica, aprendizaje, camiones, clientes, clock }),
  ejecutarAnalisis: analizarAprendizaje,
  registrarPosiciones: crearRegistrarPosiciones({ registro, rutas, entregas, resolverCamion, clock }),
  registrarEvento: crearRegistrarEvento({ facturas, entregas, clientes, rutas, resolverCamion, reloj: clock, reordenarTrasVisita: serviciosDeRuta.reordenarTrasVisita }),
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
const ciclo = setInterval(() => void analizarTodo(), CADA_HORAS * 3_600_000);
ciclo.unref();
analizarPronto();
