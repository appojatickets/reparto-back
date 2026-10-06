# 0020 — Terminar la ruta y el registro del día

Estado: aceptada. Pedido del dueño, 2026-10-05: «el sistema debe detectar que al llegar al punto inicial se acaba la ruta, o un botón TERMINAR RUTA siempre abajo de la lista»; «cada día se limpia la lista y se piensa con las facturas de ese día»; «guardar el registro: anotar el comenzar y terminar, para cálculos internos que hagan las rutas más inteligentes».

## Decisiones
- **Terminar la ruta = terminar la jornada.** `POST /v1/jornada/terminar` cierra la jornada de hoy (queda `hasta`, la hora de término; `desde` ya era la de inicio) y devuelve el **resumen del día de ese camión**: entregadas, no entregadas y pendientes. `DELETE /v1/jornada` sigue existiendo (la pantalla «Mi jornada» no cambia) y también registra el término. Sin jornada de hoy no inventa resumen.
- **Las pendientes no se tocan.** Lo que no se alcanzó a entregar queda pendiente *de su día*; no pasa solo al siguiente ni se marca como no entregado. Así el resumen cuenta lo que realmente pasó y mañana se parte limpio.
- **El día ya se separa solo.** Facturas, rutas y jornadas van por fecha de reparto, y una jornada abierta de un día anterior no cuenta (ADR 0010). Al día siguiente el chofer elige camión y su lista parte vacía; no hay nada que borrar a mano. El historial queda en la base (rutas, paradas, eventos con hora y GPS) para aprender.
- **Registro sin tablas nuevas.** El inicio y término de cada jornada, las facturas con su estado y los eventos de entrega con hora y posición bastan para calcular después: tiempos reales por tramo y por local, ritmo del camión, locales que suelen estar cerrados a cierta hora, pines confirmados por visitas. El resumen se calcula al terminar; no se guarda aparte (se puede recalcular).
- **La vista de la ruta trae el depósito** (`deposito`): la app lee el GPS mientras la pantalla está abierta y, al llegar al depósito después de haber hecho entregas, avisa o termina sola (ADR 0010 del front).

## Pendiente (aprendizaje)
Con unas dos semanas de rutas reales: ritmo real por camión y franja, tiempo de servicio por local, horario aprendido de los locales («cerrado» repetido a la misma hora) y pines por visitas coherentes. Los tiempos no se muestran hasta que sean confiables.

## Actualización: la ruta no se guarda, solo los datos para aprender

La ruta se arma cada día y nunca se repite, así que no se conserva. Al **terminar la ruta** (`POST /v1/jornada/terminar`) la lista del camión queda limpia al instante:

- se borra la ruta guardada de ese camión y día, y toda ruta guardada de días anteriores (también al empezar una jornada, por si alguien no terminó);
- lo entregado y lo no entregado deja de mostrarse en la lista: `hechas` solo cuenta desde que terminó la última jornada del camión (o desde que empezó la vigente), sin columnas nuevas;
- lo pendiente se suelta del camión y queda «sin camión» en su mismo día (no pasa solo al día siguiente).

Lo que sí queda es lo que sirve para que el algoritmo aprenda: la jornada con hora de inicio y término, los avisos de entrega con su posición (`entrega_evento`) y el resultado de cada factura. Además, ahora se guarda para siempre el resumen de cada jornada, cada movimiento de la ruta y el recorrido del camión (ADR 0022). Si no se toca TERMINAR, el día siguiente empieza limpio igual: todo está separado por fecha y la jornada de otro día no cuenta.
