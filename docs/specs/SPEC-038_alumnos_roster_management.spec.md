---
id: SPEC-038
titulo: Gestión de Alumnos, Validación de Matrícula e Importación Masiva
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_alumnos
estado: implemented
---

## Contexto
El control de estudiantes requiere alta individual con validación estricta de matrícula, asignación a grupos específicos e importación masiva por archivo CSV/Excel para el inicio de ciclo escolar.

## Requisitos Funcionales
- **REQ-001 (Alta y Edición de Alumnos)**: Formulario con nombres, apellidos, matrícula única y grupo.
- **REQ-002 (Importación Masiva)**: Procesamiento de archivos de texto/CSV con vista previa antes de guardar.
- **REQ-003 (Empty State Estandarizado)**: Tarjeta con pasos cuando el grupo no tiene alumnos registrados.

## Criterios de Aceptación
1. El docente puede registrar y editar alumnos con matrícula única y asignación a un grupo específico.
2. El procesamiento de carga de alumnos valida matrículas duplicadas y formato institucional.
3. Cuando no hay alumnos registrados en el grupo seleccionado, se muestra el Empty State Bento con guía operativa.
4. Los tests automatizados de frontend y backend se ejecutan exitosamente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Formulario de alta y edición de alumnos | `apps/frontend/tests/seccionAlumnos.test.tsx` | Completado |
| REQ-002 | Validación y edición de alumnos en backend | `apps/backend/tests/integracion/alumnosEdicion.test.ts` | Completado |
| REQ-003 | Procesamiento de listas y CSV | `apps/backend/tests/csv.test.ts` | Completado |
