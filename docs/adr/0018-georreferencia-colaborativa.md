# 0018 — La base de ubicaciones se nutre sola con el uso: GPS siempre y enlace del vendedor

Estado: aceptada. Decisiones del dueño, 2026-10-05.

## Contexto
Cada mañana cada chofer carga 30 o más entregas por voz o a mano, planea la ruta de memoria y llama al vendedor si duda. Lo que cada uno aprende (dónde queda el local, cuándo abre) debe quedar guardado para todos. Se descarta el OCR de la guía: lento, engorroso y dependiente de la cámara; voz y texto bastan.

## Decisiones
1. **La posición se guarda siempre.** ENTREGADO y ESTÁ CERRADO toman una lectura de GPS (y se guarda con su precisión en cada aviso, como evidencia). Si el local no tiene pin y la precisión es ≤ 100 m, esa posición pasa a ser su pin «sugerido» (fuente `chofer`). Se quita el botón ESTOY AQUÍ: ya no hace falta, el chofer está en la puerta al entregar. Si el GPS falla el aviso se anota igual y se le dice al chofer.
2. **Todos pegan el enlace del vendedor.** Chofer, ayudante, despachador y admin pegan el enlace de «Compartir» de Google Maps o Waze (largo o corto) o unas coordenadas, desde la parada («UBICACIÓN DEL VENDEDOR») o desde la ficha del cliente. La API lee el punto (`!3d!4d`, `@lat,lng`, `q=`, `ll=`, `destination=`, `ll.lat,lng` de Waze). Los enlaces cortos (`maps.app.goo.gl`, `goo.gl`, `waze.com`) se abren desde el servidor siguiendo las redirecciones a mano, solo hacia hosts de mapas, con tope de 5 saltos y 4 s, sin descargar el cuerpo (no sirve para consultar direcciones internas).
3. **Confianza del pin**, de mayor a menor: corregido o validado por una persona (admin, revisión de propuestas) › enlace del vendedor › entregas coherentes (ADR 0009, Fase 5) › un punto de un chofer › geocodificador (S3, pendiente) › solo la dirección escrita.
4. **Un pin de menor nivel nunca pisa a uno de mayor nivel.** El enlace fija el pin como `validado`, fuente `enlace`, y reemplaza a uno `sugerido` o a uno que ya vino de otro enlace (el último dato del vendedor gana). Si el local tiene un pin `validado` por una persona, el enlace queda como **propuesta** en la pantalla PINES para revisarla; nada que una persona fijó se pisa solo.

## Pendiente
- Geocodificador gratuito para proponer un pin al crear el cliente (spike S3; el entorno del agente no alcanza Nominatim).
- Aprender del conjunto de entregas (≥3 coherentes → validar o corregir el pin, margen de entrega, caminata): Fase 5, ADR 0009.
- Nombre comercial, dónde estacionar y orden de apertura como datos del local (el chofer ya escribe el nombre de la guía en el aviso de local cerrado; hoy no se guarda).
