---
id: SPEC-041
titulo: Banco de Reactivos, Taxonomía Pedagógica y Estimador de Páginas OMR
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_banco
estado: implemented
---

## Contexto
El docente alimenta reactivos clasificados por tema, tipo de pregunta (opción múltiple, abierta, código fuente, fórmulas matemáticas LaTeX) e imágenes adjuntas. El motor calcula el alto tipográfico y estima la cantidad de páginas que ocupará el examen impreso.

## Requisitos Funcionales
- **REQ-001 (Formulario de Reactivos)**: Enunciado con soporte Markdown/LaTeX, opciones A-E y clave correcta.
- **REQ-002 (Estimador de Páginas)**: Cálculo en tiempo real de altura y corte de página OMR.
- **REQ-003 (Filtros y Búsqueda)**: Exploración por tema, tipo y dificultad.

## Criterios de Aceptación
1. El editor de preguntas admite enunciados en Markdown/LaTeX, opciones múltiples A-E y clave correcta.
2. El estimador de páginas calcula la altura tipográfica y cortes de página para examen OMR en tiempo real.
3. La búsqueda y filtrado por tema, taxonomía y dificultad filtra los reactivos de forma inmediata.
4. Todos los tests de estimadores y refactorización del banco pasan satisfactoriamente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Creación y edición de preguntas | `apps/frontend/tests/banco.refactor.test.tsx` | Completado |
| REQ-002 | Estimador de páginas OMR | `apps/frontend/tests/banco.estimadores.test.tsx` | Completado |
| REQ-003 | Filtro por tema y gestión de taxonomía | `apps/frontend/tests/bancoGestionTemas.test.tsx` | Completado |
