---
id: SPEC-047
titulo: Portal Alumno Cloud y Consulta Segura de Evaluaciones
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_portal_alumno
estado: implemented
---

## Contexto
Acceso transparente para que los estudiantes consulten sus resultados de examen, desglose de aciertos por tema, justificaciones de faltas y retroalimentación pedagógica.

## Requisitos Funcionales
- **REQ-001 (Login de Alumno)**: Acceso con matrícula o cuenta institucional de Google.
- **REQ-002 (Consulta de Resultados)**: Visualización de calificaciones y desglose por reactivo.
- **REQ-003 (Auditoría y PWA Alumno)**: Experiencia responsiva y manifest PWA para alumnos.

## Criterios de Aceptación
1. El estudiante inicia sesión mediante matrícula o correo institucional con validación de credenciales.
2. El portal muestra el listado de materias, calificaciones obtenidas y desglose de respuestas por reactivo.
3. La interfaz cumple con el diseño responsivo Bento Glassmorphism y capacidad PWA.
4. Los tests unitarios y de integración del portal de alumno cloud pasan en verde.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Cliente y autenticación del portal alumno | `apps/frontend/tests/clientePortal.test.tsx` | Completado |
| REQ-002 | Integración del portal de alumno cloud | `apps/portal_alumno_cloud/tests/integracion/portal.test.ts` | Completado |
| REQ-003 | Auditoría responsiva y contratos del portal | `apps/portal_alumno_cloud/tests/sesion.test.ts` | Completado |
