---
id: SPEC-098
titulo: Trazabilidad de calificaciones e historial ligero de Classroom
version: 1.2.0
fecha: 2026-10-14
autor: Erick Vega / Codex
modulo: modulo_analiticas
estado: approved
---

## Contexto

Las calificaciones académicas deben poder capturarse y consultarse desde la GUI o la API sin crear estados divergentes. Cada escritura debe dejar evidencia durable de cuándo ocurrió, quién la realizó, por qué canal y con qué método; los reintentos y las ediciones concurrentes no deben duplicar ni sobrescribir silenciosamente datos. La sincronización actual de Classroom conserva la evidencia vigente por entrega, pero reemplaza `classroomData`; hace falta un historial ligero consultable por alumno y corte parcial para explicar cómo cambió cada calificación sin copiar el expediente completo de Classroom.

Esta especificación complementa SPEC-096 (captura de examen y campos del libro) sin cambiar las escalas ni la semántica académica del libro. El registro canónico permanece en EvaluaPro; GUI y API deben invocar los mismos servicios de dominio y persistencia.

## Requisitos Funcionales

- REQ-001: Toda captura o cambio de calificación guardará en una transacción el valor, actor autenticado, instante UTC, canal de captura (`gui`, `api`, `omr` o `classroom`), método/origen, alumno, periodo, corte/componente, escala/unidad, referencia de origen cuando exista, versión, `clientRequestId` y hash del payload. El valor y su evento de auditoría se confirman juntos o ninguno se confirma.
- REQ-002: La GUI y la API usarán el mismo validador, permisos, servicio de dominio, control de versión, idempotencia y transacción. Tras guardar, ambos canales consultarán el mismo estado canónico y expondrán procedencia e historial con contrato equivalente.
- REQ-003: Una repetición de la misma operación con el mismo `clientRequestId` y payload devolverá el resultado original sin crear otro evento. Reutilizar la clave con acción/payload distinto se rechazará como conflicto. La respuesta incierta por timeout se resolverá consultando por clave/recurso antes de permitir reintento.
- REQ-004: Las escrituras concurrentes usarán versión esperada. Una escritura obsoleta devolverá conflicto explícito, preservará el valor y auditoría ya guardados y permitirá recargar y decidir qué versión conservar. No habrá política de “última escritura gana” silenciosa.
- REQ-005: El historial de calificaciones será append-only y no se truncará mediante límites fijos de eventos por registro. Se consultará por recurso y periodo mediante API paginada y vista GUI, ordenado por fecha UTC, con filtros por alumno, corte, componente y origen. Cada evento distinguirá valor anterior/nuevo y estado (capturado, corregido, anulado si el dominio lo admite); no se borrarán eventos al archivar un recurso.
- REQ-006: Cada sincronización/importación de Classroom conservará un evento ligero por alumno, actividad y corte, con IDs canónicos de alumno/periodo/actividad/entrega, estado de entrega, puntaje y máximo originales, nota normalizada solo cuando aplique, instante de observación UTC, identificador de corrida/importación, hash estable del estado y actor/servicio que sincronizó. No guardará copias repetidas de nombre, correo, contenido de entrega, adjuntos ni el payload completo de Classroom en este historial.
- REQ-007: La sincronización agregará evento cuando cambie el estado relevante; si el hash y el estado no cambiaron, será idempotente y no agregará duplicados. Una corrección, devolución, retirada o cambio de calificación conservará el estado previo y añadirá el nuevo evento. Una actividad sin calificar o sin entrega se distinguirá de calificación cero.
- REQ-008: La asociación de la actividad con el corte será explícita y versionada/auditable. Cambiar una actividad de corte no reescribirá la historia pasada; cada evento mostrará el mapeo vigente al momento de observación y el sistema permitirá reconciliarlo explícitamente.
- REQ-009: API y GUI ofrecerán consulta del historial por alumno y parcial, con paginación estable, filtros y permisos. La vista distinguirá calificación vigente, evidencias Classroom históricas, captura manual y resultado OMR; ninguna fuente sustituirá silenciosamente otra.
- REQ-010: El esquema mantendrá una política de retención declarada. La historia necesaria para justificar calificaciones no se purgará por truncamiento técnico, sincronización, archivo de curso o reintento. Cualquier futura purga deberá ser una operación administrativa explícita, autorizada y auditable.
- REQ-011: Mensajes de error de GUI/API identificarán validación, permiso, conflicto de versión, clave idempotente incompatible o dependencia Classroom; no incluirán tokens ni datos de entrega sensibles.
- REQ-012: Para cada versión del promedio de un alumno en un corte, EvaluaPro generará una ficha visual individual a partir del snapshot canónico: promedio y escala, corte, periodo, fecha UTC, estado de datos, componentes/actividades que contribuyen y referencia/hash del historial origen. Se distinguirán faltantes de cero y se omitirá cualquier dato de otros alumnos. La ficha no afirmará una nota si la regla del corte no permite calcularla.
- REQ-013: La ficha se comprimirá como imagen WebP, se almacenará como artefacto inmutable vinculado al evento/snapshot (con MIME, dimensiones, bytes, hash y fecha), y podrá generarse, consultarse y descargarse mediante los mismos servicios autorizados desde GUI y API. El binario no se duplicará dentro de cada evento Classroom ni se recreará al reintentar la misma operación; las nuevas versiones del promedio obtendrán su propio artefacto. La ficha y su metadata compartirán la política de retención del historial académico.
- REQ-014: Si Classroom informa una nueva entrega o revisión de una actividad con evidencia ya aceptada, la sincronización detectará y mostrará el cambio como pendiente, pero no reemplazará la evidencia aceptada, el promedio oficial ni su ficha. Solo una acción explícita del docente puede aceptar y aplicar esa revisión; la decisión se protegerá con versión e idempotencia, conservará la evidencia anterior y registrará actor, fecha, valores y método. La GUI y la API tendrán operaciones equivalentes para revisar, aceptar o descartar una revisión.

