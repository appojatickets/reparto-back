# 0043 — Estándar de 10 minutos de atención por local

Estado: aceptada. Pedido del dueño, 2026-10-11: «deja el estándar de 10 minutos por local como base; cuando tenga más datos lo ajustamos».

## Contexto
- El valor de respaldo era 8 minutos y el sistema lo reemplazaba por lo que aprendía: **4,8 minutos** como tiempo general (177 entregas) y el de cada local con solo 2 visitas.
- Ese tiempo se mide de «llegada» a «entregado» y deja afuera estacionar y caminar. Contra los tramos reales entre dos entregas seguidas (25 tramos, 11-oct) la estimación salía ~3 a 4 minutos por parada por debajo de lo real, y las horas de llegada quedaban adelantadas.

## Decisión
- `SERVICIO_POR_DEFECTO_MIN = 10`: cada local se estima con **10 minutos** (estacionar, caminar y entregar).
- El tiempo general medido **ya no se usa**; sigue calculándose y mostrándose en ANALÍTICA.
- El tiempo de un local solo reemplaza al estándar con **10 o más visitas medidas** (`MINIMO_MUESTRAS_SERVICIO_LOCAL`), antes eran 2.
- Se vuelve a usar lo aprendido cuando haya más datos y una medida que incluya el estacionar y el caminar.
