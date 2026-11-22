---
id: SPEC-145
titulo: Barajeo y diversidad de reactivos en exámenes OMR
version: 1.0.0
fecha: 2026-11-19
autor: EvaluaPro Team
modulo: modulo_generacion_pdf
estado: approved
---

## Contexto

La generación de lotes necesita reducir la repetición entre exámenes y evitar errores al
traducir la clave de reactivos cuando se barajean preguntas u opciones. La selección debe
conservar cobertura temática, ser reproducible desde el blueprint aprobado y fallar sin
persistir resultados cuando no puede producir una variante válida.

## Requisitos Funcionales

- REQ-001: El barajeo de preguntas y opciones usa una distribución uniforme para rangos acotados.
- REQ-002: La clave correcta se conserva al traducir el índice original a la opción visible y a la clave OMR.
- REQ-003: Un lote no persiste exámenes con mapas de variante repetidos. Si el preflight no obtiene una variante distinta, falla antes de guardar el conjunto nuevo.
- REQ-004: La selección limitada por `reactivosObjetivo` conserva cobertura round-robin entre temas y aleatoriza los reactivos dentro de cada tema. El preview congela la selección aprobada en el blueprint.
- REQ-005: El orden del paquete se determina establemente por nombre del alumno y luego por ID; el PDF indica `ORDEN n/N` para permitir reparto manual sin crear una asignación de asientos.
- REQ-006: El preflight valida todos los PDFs individuales antes de persistir el primer examen nuevo.

## Criterios de Aceptación

1. Las pruebas confirman la distribución de índices, la correspondencia de clave y la ausencia de duplicados de variante dentro del lote.
2. La selección de reactivos conserva la cobertura temática y el preview retiene el conjunto aprobado.
3. Un fallo de variante o de renderizado no persiste parcialmente el lote.
4. El orden de impresión es determinista para el mismo padrón y los números `ORDEN n/N` cubren una sola vez el rango del paquete.

## Matriz de Trazabilidad

| ID Requisito | Descripción del caso | Archivo de test vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001..REQ-003 | Barajeo, clave y variantes únicas | `apps/backend/tests/variantes.test.ts` | Pendiente validar en el merge actual |
| REQ-004 | Selección temática y preview congelado | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Pendiente validar en el merge actual |
| REQ-005 | Orden y paridad del PDF generado | `apps/backend/tests/pdf.paridad.test.ts` | Pendiente validar en el merge actual |
| REQ-006 | Preflight y persistencia atómica del lote | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Pendiente validar en el merge actual |