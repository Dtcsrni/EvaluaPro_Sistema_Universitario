---
id: SPEC-036
titulo: Autenticación Híbrida, Google OAuth y Guardrails de Seguridad
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_autenticacion
estado: implemented
---

## Contexto
El acceso seguro a la plataforma requiere soportar tanto credenciales institucionales (correo y contraseña) como inicio de sesión con cuenta de Google (OAuth 2.0). Ante fallos de configuración de origen en Google Cloud (`origin_mismatch`) o falta de conexión con el backend de Google, el sistema debe guiar proactivamente al usuario con diagnósticos claros y fallback seguro a credenciales locales.

## Requisitos Funcionales
- **REQ-001 (Inicio de Sesión Híbrido)**: El módulo debe permitir autenticarse con correo y contraseña o mediante botón oficial de Google OAuth 2.0.
- **REQ-002 (Validación de Dominios Permitidos)**: En cuentas de Google, el sistema debe validar que el correo pertenezca a los dominios universitarios autorizados antes de conceder acceso.
- **REQ-003 (Alerta Proactiva de Orígenes OAuth)**: Cuando Google OAuth falle por discrepancia de origen (`origin_mismatch`), el sistema debe renderizar una tarjeta de ayuda detallada con el origen exacto detectado en el navegador (`window.location.origin`), enlace directo a la consola de Google Cloud y botón para iniciar con credenciales locales.
- **REQ-004 (Primer Uso y Registro de Licencia)**: En instalaciones nuevas, el sistema debe exigir el registro del docente administrador y la validación de la clave de licencia institucional.

## Criterios de Aceptación
1. Login exitoso con correo y contraseña almacena el token JWT de forma persistente.
2. Login con Google procesa nombres compuestos y valida dominios institucionales.
3. Ante error 400 origin_mismatch, se muestra la tarjeta de diagnóstico con los pasos de solución.
4. El modo Google-only se activa cuando el backend así lo requiere.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Autenticación por formulario y validación de campos | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Completado |
| REQ-002 | Validación de dominio de correo en Google OAuth | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Completado |
| REQ-003 | Diagnóstico de Google OAuth y modo Google-only | `apps/frontend/tests/seccionAutenticacion.googleOnly.test.tsx` | Completado |
| REQ-004 | Registro inicial y edición de clave de licencia | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Completado |
