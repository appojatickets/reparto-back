# 0042 — El horario no saca paradas de la ruta

Estado: aceptada. Pedido del dueño, 2026-10-11: «cuando coloqué horarios me sacó de la ruta porque decía que no [se alcanzaba]; los horarios no se miden».

## Qué pasaba
- Si, según el horario cargado (o el día marcado como cerrado), una parada ya no se podía alcanzar antes de su cierre —yendo directo desde donde está el camión y con la hora de ahora—, el motor la **sacaba de la ruta** y la listaba aparte en «No se pueden atender», sin acciones. El mensaje de un día cerrado decía «Cerró a las 00:00…».
- El horario es una estimación (lo cargan personas o se lee de notas) y los tiempos de viaje también. Quien está en terreno sabe más que el cálculo: «lo que se hace manda sobre lo sugerido». Un horario mal cargado dejaba a un cliente abierto fuera de la ruta.

## Decisión
- **Ninguna parada sale de la ruta por su horario.** Las que según el horario ya cerraron (o no atienden hoy) se dejan fuera de la *búsqueda* —para que no distorsionen el orden de las demás— y van **al final de la ruta**, marcadas en riesgo (`enRiesgo`) con la explicación:
  - «Según su horario hoy no atiende.» (día marcado cerrado)
  - «Según su horario cerró a las HH:MM y ya no se alcanza a llegar a tiempo.»
- `noAtendidas` queda siempre vacío (el campo se mantiene por compatibilidad con el front).
- Un orden que una persona dejó (`evaluarOrden`) se respeta tal cual, incluidas esas paradas donde ella las puso; las que no están en él van al final.
- Las paradas fijadas por el chofer nunca se tratan como cerradas.

## Límite
- El optimizador no incluye el tramo hasta las que van al final al buscar el mejor orden de las demás (diferencia mínima en el costo total).
- Cargar un horario sigue influyendo: lo que está abierto y cerca de cerrar se atiende antes; lo que abre más tarde se deja para después.
