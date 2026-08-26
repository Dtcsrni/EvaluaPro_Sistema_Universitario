---
id: SPEC-037
titulo: Ciclo de Vida de Materias, Periodos y Gestión de Grupos
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_materias
estado: implemented
---

## Contexto
El docente necesita organizar sus cursos académicos por periodos, asignaturas y grupos. El sistema debe permitir crear materias, asignar grupos, editar metadatos, archivar cursos finalizados y restaurarlos cuando sea necesario sin pérdida de datos.

## Requisitos Funcionales
- **REQ-001 (Alta de Materia y Grupos)**: Creación de asignaturas con nombre, clave y lista de grupos.
- **REQ-002 (Archivo y Restauración)**: Mover materias terminadas a la vista de archivadas y recuperarlas con 1 clic.
- **REQ-003 (Empty States Estandarizados)**: Cuando no haya materias activas o archivadas, mostrar la tarjeta Bento con guía de 3 pasos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Creación y listado de materias | `apps/frontend/tests/seccionPeriodos.test.tsx` | Completado |
| REQ-002 | Archivo y restauración de periodos | `apps/frontend/tests/periodos.archived.contract.test.ts` | Completado |
| REQ-003 | Estado vacío con tarjeta de pasos | `apps/frontend/tests/seccionPeriodos.test.tsx` | Completado |
