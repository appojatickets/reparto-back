# ADR 0032 — El pin se verifica solo cuando las entregas lo confirman

Estado: aceptada (2026-10-08). Pedido del dueño: «si una o más veces dice entregado y el pin está similar, ya no se toque, y que tenga una insignia de verificado». Complementa el ADR 0024 (pin por entregas) y el ADR 0030 (nivel de respaldo).

## Contexto
Con 178 pines por verificar y ninguno verificado, nadie iba a revisarlos uno por uno. Pero los datos reales ya confirman muchos:
- Un pin que nació de una entrega coincide siempre con esa entrega, así que una sola entrega no prueba nada (el 93 % de los pines vienen de ahí).
- De los pines de otra fuente (buscador, enlace, planilla) con una entrega, 12 de 14 (86 %) quedaron a ≤60 m. Solo 4 de 119 entregas cayeron a más de 150 m del pin.

## Decisión
Al avisar ENTREGADO con buen GPS (≤50 m de precisión), si el pin no está verificado:
1. **Pin de otra fuente** (`geocodificador`, `enlace`, `importado`, `manual`) y la entrega queda a **≤60 m**: el pin queda **verificado por entregas**, tal cual (no se mueve a la entrega).
2. **Pin que nació de una entrega** (`chofer`, `aprendido`): sigue ajustándose como en el ADR 0024. Cuando el respaldo lo confirma (≥2 entregas que coinciden, en ≥2 días distintos, a ≤60 m del pin), queda verificado por entregas.
3. Si no se cumple ninguna, todo sigue como antes (se ajusta a donde se entrega).

Un pin verificado, por una persona o por las entregas, **no se mueve solo**. Una entrega lejos de un pin verificado no lo cambia: esas entregas ya aparecen entre los «dudosos» de ANALÍTICA y el nivel de respaldo lo muestra.

## Cómo se distingue de una verificación hecha a mano
Sin migración: `pin_verificado_en` con `pin_verificado_por` nulo = verificado por las entregas; con persona = verificado por una persona. `GET /v1/locales/:id` trae `pinVerificacion: 'persona' | 'entregas'`. Una persona puede quitar la verificación (vuelve a ajustarse) y volver a verificar.

## Reglas de seguridad
- La verificación automática nunca bloquea el aviso: si falla, el ENTREGADO igual queda hecho.
- Solo verifica si el local tiene pin y no estaba verificado (consulta condicional).
- Las constantes (50 m de precisión, 60 m, 2 entregas en 2 días) son las mismas del ADR 0024 y 0030: un solo criterio.

## Lista para revisar pines (ADR 0033, misma entrega)
`GET /v1/pines/revision?estado=por_verificar|verificados` (permiso nuevo `pines:verificar`): hasta 100 pines con su nivel de respaldo. «Por verificar» va con lo más seguro primero (respaldados, después en conflicto, después sin respaldo); «verificados» con los más recientes primero y quién los verificó. El permiso `pines:verificar` lo tienen admin, despachador y el **chofer editor** (también para `PUT /v1/locales/:id/pin/verificacion`); no incluye aceptar propuestas ni buscar pines (siguen en `pines:revisar`).
