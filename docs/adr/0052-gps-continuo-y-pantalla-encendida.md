# 0052 — GPS continuo, pantalla encendida y cobertura del GPS

Estado: aceptada. Pedido del dueño, 2026-10-16: «que el GPS funcione siempre y recolecte datos». La auditoría mostró que en los días reales solo entre el 14 % y el 46 % de los minutos del recorrido tenían GPS.

## Decisión (app web, sin costo)
- **GPS continuo** (`watchPosition`) en vez de una lectura por minuto: se guarda como mucho un punto cada 15 s y se manda cada minuto; sin señal se acumula (hasta ~2,5 h) y se manda en varios lotes al volver. Si el GPS continuo se queda callado 2 min, se lee a mano.
- **Pantalla encendida** (Screen Wake Lock) mientras chofer o ayudante tienen la app a la vista: con la pantalla apagada el navegador deja de leer el GPS. Se vuelve a pedir al volver a la app.
- **Indicador** bajo el kit de emergencia: «GPS activo · pantalla encendida», o un aviso claro si falta el permiso o no hay señal.
- **Cobertura** en `GET /v1/analitica` (`coberturaGps`) y en ESTADO DEL SISTEMA: minutos con GPS sobre minutos entre la primera y la última entrega de cada día-camión (últimos 14 días). Es la medida para saber si esto sirvió.

## Límite honesto
Una app web **no puede** leer el GPS con la app en segundo plano: cuando el chofer pasa a Waze o Google Maps para navegar, el GPS se pausa hasta que vuelve a la app. La única forma de seguir siempre es una **app nativa de Android** (por ejemplo, la misma app envuelta con Capacitor y un plugin de ubicación en segundo plano, instalada como APK sin pasar por Play Store). Es un proyecto aparte; publicar en Play Store cuesta US$25 una vez (requiere autorización del dueño).
