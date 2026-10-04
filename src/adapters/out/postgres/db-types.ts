import type { ColumnType, Generated } from 'kysely';

/** Columna calculada por la base (`generated always as … stored`): se lee, no se escribe. */
type Calculada<T> = ColumnType<T, never, never>;
type Fecha = ColumnType<Date, Date | string | undefined, Date | string>;

export type Tabla = {
  empresa: { id: Generated<string>; nombre: string; config: ColumnType<unknown, string | undefined, string>; config_version: Generated<number>; creado_en: Generated<Date> };
  usuario: { id: string; empresa_id: string; rol: 'admin' | 'despachador' | 'chofer'; username: string; nombre: string; activo: Generated<boolean>; creado_en: Generated<Date> };
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
    pin_fuente: 'geocodificador' | 'manual' | 'importado' | 'aprendido' | 'chofer' | null;
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
    desde: string;
    hasta: string;
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
  login_intento: { usuario_id: string; intentos: Generated<number>; bloqueado_hasta: Date | null };
};
