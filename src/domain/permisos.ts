export type Rol = 'admin' | 'despachador' | 'chofer' | 'ayudante';

export const TODOS_LOS_PERMISOS = [
  'clientes:leer',
  'clientes:escribir',
  'clientes:crear',
  'clientes:importar',
  'pines:proponer',
  'pines:revisar',
  'archivos:subir',
  'usuarios:gestionar',
  'camiones:gestionar',
  'vendedores:leer',
  'vendedores:gestionar',
  'facturas:leer',
  'facturas:escribir',
  'rutas:leer',
  'rutas:escribir',
  'empresa:configurar',
  'jornada:gestionar',
  'entregas:registrar',
  'metricas:leer',
  'datos:exportar',
  'fotos:revisar',
] as const;

export type Permiso = (typeof TODOS_LOS_PERMISOS)[number];

/**
 * Los permisos viven en el dominio y los aplica el adaptador HTTP. Chofer: carga sus facturas y ve su ruta (ADR 0012), busca clientes para
 * cargarlas, propone pines y sube fotos; la API limita facturas y rutas al camión de su jornada. Sin métricas, usuarios ni edición de clientes. Despachador: clientes y pines. Admin: todo.
 * Supuesto de negocio a confirmar: quién revisa los pines propuestos por los choferes (hoy admin y despachador).
 */
const PERMISOS_DE_CAMION: readonly Permiso[] = ['clientes:leer', 'clientes:crear', 'pines:proponer', 'archivos:subir', 'facturas:leer', 'facturas:escribir', 'rutas:leer', 'rutas:escribir', 'jornada:gestionar', 'entregas:registrar', 'vendedores:leer'];

const PERMISOS_POR_ROL: Readonly<Record<Rol, readonly Permiso[]>> = {
  admin: TODOS_LOS_PERMISOS,
  despachador: ['clientes:leer', 'clientes:escribir', 'clientes:crear', 'pines:proponer', 'pines:revisar', 'archivos:subir', 'facturas:leer', 'facturas:escribir', 'rutas:leer', 'rutas:escribir', 'entregas:registrar', 'vendedores:leer'],
  chofer: PERMISOS_DE_CAMION,
  ayudante: PERMISOS_DE_CAMION,
};

/** Chofer y ayudante van en el camión y tienen los mismos permisos (el ayudante se ancla al camión del día; ADR 0016). */
export const esDeCamion = (rol: Rol): boolean => rol === 'chofer' || rol === 'ayudante';

export const puede = (rol: Rol, permiso: Permiso): boolean => PERMISOS_POR_ROL[rol].includes(permiso);
