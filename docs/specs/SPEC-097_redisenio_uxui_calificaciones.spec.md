---
id: SPEC-097
titulo: Rediseño UX/UI del espacio de Calificaciones
version: 1.0.0
fecha: 2026-10-13
autor: Erick Vega / Codex
modulo: modulo_analiticas
estado: approved
---

## Contexto

El espacio docente de Calificaciones reúne cinco vistas (Resultados, Extraordinarios, Actas y exportación, Revisión y captura OMR/manual, y Classroom) y el detalle del libro por alumno. La captura actual evidencia una columna muy larga de tarjetas para AJ–BB, repetición de “Sin dato” y controles de captura mezclados con el resumen, lo que hace lenta la consulta y oculta la acción principal, sobre todo en anchos estrechos.

La dirección visual elegida por el usuario es “Resumen primero”: encabezado compacto del alumno, resumen de calificaciones y navegación por corte, captura contextual y libro completo plegable. El rediseño debe extender una jerarquía visual consistente a las cinco vistas relacionadas. La imagen conceptual no cambia reglas académicas ni define datos.

Personas beneficiadas: docente que consulta, captura y revisa calificaciones. El valor esperado es localizar un estado o dato con menos desplazamiento, reducir errores de captura y mantener accesibles los flujos existentes.

## Requisitos Funcionales

- REQ-001: Rediseñar la jerarquía del espacio de Calificaciones para las vistas Resultados, Extraordinarios, Actas y exportación, Revisión y captura OMR/manual, y Classroom. Conservar acceso, acciones, nombres de estados y comportamiento funcional vigentes; hacer evidente la vista activa y el contexto de materia/alumno cuando aplique.
- REQ-002: La vista Resultados ofrecerá controles de materia, búsqueda, orden y estado en un grupo compacto. En escritorio conservará lectura tabular y jerarquía de calificación final; en pantallas estrechas presentará filas como registros legibles sin desbordamiento horizontal, solapamiento ni pérdida de campos o acciones.
- REQ-003: El detalle del alumno priorizará identidad académica mínima, estado y resumen de cortes. Permitirá recorrer Resumen, Primer Parcial, Segundo Parcial, Global y Libro con una navegación accesible por teclado. No cambiará valores, fórmulas, escalas, fuentes ni reglas de persistencia.
- REQ-004: La captura manual y las referencias automáticas/OMR se presentarán con procedencia claramente separada. Cada control conservará rango, precisión, permisos, validación, concurrencia, idempotencia, errores y confirmación de guardado vigentes. Un valor faltante seguirá siendo distinto de cero.
- REQ-005: Los campos académicos AJ–BB conservarán su nombre, clave, unidad/escala, procedencia y semántica. El libro completo podrá expandirse bajo demanda; los campos ausentes no dominarán el resumen inicial y seguirán siendo consultables. No ocultar valores existentes ni convertir campos calculados a editables.
- REQ-006: Bono extracurricular, solicitudes/resultados Extra, observaciones y acciones para abrir revisión conservarán sus reglas y estarán agrupados en la sección contextual correspondiente, sin eliminar acciones existentes ni implicar mutaciones no confirmadas.
- REQ-007: Usar los iconos SVG compartidos y el catálogo Lucide ya instalado cuando un símbolo ayude a reconocer navegación, categoría, estado o acción. No agregar dependencias. Mantener texto visible en acciones/estados; los controles solo con icono tendrán nombre accesible y tooltip cuando proceda.
- REQ-008: Añadir transiciones breves para cambios de vista, apertura de secciones y estados de guardado; ninguna información dependerá del movimiento. Respetar `prefers-reduced-motion` y evitar animaciones continuas salvo indicador temporal de carga.
- REQ-009: Cumplir `docs/WCAG_UI_POLICY.md` en temas claro y oscuro, contraste, foco visible, teclado, nombres accesibles, mensajes de error, reflow y zoom. Usar la familia cromática institucional con roles diferenciados para selección, información, pendiente, éxito y error, tomando sus valores de tokens semánticos existentes y verificando contraste por tema. Mantener tokens semánticos y no añadir colores crudos sin evidencia del guard WCAG.
- REQ-010: No cambiar endpoints, contratos API, fórmulas académicas, permisos, política de datos, rutas ni escritura canónica de calificaciones como parte del rediseño.

