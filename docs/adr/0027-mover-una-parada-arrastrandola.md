# 0027 — Mover una parada arrastrándola (operación «mover»)

> Nota (ADR 0029): desde el mismo día, lo que queda **debajo** de la parada soltada se vuelve a ordenar solo; la parada y todo lo de arriba quedan como las dejó la persona. Lo demás de este ADR sigue igual. La pantalla está en el ADR 0016 del front.

Estado: aceptada. Pedido del dueño, 2026-10-07: «presionar el botón y subir y bajar como un scroll y, al soltarlo, que se posicione en la lista».

## Decisiones
- **Operación nueva** `{ tipo: 'mover', facturaId, posicion }` en `POST /v1/rutas/operaciones`: la parada queda exactamente en `posicion` de la lista de paradas en orden (0 = la primera; un número fuera de la lista se acota al extremo) y las demás conservan su orden relativo. Pasa la ruta a modo **manual**, sube la versión y recalcula las horas con el nuevo orden.
- **Una sola llamada por arrastre**, no una por cada lugar que se cruza: soltar una parada 15 lugares más abajo es una operación, un registro y una versión.
- **No se reoptimiza**: lo que la persona soltó es lo que manda (igual que SUBIR/BAJAR). Una parada fijada («ir primero») sigue fijada solo mientras siga encabezando la ruta.
- **Queda anotada** como corrección (`ruta_operacion.tipo = 'mover'`, con el orden resultante) y la analítica la cuenta entre los cambios hechos a mano, como subir/bajar: es la señal de cuánto se corrige lo que sugirió el sistema.
- **SUBIR y BAJAR siguen en la API** y ahora son el caso particular «una posición». La app los reemplaza por el arrastre (y por las flechas del teclado en el asa), pero no se quitan: el contrato no se rompe.
- **Migración** `1759725000000_operacion-mover.sql`: amplía la restricción de tipos de `ruta_operacion`. Es aditiva y compatible con la versión anterior del back; se aplica antes de desplegar. La migración de vuelta conserva lo ya anotado (la restricción vieja solo se exige a lo nuevo).
