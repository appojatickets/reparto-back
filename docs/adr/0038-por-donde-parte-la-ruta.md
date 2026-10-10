# 0038 — Por dónde parte la ruta: automático, más lejano o más cercano al depósito

Estado: aceptada. Pedido del dueño (configuración), 2026-10-07.

## Decisión
- La configuración de la empresa suma `ordenInicio`: `automatico` (por defecto, como hasta ahora), `lejano` o `cercano`.
  - **Más lejano**: la ruta parte por lo más lejano del depósito y vuelve acercándose (útil para no cargar el camión de punta a punta ni
    dejar lo lejano para la tarde).
  - **Más cercano**: parte por lo más cercano y se va alejando.
- Mecanismo (igual al del orden de carga, ADR 0028): cada parada tiene el lugar que le tocaría si se ordenaran por su distancia en línea
  recta al depósito; la ruta paga `PESO_ORDEN_INICIO` (5 minutos) por cada lugar que una parada se aleja de ese lugar.
  - Con **más lejano** se apaga la inclinación por lo cercano (`epsLlegada`), que empuja al revés.
  - Es una preferencia, no una regla: **un horario duro manda** (un local que cierra temprano se atiende antes aunque quede cerca), y un
    desvío grande puede ganarle.
- `PUT /v1/empresa/config` acepta `ordenInicio`; si el cliente no lo manda (pantalla vieja) se conserva el guardado. No necesita migración
  (vive en el JSON de la configuración).

## Pendiente
- El peso no está calibrado con datos. Si el dueño lo usa unas semanas, se revisa con lo que ANALÍTICA muestre (ADR 0022).
