import type { ColumnType, Generated } from 'kysely';

/** Columna calculada por la base (`generated always as … stored`): se lee, no se escribe. */
type Calculada<T> = ColumnType<T, never, never>;
type Fecha = ColumnType<Date, Date | string | undefined, Date | string>;

export type Tabla = {
  empresa: { id: Generated<string>; nombre: string; config: ColumnType<unknown, string | undefined, string>; config_version: Generated<number>; creado_en: Generated<Date> };
  usuario: { id: string; empresa_id: string; rol: 'admin' | 'despachador' | 'chofer' | 'ayudante'; username: string; nombre: string; activo: Generated<boolean>; creado_en: Generated<Date> };
  cliente: {
    id: Generated<string>;
    empresa_id: string;
    rut: string | null;
    razon_social: string;
    razon_social_norm: Calculada<string>;
    giro: string | null;
    estado: Generated<'nuevo' | 'activo' | 'inactivo' | 'cerrado' | 'archivado'>;
    creado_en: Generated<Date>;
  };
  local: {
    id: Generated<string>;
    empresa_id: string;
    cliente_id: string;
    direccion: string;
    direccion_norm: Calculada<string>;
    comuna: string;
    lat: number | null;
    lng: number | null;
    pin_estado: Generated<'pendiente' | 'sugerido' | 'validado'>;
    pin_fuente: 'geocodificador' | 'manual' | 'importado' | 'aprendido' | 'chofer' | 'enlace' | null;
    pin_confianza: number | null;
    foto_path: string | null;
    streetview_rumbo: number | null;
    nota: string | null;
    creado_en: Generated<Date>;
  };
  horario_local: {
    id: Generated<string>;
    empresa_id: string;
    local_id: string;
    dias: number[];
    desde: string | null;
    hasta: string | null;
    cerrado: Generated<boolean>;
    fuente: 'confirmado' | 'aprendido' | 'sugerido' | 'giro';
    confianza: Generated<number>;
    observado_en: Fecha;
  };
  propuesta_pin: {
    id: Generated<string>;
    empresa_id: string;
    local_id: string | null;
    rut: string | null;
    direccion: string;
    direccion_norm: Calculada<string>;
    lat: number;
    lng: number;
    distancia_actual_m: number | null;
    estado: Generated<'pendiente' | 'aceptada' | 'rechazada' | 'sin_local'>;
    propuesto_por: string;
    resuelto_por: string | null;
    creado_en: Generated<Date>;
    resuelto_en: Date | null;
  };
  camion: { id: Generated<string>; empresa_id: string; patente: string; alias: string | null; activo: Generated<boolean>; creado_en: Generated<Date> };
  vendedor: { id: Generated<string>; empresa_id: string; codigo: string; nombre: string; celular: string | null; activo: Generated<boolean>; creado_en: Generated<Date> };
  factura: {
    id: Generated<string>;
    empresa_id: string;
    folio: string | null;
    local_id: string;
    camion_id: string | null;
    fecha_reparto: string;
    total: number | null;
    antes_de_min: number | null;
    urgente: Generated<boolean>;
    nota: string | null;
    estado: Generated<'pendiente' | 'entregada' | 'no_entregada' | 'anulada'>;
    creado_por: string | null;
    creado_en: Generated<Date>;
    actualizado_en: Generated<Date>;
  };
  ruta: {
    id: Generated<string>;
    empresa_id: string;
    camion_id: string;
    fecha_reparto: string;
    salida_min: number;
    modo: Generated<'sugerida' | 'manual'>;
    version: Generated<number>;
    creado_por: string | null;
    creado_en: Generated<Date>;
    actualizado_en: Generated<Date>;
  };
  parada_ruta: { ruta_id: string; factura_id: string; orden: number; fijada: Generated<boolean> };
  entrega_evento: {
    id: Generated<string>;
    empresa_id: string;
    factura_id: string;
    local_id: string;
    camion_id: string | null;
    usuario_id: string | null;
    tipo: 'llegada' | 'entregado' | 'cerrado' | 'espera' | 'no_entregado' | 'vuelve_mas_tarde';
    motivo: 'cerrado' | 'no_recibe' | 'direccion' | 'otro' | null;
    minutos: number | null;
    lat: number | null;
    lng: number | null;
    precision_m: number | null;
    creado_en: Generated<Date>;
  };
  jornada: {
    id: Generated<string>;
    empresa_id: string;
    usuario_id: string;
    camion_id: string;
    fecha_reparto: string;
    desde: Generated<Date>;
    hasta: Date | null;
  };
  login_intento: { usuario_id: string; intentos: Generated<number>; bloqueado_hasta: Date | null };
};
