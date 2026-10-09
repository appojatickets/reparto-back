# 0030 — Qué tan firme es un pin: el nivel de respaldo

Estado: propuesta (rama `claude/relaxed-allen-xpaz4l`, sin mergear a `main`). Sale de la pregunta del dueño, 2026-10-07: «¿cómo hacemos que el sistema entienda y discrimine un pin?». No cambia ningún comportamiento: solo hace visible algo que el sistema ya sabe.

## Contexto
El ADR 0024 mueve un pin «por verificar» a donde se entrega, y solo marca como dudosos los verificados. Pero hoy todos los pines por verificar se ven iguales: uno estimado por el buscador parece igual de firme que uno confirmado por tres entregas. Con 178 pines por verificar y ninguno verificado, el dueño no tiene cómo saber por cuáles empezar.

## Decisión
Cada pin con ubicación trae un **nivel de respaldo** (`pinRespaldo` en `GET /v1/locales/:id`), calculado en el momento a partir de sus entregas con buen GPS (≤ 50 m, las últimas 20):
- **verificado**: una persona lo confirmó.
- **respaldado**: al menos 2 entregas que coinciden entre sí (a ≤ 60 m una de otra), en al menos 2 días distintos (hora de Chile) y junto al pin (≤ 150 m).
- **en conflicto**: hay entregas pero no coinciden entre sí, o coinciden a más de 150 m del pin. Es lo que conviene mirar.
- **sin respaldo**: aún no alcanza la evidencia (sin entregas, una sola, o varias el mismo día).

Reglas de criterio:
- **Una sola entrega nunca es conflicto**: puede ser el pin o el lugar desde donde se tocó el botón. (Es el error de la primera lista de «dudosos»: alarmar con 1 visita.)
- Manda el **grupo más grande** que coincide: una entrega suelta lejos no deshace el respaldo.
- Dos entregas el mismo día no son confirmación independiente.
- Se calcula al pedir la ficha (no se guarda): no hay migración ni datos que mantener. Si no se pueden leer las entregas, la ficha se entrega igual sin el nivel.

## Fuera de alcance (a decidir por el dueño)
- Mover con más prudencia (que una sola entrega lejana no mueva un pin del buscador con confianza alta) cambiaría el ADR 0024.
- Verificar de una vez todos los «respaldados» con un botón.
- Contar los niveles en el panel de analítica.
