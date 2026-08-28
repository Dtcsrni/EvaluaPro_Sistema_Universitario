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

## Criterios de Aceptación
1. El docente puede crear una materia indicando nombre, clave y grupos asociados.
2. Las materias archivadas se separan de la vista activa y pueden restaurarse inmediatamente.
3. La vista de periodos renderiza la guía Bento Step Card informativa en estados vacíos.
4. Los tests unitarios y de integración de frontend y backend pasan en verde.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Creación y listado de materias | `apps/frontend/tests/seccionPeriodos.edit.test.tsx` | Completado |
| REQ-002 | Archivo y restauración de periodos | `apps/backend/tests/integracion/periodosBorradoDuplicados.test.ts` | Completado |
| REQ-003 | Estado vacío con tarjeta de pasos y listas | `apps/frontend/tests/seccionPeriodos.listasInstitucionales.test.tsx` | Completado |
