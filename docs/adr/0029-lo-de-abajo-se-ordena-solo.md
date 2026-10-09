# ADR 0029 — Lo que se cambia a mano manda y lo de abajo se ordena solo

Estado: aceptada (2026-10-07). Cambia lo que decían los ADR 0025 y 0027: subir, bajar y arrastrar ya no dejan el resto como estaba.

## Contexto

El dueño pidió que la ruta sea proactiva: «si cambias algo, que se ordene para abajo».

Hasta ahora, subir, bajar o arrastrar una parada solo la cambiaba de lugar. Lo que quedaba debajo seguía en el orden calculado para antes del
cambio, aunque ya no tuviera sentido. Y si el chofer entregaba una parada que no era la siguiente, la lista seguía igual, como si el camión
no se hubiera movido.

El 7-oct un chofer tocó SUBIR 111 veces.

## Decisión

- **Subir, bajar o arrastrar una parada.** La parada y todo lo que quedó arriba de ella se fija tal como lo dejó la persona. Lo que está
  debajo se vuelve a ordenar solo, desde esa parada (`ordenarDebajoDe`). La ruta pasa a «acomodada a mano».
- **Ir primero.** La parada pasa al frente y lo demás se ordena desde ahí. Ahora también en una ruta acomodada a mano. Lo que la persona
  fijó antes sigue detrás de ella.
- **Facturas nuevas en una ruta acomodada a mano.** Entran debajo de lo que la persona fijó, y esa parte se ordena con ellas.
- **Quitar una factura.** Lo de abajo se vuelve a ordenar.
- **Entregar (o no entregar) una parada que no era la siguiente.** Lo que queda se ordena solo, desde donde está el camión
  (`reordenarTrasVisita`, llamado al registrar el aviso). Se respeta lo que la persona fijó arriba.
  - Si el chofer siguió la lista, no cambia nada.
  - Si reordenar falla, el aviso igual queda hecho.
  - Se anota como «ordenar»: es una sugerencia del sistema, no una corrección de la persona.
- **Compatibilidad.** Una ruta acomodada a mano antes de este cambio no tiene nada fijado. En ese caso las facturas nuevas y quitar siguen
  sin reordenar nada, porque no se sabe qué decidió la persona.
- **Lo que se mantiene igual.** VOLVER A CALCULAR DESDE CERO sigue descartando todo. ORDENAR LO QUE QUEDA ordena lo que no está fijado.
