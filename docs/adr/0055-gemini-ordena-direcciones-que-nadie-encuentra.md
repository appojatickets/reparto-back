# ADR 0055 — Gemini (plan gratuito) ordena las direcciones que ningún buscador encuentra

Estado: aceptada. Pedido del dueño (2026-10-21): usar Gemini, con la clave gratuita que ya tiene, sabiendo que puede fallar.

## Qué hace y qué no

- **Ordena el texto.** Recibe la dirección escrita en la factura y la comuna, y devuelve la calle y el número («Pje Los Olmoz 88 depto 3, Sn Bdo» → «Los Olmos», 88). Con ese texto se busca de nuevo en Nominatim y ORS, que son quienes ponen el punto preciso.
- **Es la última carta.** Se consulta solo cuando Nominatim y ORS ya probaron y ninguno la encontró (ninguno falló). Si lo encuentran con el texto ordenado, el pin queda como **aproximado** (confianza de calle, 0,6, aunque el mapa diga «exacta»): el texto lo reescribió un modelo.
- **Último escalón: un punto aproximado estimado por el modelo** (revisión del 2026-10-21; la primera versión no lo aceptaba). Si ningún mapa la halla ni con el texto ordenado, se usa la latitud/longitud que estima Gemini, pero solo si es creíble (`evaluarPuntoDeModelo`: dentro de la Región Metropolitana y a no más de 9 km del centro de su comuna, 30 km en las comunas grandes y rurales) y siempre con **confianza 0,3**. Razón: un punto aproximado y plausible ordena mejor la ruta que el centro de la comuna, donde todas las paradas quedaban a distancia 0.
  - Reutiliza el mecanismo existente de «pin aproximado» (fuente `geocodificador`, confianza < 0,7): la ruta y las listas lo avisan, y **el primer ENTREGADO con GPS lo reemplaza** (ADR 0024). No hay migración. La confianza 0,3 distingue estos pines de los que salieron de un mapa, para poder medir después cuánto aciertan.
  - En la ruta pierde ante cualquier dato mejor: si la calle tiene otras puertas con pin conocido, la ubicación por calle y número (ADR 0054) pasa por encima de este punto.
  - Riesgo que se acepta: hasta la primera entrega, el enlace de navegación de ese local apunta a un lugar aproximado (la interfaz ya lo marca como aproximado).
- **Mismas reglas de siempre** para lo que devuelve un mapa: en la Región Metropolitana y en la comuna del local; si no, no se acepta.
- **Una sola vez por local:** al terminar se anota el intento, como hoy. Se gasta como mucho un pedido de Gemini por local, no por día; el mismo pedido trae el texto ordenado y la estimación.
- **El motor no depende de Gemini.** Sin clave, o si falla, la ruta se arma igual (ADR 0054); Gemini solo agrega pines que antes no existían.

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
