---
id: SPEC-076
titulo: Solicitud docente de examen Extra para materias reprobadas
version: 1.0.0
fecha: 2026-10-06
autor: EvaluaPro Team
modulo: modulo_analiticas
estado: approved
---

## Contexto

La recuperación extraordinaria requiere una solicitud docente explícita, la elegibilidad depende de la calificación final ordinaria vigente y los resultados deben conservar procedencia verificable sin modificar la evaluación ordinaria. Esta especificación define el flujo para registrar solicitudes y resultados Extra internos o externos, con aislamiento por materia, auditoría e idempotencia.

## Requisitos Funcionales

- **REQ-001 (Elegibilidad):** La sección Extra solo aparece cuando la calificación final vigente de la materia está definida y es menor que 6. El servidor vuelve a validar esta regla antes de registrar una solicitud.
- **REQ-002 (Solicitud explícita):** No se considera solicitante a un alumno hasta que el docente marque que solicita presentar Extra. La acción queda versionada, idempotente y auditada con el mecanismo de captura manual vigente.
- **REQ-003 (Redondeo reprobatorio):** Si la final es menor que 6, su calificación para acta se redondea hacia abajo con `floor`. En 6 o más se aplica redondeo normal al entero. El umbral de elegibilidad usa el valor final sin redondear.
- **REQ-004 (Aislamiento):** La solicitud Extra y cualquier calificación extraordinaria quedan fuera del cálculo de parciales y de la final ordinaria.
- **REQ-005 (Referencia de resultado):** La calificación extraordinaria puede referenciar un examen interno verificable o un resultado externo registrado explícitamente. Los resultados externos no inventan un `examenGeneradoId` ni un lote: conservan periodo, alumno, folio, archivo fuente y SHA-256; el lote puede quedar sin verificar.
- **REQ-006 (Persistencia externa):** El resultado externo se persiste en una entidad separada de `Calificacion`, requiere solicitud Extra docente vigente y final menor que 6, guarda aciertos/evaluables, calificación exacta y presentaciones sobre 5 y 10; usa `clientRequestId` idempotente, huella de payload y auditoría del docente.
- **REQ-007 (Procedencia):** El origen literal `inferida manualmente`, el nombre del PDF, SHA-256 y criterios aplicados se conservan sin duplicar el PDF en la base de datos.

## Criterios de Aceptación

1. Con final `5.99`, Extra está disponible y la calificación para acta es `5`.
2. Con final `6.00`, Extra no está disponible.
3. Sin acción docente explícita, la fila se conserva como no solicitante.
4. Una escritura nueva para una materia aprobada se rechaza en el servidor.
5. La escritura tiene versionado, auditoría e idempotencia del endpoint de lista manual.
6. Guardar o consultar Extra no cambia parcial 1, parcial 2, global ni la final de materia.
7. Una referencia externa no fabrica IDs canónicos; muestra la etiqueta externo, folio y origen, y lote solo cuando esté documentado.
8. Una alta externa falla si la final ya no es menor que 6, si no existe solicitud Extra docente, si los datos no pertenecen al periodo/docente, o si el folio ya está registrado para ese alumno.
9. Reintentar el mismo `clientRequestId` y payload devuelve el mismo registro; cambiar el payload con esa clave produce conflicto.
10. Un resultado externo no cambia parciales ni final ordinaria y presenta 2 escalas con aprobación solo si el valor exacto sobre 10 es mayor que 6.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-003 | Elegibilidad y redondeo de la final ordinaria | `apps/backend/tests/listaAcademicaResumen.test.ts` | PASS |
| REQ-002, REQ-004 | Solicitud explícita, auditoría e independencia de la calificación ordinaria | `apps/backend/tests/integracion/listaAcademicaContratos.test.ts`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | PASS |
| REQ-005 | Procedencia verificable del examen relacionado | `apps/backend/tests/listaAcademicaResumen.test.ts`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | PASS |
| REQ-005, REQ-006, REQ-007 | Persistencia externa, idempotencia, aislamiento, UI y migración | `apps/backend/tests/integracion/listaAcademicaContratos.test.ts`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `scripts/tests/migrate-resultados-extra-externos-sqlite.test.mjs` | PASS focal |
