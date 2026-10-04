# ADR 0008: La ruta es una sugerencia; el chofer la acomoda fácil y el sistema lo respeta

Fecha: 2026-10-04 · Estado: aceptada (decisión del dueño); se implementa en las fases 3 y 4

## Contexto
Los choferes mueven la ruta a su gusto. El sistema debe sugerir, pero acomodar tiene que ser fácil.

## Decisión
- **Acomodar sin escribir:** cada parada tiene botones grandes **SUBIR** y **BAJAR** (una posición), además de IR PRIMERO A ESTA,
  DEJAR PARA DESPUÉS y QUITAR. En el despachador, arrastrar y soltar. Todo con **deshacer** (10 s en el teléfono).
- **Dos modos por ruta:**
  - *Sugerida:* el motor puede reordenar lo que no esté fijado (ORDENAR LO QUE QUEDA, al agregar paradas).
  - *Manual:* en cuanto el chofer mueve algo con SUBIR/BAJAR, la ruta pasa a «mi orden»: el sistema **no reordena más**;
    solo recalcula horarios y avisa («con tu orden, X llegaría tarde: cierra a las 12:00. ¿Subirla?») como sugerencia
    que se acepta con un toque. Se vuelve a *sugerida* con un botón explícito.
- **Paradas nuevas en modo manual:** se insertan donde menos molesten (inserción más barata) sin mover las demás.
- **Aprender del orden real:** se guarda el orden planificado y el real (`orden_plan` / `orden_real`). El % de paradas que el
  chofer reordena y dónde mide cuándo el sistema se equivoca (solo admin); en la fase 5 puede proponer preferencias.
- **Motor:** `evaluarOrden` ya recalcula horarios sin optimizar; faltan las operaciones `moverParada(id, +1/-1)` y
  `agregarSinReordenar`, y un modo de optimización «solo insertar» (sin búsqueda local).

## Principio relacionado
Semiautomático (ADR 0007): el sistema propone, la persona decide, lo manual no se pisa.
