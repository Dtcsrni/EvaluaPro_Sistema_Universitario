---
id: SPEC-040
titulo: Temarios Curriculares, Encuadre Pedagógico y Firmas
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_temarios
estado: implemented
---

## Contexto
Estructuración de las unidades temáticas por asignatura, definición de criterios de evaluación (Exámenes, Tareas, Proyectos) y generación del acta de encuadre firmada por los alumnos.

## Requisitos Funcionales
- **REQ-001 (Unidades Temáticas)**: Registro de temas y subtemas por materia.
- **REQ-002 (Criterios y Ponderaciones)**: Asignación de porcentajes que deben sumar 100%.
- **REQ-003 (Firma de Encuadre)**: Registro de aceptación por parte del grupo y descarga del acta PDF.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Gestión de temas curriculares | `apps/frontend/tests/seccionTemarios.test.tsx` | Completado |
| REQ-002 | Ponderaciones y encuadre | `apps/frontend/tests/seccionTemarios.test.tsx` | Completado |
| REQ-003 | Generación de encuadre y firmas | `apps/frontend/tests/encuadre_firmas.spec.md` | Completado |
