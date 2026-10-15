# 0049 — Ficha aprendida por local y banco de pruebas

Estado: aceptada (primera etapa: **mide y muestra**; el motor todavía no la usa). Pedido del dueño, 2026-10-15: que lo aprendido sirva («usualmente se entrega entre tal y tal hora», «cierra a tal hora»), porque los días se parecen pero no son iguales.

## Ficha aprendida (`GET /v1/locales/:id/ficha-aprendida`)
Se calcula al pedirla, con los avisos de entrega y de cerrado de los últimos 180 días (`fichaAprendida`, dominio):
- **Hora habitual de entrega**: rango (de un cuarto a tres cuartos de los casos) y mediana; con 3 o más entregas. También por día de la semana si ese día tiene 3 o más.
- **Cerrado por franja de 2 horas**: visitas, cerrados y probabilidad suavizada `(cerrados + 1) / (visitas + 2)`. Una franja sin visitas queda desconocida (no haber ido no prueba que cierre; ADR 0007).
- **Confianza** `n / (n + 10)`. Rangos y probabilidades, no horas fijas.

## Banco de pruebas (`bancoDePruebasDeFicha`, en el análisis de segundo plano)
Se repasa lo ocurrido en orden: para cada visita se arma la ficha del local **solo con días anteriores** (no se mira el futuro ni el mismo día) y se compara su predicción con lo que pasó:
- **Cierres**: cuántos de los cierres reales anticipó (cerrado si `p ≥ 0,5` con ≥ 2 visitas en la franja), cuántas falsas alarmas dio y cuántas visitas acertó.
- **Hora**: cuántas entregas cayeron dentro del rango habitual (± 30 min).
Sale en `GET /v1/analitica` (`bancoFicha`) y en el panel. Es la prueba que decide si el motor la usa.

## Criterio para usarla en la ruta (etapa 2)
Solo si el banco de pruebas muestra que acierta bastante más que «siempre abierto» (línea base) con muestra suficiente. Entonces entra al motor como **horario blando** con peso según la confianza; lo manual sigue mandando. Después: afinidades entre locales y «días parecidos».

## Límites
Pocos días de datos ⇒ las cifras no concluyen. El cierre deducido por GPS (ADR 0046) aún no alimenta la ficha: primero hay que validarlo.
