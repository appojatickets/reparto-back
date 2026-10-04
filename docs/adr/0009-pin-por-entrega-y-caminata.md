# 0009 — El pin se afirma con cada entrega y se distingue «donde estaciona» de «la puerta»

Estado: aceptada (a construir en la Fase 4 app del chofer y la Fase 5 aprendizaje). Pedido del dueño, 2026-10-04.

## Contexto
El pin de un local nunca es exacto: la dirección es aproximada, a veces tapa la feria o el estacionamiento y el chofer debe
estacionar lejos y **caminar**. Hoy el pin lo fija una persona (importación, propuesta, revisión). Cada entrega es una
oportunidad gratuita de mejorarlo.

## Decisión
1. **Al marcar ENTREGADO se guarda un punto GPS puntual** (una lectura, con su precisión en metros y la hora). No hay
   seguimiento continuo (coherente con el aviso de privacidad, B4).
2. **El punto es evidencia, no una orden.** Con varias entregas coherentes (p. ej. ≥3 puntos con precisión ≤ 30 m dentro
   de un radio de ~40 m) el sistema **propone** fijar/validar el pin y calcula un **margen** (`radio_m`, la dispersión de
   los puntos). El ruteo usa ese margen como «zona de entrega», no un punto exacto. Mientras no haya evidencia, manda el pin
   existente. Regla de ADR 0007: lo manual siempre gana; al inicio la propuesta la confirma el despachador/admin.
3. **Caminata.** Un solo botón extra al entregar: «TUVE QUE CAMINAR» (con 3 opciones de tiempo: ~1, 3 o 5+ min). En ese caso el
   GPS se guarda como **punto de estacionamiento**, no como puerta: no mueve el pin de la puerta. El local acumula
   `punto_estacionamiento` y `minutos_caminata` (aprendido por mediana) y el optimizador suma ese tiempo al servicio.
4. **Condiciones por día/hora** (feria, estacionamiento tapado): la caminata se aprende con su día de la semana y franja, igual
   que la disponibilidad horaria (ADR 0007): «los sábados en la mañana hay feria → +5 min».
5. La foto del local ayuda al chofer a reconocer la puerta; si se estaciona lejos se puede agregar una foto/nota del
   «dónde estacionar» (un campo más del local, opcional).
6. Offline: el punto GPS y la marca de caminata se guardan en el teléfono y se envían al volver la señal.

## Consecuencias
- Nueva tabla `entrega` (factura, hora, lat, lng, precision_m, a_pie, minutos_caminata) en la Fase 4; el aprendizaje de pines y
  de caminata se calcula en la Fase 5 con funciones puras de dominio y pruebas (como `aprendizaje/ritmo.ts`).
- Pendiente de decidir con el dueño: umbrales (3 entregas, 30 m de precisión, 40 m de radio) y quién confirma el cambio de pin.
