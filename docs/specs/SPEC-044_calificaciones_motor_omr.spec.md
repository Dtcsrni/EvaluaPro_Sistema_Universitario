---
id: SPEC-044
titulo: Motor de Calificación OMR, Revisión Visual de Burbujas y Actas
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_calificaciones
estado: implemented
---

## Contexto
Procesamiento óptico de marcas (OMR) mediante visión computacional, detección automática de respuestas marcadas, corrección visual interactiva de marcas dudosas y emisión de actas oficiales de notas.

## Requisitos Funcionales
- **REQ-001 (Análisis Óptico)**: Procesamiento de imágenes escaneadas/fotografiadas de hojas OMR.
- **REQ-002 (Revisión Visual)**: Interfaz con mapa de burbujas para verificar marcas dudosas.
- **REQ-003 (Actas de Calificaciones)**: Consolidación de notas parciales y finales.

## Criterios de Aceptación
1. El motor OMR procesa hojas de examen escaneadas extrayendo marcas con niveles de confianza calibrados.
2. La interfaz de revisión visual resalta marcas dudosas y permite corrección manual ágil con atajos de teclado.
3. El sistema consolida calificaciones parciales y finales emitiendo el acta respectiva.
4. Los tests de flujo OMR y módulos de calificación se ejecutan en verde.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Análisis y normalización OMR | `apps/frontend/tests/omrWorkflowState.hooks.test.tsx` | Completado |
| REQ-002 | Interfaz interactiva de calificación OMR | `apps/frontend/tests/seccionCalificar.test.tsx` | Completado |
| REQ-003 | Prioridad y resolución OMR en backend | `apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts` | Completado |
