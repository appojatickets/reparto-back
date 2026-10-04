# ADR 0004: Motor de ruteo de un vehículo (TSP con ventanas horarias), dominio puro

Fecha: 2026-10-04 · Estado: aceptada

## Decisiones
- **Un vehículo por llamada.** La asignación de facturas a camiones es manual en la V1, así que cada ruta es un TSPTW
  (salida del origen, regreso al depósito). El multi-vehículo queda para la Fase 8.
- **Costo:** `C = Σ viaje·ritmo + Σ(riesgo + μ·atraso) + ω·Σ espera + Σ w_j·no_atendida (+ ε·llegada de prioritarias)`.
  Se agregó `penalizacionRiesgo` (10.000 por parada en riesgo) a la fórmula del plan: con μ = 5 solo, una ruta con
  atrasos podía costar menos que una sin ellos, y las ventanas «duras» no lo serían. Con la penalización, si existe una
  ruta sin riesgos, gana. Se omite `λ·giros_izquierda`: sin geometría de calles no se puede calcular.
- **Ventana dura infactible:** la parada queda **EN RIESGO** (conflictos + sugerencias: hacer primero, salir antes, otro
  camión). Solo si ya venció por completo (cierra antes de poder llegar directo) pasa a `noAtendidas`, también explícita.
- **Algoritmo:** inserción más barata + búsqueda local iterada (2-opt, Or-opt de 1 a 3 que incluye relocate, swap) con
  semilla fija (mulberry32). La factibilidad se evalúa recorriendo la ruta (O(n)) con **poda por costo**, no con
  holguras en O(1): los tiempos cambian por período y las holguras clásicas no serían exactas. Con 50 paradas tarda ~0,5 s.
- **Determinismo:** hora y azar entran por parámetro (`Presupuesto.reloj`, `semilla`). Sin presupuesto, el resultado
  depende solo del problema y la semilla; el reloj es solo una válvula de seguridad.
- **Tiempos:** puerto `TiemposViaje` con una matriz por período; el haversine calibrado vive en el dominio como cálculo
  puro (`crearTiemposHaversine`). Los valores por defecto (circuidad 1,35; 22/30/22 km/h) están **sin calibrar** (spike S1).
- **Invariantes en ejecución** (`verificarInvariantes`) con un cálculo independiente del motor; si fallan, la aplicación
  debe conservar el orden anterior.
- **Precedencia de horarios:** confirmado > aprendido > sugerido > giro; la condición del día (antes de X) **recorta** el
  horario, no lo reemplaza. Un día sin datos para un local que sí tiene horarios = cerrado ese día.

## Pendientes / preguntas al dueño
- **Prioridad:** hoy solo adelanta la llegada con un peso pequeño (`epsPrioridad`) y sube el costo de no atenderla.
  Falta definir qué significa exactamente «prioridad» para el negocio.
- **Frío (T_max fuera del freezer):** desactivado hasta definir la pregunta O-02 del plan.
- Calibrar `μ`, `ω`, pesos y velocidades con datos del piloto.
