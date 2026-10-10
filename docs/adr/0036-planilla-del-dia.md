# 0036 — Planilla del día: quién lleva cada camión, con qué vendedores y comunas

Estado: aceptada. Decisión del dueño, 2026-10-07. Cierra lo que quedó abierto en el ADR 0017.

## Contexto
Cada mañana la oficina recibe una planilla de Excel con una fila por camión: **chofer, ayudante, patente, vendedor(es) (V01…V16 con su nombre) y, opcionalmente, la comuna o comunas que hace**. Los choferes rotan de camión, así que esa planilla es la verdad del día. Hasta ahora el chofer elegía su camión a mano y veía a todos los vendedores.

## Decisiones
1. **La oficina pega la planilla tal cual** (admin o despachador, `POST /v1/planilla`). No se escribe fila por fila.
2. **Cada fila se aplica por separado** y devuelve su resultado: una fila mala no frena a las demás.
   - Camión que no existe → se crea con la patente. El **nombre corto es los dos últimos dígitos** de la patente (81, 16, 23); si otro camión ya los usa (SDTS23 y LZYS23), el nuevo queda sin nombre y se le pone a mano («23 nuevo», «23 antiguo»). Un camión fuera de servicio que aparece en la planilla se reactiva.
   - Vendedores que no existen → se crean (el código hace de nombre si la planilla no lo trae; si ya estaban con el código por nombre, se completa). El celular se carga aparte en VENDEDORES.
   - Chofer y ayudante → se enlazan con su usuario **por nombre** (todas las palabras de uno están en el otro, mínimo dos palabras, sin ambigüedad). Si no se puede enlazar con certeza **se avisa y no se adivina** («sin usuario»).
   - Si la planilla es **de hoy**, cada persona enlazada queda con su camión ya elegido: el chofer abre la app y ya está en su ruta.
3. **Se guarda la asignación** del día por camión (`asignacion_dia`, `asignacion_vendedor`); volver a pegar la planilla reemplaza solo los camiones que trae.
4. **La jornada trae la asignación**: `GET/POST /v1/jornada` incluye `asignacion` (chofer, ayudante, comunas y vendedores con celular). Con eso, «ESTÁ CERRADO» ofrece WhatsApp **solo a los vendedores de ese camión**, y la carga avisa (sin bloquear) cuando la comuna de una dirección no está entre las del camión.
5. **Un código de vendedor es el mismo escrito V6, V06 o v 06** (→ V06), tanto al crearlo a mano como desde la planilla.

## Límites
- Cuando el nombre de la planilla no coincide con ningún usuario, la persona queda anotada pero sin camión elegido: hay que crearle el usuario (USUARIOS) o corregir el nombre y pegar de nuevo.
- **CABINET** es quien entrega las máquinas (freezers), no los helados: la app lo omite antes de enviar (ADR 0024 del front). Cualquier otra
  cosa que no sea patente se informa como fila inválida y no frena a las demás.
