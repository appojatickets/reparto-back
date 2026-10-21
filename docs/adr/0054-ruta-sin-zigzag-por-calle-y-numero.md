# ADR 0054 — La ruta sin zigzag: las calles se hacen de una vez y el motor ve dónde está cada puerta

Estado: aceptada. Pedido del dueño (2026-10-21): las rutas hacían zigzag, mezclaban números muy lejanos de una misma calle y dejaban separadas direcciones de la misma calle con números distintos.

## Por qué fallaba (tres causas, medidas)

1. **La inclinación por «llegar antes a lo cercano» (`epsLlegada = 0,5`) cruzaba la ruta consigo misma.** Cobra 0,5 min por cada minuto de llegada de *cada* parada, así que acortar los primeros tramos vale más que el recorrido completo. En 20 rutas simuladas de 30 paradas con pin exacto: 1,25 cruces por ruta y 8 % más km que sin la inclinación. Con 0,005 (solo desempata) quedan 0 cruces y los mismos km.
2. **Sin pin, todas las paradas de una comuna quedaban en el mismo punto (el centro de la comuna) o repartidas por el orden de carga.** A distancia 0 entre sí, `Colón 100`, `Freire 200` y `Colón 4500` se intercalaban sin costo: el motor no veía la calle ni el número. Solo se ubicaba bien una parte (Nominatim halla ~31 % de las direcciones, ADR 0028).
3. **El orden de carga (1 min por lugar de diferencia) pesaba incluso con pin exacto.** Como el chofer no carga siguiendo las calles, esa preferencia sacaba a la ruta de lo que la geometría decía que estaba cerca y la hacía ir y volver por la misma zona.

## Decisión

- **El motor ve la calle y el número** (`calleYNumero`): «Av. Los Leones 45», «Los Leones 120 Of 3» y «Pasaje Los Leones 3000» son la misma calle (sin tipo de vía, sin oficina/depto/block, sin la comuna al final); el número es el último que cierra la dirección.
- **Ubicación por calle y número** (`ubicarPorCalle`, `ubicarFacturas`) para toda factura sin pin exacto (sin pin, o con pin que el buscador halló solo hasta la calle):
  1. Si en su calle hay puertas con ubicación conocida —pines exactos de otras facturas del día, lo ya entregado hoy o locales de la empresa con pin confiable (`RutaRepository.pinesDeLocales`)—, cae entre las dos vecinas según su número; fuera de lo conocido, se sigue la calle en la dirección que llevan las dos puertas más cercanas (como máximo 1,5 km).
  2. Si nada de su calle se conoce, todas las facturas de esa calle quedan juntas en un mismo punto —el que da el orden de carga para el lugar mediano de la calle, o el centro de la comuna— y ordenadas entre sí por número (1 m por número). Así `Colón 100` y `Colón 4500` quedan a ~4 km y no a distancia 0.
  3. Si la dirección no tiene una calle reconocible, queda como antes (entre sus vecinas de carga o el centro de la comuna).
- **Una calle se hace de una vez** (`pesoCalle = 10`): volver a una calle que la ruta ya había dejado cuesta 10 min. Es blando: un horario duro puede partir una calle.
- **El orden de carga solo guía lo que no se sabe dónde está** (`pesoOrdenCargaPin = 0`): con pin exacto o ubicada por su calle y número manda la geometría. Las facturas de una calle sin ninguna puerta conocida comparten el lugar de carga de su calle (el del medio), para que el orden de carga guíe a la calle entera sin desordenar sus números.
- **`epsLlegada` baja a 0,005** (`EPS_LLEGADA_DESEMPATE`): solo decide en qué sentido se recorre un mismo circuito (empezando por lo cercano). `ordenInicio` lejano/cercano sigue funcionando igual.
- **Tiempos por calles (ORS):** las paradas que la ruta ubica por su calle ya no se consultan con el punto de su pin aproximado; quedan en línea recta para no mezclar dos medidas distintas con un punto que no es el suyo.
- No hay migración ni cambio de la API (`openapi.json` no cambia). Ninguna consulta nueva a servicios externos; `pinesDeLocales` es una lectura de la base que solo se hace si hay paradas sin pin exacto.

## Resultados (simulación, 15 rutas de 30 paradas en una cuadrícula de 9 calles, km reales de la ruta, misma semilla)

| Pines exactos | | km | cruces | vueltas a una calle ya dejada |
|---|---|---|---|---|
| 0 % | antes | 28,0 | 43,7 | 9,8 |
| 0 % | ahora | 18,4 | 10,5 | 0,0 |
| 35 % | antes | 27,2 | 39,7 | 9,7 |
| 35 % | ahora | 16,4 | 8,5 | 0,0 |
| 100 % | antes | 14,4 | 4,1 | 4,6 |
| 100 % | ahora | 12,8 | 2,8 | 0,0 |

Qué aporta cada pieza (km reales, mismas rutas):

| | 0 % de pines | 35 % de pines |
|---|---|---|
| Antes | 28,0 | 27,2 |
| Ubicar por calle y número, con los parámetros de antes | 24,5 | 18,6 |
| + orden de carga solo para lo incierto y `epsLlegada` 0,005 | 18,5 | 16,2 |
| + castigo por volver a una calle (resultado final) | 18,4 | 16,4 |

El castigo por volver a una calle no acorta el recorrido (en la simulación, con coordenadas ya buenas, da lo mismo en km): lo que hace es que ninguna calle quede partida en dos visitas (de 1,5 y 5,9 vueltas a 0). Eso importa aunque los km sean parecidos, porque las coordenadas estimadas y los pines aproximados no son exactos y el chofer ve la calle completa de una vez.

Pruebas: `sin-zigzag.test.ts` (30 paradas al azar sin ningún cruce; calles sin pin juntas y de punta a punta), `ubicacion-por-calle.test.ts`, `ubicar-paradas.test.ts`, `direccion-calle.test.ts` y los casos nuevos de `evaluacion`, `optimizador`, `armar-problema` y `rutas`.

## Límites y pendiente

- Los pesos (`pesoCalle`, 1 m por número) no están calibrados con rutas reales; la simulación los muestra estables entre 4 y 16. Hay que mirarlos con unas semanas de uso real.
- La numeración se trata como una línea: no distingue lado par/impar ni calles que se doblan. Con dos o más puertas conocidas en la calle la ubicación sigue la recta que las une.
- Un pin exacto equivocado sigue siendo la causa más probable de un zigzag que quede: ahí ayuda la revisión de pines (ADR 0032).
- Sigue pendiente que Nominatim/ORS encuentren más direcciones (ADR 0028): cada pin exacto más mejora la ruta más que cualquier ajuste del motor.
