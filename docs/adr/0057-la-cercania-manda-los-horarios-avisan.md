# ADR 0057 — La cercanía manda; los horarios, las urgencias y los cerrados los maneja el chofer en terreno

Estado: aceptada. Criterio del dueño (2026-10-21): «la única verdad absoluta es la cercanía de los lugares; todo lo demás es dinámico y manual durante la ruta. El optimizador debe estar siempre buscando cercanías, barriendo de norte a sur, sur a norte, este a oeste u oeste a este, y devolviéndose solo si está cerrado o si alguien lo pide. La ruta la decide el primero en la lista, todo el tiempo.»

## Qué pasaba

Aun con el ADR 0056, los horarios de los locales (cargados a mano, aprendidos o sugeridos) gobernaban el orden: cada parada que llegaba fuera de su horario costaba 10.000 (riesgo) más 5 por minuto de atraso, esperar a que abriera costaba 0,3 por minuto, y las que ya habían cerrado se mandaban al final de la ruta. Un horario es una estimación y cambia durante el día, pero el motor lo trataba como una ley y cruzaba la ciudad para cumplirlo.

Medido (20 rutas simuladas de 30 paradas con pin exacto, el 30 % o el 60 % de los locales con horario):

| Locales con horario | Horarios mandan (antes) | Horarios solo avisan (ahora) | Sin horarios |
|---|---|---|---|
| 30 % | 96,3 km · 5,7 cruces | 72,8 km · 0,1 cruces | 70,9 km · 0 cruces |
| 60 % | 121,7 km · 15,9 cruces | 69,8 km · 0,1 cruces | 70,9 km · 0 cruces |

Volver los horarios «blandos» (30 min de castigo por parada tarde) casi no ayudaba (95,3 km y 5,7 cruces con el 30 %): mientras el horario cueste algo comparable a un desvío, el motor sigue cruzando la ciudad. Por eso se sacó del costo.

## Decisión

- **El orden sale solo de las cercanías** (más los pesos que ya existen: calle, desempate por llegar antes, orden de carga para lo que no se sabe dónde está, y «más lejano/más cercano» si el dueño lo eligió).
- **Los horarios solo avisan.** `HORARIOS_GOBIERNAN_EL_ORDEN = false`: riesgo, atraso y espera valen 0 al ordenar. La parada que llegaría fuera de su horario sigue saliendo en `enRiesgo` («Llegaría a las 14:10 y cierra a las 13:00») con sus sugerencias, y el chofer decide.
- **Nada se manda al final por su horario.** Las paradas que según su horario ya cerraron (o no atienden hoy) se ordenan por cercanía como las demás y quedan marcadas en riesgo. Si el chofer encuentra un local cerrado, lo posterga («después») o lo marca como no entregado, y ahí sí la ruta se devuelve por él más tarde.
- **Lo aprendido sobre cierres** (ADR 0050) conserva solo el aviso CIERRE_PROBABLE (`avisarCierresAprendidos`): ya no mueve paradas.
- **Urgencias y orden manual** siguen igual: «IR PRIMERO» y mover una parada a mano reordenan lo de abajo desde ahí (ADR 0029). La prioridad `urgente` conserva su empuje leve (0,1 por minuto).
- **La ruta la decide el primero de la lista.** Al registrar una entrega que no era la siguiente, o al mover/pasar primero una parada, lo que queda se vuelve a ordenar desde donde está el camión (ADR 0029); con la cercanía como único criterio, cada parada que se entrega deja el resto optimizado desde ahí.
- El motor puro (`PARAMETROS_POR_DEFECTO`) sigue pudiendo hacer que los horarios manden (`horariosGobiernan: true`): es una decisión de la aplicación, y se vuelve a activar con una sola constante si el dueño lo pide cuando los horarios estén confirmados.

## Consecuencias

- La ruta puede llegar a un local antes de que abra o después de que cierre. Es lo que el dueño pidió: eso se resuelve en terreno y queda a la vista en los avisos. La lista de «en riesgo» puede ser larga cuando hay muchos horarios cargados.
- Cargar un horario deja de «mover» la ruta (ADR 0042, «Límite»: ya no se atiende antes lo que cierra pronto).
- Sin migración ni cambio de API.

## Pendiente

- Hoy la lista se reordena con las acciones del chofer y al registrar entregas; no hay reoptimización continua por posición GPS sin que ocurra nada. Si se quiere, se puede ofrecer como sugerencia («hay un orden mejor desde donde estás») sin mover la lista sola.
- La ruta vuelve siempre al depósito: es el último tramo del circuito, no un retroceso.
