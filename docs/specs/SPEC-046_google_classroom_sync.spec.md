---
id: SPEC-046
titulo: Sincronización de Calificaciones desde Google Classroom
version: 1.5.0
fecha: 2026-09-30
autor: Antigravity / EvaluaPro Team
modulo: modulo_classroom
estado: approved
---

## Contexto
EvaluaPro sincroniza las calificaciones que ya fueron asignadas a actividades en Google Classroom y las presenta como evidencia de solo lectura en Calificaciones. La revisión de entregas y la asignación de notas permanecen en Classroom. Esta integración no debe duplicar esos flujos ni publicar calificaciones desde EvaluaPro.

## Requisitos Funcionales
- **REQ-001 (Conexión OAuth 2.0)**: Vinculación con los alcances (`scopes`) de Classroom.
- **REQ-002 (Vinculación de curso y materia)**: Seleccionar explícitamente el curso Classroom y la materia local antes de sincronizar; no inferir ni cambiar asignaciones de calificación.
- **REQ-003 (Lectura de calificaciones asignadas)**: Sincronizar únicamente `assignedGrade`; ignorar `draftGrade`. Mostrar las evidencias Classroom en Calificaciones como datos de origen no editables.
- **REQ-004 (Descripción extensa)**: Vista previa e importación aceptan actividades de Classroom cuya descripción original exceda el límite de 600 caracteres de una descripción personalizada; se conserva el texto original sin enviarlo como modificación del usuario.
- **REQ-005 (Previsualización e idempotencia)**: La previsualización no crea ni modifica evidencias o calificaciones; repetir una importación del mismo envío no duplica la evidencia.
- **REQ-006 (Normalización de nota existente)**: Convertir `assignedGrade` a escala de 0–10 usando `maxPoints` cuando esté disponible. Una entrega sin `assignedGrade` no crea evidencia nueva; si ya existe evidencia sincronizada, queda pendiente y sin nota normalizada. No importar ni persistir `draftGrade`.
- **REQ-007 (Mapeo académico sin duplicar Classroom)**: La sincronización conserva el `assignedGrade` ya capturado en Classroom y permite mapear la actividad importada a un corte/destino académico de EvaluaPro para calcular evaluación continua. Ese mapeo no crea otra actividad, entrega ni calificación editable; debe guardar IDs de Classroom y permitir revisión del docente. No se infiere el corte por título. Si la actividad tiene corte explícito, este prevalece sobre la fecha de corte y solo contribuye a ese parcial; la fecha se usa como fallback únicamente si no hay corte explícito.
- **REQ-008 (Separación de responsabilidades)**: La pantalla Classroom se limita a conexión, selección de curso/materia, sincronización explícita e historial. El mapeo de alumno y de actividad importada a corte/destino se administra en Calificaciones/Evaluación continua, sin roster duplicado ni revisión/asignación de notas en EvaluaPro. La nota fuente permanece de solo lectura y cualquier corrección de nota se hace en Classroom.
- **REQ-009 (Solo lectura y reconciliación)**: Calificaciones filtra evidencias Classroom por la materia seleccionada y las presenta como solo lectura. Si se elimina una nota asignada en Classroom, la siguiente sincronización limpia la nota local obsoleta.
- **REQ-010 (Revisión en la fuente)**: Cada evidencia sincronizada expone el enlace original de actividad que entrega Classroom, si es válido. Calificaciones ofrece un enlace externo de solo lectura para abrir esa actividad en Classroom; EvaluaPro no presenta entregas duplicadas ni modifica el trabajo o su nota.
- **REQ-011 (Consulta histórica de materias archivadas)**: En Classroom, la persona docente puede solicitar incluir materias archivadas, identificadas claramente, para consultar historial y sincronizar actividades ya calificadas de ese periodo. La consulta no reactiva la materia. Para un periodo archivado, el mapeo puede resolver alumnos locales inactivos pertenecientes a ese mismo periodo; periodos activos mantienen el filtro actual de alumnos activos. La sincronización conserva permisos, preview, confirmación y auditoría vigentes.
- **REQ-012 (Resultado parcial de ejecución)**: Si la API termina la solicitud pero devuelve errores por actividad junto con conteos reales, Calificaciones anuncia que la ejecución terminó con errores, conserva los conteos y detalles devueltos y no presenta el resultado como una sincronización íntegramente completada. Una relectura correcta de evidencias no elimina ni oculta esos errores.

