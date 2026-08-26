---
id: SPEC-043
titulo: Mesa de Entrega y Recepción de Exámenes con Bono de Acordeón
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_entrega
estado: implemented
---

## Contexto
Control presencial en el aula al momento de que los alumnos entregan su examen físico, vinculando el folio impreso con el estudiante y registrando si entregó acordeón de estudio para asignación de bonificación.

## Requisitos Funcionales
- **REQ-001 (Vinculación de Folio)**: Escaneo o captura rápida de folio asignado a alumno.
- **REQ-002 (Bono de Acordeón)**: Registro booleano y ponderación del bono formativo.
- **REQ-003 (Control de Duplicados)**: Validación para evitar folios dobles o suplantación.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Vinculación de entrega | `apps/frontend/tests/appDocente.test.tsx` | Completado |
| REQ-002 | Bono de acordeón pedagógico | `apps/frontend/tests/appDocente.test.tsx` | Completado |
| REQ-003 | Contrato de entregas | `apps/frontend/tests/omr.flow.contract.test.ts` | Completado |
