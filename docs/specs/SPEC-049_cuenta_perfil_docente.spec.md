---
id: SPEC-049
titulo: Perfil del Docente, Configuración Institucional y Seguridad de Cuenta
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_cuenta
estado: implemented
---

## Contexto
Administración de datos del docente, personalización del nombre de la institución en exámenes OMR, cambio de contraseña y control de sesiones activas.

## Requisitos Funcionales
- **REQ-001 (Perfil del Docente)**: Actualización de nombres, apellidos y correo.
- **REQ-002 (Configuración Institucional)**: Nombre de la universidad/facultad en encabezados de exámenes.
- **REQ-003 (Cierre de Sesión y Token)**: Cierre de sesión seguro con limpieza de almacenamiento local.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Perfil y autenticación docente | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Completado |
| REQ-002 | Datos institucionales | `apps/frontend/tests/appDocente.test.tsx` | Completado |
| REQ-003 | Cierre de sesión seguro | `apps/frontend/tests/appDocente.test.tsx` | Completado |
