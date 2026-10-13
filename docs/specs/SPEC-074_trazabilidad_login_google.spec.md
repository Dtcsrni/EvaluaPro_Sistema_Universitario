---
id: SPEC-074
titulo: Trazabilidad local del login y Google Identity
version: 1.1.0
fecha: 2026-10-12
autor: EvaluaPro Team
modulo: modulo_autenticacion
estado: implemented
---

# SPEC-074: Trazabilidad local del login y Google Identity

## Contexto

El flujo actual deja registros HTTP, pero no permite correlacionar el callback de Google, la validación de credencial, la emisión de sesión y la validación del perfil. Un cierre del navegador puede ocurrir antes de que la petición llegue al API. Se necesita evidencia local recuperable y correlacionada sin registrar datos de autenticación.

## Requisitos Funcionales

- REQ-001: Cada intento de login con contraseña o Google usa un UUID de flujo compartido entre la UI y el API; el API lo valida y lo registra junto con su `requestId`.
- REQ-002: La UI conserva una bitácora local acotada de hitos del proveedor Google, login, almacenamiento de sesión y validación de perfil, incluso después de una recarga o recuperación del navegador.
- REQ-003: La bitácora y los logs del API no registran contraseñas, credenciales Google, tokens, correos ni el identificador `sub`; registran solo etapa, resultado, código de error seguro, estado HTTP y duración.
- REQ-004: Los callbacks de error disponibles en el proveedor Google se registran con códigos seguros; el control para copiar y los avisos diagnósticos de configuración solo se muestran cuando está activa la bandera de desarrollo `import.meta.env.DEV`.
- REQ-005: Si el almacenamiento local está bloqueado o falla, la autenticación conserva su comportamiento y la bitácora no interrumpe el login.

## Criterios de Aceptación

1. El mismo UUID de flujo aparece en la bitácora local y en el log estructurado del API para el login correspondiente.
2. Los logs distinguen callback/proveedor, validación Google, búsqueda de cuenta, validación de contraseña, emisión de sesión, guardado del token y consulta de perfil.
3. Las pruebas verifican códigos de rechazo y etapas sin incluir secretos ni PII.
4. La bitácora local conserva como máximo 80 eventos y el flujo no falla cuando el almacenamiento del navegador no está disponible.
5. En desarrollo, el botón de diagnóstico exporta únicamente eventos sanitizados de la bitácora local y los avisos de diagnóstico son visibles.
6. En producción (`import.meta.env.DEV === false`), el botón, el estado de copiado y los avisos diagnósticos no se renderizan; el acceso normal con Google y las alternativas de autenticación siguen disponibles.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Correlación UUID UI/API y validación de entrada | `apps/backend/tests/integracion/autenticacion.trazabilidad.test.ts` | Implementado |
| REQ-002 | Retención local acotada y recuperación tras recarga | `apps/frontend/tests/trazaAutenticacion.test.ts` | Implementado |
| REQ-003 | Etapas de login sanitizadas en frontend/backend | `apps/backend/tests/integracion/autenticacion.trazabilidad.test.ts` | Implementado |
| REQ-004 | Callback de error Google; controles y avisos diagnósticos solo en desarrollo | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Implementado |
| REQ-005 | Degradación segura ante fallo de localStorage | `apps/frontend/tests/trazaAutenticacion.test.ts` | Implementado |
