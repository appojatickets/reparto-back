# ADR 0055 — Gemini (plan gratuito) ordena las direcciones que ningún buscador encuentra

Estado: aceptada. Pedido del dueño (2026-10-21): usar Gemini, con la clave gratuita que ya tiene, sabiendo que puede fallar.

## Qué hace y qué no

- **Solo ordena texto.** Recibe la dirección escrita en la factura y la comuna, y devuelve la calle y el número («Pje Los Olmoz 88 depto 3, Sn Bdo» → «Los Olmos», 88). **Nunca devuelve coordenadas**: el punto lo sigue poniendo un buscador de mapas (Nominatim u OpenRouteService). Un pin inventado entraría a la ruta como si fuera real y causaría el zigzag que el ADR 0054 quita.
- **Es la última carta.** Se consulta solo cuando Nominatim y ORS ya probaron y ninguno la encontró (ninguno falló). Se busca de nuevo con el texto ordenado; si lo encuentran, el pin queda como **aproximado** (confianza de calle, 0,6, aunque el mapa diga «exacta»): el texto lo reescribió un modelo, así que el GPS de la primera entrega lo confirma o lo reemplaza, y la ruta lo trata como pin de calle (ADR 0054).
- **Mismas reglas de siempre:** el punto hallado debe estar en la Región Metropolitana y en la comuna del local; si no, no se acepta.
- **Una sola vez por local:** al terminar se anota el intento, como hoy. Se gasta como mucho un pedido de Gemini por local, no por día.

## Puede fallar, y no pasa nada

- Sin `GEMINI_API_KEY` el normalizador no existe: todo sigue exactamente igual.
- Clave mala, modelo que ya no existe, caída, respuesta rara o dirección que no entiende → se ignora y el local queda «sin resultado», como hoy.
- Cupo agotado (429) → la cola se detiene sin anotar el intento, igual que cuando se agota el cupo de ORS; se vuelve a probar la próxima vez que se pida la ruta.
- Los pedidos se espacian 4,5 s (≈13 por minuto) para no pasarse del cupo por minuto del plan gratuito; corre en segundo plano, nadie espera.
- Lo que devuelve se valida: la calle debe tener letras, ≤ 80 caracteres, una línea y ≤ 7 palabras; el número, un entero razonable. La dirección de la factura es un dato, no una orden (la instrucción lo dice y, aun si el modelo se confundiera, solo sale texto que se usa para buscar en un mapa).

## Privacidad y costo

- Solo se envían la dirección y la comuna: nunca la razón social ni el RUT. En el plan gratuito Google puede usar lo enviado para mejorar sus modelos; por eso se limita a ese dato.
- La clave va en el encabezado (`x-goog-api-key`), no en la URL, y solo en variables de entorno.
- Costo: ninguno mientras se use el plan gratuito. Si algún día se pidiera activar facturación, hay que detenerse y preguntar.

## Configuración

- `GEMINI_API_KEY` (opcional, ≥ 10 caracteres) y `GEMINI_MODEL` (por defecto `gemini-flash-lite-latest`, un alias que sigue al modelo liviano vigente; se puede cambiar en Render sin tocar el código). Sin migración ni cambios en la API.

## Pendiente

- Medir con unas semanas de uso cuántas direcciones rescata (cuántos locales pasan de «no encontrada en el mapa» a pin aproximado). Si el aporte es bajo, no cuesta nada dejarlo apagado.
- Usarlo también para leer la calle y el número en `calleYNumero` cuando la dirección está muy sucia requeriría guardar la dirección normalizada (migración): no se hace todavía.
