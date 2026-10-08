---
id: SPEC-075
titulo: Rehidratación de extraordinarios y procedencia de calificaciones inferidas manualmente
version: 1.0.0
fecha: 2026-10-06
autor: EvaluaPro Team
modulo: modulo_recuperacion_examenes
estado: approved
---

## Contexto

Una calificación extraordinaria obtenida mediante revisión manual de un examen impreso debe conservar su procedencia y quedar asociada al examen generado correcto. Actualmente la persistencia de Calificacion no incluye un campo de origen, y la rehidratación canónica depende de bundles o manifiestos firmados disponibles para la cuenta docente.

Un QR o folio impreso identifica una referencia; por sí solo no contiene la clave de respuestas ni demuestra la identidad de un examen registrado. Si faltan los artefactos firmados o no coinciden lote, folio, alumno y examen, no se debe crear una relación ni persistir una nota.

## Requisitos Funcionales

- **REQ-001 (Descubrimiento de evidencia):** La recuperación consulta los bundles/manifiestos mediante los endpoints autenticados existentes. No consulta ni modifica directamente la base de datos.
- **REQ-002 (Integridad y recuperabilidad):** Antes de reconstruir, se verifica la firma, integridad, compatibilidad y permiso docente del artefacto. Un PDF, OCR o QR aislado no sustituye un artefacto de recuperación firmado ni permite reconstruir una clave ausente.
- **REQ-003 (Vínculo exacto):** La rehidratación y calificación requieren coincidencia verificable de lote, folio, examen generado, alumno y tipo extraordinario. Ante un dato ausente o discrepante, el flujo termina sin crear examen ni calificación.
- **REQ-004 (Reconstrucción idempotente):** La reconstrucción restablece el examen, variante, reactivos y clave desde un bundle/manifiesto válido; conserva las fuentes existentes y registra el resultado/conflictos. Repetir la misma operación no duplica registros.
- **REQ-005 (Origen persistente):** El registro de Calificacion admite y devuelve el origen literal "inferida manualmente", con validación estricta. Las calificaciones históricas conservan su interpretación al migrar el esquema.
- **REQ-006 (Auditoría de la inferencia):** Una calificación con origen "inferida manualmente" conserva una referencia auditable a su examen y evidencia: lote, folio, huella SHA-256 del documento fuente, fecha, actor docente y resumen de criterios aplicados. No guarda una copia adicional del PDF dentro de la fila de calificación.
- **REQ-007 (Separación académica):** El resultado extraordinario se mantiene vinculado al examen y alumno canónicos y fuera de los campos/agregados de parciales y globales. No reemplaza una calificación ordinaria.
- **REQ-008 (Idempotencia de calificación):** La escritura conserva la protección por clientRequestId; reutilizarlo con un payload distinto produce conflicto y no modifica la calificación existente.
- **REQ-009 (Presentación y aprobación):** El resultado extraordinario muestra la calificación sobre 5 y su equivalente sobre 10, calculada como calificación sobre 5 multiplicada por 2. Indica "Aprobatoria" solo cuando la equivalencia exacta sobre 10 es estrictamente mayor que 6; una calificación equivalente a 6.00 se indica como "No aprobatoria". La decisión usa el valor antes del redondeo de presentación.
- **REQ-010 (Reactivos excluidos en inferencia autorizada):** Solo cuando el origen sea "inferida manualmente", el payload puede registrar un denominador menor que el total impreso para excluir reactivos identificados explícitamente en los criterios. El servidor valida aciertos entre 0 y el denominador y conserva la cantidad evaluable y las exclusiones en la evidencia. OMR ordinario y otras calificaciones siguen usando la cantidad oficial de reactivos.

## Criterios de Aceptación

1. La lista de recuperación solo incluye artefactos accesibles para la cuenta docente actual.
2. Un artefacto inválido, no recuperable o de otro docente no reconstruye registros.
3. Un identificador que no coincida exactamente en lote y folio no se vincula por nombre del alumno, materia, plantilla ni similitud.
4. Si falta el artefacto firmado o no se puede verificar el examen/alumno, no se persiste una calificación.
5. Una reconstrucción válida conserva examen, variante, clave y vínculos originales, y repetirla no genera duplicados.
6. La API y consulta de calificaciones exponen el valor exacto "inferida manualmente" cuando ese fue el origen persistido.
7. La auditoría permite identificar el PDF mediante SHA-256 y explica los criterios de revisión sin guardar datos de autenticación ni duplicar el archivo.
8. Una calificación extraordinaria no cambia notas ni agregados ordinarios del alumno.
9. La persistencia sigue siendo idempotente y rechaza la reutilización conflictiva de clientRequestId.
10. Una migración deja los registros existentes con semántica histórica intacta; no los reclasifica retrospectivamente.
11. El resultado extraordinario presenta ambas escalas: sobre 5 y equivalente sobre 10. El estado es "Aprobatoria" únicamente si el valor equivalente exacto supera 6; el valor exacto 6 se presenta como "No aprobatoria".
12. Una calificación inferida puede usar un denominador reducido solo si declara los reactivos excluidos en la evidencia y 0 ≤ aciertos ≤ total evaluable; el resultado y los criterios quedan auditados.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-004 | Listado, verificación de integridad, permisos y reconstrucción idempotente desde evidencia firmada | apps/backend/tests/integracion/recuperacionExamenes.test.ts | Pendiente |
| REQ-003, REQ-005, REQ-006 | Rechazo de vínculos inconsistentes y persistencia/consulta del origen con evidencia | apps/backend/tests/calificacion.persistencia.test.ts | Pendiente |
| REQ-007, REQ-008 | Aislamiento extraordinario y protección de idempotencia | apps/backend/tests/integracion/flujoExamen.test.ts; apps/backend/tests/calificacion.persistencia.test.ts | Pendiente |
| REQ-005 | Compatibilidad de registros históricos durante migración | scripts/tests/migrate-examen-tipo-examen-sqlite.test.mjs | Pendiente |
| REQ-009 | Mostrar calificación extraordinaria en escala de 5 y 10 y aplicar umbral aprobatorio estricto | apps/frontend/tests/seccionCalificaciones.resumen.test.tsx | Pendiente |
| REQ-010 | Permitir denominador reducido solo en inferencia autorizada y auditar exclusiones | apps/backend/tests/calificacion.persistencia.test.ts | Pendiente |
