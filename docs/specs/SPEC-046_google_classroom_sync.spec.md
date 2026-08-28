---
id: SPEC-046
titulo: Integración Bidireccional con Google Classroom
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_classroom
estado: implemented
---

## Contexto
Sincronización con Google Classroom para importar cursos y alumnos hacia EvaluaPro y publicar calificaciones y tareas de vuelta en la plataforma de Google.

## Requisitos Funcionales
- **REQ-001 (Conexión OAuth 2.0)**: Vinculación con los alcances (`scopes`) de Classroom.
- **REQ-002 (Importación de Cursos y Alumnos)**: Mapeo de cursos de Classroom a Materias locales.
- **REQ-003 (Publicación de Tareas y Notas)**: Envío de resultados finales a la libreta de Classroom.

## Criterios de Aceptación
1. El flujo de autenticación OAuth 2.0 conecta de forma segura con la API de Google Classroom.
2. La importación de cursos sincroniza listas de estudiantes evitando duplicidades y problemas de rendimiento N+1.
3. El sistema permite exportar calificaciones finales hacia la libreta de calificaciones de Classroom.
4. La suite de auditoría de Classroom en backend y frontend corre en verde.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Flujo de conexión y comportamiento Classroom | `apps/frontend/tests/centroClassroom.behavior.test.tsx` | Completado |
| REQ-002 | Auditoría y optimización de importaciones | `apps/backend/tests/integracion/classroom.audit.test.ts` | Completado |
| REQ-003 | Sincronización pull de cursos y notas | `apps/backend/tests/integracion/classroom.pull.test.ts` | Completado |
