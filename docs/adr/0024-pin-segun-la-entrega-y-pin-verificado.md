# ADR 0024 — El pin sale de donde se entrega; un pin verificado no se mueve

Estado: aceptada.

## Contexto

La base se está formando: muchos pines vienen de la búsqueda por dirección (aproximados) o de una planilla, y los datos de los primeros repartos mostraron entregas a 468 m, 1,6 km y hasta 8,7 km del pin. Donde el camión de verdad entrega es la mejor evidencia de dónde está el local.

## Decisión

- **Pin por verificar** (por defecto, todos): cada vez que se avisa ENTREGADO con GPS de ≤ 50 m, el pin del local pasa a ser ese lugar («sugerido», fuente chofer), por sobre el que había en la base. Con varias entregas el pin queda donde coinciden las demás (mediana del grupo más grande entre las últimas 5; si no coinciden, gana la más reciente), así una entrega avisada desde otro lado no lo arrastra. No se reescribe si se movió menos de ~10 m.
- **Pin verificado**: una persona (admin o despachador, permiso `pines:revisar`) lo confirma con VERIFICAR PIN, o acepta una propuesta de pin en la revisión. Un pin verificado no se mueve solo: ni por entregas ni por un enlace pegado (este queda como propuesta). Se puede quitar la verificación para que vuelva a ajustarse. Quién y cuándo queda en `pin_verificado_por` / `pin_verificado_en`.
- Un ENTREGADO con GPS peor que 50 m no mueve un pin que ya existe; si el local no tiene pin vale hasta 100 m. LLEGUÉ o «cerrado» siguen completando solo un local sin pin.
- El analizador (ADR 0022) solo propone mover y solo marca como dudosos los pines **verificados** que las visitas contradicen: los por verificar ya se corrigen solos. El panel de analítica cuenta verificados, por verificar y sin pin.

## Consecuencias

- Mientras nada esté verificado, incluso un pin exacto pegado desde Google Maps se ajusta con la posición del camión (unas decenas de metros de diferencia). Quien quiera fijarlo debe verificarlo.
- La ruta mejora sola a medida que se entrega: cada visita acerca el pin a la puerta real.
