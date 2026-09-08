---
id: SPEC-052
titulo: Sistema visual reutilizable para tarjetas del frontend
version: 1.6.0
fecha: 2026-09-01
autor: EvaluaPro Team
modulo: frontend_ui_tarjetas
estado: approved
---

## Contexto
Las tarjetas del portal docente usan estilos locales y acumulados que producen diferencias de jerarquía, espaciado, profundidad y estados interactivos entre materias, alumnos, banco, temarios, asistencias, calificaciones, plantillas y cuenta. El docente necesita reconocer rápidamente qué información es principal, qué acción está disponible y qué estado tiene cada registro, sin perder legibilidad ni comportamiento responsive.

## Dirección visual aprobada
La evolución visual debe ser estructural y no limitarse a sumar gradientes o brillos. El
canvas de la aplicación será sutil, difuminado y de bajo contraste; las tarjetas tendrán
una superficie de vidrio azul pizarra claramente separada del fondo, profundidad controlada
y ningún acento decorativo que sobresalga de sus límites. La información primaria deberá
preceder a guías y formularios secundarios, y cada tarjeta interactiva deberá exponer una
acción principal descubrible además de sus acciones administrativas plegables.

La identidad canónica de esta iteración es **Petróleo Prismático**. El canvas usa
`#07162B` en oscuro y `#EEF4FA` en claro; el texto primario usa `#F8FBFF`/`#102033`,
el texto secundario `#D9E8F5`/`#334E68` y la acción primaria `#0B6FA8` con texto blanco.
Los acentos semánticos son cyan, violeta, menta, ámbar y coral para acción, navegación,
éxito, advertencia y riesgo respectivamente. Las superficies emplean alpha y blur
controlados, con reflejo interno recortado y fallback opaco equivalente; ningún texto
crítico depende de la imagen que se vea detrás.

## Requisitos Funcionales
- **REQ-001 (Base reutilizable)**: El frontend debe exponer una clase base de tarjeta (`.ui-card`) con variables de superficie, borde, sombra, radio, separación y transición, reutilizable por módulos existentes.
- **REQ-002 (Variantes semánticas)**: Las tarjetas deben admitir variantes para contenido informativo, interactivo, destacado, formulario y estado vacío, sin duplicar reglas visuales por pantalla.
- **REQ-003 (Interacción y animación)**: Las tarjetas interactivas deben tener estados hover, focus-visible y active coherentes; las listas deben conservar entrada escalonada y las animaciones deben desactivarse cuando el usuario prefiera reducir movimiento.
- **REQ-004 (Presentación)**: La tarjeta debe mantener una jerarquía clara para encabezado, contenido, metadatos, acciones e indicadores, con acciones alineadas y wrapping seguro en anchos reducidos.
- **REQ-005 (Temas y responsive)**: El sistema debe conservar contraste en modo claro y oscuro, adaptarse desde móvil hasta escritorio y no alterar la semántica ni las acciones existentes.
- **REQ-006 (Metadatos de alumno)**: Las tarjetas de alumnos deben presentar matrícula, grupo y correo como tokens de metadato reutilizables, con jerarquía visual etiqueta/valor, acentos semánticos, contraste suficiente, wrapping seguro y sin modificar los datos mostrados ni su lógica.
- **REQ-007 (Metadatos de materia)**: Las tarjetas activas y archivadas de materias deben presentar sus fechas, grupos e identificadores con el mismo lenguaje de tokens reutilizables, sin solapamientos ni pérdida de legibilidad en los estados claro, oscuro y responsive.
- **REQ-008 (Iconografía coherente)**: Los iconos SVG y sus superficies visuales reutilizables deben conservar alineación óptica, contraste, profundidad, estados de interacción y adaptación responsive en los módulos docentes, sin cambiar su significado accesible.
- **REQ-009 (Jerarquía tipográfica)**: Los títulos, subtítulos, etiquetas, metadatos y texto auxiliar de las tarjetas deben usar una jerarquía reutilizable con contraste suficiente, wrapping seguro y énfasis semántico sin reducir la legibilidad ni modificar el contenido.
- **REQ-010 (Separación de superficie)**: Las tarjetas deben distinguirse del fondo mediante una superficie de vidrio más clara que el plano base, sin acentos decorativos que sobresalgan de sus límites visuales.
- **REQ-011 (Jerarquía de tarea)**: Las pantallas de catálogo deben priorizar el contenido operativo; las guías y formularios secundarios deben iniciar plegados y conservar un control explícito para expandirse.
- **REQ-012 (Acción primaria semántica)**: Una tarjeta de materia debe exponer una acción primaria visible para abrir el grupo y no depender únicamente de un contenedor con `role="button"` que anide otros controles interactivos.
- **REQ-013 (Fuente única de estilos)**: Las variantes de tarjeta deben resolverse mediante tokens y reglas reutilizables; los overrides históricos no deben reintroducir líneas decorativas, superficies contradictorias ni duplicación visual por pantalla.
- **REQ-014 (Sistema transversal de pantallas)**: Las vistas docente, alumno y negocio deben compartir tokens de canvas, tipografía, superficies, controles, estados, iconografía y responsive; cada dominio puede declarar únicamente su acento semántico.

