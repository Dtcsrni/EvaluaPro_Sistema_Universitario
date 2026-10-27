---
id: SPEC-126
titulo: Mejora UX de Alumnos y matrícula
version: 1.0.0
fecha: 2026-10-26
autor: Codex
modulo: frontend_docente_alumnos_ux
estado: approved
---

## Contexto

La pantalla de Alumnos combina altas, edición, reinscripción, filtros y seguimiento de grupo. La revisión detectó información de matrícula repetida en tarjetas, el indicador ambiguo `Sin Derecho`, emoji decorativos, atributos de formulario incompletos e IDs internos visibles en etiquetas de materias. El runtime docente ya estuvo disponible para la revisión visual inicial y la comprobación de selectores; faltan los demás tamaños, temas y recorridos de interacción definidos abajo.

Fuentes de diseño accesible:

- [W3C WAI: etiquetar controles](https://www.w3.org/WAI/tutorials/forms/labels/)
- [W3C WAI: instrucciones para formularios](https://www.w3.org/WAI/tutorials/forms/instructions/)
- [WCAG 2.2: identificación y corrección de errores](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
- [WCAG 2.2: reflow (SC 1.4.10)](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [W3C WAI: tablas de datos](https://www.w3.org/WAI/tutorials/tables/)

## Alcance

Mejorar la presentación y captura de expedientes de alumnos en el frontend docente. No cambiar API, persistencia, permisos, formato de matrícula CUH, umbrales de asistencia, reglas académicas, importación de listas ni semántica de reinscripción.

## Requisitos Funcionales

- **REQ-001 (Tarjetas de alumno):** El nombre y la matrícula deben presentarse una sola vez cada uno, con jerarquía legible. Matrícula, grupo y correo conservan sus etiquetas y contenido.
- **REQ-002 (Indicadores):** Reemplazar `Sin Derecho` por texto que describa el dato observado —alumnos con cuatro o más inasistencias— sin inferir una decisión de elegibilidad. Conservar exactamente el cálculo y su umbral actuales.
- **REQ-003 (Formulario):** Mantener etiqueta visible e instrucción de matrícula. Declarar propósito/autocompletado adecuado para nombres, apellidos y correo; marcar el correo como campo de correo sin alterar validación o envío existentes.
- **REQ-004 (Consistencia visual):** Retirar emoji decorativos de títulos y acciones, usar la iconografía compartida y mantener textos en español con uso de mayúsculas natural. Reutilizar tokens existentes.
- **REQ-005 (Responsive y accesibilidad):** Revisar tarjetas, ayudas, selectores y acciones en temas claro/oscuro, teclado, zoom y anchos móviles; errores y estados deben permanecer identificables con texto.
- **REQ-006 (Compatibilidad):** Conservar CRUD, permisos, filtros, importación, estados vacíos, reinscripción, etiquetas accesibles y datos históricos.

## Criterios de Aceptación

1. Una tarjeta muestra nombre, matrícula, grupo y correo sin duplicar matrícula ni recortar datos.
2. El contador de inasistencias explica qué mide y no comunica una decisión académica no calculada por esa vista.
3. Los campos personales mantienen etiquetas e instrucciones visibles; los propósitos de nombre, apellidos y correo se exponen de forma programática.
4. Las pantallas de referencia y posterior se revisan en ejecución en tema claro y oscuro, a 320/390 px y escritorio; se recorren teclado y estados aplicables. Una pantalla no disponible queda pendiente.
5. Las pruebas de compatibilidad confirman matrícula, alta/edición, filtros, permisos, importación y reinscripción sin cambios de contrato.
6. Pasan `npm run guard:wcag`, lint, typecheck frontend y las pruebas frontend focales; se registra el resultado exacto.

## Matriz de Trazabilidad

| Requisito | Verificación | Estado |
| --- | --- | --- |
| REQ-001, REQ-006 | `apps/frontend/tests/seccionAlumnos.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; revisión runtime | Implementación y pruebas focales existentes; opciones conservan `_id` como `value` y ya no lo exponen como `title`; reflow verificado por tests a 320/390/571/1023 CSS px en tema oscuro; falta tema claro y recorrido visual sin datos personales |
| REQ-002 | `apps/frontend/tests/seccionAlumnos.test.tsx` | Implementado y cubierto; falta revisar visualmente el estado con datos reales sin conservar datos personales |
| REQ-003 | `apps/frontend/tests/seccionAlumnos.test.tsx` | Implementado y cubierto; matrícula, nombres, apellidos y materia son obligatorios en UI y tecnología asistiva; correo y grupo se identifican como opcionales; correo sigue siendo `type=email` |
| REQ-004 | `apps/frontend/tests/seccionAlumnos.test.tsx`; `apps/frontend/tests/guiaAlumnosVisual.test.tsx`; `apps/frontend/tests/ux.visual.test.tsx` | Emoji retirados del botón plegado de guía y de la ayuda del formulario; icono SVG decorativo queda oculto a tecnología asistiva; falta revisar el resto de pantallas en temas y tamaños requeridos |
| REQ-005 | `apps/frontend/tests/gui.responsive.contract.test.tsx`; revisión runtime | Parcial; sin overflow del documento ni de lista/panel a 320/390/571/1023 CSS px en tema oscuro; faltan teclado, zoom y tema claro |
| Selectores sin IDs técnicos | `apps/frontend/tests/seccionAlumnos.test.tsx` | Implementado: etiquetas legibles con fecha de inicio; ID permanece solo como valor interno de opción |
| Build y controles de calidad | Builds docente/alumno, guard de bundle, WCAG, pruebas focales | Pasan en la actualización de reflow: typecheck, ESLint, guard y contraste 20/20; Alumnos/responsive 25/25; falta recorrido de teclado y ambos temas |
