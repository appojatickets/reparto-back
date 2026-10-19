# 0052. Cajas y patrones observados del recorrido

## Registros de cantidades y dinero

El dueño confirmó $15 por caja entregada para cada persona. `caja_carga` representa la carga física de una ventana de trabajo del camión; `caja_cuenta` representa la participación del usuario por jornada. Se conservan usuario y camión aunque luego cambien de equipo. No se suman las cuentas de personas para obtener la carga física.

Se registran bultos opcionales y la equivalencia en cajas explícita. Las cajas se expresan en centésimas y los cálculos monetarios en centavos de peso. Los descuentos son cajas no entregadas por cerrado y otros rebajes sin solaparlos; nunca pueden superar la carga. La tarifa queda registrada para conservar el historial. El total físico que vuelve se confirma al cierre del último integrante. Las revisiones de carga evitan sobrescrituras silenciosas y el cierre personal es idempotente; todas las escrituras quedan en `caja_auditoria`.

Las tablas están aisladas por empresa y con RLS. User y editor consultan exclusivamente sus cuentas: no hay un parámetro de usuario que permita pedir las ajenas. Solo admin consulta el conjunto. El inicio del servidor aplica esta migración aditiva en una transacción con bloqueo; el SQL es idempotente para que su posterior registro mediante el migrador habitual sea compatible. No se reejecutan migraciones viejas ni se requieren credenciales nuevas.

Los paneles incluyen también jornadas históricas sin carga registrada, pero no inventan cantidades ni montos para ellas. Solo cierres de cajas confirmados acumulan dinero. Km y comunas derivan de datos observados. Para el camión se fusionan muestras de sus teléfonos por intervalo, eligiendo la mejor precisión y descartando saltos o huecos mayores a dos minutos.

## GPS y motor

Una permanencia cerca de un pin preciso y el avance posterior se exponen como visita sin confirmar, no entrega automática. Se exige precisión conocida de hasta 50 m, permanencia mínima y ausencia de ambigüedad con otro local a distancia similar. Dos muestras posteriores a más de 100 m respaldan el avance. Confirmar una visita pasada utiliza `sinPin` para no mover el local desde otra ubicación. La carga retrasada por falta de conexión amplía la ventana usada para reconstruir llegadas, dentro de la antigüedad aceptada.

El análisis de los últimos 90 días aprende pares, ternas, transiciones de comuna e inicio habitual, con ámbito de equipo, camión, persona y día de semana. Las jornadas delimitan quién participó. Múltiples botones o pings de un mismo día no constituyen días adicionales. Se exigen tres días distintos y al menos 70 % de coincidencia. El patrón específico del día/persona prevalece sobre uno general.

Se guardan patrones y direcciones legibles en el resumen del análisis existente; no se añade una base ni un servicio de IA. La ruta consulta el último análisis y aplica únicamente preferencias blandas con costo total limitado a cinco minutos. Las ventanas duras, prioridades y posiciones fijadas siguen dominando. Los modos manual y carga conservan su orden. El detalle y la evaluación del motor comparten el mismo costo. No se infieren causas como ferias a partir de un desvío semanal.

## Validación

Pruebas de aritmética decimal, límites, privacidad por rol, cierre idempotente, carga compartida y revisiones, SQL real, visitas sin botones, ambigüedad, patrones por días distintos y restricciones horarias. La compilación del APK conserva el mecanismo de aviso de versiones ya publicado.
