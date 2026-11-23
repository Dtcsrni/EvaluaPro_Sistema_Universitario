---
id: SPEC-043
titulo: Mesa de Entrega y Recepción de Exámenes con Bono de Acordeón
version: 1.0.1
fecha: 2026-10-24
autor: Antigravity / EvaluaPro Team
modulo: modulo_entrega
estado: approved
---

## Contexto
Control presencial en el aula al momento de que los alumnos entregan su examen físico, vinculando el folio impreso con el estudiante y registrando si entregó acordeón de estudio para asignación de bonificación.

## Requisitos Funcionales
- **REQ-001 (Vinculación de Folio)**: Escaneo o captura rápida de folio asignado a alumno.
- **REQ-002 (Bono de Acordeón)**: Aplicar +0.25 únicamente cuando ese valor aparece escrito en el área de calificación del examen; el componente y resultado del examen se limitan a 5.
- **REQ-003 (Control de Duplicados)**: Validación para evitar folios dobles o suplantación.

## Criterios de Aceptación
1. La mesa de recepción asocia rápidamente el folio físico del examen con el alumno correspondiente.
2. El +0.25 se aplica solo cuando aparece escrito en el área de calificación del examen, y el resultado nunca excede 5.
3. Se previene la recepción duplicada de folios o asignaciones inconsistentes.
4. La suite de pruebas de entrega y flujo docente valida el comportamiento sin errores.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Vinculación y recepción de exámenes | `apps/frontend/tests/seccionEntrega.test.tsx` | Completado |
| REQ-002 | Bono de acordeón pedagógico en shell | `apps/frontend/tests/appDocente.test.tsx` | Completado |
| REQ-003 | Contrato y flujo de examen | `apps/backend/tests/integracion/flujoExamen.test.ts` | Completado |