## Criterios de Aceptación

- CA-001: Una captura manual por GUI y otra equivalente por API producen una sola calificación canónica por operación y muestran el mismo actor/canal, fecha UTC, componente, versión y procedencia después de recargar.
- CA-002: La base de datos no puede quedar con calificación sin evento de auditoría ni con evento de captura sin calificación confirmada; fallo inyectado dentro de la transacción revierte ambos.
- CA-003: Reintentar exactamente la misma solicitud conserva el mismo resultado y conteo de eventos; cambiar payload usando el mismo UUID produce conflicto sin mutar datos.
- CA-004: Dos clientes sobre la misma versión no sobrescriben en silencio: el primero guarda, el segundo recibe conflicto explícito, y el historial conserva solo la mutación aceptada hasta una nueva decisión del usuario.
- CA-005: Superar 50 cambios conserva consultables todos los eventos; lecturas paginadas no pierden ni repiten eventos al avanzar páginas.
- CA-006: Classroom guarda cambios de puntaje/estado como eventos por alumno, actividad y parcial; una sincronización idéntica no duplica; 0, sin calificación y sin entrega son estados diferentes.
- CA-007: Los eventos Classroom no guardan PII o payload completo innecesario, pero permiten enlazar la fuente por identificador autorizado y explicar nota, escala, corte, fecha y cambio.
- CA-008: Reclasificar una actividad a otro parcial no altera eventos anteriores y la reconciliación produce un registro explícito.
- CA-009: Una cuenta sin permiso no puede leer/escribir historial fuera de su ámbito. Errores y logs no exponen secretos ni contenido de entregas.
- CA-010: API, GUI y exportación académica concuerdan en la calificación vigente y no mezclan evidencia Classroom con captura manual o resultado OMR.
- CA-011: Cobertura automatizada incluye contrato API, transacciones/rollback, idempotencia, concurrencia, paginación/retención, sincronización Classroom, deduplicación, privacidad, mapeo de cortes y flujo visible de consulta GUI. El gate SDD valida las rutas de prueba declaradas.
- CA-012: GUI y API recuperan la ficha idéntica (mismo snapshotHash y bytes) para el mismo alumno/corte/versión; la imagen corresponde a la nota, escala, estado, fecha y componentes registrados, no muestra a otros alumnos y está comprimida en WebP.
- CA-013: Reintentos del mismo snapshot no generan imágenes duplicadas; un cambio relevante produce nuevo snapshot y artefacto. Faltante, ausencia de submissions y promedio cero se renderizan con estados inequívocos.
- CA-014: Una imagen no autorizada o un ID de otro docente/periodo/alumno no se puede leer; respuestas privadas usan `no-store` y validan `nosniff`/MIME.
- CA-015: Ante una nueva entrega o puntaje distinto, la sincronización crea una revisión pendiente; la calificación aceptada y su ficha no cambian hasta confirmación explícita del docente.
- CA-016: Aceptar una revisión en GUI o API crea exactamente una versión nueva con ficha WebP y audit trail; repetir la misma clave no duplica, usar versión obsoleta devuelve 409 y descartar conserva intacta la versión aceptada.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001–REQ-004 | Contrato de escritura, auditoría, idempotencia y concurrencia de calificaciones | apps/backend/tests/integracion/listaAcademicaContratos.test.ts | Por ampliar |
| REQ-001, REQ-005 | Historial append-only, consulta por páginas y retención | apps/backend/tests/integracion/listaAcademicaContratos.test.ts | Por implementar |
| REQ-002, REQ-009 | Captura y consulta de componentes/procedencia desde GUI | apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx | Por ampliar |
| REQ-005, REQ-009 | Presentación y filtros del historial en Calificaciones | apps/frontend/tests/seccionCalificaciones.resumen.test.tsx | Por implementar |
| REQ-006–REQ-008 | Snapshot ligero por actividad/alumno/corte, cambios y deduplicación | apps/backend/tests/integracion/classroom.v2.test.ts | Por ampliar |
| REQ-006, REQ-007, REQ-009 | Historial consultable por entrega, paginación estable, deduplicación y vista GUI | apps/backend/tests/integracion/classroom.v2.test.ts; apps/frontend/tests/classroomEnCalificaciones.test.tsx | Implementado y validado en pruebas focalizadas |
| REQ-006, REQ-007, REQ-011 | Auditoría, estados faltantes/cero y privacidad en sincronización | apps/backend/tests/integracion/classroom.audit.test.ts | Por ampliar |
| REQ-008 | Mapeo explícito y reconciliación entre actividad y corte parcial | apps/frontend/tests/classroomEnCalificaciones.mapeoCortes.test.tsx | Por ampliar |
| REQ-002, REQ-009 | Flujo GUI de evidencias e historial Classroom | apps/frontend/tests/classroomEnCalificaciones.test.tsx | Por ampliar |
| REQ-010 | Archivo/retención de historial y recursos académicos | apps/backend/tests/listaAcademicaResumen.test.ts | Por implementar |
| REQ-012, REQ-013 | Render, compresión WebP, vínculo inmutable y lectura autorizada de ficha individual | apps/backend/tests/integracion/classroom.v2.test.ts | Por implementar |
| REQ-009, REQ-012, REQ-013 | Presentación/descarga de ficha del promedio desde GUI | apps/frontend/tests/classroomEnCalificaciones.test.tsx | Por implementar |
| REQ-014 | Revisiones pendientes de reentrega y confirmación docente | apps/backend/tests/integracion/classroom.v2.test.ts | Por implementar |
| REQ-014 | Confirmar/descartar revisión en flujo GUI Classroom | apps/frontend/tests/classroomEnCalificaciones.test.tsx | Por implementar |