## Criterios de Aceptación
1. Las tarjetas existentes de los módulos docentes reciben el tratamiento base mediante `.ui-card` o un mapeo compatible de sus clases actuales.
2. Materias activas y archivadas muestran una tarjeta visualmente consistente, con encabezado, indicador de estado, metadatos y acciones sin solapamientos.
3. Hover, focus-visible y active son visibles sin depender exclusivamente del color; `prefers-reduced-motion: reduce` elimina transformaciones y animaciones.
4. El layout de listas usa columnas fluidas y las acciones se acomodan sin desbordar en anchos menores.
5. El contrato visual automatizado pasa y la build de frontend docente concluye correctamente.
6. Las tarjetas de alumnos muestran sus metadatos con una superficie oscura de vidrio, separación visible entre etiqueta y valor, acentos diferenciados para matrícula/grupo/correo y adaptación sin desbordamiento en móvil y modo claro.
7. Las tarjetas activas y archivadas de materias muestran sus metadatos con la misma jerarquía visual, acentos diferenciados por significado y wrapping seguro.
8. Los iconos de navegación, tarjetas, guías, formularios y estados muestran un tratamiento visual coherente, con acabado de superficie, realce óptico y `prefers-reduced-motion` respetado.
9. Los textos de tarjetas y paneles distinguen visualmente título, contexto, estado, metadato y ayuda mediante peso, tamaño, color y espaciado consistentes, sin texto cortado horizontalmente en los anchos responsive soportados.
10. En modo oscuro, las tarjetas presentan una superficie azul pizarra más clara que el fondo, sombra controlada y ningún trazo superior que sobresalga del borde.
11. La pantalla de Materias prioriza el catálogo activo, mantiene guía y alta de materia plegadas por defecto y conserva sus estados persistentes sin scroll horizontal.
12. Cada materia muestra un CTA visible para abrir su grupo; las acciones administrativas permanecen agrupadas en un disclosure accesible y no rompen la navegación por teclado.
13. La cascada final no contiene el pseudo-elemento de trazo superior en tarjetas ni depende de reglas históricas de mayor especificidad para lograr la separación visual.
14. El sistema transversal define canvas difuminado, superficies de tarjeta claras respecto al fondo, estados de control, iconos SVG embebidos en campos y acentos por dominio sin alterar la funcionalidad.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Contrato de tokens, clase base y mapeo de tarjetas | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-002 | Variantes semánticas declaradas | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-003 | Estados interactivos y reduced motion | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-004 | Materias conserva clases y estructura de acciones | `apps/frontend/tests/appDocente.test.tsx` | Pendiente |
| REQ-005 | Build y pruebas UX del frontend | `apps/frontend/tests/ux.quality.test.tsx` | Pendiente |
| REQ-006 | Tokens visuales de metadatos en tarjetas de alumnos | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-007 | Tokens visuales de metadatos en tarjetas de materias | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-008 | Tratamiento global de iconos SVG y superficies | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-009 | Jerarquía tipográfica y contraste de textos | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-010 | Superficie clara y acentos contenidos | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-011 | Jerarquía de catálogo, guías y formulario plegable | `apps/frontend/tests/seccionPeriodos.edit.test.tsx` | Pendiente |
| REQ-012 | CTA primario y semántica de tarjeta de materia | `apps/frontend/tests/seccionPeriodos.edit.test.tsx` | Pendiente |
| REQ-013 | Fuente única de estilos y neutralización de legacy overrides | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
| REQ-014 | Tokens transversales, acentos por pantalla e iconos de campos | `scripts/tests/ui-cards.contract.test.mjs` | Pendiente |