## Criterios de Aceptación
1. El flujo de autenticación OAuth 2.0 conecta de forma segura con la API de Google Classroom.
2. El mapeo de cuentas de estudiantes se administra en Calificaciones, para la materia elegida, y no crea estudiantes.
3. `draftGrade` nunca se importa como nota; solo una calificación `assignedGrade` produce estado calificado.
4. La suite de auditoría de Classroom en backend y frontend corre en verde.
5. Una actividad con descripción original extensa no produce error de validación por longitud.
6. La previsualización no cambia evidencias ni calificaciones y la segunda importación de los mismos envíos mantiene el conteo de evidencias.
7. Una entrega con `draftGrade` y sin `assignedGrade` no crea evidencia local ni nota normalizada.
8. Si una calificación asignada se retira en Classroom, la siguiente sincronización limpia la nota normalizada que había guardado EvaluaPro.
9. Classroom y Calificaciones no duplican revisión/asignación de notas; la sincronización solo lee y no edita Classroom. El mapeo académico local conserva los IDs de la actividad y el corte destino.
10. La consulta de Calificaciones presenta las evidencias Classroom como solo lectura, aisladas por materia, y una nota retirada se elimina localmente al sincronizar de nuevo.
11. Una evidencia con `corte: 3` y fecha anterior a los cortes 1 y 2 aporta a C3, no a C1 ni C2; las evidencias sin corte explícito conservan el fallback por fecha configurada.
12. Una evidencia con `metadata.alternateLink` HTTPS de `classroom.google.com` muestra un enlace `target="_blank"` protegido; hosts externos, protocolos distintos y URLs inválidas no crean enlaces.
13. La GUI solicita `GET /periodos?activo=false` solo cuando se activa «Incluir materias archivadas», las etiqueta como archivadas, conserva la materia activa sin duplicarla y no reactiva ni sincroniza automáticamente la materia seleccionada.
14. En una materia archivada, las coincidencias por correo/matrícula pueden resolver sus alumnos locales inactivos; en una materia activa los alumnos inactivos siguen fuera del mapeo automático.
15. Si la ejecución devuelve conteos y al menos un error por actividad, la GUI muestra un aviso accesible de finalización con errores con los conteos reales, mantiene visible el detalle del error y distingue ese resultado de una ejecución completa; la relectura de evidencias se reporta por separado.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Flujo de conexión y comportamiento Classroom | `apps/frontend/tests/seccionClassroom.test.tsx` | En actualización |
| REQ-002 | Auditoría y optimización de importaciones | `apps/backend/tests/integracion/classroom.audit.test.ts` | Completado |
| REQ-003 | Sincronización pull de cursos y notas | `apps/backend/tests/integracion/classroom.pull.test.ts` | Completado |
| REQ-004 | Descripción extensa en vista previa e importación | `apps/frontend/tests/seccionClassroom.test.tsx` | Completado |
| REQ-005 | Vista previa sin escrituras de notas e importación idempotente | `apps/backend/tests/integracion/classroom.v2.test.ts` | Completado |
| REQ-006 | Solo `assignedGrade` determina estado y nota importada | `apps/backend/tests/integracion/classroom.v2.test.ts` | En actualización |
| REQ-007 | Selección explícita y envío de solo actividades publicadas | `apps/frontend/tests/seccionClassroom.test.tsx` | En actualización |
| REQ-007 | Corte explícito prevalece sobre fecha en cálculo de continua | `apps/backend/tests/integracion/evaluaciones.modulo.test.ts` | Verificado |
| REQ-008 | Sin duplicar revisión ni asignación de notas en EvaluaPro | `apps/frontend/tests/seccionClassroom.test.tsx` | En actualización |
| REQ-009 | Evidencias de solo lectura y vinculación alumno–cuenta dentro de Calificaciones | `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | En actualización |
| REQ-010 | Preservación del enlace en la API y acceso seguro a actividad original en Calificaciones | `apps/backend/tests/integracion/evaluacionesEvidenciasPaginacionApi.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | En actualización |
| REQ-011 | Listado explícito y selección de materias archivadas sin reactivación | `apps/frontend/tests/seccionClassroom.test.tsx`; `apps/backend/tests/integracion/classroom.v2.test.ts` | Pruebas focalizadas y runtime local verificados; falta validar Classroom real |
| REQ-012 | Conteos reales y errores por actividad no deben mostrarse como éxito total | `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `apps/backend/tests/integracion/classroom.v2.test.ts` | GUI 9/9 y API 5/5 focales en este worktree; sin Classroom real en esta auditoría |
