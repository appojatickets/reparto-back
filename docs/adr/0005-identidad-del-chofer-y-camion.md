# ADR 0005: La clave no es la patente; el camión se elige cada día (jornada)

Fecha: 2026-10-04 · Estado: propuesta (pendiente de confirmar con el dueño)

## Contexto
Se propuso usar la patente del camión como clave de login para identificar chofer + camión en el análisis.

## Decisión
Separar **autenticación** de **identificación operativa**:
- **Autenticación:** usuario + clave numérica de 6 dígitos, secreta (Supabase Auth, bloqueo tras 5 fallos).
- **Identificación para el análisis:** entidad `jornada` = chofer + camión + fecha, creada al elegir el camión al empezar
  el día (pantalla «¿Qué camión llevas hoy?»). Todo evento de parada referencia la jornada.
- Un camión y un chofer no pueden tener dos jornadas abiertas a la vez (índices únicos parciales).
- Opcional: QR en la cabina que abre la app con el camión preseleccionado (sin escribir la patente).

## Por qué no la patente como clave
- No es secreta (visible en el camión): con el usuario, que es fácil de adivinar, permitiría suplantar al chofer.
- Cambia cuando el chofer rota de camión: obligaría a cambiar la clave o a tener varias.
- Mezcla un dato público del negocio con un secreto; un error de tipeo bloquearía el acceso.

## Consecuencias
- Métricas por chofer, por camión y por pareja chofer-camión salen de `jornada`, no del credencial.
- Si cada chofer maneja siempre el mismo camión, se asigna al usuario y la pantalla de elección se omite.
- Tablas `camion` y `jornada` llegan con la Fase 4 (app del chofer).
