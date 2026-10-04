# ADR 0007: Horarios aprendidos con evidencia acumulada y prioridad calculada

Fecha: 2026-10-04 · Estado: propuesta (a implementar en la fase 5; confirmar puntos abiertos con el dueño)

## Qué pidió el dueño
«Prioridad» no es una casilla manual: es inteligencia de cálculo. Si hay locales abiertos y, entrega tras entrega, el
sistema cruza que a cierta hora un local está disponible, eso se suma; si nunca se entrega en un local en cierto horario,
se suma que no está disponible. No se mide con un día. Además, usar APIs públicas (p. ej. Google Maps) para verificar
horarios y fotos.

## Diseño
- **Evidencia por local, día de la semana y franja** (p. ej. 30 min): `abierto` = entrega o parcial hecha en esa franja;
  `cerrado` = «NO_PUDE · Local cerrado» en esa franja. Confianza = (aciertos + 1) / (intentos + 2) (fórmula del plan).
- **Ausencia de entregas ≠ cerrado.** Solo se llega a un local cuando la ruta pasa por ahí; no haber ido a las 19:00 no
  prueba que cierre antes. Una franja sin intentos queda **desconocida** y conserva el horario por giro/confirmado. Solo
  cuenta como cerrado lo observado: un «local cerrado» registrado por el chofer. (Opcional: dejar que el optimizador visite
  ocasionalmente franjas desconocidas para aprender: exploración.)
- **Umbrales:** no se propone nada con menos de ~3 observaciones en ≥ 3 días distintos por franja (ajustable en la config de
  la empresa); la evidencia más reciente pesa más (decaimiento) para seguir cambios de horario.
- **Nada cambia solo:** el resultado es una `sugerencia` con su evidencia (aciertos, intentos, fechas) que el admin confirma o
  rechaza. Opción futura, por empresa: autoaplicar cuando la confianza supere un umbral.
- **Prioridad calculada en el motor:** las ventanas dejan de ser todas «duras». `confirmado` (y la condición del día) = duras;
  `aprendido`/`sugerido` = blandas, con penalización proporcional a P(cerrado) en la franja de llegada. El motor prioriza
  solo, sin casilla manual (el parámetro provisorio `epsPrioridad` se reemplaza por esto). La casilla manual podría quedar
  solo para entregas urgentes si el dueño la quiere.

## APIs públicas (Google Maps y otras)
- **Google Places** exige cuenta de facturación con tarjeta (choca con «todo gratis», sin tope duro de gasto) y sus términos
  restringen guardar su contenido (horarios, fotos, reseñas; solo el `place_id` y, por plazo limitado, coordenadas) y exigen
  mostrarlo con su atribución. **No se guarda** ni se importa de forma masiva. Cuotas y términos: **a verificar** en la fuente
  oficial antes de cualquier decisión.
- **Alternativa sin costo ni riesgo de términos:** botón «Ver en Google Maps» (ya existe el enlace con coordenadas) para que
  el despachador vea horarios y fotos en Google y confirme el dato a mano (`fuente = confirmado`).
- **OpenStreetMap** (`opening_hours`, licencia ODbL, se puede guardar con atribución) tiene poca cobertura en almacenes
  pequeños de Chile; sirve como fuente `sugerido` de baja confianza si existe.
- Las **fotos** de fachada siguen siendo las que toman los choferes; de Street View solo se guarda la referencia.

## Principio: semiautomático (decisión del dueño)
El sistema propone y calcula; una persona puede decidir a mano en cada punto.
- **Lo manual manda:** un dato fijado por una persona (horario `confirmado`, pin `validado`, orden fijado por el chofer, camión
  elegido) tiene prioridad sobre cualquier cálculo y el aprendizaje **no lo sobrescribe**; queda marcado como manual.
- **Siempre se puede corregir:** horarios y pines se editan a mano; las sugerencias se aceptan, rechazan, editan o revierten.
- **Urgente es manual:** la casilla de prioridad solo se conserva como marca manual de «entrega urgente» (sobrescribe el cálculo
  para esa factura); la prioridad normal la calcula el motor.
- **Auditoría:** se registra quién cambió qué y cuándo (transparencia y Ley 21.719).
