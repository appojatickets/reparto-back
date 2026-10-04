export type Rol = 'admin' | 'despachador' | 'chofer';

export const TODOS_LOS_PERMISOS = [
  'clientes:leer',
  'clientes:escribir',
  'clientes:importar',
  'pines:proponer',
  'pines:revisar',
  'archivos:subir',
  'usuarios:gestionar',
  'camiones:gestionar',
  'facturas:leer',
  'facturas:escribir',
  'rutas:leer',
  'rutas:escribir',
  'empresa:configurar',
  'jornada:gestionar',
  'metricas:leer',
] as const;

export type Permiso = (typeof TODOS_LOS_PERMISOS)[number];

/**
 * Los permisos viven en el dominio y los aplica el adaptador HTTP. Chofer: carga sus facturas y ve su ruta (ADR 0012), busca clientes para
 * cargarlas, propone pines y sube fotos; la API limita facturas y rutas al camión de su jornada. Sin métricas, usuarios ni edición de clientes. Despachador: clientes y pines. Admin: todo.
 * Supuesto de negocio a confirmar: quién revisa los pines propuestos por los choferes (hoy admin y despachador).
 */
const PERMISOS_POR_ROL: Readonly<Record<Rol, readonly Permiso[]>> = {
  admin: TODOS_LOS_PERMISOS,
  despachador: ['clientes:leer', 'clientes:escribir', 'pines:proponer', 'pines:revisar', 'archivos:subir', 'facturas:leer', 'facturas:escribir', 'rutas:leer', 'rutas:escribir'],
  chofer: ['clientes:leer', 'pines:proponer', 'archivos:subir', 'facturas:leer', 'facturas:escribir', 'rutas:leer', 'rutas:escribir', 'jornada:gestionar'],
};

export const puede = (rol: Rol, permiso: Permiso): boolean => PERMISOS_POR_ROL[rol].includes(permiso);
