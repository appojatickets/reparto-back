# ADR 0006: API en Render Starter (pago, autorizado por el dueño)

Fecha: 2026-10-04 · Estado: aceptada; **se activa al terminar el desarrollo y tras ~1 semana de pruebas en plan gratis** (decisión del dueño)

## Contexto
Render Free duerme el servidor tras 15 minutos sin tráfico y tarda hasta ~1 minuto en despertar; la primera consulta
posterior fallaba o esperaba. Se evaluó mantenerlo despierto con pings (consume horas de la cuota compartida de 750 h/mes,
o minutos de GitHub Actions) y cachear con Redis (no resuelve el arranque en frío).

## Decisión
El dueño paga **Render Starter (~US$7/mes)** para `reparto-back`: sin sueño, siempre encendido.
Es la **única excepción** a «todo gratis»; el resto del stack sigue en planes gratuitos (Supabase Free, Vercel Hobby, GitHub).

## Consecuencias
- Durante la semana de pruebas se sigue en Render Free: los reintentos automáticos y el aviso «Despertando servidor»
  cubren el arranque en frío (primera consulta tras 15 min de inactividad: hasta ~1 minuto).
- Se acaba el arranque en frío del chofer. Los reintentos y el aviso «Despertando servidor» se mantienen como resiliencia
  ante reinicios y despliegues.
- El servicio deja de contar para las 750 h/mes gratuitas (el otro servicio free del workspace, `api-reencuentro`, queda solo).
- El ping diario por GitHub Actions se mantiene: ya no despierta Render, pero deja actividad en Supabase (evita la pausa
  del proyecto tras una semana sin uso en fines de semana largos).
- No se usa Redis: una sola instancia y nada que compartir; se reevalúa si la API pasa a varias instancias.
- Con 0,5 CPU el motor de ruteo en la API tiene más margen; el plan v1 lo mantiene en el servidor.
