---
id: SPEC-E2E-PLAYWRIGHT-MATRIX
titulo: Matriz Exhaustiva de Pruebas Funcionales y de Calidad UX/UI con Playwright
version: 1.1.1
fecha: 2026-08-20
autor: Codex / Antigravity AI
modulo: modulo_qa_e2e
estado: implemented
---

# SPEC-E2E-PLAYWRIGHT-MATRIX: Matriz Exhaustiva de Pruebas Funcionales y de Calidad UX/UI con Playwright

## Contexto
EvaluaPro requiere una validación exhaustiva automatizada de extremo a extremo que cubra todas las superficies del sistema (Docente, Alumno, Admin Negocio), interactuando con cada funcionalidad, base de datos local SQLite y verificando los estándares de calidad visual y accesibilidad UX/UI.

## Requisitos Funcionales
- REQ-001 (Docente - Onboarding/Acceso): Validación de registro con clave de licencia institucional, login con credenciales, toggle de pestañas y conmutación de tema.
- REQ-002 (Docente - Materias y Periodos): Creación, edición, selección y archivado de materias y ciclos escolares.
- REQ-003 (Docente - Alumnos y Pase de Lista): Alta de estudiantes, pase de lista con estados Presente/Falta/Retardo y semáforo dinámico de derecho a examen.
- REQ-004 (Docente - Banco de Preguntas): Redacción y almacenamiento de preguntas múltiple opción, asignación de temarios y competencias.
- REQ-005 (Docente - Plantillas y Exámenes): Configuración de estructura de examen, ponderación y previsualización de hojas OMR y formato carta.
- REQ-006 (Docente - Escaneo y Calificación OMR): Simulación y procesamiento de hojas ópticas con asignación automática de notas en SQLite.
- REQ-007 (Docente - Evaluaciones y Exportación): Cálculo de promedios ponderados y exportación de listas en formatos DOCX y XLSX.
- REQ-008 (Docente - Sincronización y Respaldo): Generación y restauración de paquetes cifrados AES-256-GCM y diagnóstico de Classroom.
- REQ-009 (Docente - Cuenta y Temas): Inspección de licencia institucional y ajuste de contraste visual en temas claro/oscuro.
- REQ-010 (Alumno - Acceso y Consulta): Ingreso con código o matrícula y consulta de desglose de reactivos.
- REQ-011 (Admin - Monitoreo): Consulta de métricas institucionales y estado de servicios.
- REQ-012 (Calidad UX/UI): Cero desbordamiento horizontal en resoluciones Desktop (1366x900), Tablet (1024x768, 768x1024) y Móvil (390x844), controles con targets táctiles mínimos y soporte para `prefers-reduced-motion`.

## Criterios de Aceptación
- Todas las suites de Playwright (docente, alumno, admin, ciclo y journey) ejecutan y pasan al 100% en verde.
- No se presentan errores en consola JS ni bloqueos de interfaz durante los flujos.
- Los snapshots y reportes de calidad UX/UI quedan actualizados en `reports/qa/latest/`.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Docente - Onboarding y acceso | `tests/gui-responsive/responsive-docente.spec.ts` | Implementado |
| REQ-002 | Docente - Materias y periodos | `tests/gui-responsive/ciclo-completo.spec.ts` | Implementado |
| REQ-003 | Docente - Alumnos y pase de lista | `tests/gui-responsive/journey-docente-integral.spec.ts` | Implementado |
| REQ-004 | Docente - Banco de reactivos | `tests/gui-responsive/journey-docente-integral.spec.ts` | Implementado |
| REQ-005 | Docente - Plantillas y exámenes | `tests/gui-responsive/journey-docente-integral.spec.ts` | Implementado |
| REQ-006 | Docente - Escaneo y calificación OMR | `tests/gui-responsive/journey-docente-integral.spec.ts` | Implementado |
| REQ-007 | Docente - Evaluaciones y exportación | `tests/gui-responsive/journey-docente-integral.spec.ts` | Implementado |
| REQ-008 | Docente - Sincronización y respaldo | `apps/frontend/tests/sincronizacion.behavior.test.tsx` | Implementado |
| REQ-009 | Docente - Cuenta y temas | `apps/frontend/tests/tema.provider.test.ts` | Implementado |
| REQ-010 | Alumno - Acceso y consulta | `tests/gui-responsive/responsive-alumno.spec.ts` | Implementado |
| REQ-011 | Admin - Monitoreo de negocio | `tests/gui-responsive/responsive-admin.spec.ts` | Implementado |
| REQ-012 | Calidad UX/UI y auditoría responsive | `apps/frontend/tests/gui.responsive.audit.test.ts` | Implementado |