## Criterios de Aceptación

- CA-001: Los cinco espacios se pueden abrir y operar mediante el shell rediseñado, y conservan su funcionalidad y contexto activo.
- CA-002: En Resultados, se puede identificar alumno, grupo, Parcial 1, Parcial 2, Global, Bono, Final, Estado y Acción en escritorio y móvil; filtros, búsqueda, orden y detalle siguen disponibles.
- CA-003: El detalle prioriza el resumen y los cortes. Los campos AJ–BB completos se consultan al expandir Libro; “Sin dato”, cero, automático/referencia y captura manual permanecen semánticamente distintos.
- CA-004: Guardar una calificación, bono o solicitud Extra conserva el comportamiento previo y su resultado se comunica con texto accesible; el rediseño no introduce escrituras adicionales.
- CA-005: No hay contenido recortado, desbordado ni superpuesto a 320, 360, 718, 1280 y 1440 px; reflow correcto a zoom 200 %.
- CA-006: Navegación e interacción principal funcionan con Tab, Shift+Tab, Enter y Space; Escape cierra detalle o menú cuando corresponda. El foco permanece visible y no queda tapado.
- CA-007: Contraste, estados `default`, `hover`, `active`, `focus-visible`, `disabled`, `loading`, `error`, `success` y `selected` se revisan en ambos temas; la paleta relacionada conserva suficiente contraste para cada rol sin depender solo del color; movimiento reducido elimina o minimiza transiciones no esenciales.
- CA-008: Se ejecutan pruebas frontend dirigidas, lint, typecheck, `npm run guard:wcag`, build docente y gates aplicables; se documenta revisión visual runtime de las cinco vistas, teclado y estados pertinentes. No se declara conformidad WCAG completa con capturas solamente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Navegación entre espacios, resumen y comportamiento del libro de calificaciones | apps/frontend/tests/seccionCalificaciones.routing.test.tsx | Cubierto; suite dirigida 42/42 aprobada |
| REQ-002, REQ-003, REQ-005 | Presentación y semántica del resumen/campos académicos | apps/frontend/tests/seccionCalificaciones.resumen.test.tsx | Cubierto; suite dirigida 42/42 aprobada |
| REQ-003, REQ-004 | Captura manual y estado editable de revisión | apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx | Cubierto; suite dirigida 42/42 aprobada |
| REQ-001, REQ-006 | Flujos de extraordinarios y sus estados | apps/frontend/tests/extraordinariosCalificaciones.test.tsx | Cubierto; suite dirigida 42/42 aprobada |
| REQ-001, REQ-006 | Vínculos y cortes de Classroom desde Calificaciones | apps/frontend/tests/classroomEnCalificaciones.test.tsx | Cubierto; suite dirigida 42/42 aprobada |
| REQ-001, REQ-006 | Mapeo de actividades Classroom a cortes | apps/frontend/tests/classroomEnCalificaciones.mapeoCortes.test.tsx | Cubierto; suite dirigida 42/42 aprobada |
| REQ-001, REQ-004 | Estados del flujo OMR/revisión y captura | apps/frontend/tests/omrWorkflowState.hooks.test.tsx | Cubierto; suite dirigida 42/42 aprobada |
| REQ-007, REQ-008, REQ-009 | Accesibilidad, movimiento reducido, reflow, temas y estados visuales | apps/frontend/tests/seccionCalificaciones.routing.test.tsx | WCAG guard 20/20; reflow visual 25/25 y tema oscuro inspeccionados. Inspección visual del tema claro y teclado quedan pendientes |

