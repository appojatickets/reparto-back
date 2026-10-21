# ADR 0056 — La ruta sin zigzag: las calles se hacen de una vez y el motor ve dónde está cada puerta

Estado: aceptada. Pedido del dueño (2026-10-21): las rutas hacían zigzag, mezclaban números muy lejanos de una misma calle y dejaban separadas direcciones de la misma calle con números distintos.

## Por qué fallaba (medido)

1. **La inclinación por «llegar antes a lo cercano» (`epsLlegada = 0,5`) cruzaba la ruta consigo misma.** Cobra 0,5 min por cada minuto de viaje acumulado hasta *cada* parada, así que acortar los primeros tramos vale más que el recorrido completo. En 20 rutas simuladas de 30 paradas con pin exacto: 1,25 cruces por ruta y 8 % más km que sin la inclinación. Con 0,005 (solo desempata) quedan 0 cruces y los mismos km. (Medido también después de que `main` pasara esa inclinación a viaje acumulado sin servicio: sigue igual.)
2. **Sin pin, todas las paradas de una comuna quedaban en el mismo punto (el centro de la comuna).** A distancia 0 entre sí, `Colón 100`, `Freire 200` y `Colón 4500` se intercalaban sin costo: el motor no veía la calle ni el número. Solo se ubicaba bien una parte (Nominatim halla ~31 % de las direcciones, ADR 0028). Con el orden de carga ya sin peso (cambio de `main`), el problema quedó a la vista: sin pines, 38,6 km y 98,9 cruces en la simulación.
3. **Los horarios gobernaban el orden** (ver ADR 0057).

## Decisión

- **El motor ve la calle y el número** (`calleYNumero`): «Av. Los Leones 45», «Los Leones 120 Of 3» y «Pasaje Los Leones 3000» son la misma calle (sin tipo de vía, sin oficina/depto/block, sin la comuna al final); el número es el último que cierra la dirección.
- **Ubicación por calle y número** (`ubicarPorCalle`, `ubicarFacturas`) para toda factura sin pin exacto (sin pin, o con pin que el buscador halló solo hasta la calle):
  1. Si en su calle hay puertas con ubicación conocida —pines exactos de otras facturas del día, lo ya entregado hoy o locales de la empresa con pin confiable (`RutaRepository.pinesDeLocales`)—, cae entre las dos vecinas según su número; fuera de lo conocido, se sigue la calle en la dirección que llevan las dos puertas más cercanas (como máximo 1,5 km).
  2. Si nada de su calle se conoce, todas las facturas de esa calle quedan juntas en un mismo punto —el que da el orden de carga para el lugar mediano de la calle, o el centro de la comuna— y ordenadas entre sí por número (1 m por número). Así `Colón 100` y `Colón 4500` quedan a ~4 km y no a distancia 0.
  3. Si la dirección no tiene una calle reconocible, queda como antes (entre sus vecinas de carga o el centro de la comuna).
  - Los pines de Gemini sin verificar (ADR de `main`) y los de buscador con confianza baja **no** cuentan como puertas conocidas.
- **Una calle se hace de una vez, para lo que se estimó** (`pesoCalle = 10`): volver a una calle que la ruta ya había dejado cuesta 10 min, **solo entre paradas sin pin exacto**. Compensa que su ubicación es una estimación. Con pin exacto la geometría ya sabe cómo se recorre la calle, y forzarla hacía perder kilómetros (en la simulación con 100 % de pines: 12,8 km con el castigo para todas contra 10,9 km solo para las estimadas). Es blando: un horario duro puede partir una calle.
- **`epsLlegada` baja a 0,005** (`EPS_LLEGADA_DESEMPATE`): solo decide en qué sentido se recorre un mismo circuito (empezando por lo cercano). `ordenInicio` lejano/cercano sigue funcionando igual.
- **Tiempos por calles (ORS):** las paradas que la ruta ubica por su calle ya no se consultan con el punto de su pin aproximado; quedan en línea recta para no mezclar dos medidas distintas con un punto que no es el suyo.
- No hay migración ni cambio de la API (`openapi.json` no cambia). Ninguna consulta nueva a servicios externos; `pinesDeLocales` es una lectura de la base que solo se hace si hay paradas sin pin exacto.

## Resultados

Simulación: 15 rutas de 30 paradas en una cuadrícula de 9 calles, km reales recorridos, misma semilla. «Antes» = `main` con el orden de carga ya sin peso.

| Pines exactos | | km | cruces |
|---|---|---|---|
| 0 % | antes | 38,6 | 98,9 |
| 0 % | ahora | 19,3 | 13,7 |
| 20 % | antes | 31,0 | 58,5 |
| 20 % | ahora | 18,4 | 13,3 |
| 35 % | antes | 26,9 | 37,1 |
| 35 % | ahora | 16,6 | 9,0 |
| 60 % | antes | 23,3 | 26,9 |
| 60 % | ahora | 13,6 | 2,9 |
| 100 % | antes | 12,3 | 1,9 |
| 100 % | ahora | 10,9 | 0,0 |

Al contar «vueltas a una calle ya dejada» hay que mirarlo con cuidado: en una cuadrícula con pines exactos recorrer una calle en dos pasadas puede ser lo más corto, y no es un defecto. Por eso el castigo por calle solo se aplica a lo estimado.

Pruebas: `sin-zigzag.test.ts` (30 paradas al azar sin ningún cruce; calles sin pin juntas y de punta a punta), `ubicacion-por-calle.test.ts`, `ubicar-paradas.test.ts`, `direccion-calle.test.ts` y los casos nuevos de `evaluacion`, `optimizador`, `armar-problema` y `rutas`.

## Límites y pendiente

- Los pesos (`pesoCalle`, 1 m por número) no están calibrados con rutas reales; la simulación los muestra estables entre 4 y 16. Hay que mirarlos con unas semanas de uso real.
- La numeración se trata como una línea: no distingue lado par/impar ni calles que se doblan. Con dos o más puertas conocidas en la calle la ubicación sigue la recta que las une.
- Un pin exacto equivocado sigue siendo la causa más probable de un zigzag que quede: ahí ayuda la revisión de pines (ADR 0032).
- Sigue pendiente que Nominatim/ORS encuentren más direcciones (ADR 0028): cada pin exacto más mejora la ruta más que cualquier ajuste del motor.
