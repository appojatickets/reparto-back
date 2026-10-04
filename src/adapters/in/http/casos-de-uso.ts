import type { HealthReport } from '../../../application/use-cases/check-health.js';
import type { crearActualizarLocal } from '../../../application/use-cases/actualizar-local.js';
import type { crearObtenerUrlFoto, crearRegistrarFotoLocal, crearSolicitarUrlSubida } from '../../../application/use-cases/archivos.js';
import type { crearAutenticarUsuario } from '../../../application/use-cases/autenticar-usuario.js';
import type { crearBuscarClientes } from '../../../application/use-cases/buscar-clientes.js';
import type { crearCrearClienteNuevo } from '../../../application/use-cases/crear-cliente-nuevo.js';
import type { crearCrearUsuario } from '../../../application/use-cases/crear-usuario.js';
import type { crearCambiarEstadoUsuario, crearListarUsuarios, crearResetearPin } from '../../../application/use-cases/gestionar-usuarios.js';
import type { crearImportarClientes } from '../../../application/use-cases/importar-clientes.js';
import type { crearIniciarSesion } from '../../../application/use-cases/iniciar-sesion.js';
import type { crearObtenerLocal } from '../../../application/use-cases/obtener-local.js';
import type { crearImportarPines, crearListarPropuestasPin, crearResolverPropuestaPin } from '../../../application/use-cases/pines.js';
import type { crearRefrescarSesion } from '../../../application/use-cases/refrescar-sesion.js';

/** Todo lo que el adaptador HTTP necesita del resto de la aplicación; `main` lo arma y lo inyecta. */
export type CasosDeUso = {
  readonly checkHealth: () => Promise<HealthReport>;
  readonly autenticar: ReturnType<typeof crearAutenticarUsuario>;
  readonly iniciarSesion: ReturnType<typeof crearIniciarSesion>;
  readonly refrescarSesion: ReturnType<typeof crearRefrescarSesion>;
  readonly crearUsuario: ReturnType<typeof crearCrearUsuario>;
  readonly listarUsuarios: ReturnType<typeof crearListarUsuarios>;
  readonly resetearPin: ReturnType<typeof crearResetearPin>;
  readonly cambiarEstadoUsuario: ReturnType<typeof crearCambiarEstadoUsuario>;
  readonly buscarClientes: ReturnType<typeof crearBuscarClientes>;
  readonly crearClienteNuevo: ReturnType<typeof crearCrearClienteNuevo>;
  readonly importarClientes: ReturnType<typeof crearImportarClientes>;
  readonly obtenerLocal: ReturnType<typeof crearObtenerLocal>;
  readonly actualizarLocal: ReturnType<typeof crearActualizarLocal>;
  readonly importarPines: ReturnType<typeof crearImportarPines>;
  readonly listarPropuestasPin: ReturnType<typeof crearListarPropuestasPin>;
  readonly resolverPropuestaPin: ReturnType<typeof crearResolverPropuestaPin>;
  readonly solicitarUrlSubida: ReturnType<typeof crearSolicitarUrlSubida>;
  readonly registrarFotoLocal: ReturnType<typeof crearRegistrarFotoLocal>;
  readonly obtenerUrlFoto: ReturnType<typeof crearObtenerUrlFoto>;
};
