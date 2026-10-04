# 0011 — Horario manual con botones; «cerrado» explícito y días sin dato sin restricción

Estado: aceptada. Pedido del dueño, 2026-10-04: poner el horario con botones fáciles (cerrado, abre a las 10/11/12/13, colación, rangos o personalizado) y que quede como dato manual.

## Decisión
1. El horario se declara a mano con botones (elegir días → cerrado / sin dato / abre a las / cierra a las / colación / otro horario). Se guarda como fuente `confirmado`, que manda sobre `aprendido`, `sugerido` y `giro` (ADR 0007).
2. **«Cerrado» es un dato explícito** (`horario_local.cerrado = true`, sin desde ni hasta). Un día **sin registro es un día sin dato: no tiene restricción**. Antes, tener datos de otros días hacía que los demás se consideraran cerrados; con un editor por días eso inventaba cierres, y dejar una parada fuera de la ruta por un supuesto es peor que visitarla.
3. «Abre a las 10» sin hora de cierre significa abierto de 10:00 a 23:59; «cierra a las 14» sin apertura, desde las 00:00.
4. Hasta 3 tramos por día (colación = dos tramos). Los tramos no pueden solaparse ni tocarse.
5. Guardar reemplaza solo el horario manual; no toca lo aprendido.
6. Se agrega también el pin del local por coordenadas pegadas desde Google Maps (la ruta necesita pin).

## Consecuencias
- Horarios aprendidos o por giro no cierran días por ausencia; los cierres aprendidos (Fase 5) deberán guardarse también como dato explícito.
- La pantalla de rutas muestra «No se pueden atender» para los locales cerrados ese día.
