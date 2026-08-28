---
id: SPEC-UX-BUTTONS-CLASSROOM-FEEDBACK
titulo: Política Universal de Retroalimentación en Botones y Validación de Sincronización Classroom
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity
modulo: frontend_ux_core
estado: implemented
---

## Contexto
EvaluaPro requiere que cualquier acción desencadenada por un usuario a través de un botón proporcione retroalimentación visual inmediata (micro-animación de pulsación, indicador de carga cuando es asíncrono, deshabilitación preventiva contra doble clic y notificación Toast de resultado). Asimismo, el módulo de integración con Google Classroom debe garantizar la carga reactiva de cursos activos, roster de estudiantes y actividades, así como la importación de calificaciones sin fallas.

## Requisitos Funcionales
1. **REQ-BTN-001**: El componente `Boton` y los estilos de `.boton` deben proporcionar retroalimentación activa al clic (`:active { transform: scale(0.97); }`) y soportar estados de carga con spinner y `aria-busy`.
2. **REQ-BTN-002**: Toda acción asíncrona de usuario (guardar, actualizar, eliminar, crear, sincronizar, exportar) debe notificar al usuario mediante `emitToast` con niveles `info`, `ok`, `warn` o `error`.
3. **REQ-CLS-001**: La sección `SeccionClassroom` debe cargar los 12 alumnos y 6 tareas del curso activo de Google Classroom tan pronto se seleccione el curso, sin requerir una materia previa.
4. **REQ-CLS-002**: Se debe disponer de la opción de crear la materia local en EvaluaPro con 1 clic a partir del curso de Classroom seleccionado.
5. **REQ-CLS-003**: La previsualización y ejecución de sincronización deben procesar las entregas e importar evidencias de forma idempotente con status 200.

## Criterios de Aceptación
- 0 botones mudos (sin feedback ni respuesta visual) en todo el monorepo.
- 0 errores en la suite completa de calidad (`npm run lint`, `typecheck`, `test:frontend:ci`, `test:backend:ci`, `test:portal:ci`, `perf:check`, `pipeline:contract:check`).
- Validación funcional de sincronización de Classroom completada con 12 alumnos y 6 actividades importadas.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-BTN-001 | Micro-interacción y estado cargando en Boton | `apps/frontend/tests/ux.visual.test.tsx` | Implementado |
| REQ-BTN-002 | Emisión de Toast en acciones de usuario | `apps/frontend/tests/seccionClassroom.test.tsx` | Implementado |
| REQ-CLS-001 | Carga de cursos, roster y actividades Classroom | `apps/frontend/tests/seccionClassroom.test.tsx` | Implementado |
| REQ-CLS-002 | Creación de materia desde curso de Classroom | `apps/backend/tests/integracion/classroom.v2.test.ts` | Implementado |
| REQ-CLS-003 | Sincronización e importación de evidencias | `apps/backend/tests/integracion/classroom.v2.test.ts` | Implementado |
