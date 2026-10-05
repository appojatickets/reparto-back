import type { CasosDeUso } from './casos-de-uso.js';

const noImplementado = (): never => {
  throw new Error('Caso de uso no disponible en este contexto');
};

/**
 * Casos de uso que fallan al usarse. Sirven para construir el servidor sin base de datos (generar `openapi.json`) y
 * como base de las pruebas HTTP, que reemplazan solo los que cada prueba necesita.
 */
export const casosVacios = (): CasosDeUso => {
  const sinImplementar = noImplementado as unknown;
  return {
    checkHealth: () => Promise.resolve({ status: 'ok', database: 'ok', timestamp: new Date(0).toISOString() }),
    autenticar: sinImplementar,
    iniciarSesion: sinImplementar,
    refrescarSesion: sinImplementar,
    crearUsuario: sinImplementar,
    listarUsuarios: sinImplementar,
    resetearPin: sinImplementar,
    cambiarEstadoUsuario: sinImplementar,
    buscarClientes: sinImplementar,
    crearClienteNuevo: sinImplementar,
    importarClientes: sinImplementar,
    obtenerLocal: sinImplementar,
    actualizarLocal: sinImplementar,
    importarPines: sinImplementar,
    listarPropuestasPin: sinImplementar,
    resolverPropuestaPin: sinImplementar,
    solicitarUrlSubida: sinImplementar,
    registrarFotoLocal: sinImplementar,
    obtenerUrlFoto: sinImplementar,
    listarCamiones: sinImplementar,
    crearCamion: sinImplementar,
    actualizarCamion: sinImplementar,
    fijarPinDesdeEnlace: sinImplementar,
    listarVendedores: sinImplementar,
    crearVendedor: sinImplementar,
    actualizarVendedor: sinImplementar,
    registrarFactura: sinImplementar,
    listarFacturas: sinImplementar,
    actualizarFactura: sinImplementar,
    verRuta: sinImplementar,
    planificarRuta: sinImplementar,
    operarRuta: sinImplementar,
    miJornada: sinImplementar,
    iniciarJornada: sinImplementar,
    terminarJornada: sinImplementar,
    registrarEvento: sinImplementar,
    obtenerHorario: sinImplementar,
    guardarHorario: sinImplementar,
    obtenerConfigEmpresa: sinImplementar,
    guardarConfigEmpresa: sinImplementar,
  } as CasosDeUso;
};
