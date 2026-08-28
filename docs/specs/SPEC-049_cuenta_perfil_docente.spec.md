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

## Criterios de Aceptación
1. El docente puede actualizar su nombre, credenciales y datos de contacto de manera segura.
2. Se configuran logos y nombre de la institución que se reflejan en las hojas de examen OMR.
3. El cierre de sesión destruye la sesión y limpia el almacenamiento local.
4. Los tests de sección cuenta y autenticación pasan en verde.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Perfil y autenticación docente | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Completado |
| REQ-002 | Configuración de cuenta e institución | `apps/frontend/tests/seccionCuenta.test.tsx` | Completado |
| REQ-003 | Cierre de sesión y estado en shell | `apps/frontend/tests/appDocente.test.tsx` | Completado |
