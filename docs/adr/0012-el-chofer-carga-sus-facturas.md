# 0012 — El chofer carga sus propias facturas por voz o texto; no se imprime nada

Estado: aceptada. Aclaración del dueño, 2026-10-04.

## Flujo real
Una persona de la oficina entrega al chofer el montón de facturas impresas. **El chofer las carga en la app por voz o texto** y el sistema calcula la ruta de su camión. El sistema no imprime nada (se descarta la «hoja de ruta imprimible», antes 3c).

## Decisión
1. **Rol chofer ampliado:** puede cargar facturas y ver/acomodar la ruta, pero solo del camión de su jornada del día (ADR 0010). La API lo comprueba (no basta con ocultar botones). Despachador y admin siguen pudiendo hacerlo todo, como apoyo y supervisión.
2. **Jornada primero:** al entrar, el chofer elige su camión del día (un toque); sin camión elegido no hay carga ni ruta.
3. **Carga rápida, pensada para el celular y la voz:**
   - Un solo campo de texto grande: se dicta o escribe «1234 minimarket rabet». El número del comienzo es el folio y el resto busca al cliente (tolera tildes y errores de dictado, desde la 3.ª letra, ya implementado).
   - El dictado usa el micrófono del teclado del celular (funciona en cualquier campo); si el spike S5 muestra que el reconocimiento de voz del navegador sirve en los teléfonos reales, se agrega un botón de micrófono propio.
   - Confirmar el cliente con un toque, la factura queda guardada y el campo queda listo para la siguiente. Contador «cargadas: N» y lista para corregir o anular.
   - Folio repetido se avisa; el día es hoy salvo que se cambie.
   - Al terminar: «CALCULAR MI RUTA».
4. **Sin señal:** las facturas cargadas se guardan en el teléfono y se envían al volver la señal (Fase 4, modo sin conexión).
5. **Ideas para más adelante (no ahora):** foto de la factura para leer el folio y el cliente (OCR; revisar costo/gratuidad antes), y carga masiva por planilla desde la oficina si algún día se prefiere.

## Consecuencias
- Fase 4 pasa a ser lo central: login de chofer → elegir camión → cargar facturas por voz/texto → ruta en el celular con NAVEGAR y ENTREGADO (ADR 0009).
- Permisos del chofer: `facturas:leer/escribir` y `rutas:leer/escribir` restringidos a su camión de hoy; sigue sin ver clientes completos ni administración.
- Pendiente: spike S5 (voz en español de Chile en iPhone y Android reales).
