---
id: SPEC-045
titulo: Rehidratación Forense de Lotes y Trazabilidad de Exámenes Impresos
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_rehidratacion
estado: implemented
---

## Contexto
Capacidad de reconstruir el estado completo de un examen, su clave de respuestas y los datos del estudiante a partir del código QR o folio impreso en caso de contingencias o pérdida de conexión.

## Requisitos Funcionales
- **REQ-001 (Lectura de Folio/QR Forense)**: Decodificación de metadatos criptográficos del examen.
- **REQ-002 (Reconstrucción de Clave)**: Reensamble de la clave original del examen.
- **REQ-003 (Restauración de Evaluación)**: Habilitar la calificación aún sin conexión previa al servidor.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Rehidratación de lotes iniciados | `docs/specs/hidratacion_curso_iniciado.spec.md` | Completado |
| REQ-002 | Claves forenses OMR | `apps/frontend/tests/utilidades.appDocente.test.ts` | Completado |
| REQ-003 | Trazabilidad integral | `apps/frontend/tests/omr.flow.contract.test.ts` | Completado |
