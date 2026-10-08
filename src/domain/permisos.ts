export type Rol = 'admin' | 'despachador' | 'chofer' | 'ayudante';

export const TODOS_LOS_PERMISOS = [
  'clientes:leer',
  'clientes:escribir',
  'clientes:crear',
  'clientes:importar',
  'pines:proponer',
  'pines:revisar',
  'pines:verificar',
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
  'reportes:revisar',
  'locales:eliminar',
] as const;

export type Permiso = (typeof TODOS_LOS_PERMISOS)[number];

/**
 * Los permisos viven en el dominio y los aplica el adaptador HTTP. Chofer: carga sus facturas y ve su ruta (ADR 0012), busca clientes para
 * cargarlas, propone pines y sube fotos; la API limita facturas y rutas al camión de su jornada. Sin métricas, usuarios ni edición de clientes. Despachador: clientes y pines. Admin: todo.
 * Supuesto de negocio a confirmar: quién revisa los pines propuestos por los choferes (hoy admin y despachador).
 */
const PERMISOS_DE_CAMION: readonly Permiso[] = ['clientes:leer', 'clientes:crear', 'pines:proponer', 'archivos:subir', 'facturas:leer', 'facturas:escribir', 'rutas:leer', 'rutas:escribir', 'jornada:gestionar', 'entregas:registrar', 'vendedores:leer'];

/**
 * Un chofer o ayudante con permiso de editor (lo da o quita el admin) puede corregir lo que se cargó mal: el nombre del cliente, la nota, el
 * pin, quitar una foto subida por error, eliminar una dirección equivocada y verificar pines (ADR 0033). Nada más: ni usuarios, ni métricas, ni importaciones.
 */
const PERMISOS_DE_EDITOR: readonly Permiso[] = ['clientes:escribir', 'locales:eliminar', 'pines:verificar'];

const PERMISOS_POR_ROL: Readonly<Record<Rol, readonly Permiso[]>> = {
  admin: TODOS_LOS_PERMISOS,
  despachador: ['clientes:leer', 'clientes:escribir', 'clientes:crear', 'pines:proponer', 'pines:revisar', 'pines:verificar', 'reportes:revisar', 'archivos:subir', 'facturas:leer', 'facturas:escribir', 'rutas:leer', 'rutas:escribir', 'entregas:registrar', 'vendedores:leer', 'locales:eliminar'],
  chofer: PERMISOS_DE_CAMION,
  ayudante: PERMISOS_DE_CAMION,
};

/** Chofer y ayudante van en el camión y tienen los mismos permisos (el ayudante se ancla al camión del día; ADR 0016). */
export const esDeCamion = (rol: Rol): boolean => rol === 'chofer' || rol === 'ayudante';

/** `editor`: el usuario tiene el permiso de editor (solo cuenta para chofer y ayudante). */
export const puede = (rol: Rol, permiso: Permiso, editor = false): boolean =>
  PERMISOS_POR_ROL[rol].includes(permiso) || (editor && esDeCamion(rol) && PERMISOS_DE_EDITOR.includes(permiso));
