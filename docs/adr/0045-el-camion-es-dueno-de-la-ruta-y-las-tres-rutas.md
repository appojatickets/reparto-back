# 0045 — El camión es dueño de la ruta (varias personas a la vez) y se guardan las tres rutas del día

Estado: aceptada. Pedido del dueño, 2026-10-13: «el camión es dueño de la ruta y enlaza a los usuarios (ej. smena y mcarrion en el camión 81); cada uno interactúa en la ruta y la actualizan en tiempo real» y «se debe guardar la ruta en función de la entrega: se ordena pero a veces se entrega fuera del orden».

## Lo que ya era así
- La ruta se guarda por **camión + día**, no por persona, con versión (si dos mueven a la vez, el segundo recibe `RUTA_DESACTUALIZADA` y ve la versión nueva).
- La jornada es por persona; solo hay un índice único por usuario, así que chofer y ayudante pueden tener abierto el mismo camión.
- Cada cálculo o movimiento queda en `ruta_operacion` y cada aviso en `entrega_evento`.

## Lo que se corrige y agrega
1. **Ventana del camión** (`ventanaDelCamion`): la lista de «hechas» contaba desde la última jornada del camión, así que si el segundo en entrar abría después, **se le escondía lo que el primero ya había entregado**. Ahora se juntan las jornadas traslapadas y lo hecho cuenta desde que empezó el equipo.
2. **Terminar la ruta con compañero**: si otra persona sigue con jornada abierta en el camión, quien termina solo se baja (`sigueElCamion: true` en el resumen); **no** se borra la ruta, no se sueltan las pendientes ni se escribe el resumen del día. Eso lo hace quien cierre al último.
3. **Tiempo real barato**: `GET /v1/rutas/marca` devuelve una marca (versión de la ruta + conteos de entregadas, no entregadas, pendientes y anuladas) sin calcular horas ni pedir tiempos por calles. La app la consulta cada pocos segundos mientras está a la vista y recarga la ruta completa solo si la marca cambió.
4. **Las tres rutas del día** (`jornada_resumen`, migración `1759800000000`): para cada jornada comparada el analizador guarda los ids en orden de
   - `orden_sugerido`: lo que sugirió el sistema (o, en un día manual, lo que habría sugerido con las mismas paradas);
   - `orden_salida`: la lista con la que salió el camión, ya con lo que la persona acomodó a mano (manual o automático);
   - `orden_entregado`: el orden real de cada ENTREGADO;
   - `inversiones_salida`: pares entregados en distinto orden que el de la salida.
   La analítica muestra cuántos pares se entregaron fuera de orden y si el camión salió como sugería el sistema. El analizador adelanta el inicio de cada jornada al del compañero que coincidió, para que el día se mida completo.

## Límites
- No hay empuje en vivo (websocket): es consulta cada pocos segundos, suficiente en Render Starter y sin costo extra.
- Las tres rutas se calculan en el analizador de segundo plano, no al instante de terminar.
