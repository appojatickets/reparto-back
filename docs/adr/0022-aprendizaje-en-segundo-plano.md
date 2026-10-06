# ADR 0022 — El sistema aprende en segundo plano

Estado: aceptada.

## Contexto

La ruta debe ordenarse de forma inteligente y mejorar con el uso. Hasta ahora el motor usaba valores fijos (línea recta × 1,35, 8 minutos por parada) y se borraba lo que no servía en pantalla. Lo que se limpia en la pantalla del chofer no debe desaparecer del sistema: es la materia prima para aprender.

## Decisión

**1. Registro permanente (solo se agrega).** Nada de esto lo borra la app:
- `ruta_operacion`: cada cálculo y cada movimiento de la ruta (subir, bajar, ir primero, quitar…) con el orden que quedó. El primer cálculo es lo que sugirió el sistema; el resto son las correcciones de las personas.
- `posicion_camion`: dónde estaba el camión mientras la app estaba abierta (cada ~60 s). Se sigue al camión, no a la persona.
- `jornada_resumen`: por jornada, cuántas paradas había, cuántas se hicieron y cuáles no se alcanzaron (aunque se suelten del camión al terminar), más la calidad de la ruta.
- `entrega_evento`: ahora con `origen` (persona o automático) y el lugar de la ruta en que iba la parada.

**2. Llegada automática.** `POST /v1/jornada/posiciones` guarda los puntos y, si el camión se queda junto al pin de una entrega pendiente (≤ 60 m, ≥ 40 s, GPS ≤ 50 m, no yendo rápido), el servidor anota la llegada. Un aviso de una persona manda: si ya existe, no se repite. Solo funciona con la app abierta (una web instalada no sigue el GPS en segundo plano): los botones LLEGUÉ y ENTREGADO siguen siendo los puntos confiables.

**3. Analizador en segundo plano** (`analizar-aprendizaje`). Corre ~30 s después de terminar una ruta y cada 3 horas dentro de la API; es idempotente y recalcula siempre desde los datos de los últimos 90 días. **No usa IA**: es estadística con valores de respaldo:
- *Ritmo*: minutos reales entre una parada y la siguiente ÷ lo que calculó el motor (por camión, global y por comuna). Con pocos datos se acerca a 1,0 (K = 20); acotado a [0,5; 2,5] y usado en [0,6; 2,0].
- *Tiempo de atención por local*: llegada → entregado, promedio móvil desde 8 min (α = 0,3); mediana general con ≥ 5 datos.
- *Capacidad*: mediana de paradas atendidas y de duración por camión.
- *Calidad*: compara el último cálculo automático antes de salir con el orden en que se hicieron las paradas (largo en línea recta y pares invertidos).
- *Pines*: ≥ 3 visitas coherentes (≤ 40 m entre sí) en ≥ 2 días, a > 100 m del pin → propuesta de pin pendiente (una persona decide).
- *Locales cerrados*: los que se encuentran cerrados ≥ 2 veces, con las horas (informativo; todavía no cambia horarios).

**4. La ruta usa lo aprendido** solo cuando la confianza llega a 0,25: ritmo del camión (o el general) y tiempo de atención del local (o el general). Es interno: no se muestran horas. Si no se puede leer, la ruta usa sus valores de respaldo; aprender nunca bloquea la ruta.

**5. Panel de analítica del admin** (`GET /v1/analitica`, `POST /v1/analitica/ejecutar`, permiso `metricas:leer`): qué datos hay, con qué cobertura (avisos con GPS, paradas con «llegué»), qué aprendió y cuánto se parece lo sugerido a lo manejado.

## Consecuencias

- Al terminar la ruta se limpia la lista del chofer, pero queda todo lo anterior. La ruta viva se borra (se rearma cada día).
- Sin avisos de los choferes no hay aprendizaje: la adopción de LLEGUÉ/ENTREGADO es parte del sistema.
- Pendiente para cuando haya semanas de datos: horarios de atención aprendidos que alimenten las ventanas, preferencias de orden por chofer y ritmo por franja horaria.
