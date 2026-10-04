# 0015 — Cargar por dirección y comuna; el autorrelleno crece con el uso

Estado: aceptada. Aclaración del dueño, 2026-10-04.

## Contexto
Al principio la base de clientes está vacía: el chofer cargará, sobre todo, **direcciones** (a veces sin nombre del local). La **comuna es esencial** (la misma calle existe en varias comunas) y nadie la pedía al cargar. Con el uso, lo ya cargado debe autorrellenarse.

## Decisión
1. **Un solo campo** al cargar: dirección (con la comuna al final) o nombre del cliente, por voz o texto. Ejemplo: «Av. Colón 765 San Bernardo».
2. **La comuna se detecta del texto** (si termina con el nombre de una comuna; así «Av. Providencia 2500» no se confunde) y se usa como filtro de la búsqueda. Se muestra siempre, en grande, junto a la dirección: al cargar, en la lista de cargadas, en la ruta y en las paradas en riesgo.
3. **Sin nombre de cliente:** si no hay, el local se llama como su dirección; cualquiera puede completar el nombre después (colaborativo).
4. **Comuna obligatoria** al crear un cliente nuevo; se preselecciona la detectada y se puede cambiar.
5. **Autorrelleno:** lo ya cargado (dirección, comuna, nombre, pin, foto, notas, horario) aparece al escribir las primeras letras, tolerando tildes y errores de dictado; elegir un resultado carga la entrega sin más datos.
6. **Siguiente (con el pin colaborativo y el geocodificador):** avisar si el pin cae lejos de la comuna indicada, y proponer la comuna a partir del pin si falta.
