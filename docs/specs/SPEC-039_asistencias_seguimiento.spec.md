---
id: SPEC-039
titulo: Control Diario de Asistencias, Justificantes y Porcentajes
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_asistencias
estado: implemented
---

## Contexto
El docente realiza el pase de lista diario por grupo y materia. El sistema calcula en tiempo real los porcentajes de asistencia requeridos para tener derecho a examen y permite registrar justificaciones.

## Requisitos Funcionales
- **REQ-001 (Pase de Lista Rápido)**: Marcar Asistencia, Falta, Retardo o Justificado con 1 clic por estudiante.
- **REQ-002 (Recordatorio Automático)**: Banner en el shell docente si no se ha pasado lista en el día.
- **REQ-003 (Reporte y Resumen)**: Cálculo del porcentaje acumulado de asistencia por estudiante.

## Criterios de Aceptación
1. El sistema permite registrar Asistencia, Falta, Retardo o Justificado con un solo clic por alumno.
2. El Shell Docente muestra recordatorio visual en caso de no haber registrado asistencia en la fecha activa.
3. Se calcula el porcentaje acumulado de asistencia y se identifican estudiantes en riesgo por faltas.
4. La suite de pruebas de frontend y backend valida las reglas de asistencia al 100%.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Pase de lista diario | `apps/frontend/tests/seccionAsistencias.test.tsx` | Completado |
| REQ-002 | Recordatorio de asistencia en shell | `apps/frontend/tests/appDocente.test.tsx` | Completado |
| REQ-003 | Reglas y cálculo de asistencias | `apps/backend/tests/integracion/asistencia.reglas.test.ts` | Completado |
