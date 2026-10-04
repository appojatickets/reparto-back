export type CodigoError =
  | 'NO_AUTENTICADO'
  | 'CREDENCIALES_INVALIDAS'
  | 'CUENTA_BLOQUEADA'
  | 'USUARIO_INACTIVO'
  | 'SIN_PERMISO'
  | 'NO_ENCONTRADO'
  | 'CONFLICTO'
  | 'VALIDACION'
  | 'SERVICIO_EXTERNO';

/** Error de negocio de un caso de uso. El adaptador HTTP lo traduce a un código de estado. */
export type ErrorApp = { readonly codigo: CodigoError; readonly mensaje: string; readonly detalle?: unknown };

export const errorApp = (codigo: CodigoError, mensaje: string, detalle?: unknown): ErrorApp =>
  detalle === undefined ? { codigo, mensaje } : { codigo, mensaje, detalle };
