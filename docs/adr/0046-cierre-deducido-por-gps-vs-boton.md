# 0046 — Cierre deducido por GPS, medido contra el botón CERRADO

Estado: aceptada (solo recopila y mide; no cambia rutas). Idea del dueño, 2026-10-15: detectar que un local estaba cerrado porque el camión volvió, sin depender del botón.

## Hipótesis
El camión llega, se queda poco (≤ 5 min) junto al pin, se va sin entregar y después vuelve o la factura se entrega más tarde ⇒ estaba cerrado.

## Qué se hace
- `validarCierresPorGps` (dominio) reconstruye las visitas al pin con el recorrido (radio 80 m, precisión ≤ 60 m, se descartan tramos en marcha) y las clasifica: atendida / cerrado deducido / sin desenlace.
- Las compara con los botones (CERRADO o «no entregado: cerrado») y entrega: coinciden, solo GPS (con cuántos se entregaron después), solo botón, botón sin recorrido GPS, y la mediana de permanencia de cerrados por botón frente a atendidas (dice si el umbral de 5 min separa bien).
- Corre en el análisis de segundo plano; el resultado va en el resumen de la ejecución y en `cierresGps` de `GET /v1/analitica`, con los últimos 20 casos en que no coinciden, para revisarlos a mano.
- Dato que faltaba: el análisis no leía la velocidad del GPS (`velocidad_ms` ya se guardaba); ahora sí, para no confundir pasar de largo con una visita.

## Límites
- El GPS se toma cada 60 s y solo con la app abierta: «botón sin recorrido» mide cuánto se pierde.
- Solo locales con pin; sin segundo intento no se juzga.
- Cuando coincida lo suficiente se usará para horarios aprendidos y orden de la ruta (etapa 2); si no, se ajustan los umbrales con los casos revisados.
