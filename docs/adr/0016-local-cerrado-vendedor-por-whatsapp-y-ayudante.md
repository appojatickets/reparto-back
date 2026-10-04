# 0016 — Local cerrado: aviso al vendedor por WhatsApp, esperar o seguir; el ayudante también usa la app

Estado: aceptada. Aclaraciones del dueño, 2026-10-04.

## Local cerrado
Flujo real: el chofer llega y el local está cerrado → **avisa al vendedor por WhatsApp** → el **vendedor llama al cliente** → con esa respuesta el chofer decide **esperar o irse**.

Decisión:
1. Botón **ESTÁ CERRADO** en la parada. Registra la hora y el punto GPS (evidencia de horario, ADR 0007) y abre WhatsApp con el mensaje ya armado para el vendedor (cliente, dirección, comuna, hora, y el pin si hay): «Estoy en … y está cerrado. ¿Puedes llamarlo?». Sin teléfono del vendedor, abre WhatsApp para elegir el contacto (enlace `wa.me`, gratis, sin integración).
2. Después, dos opciones de un toque: **ESPERAR** (cuenta regresiva elegible, 10/15/20 min; las horas de la ruta se corren) o **SEGUIR**: queda como *no entregado – cerrado* y se elige **VOLVER MÁS TARDE** (se reinserta más adelante en la ruta) o **DEJAR PARA OTRO DÍA**.
3. Atajo para anotar lo que dijo el vendedor: «abre a las 14:00» (botones de hora) → se guarda como dato de horario de ese local (ADR 0011), con la fuente «chofer».
4. El teléfono del vendedor sale del registro de vendedores (V01…V16, con celular) y de la planilla del día (qué vendedores van en cada camión); se pregunta al dueño si el aviso va a un vendedor concreto (el dueño del cliente) o a cualquiera del camión.

## Ayudante
La planilla de la mañana trae **chofer + ayudante + camión**. El ayudante usa la app con su propio usuario, **anclado al camión del día** (y por tanto a su chofer): puede cargar entregas, agregar clientes, fijar pines, fotos y notas en ese camión, y ve la misma ruta. Lo que carga o corrige sirve a todos (colaborativo). Es un rol nuevo `ayudante`, con los permisos del chofer sobre el camión al que se ancla.
