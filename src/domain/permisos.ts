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
  'metricas:leer',
] as const;

export type Permiso = (typeof TODOS_LOS_PERMISOS)[number];

/**
 * Los permisos viven en el dominio y los aplica el adaptador HTTP. Chofer: solo lo que necesita en ruta (proponer pines,
 * subir fotos de fachada); sin métricas ni clientes. Despachador: clientes y pines. Admin: todo.
 * Supuesto de negocio a confirmar: quién revisa los pines propuestos por los choferes (hoy admin y despachador).
 */
const PERMISOS_POR_ROL: Readonly<Record<Rol, readonly Permiso[]>> = {
  admin: TODOS_LOS_PERMISOS,
  despachador: ['clientes:leer', 'clientes:escribir', 'pines:proponer', 'pines:revisar', 'archivos:subir', 'facturas:leer', 'facturas:escribir'],
  chofer: ['pines:proponer', 'archivos:subir'],
};

export const puede = (rol: Rol, permiso: Permiso): boolean => PERMISOS_POR_ROL[rol].includes(permiso);
