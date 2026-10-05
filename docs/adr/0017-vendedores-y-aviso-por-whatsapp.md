# 0017 — Registro de vendedores y aviso por WhatsApp a cada uno

Estado: aceptada (primer paso del punto 4 del ADR 0016). 2026-10-05.

## Decisión
- Tabla `vendedor` (código tipo V01, nombre, celular opcional, activo) por empresa. El admin la gestiona desde VENDEDORES; todos los roles pueden leerla (el chofer necesita los celulares).
- El celular se guarda normalizado como `569XXXXXXXX` (dominio, `valor/telefono.ts`); se acepta escrito con espacios, guiones o `+56`.
- En «ESTÁ CERRADO» el chofer ve **un botón de WhatsApp por cada vendedor con celular** (abre ese chat con el mensaje armado) y «AVISAR A OTRO CONTACTO». Sin vendedores cargados, queda el botón único que deja elegir el contacto.

## Lo que queda abierto
- **Planilla del día** (qué vendedores van en cada camión, chofer + ayudante + camión): hoy el chofer ve a todos los vendedores activos. Se hará cuando el dueño comparta cómo es la planilla.
- **Vendedor dueño del cliente:** si cada cliente tiene un vendedor asignado, el botón de ese vendedor debería ir primero. Falta que el dueño confirme si ese dato existe.
