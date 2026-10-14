---
id: SPEC-099
titulo: Tolerancia a carrera al detener procesos del Installer Hub
version: 1.0.0
fecha: 2026-10-14
autor: Codex
modulo: modulo_actualizacion_instalador
estado: approved
---

## Contexto

Durante la promoción del payload de `1.2.8`, `NativeInstallerHelper.StopOwnedNodeProcesses` enumera procesos Node pertenecientes al runtime instalado y vuelve a abrirlos por PID. Si un proceso termina entre ambas operaciones, `Process.GetProcessById` puede fallar y abortar el post-install aunque el proceso ya esté detenido. El registro MSI puede indicar éxito mientras la carpeta activa conserva binarios anteriores. La actualización debe continuar solo cuando se compruebe que el proceso terminó o que la identidad que ocupa el PID es la esperada.

## Requisitos Funcionales

- REQ-001: Revalidar PID, instante de inicio y ruta ejecutable del proceso propio inmediatamente antes de detenerlo.
- REQ-002: Si el PID ya no existe tras haber sido identificado como propio, tratarlo como detenido y continuar con la promoción.
- REQ-003: Si el PID fue reutilizado o la ruta ejecutable no coincide con el Node embebido de la instalación, abortar sin terminar ese proceso.
- REQ-004: Mantener el límite de espera y el fallo explícito cuando un proceso propio sigue activo o su identidad no puede verificarse.
- REQ-005: Registrar un diagnóstico seguro sin argumentos de proceso, secretos ni datos del usuario.
- REQ-006: Tras la instalación, confirmar promoción del payload y validar el runtime antes de reportar éxito; la publicación estable sigue gobernada por SPEC-091.

## Criterios de Aceptación

- El caso normal detiene los procesos propios y completa la actualización.
- Si el PID desaparece antes de reabrirlo, el helper continúa la promoción.
- Si el PID fue reutilizado por otro proceso, permanece intacto y la promoción se cancela de forma segura.
- Si la identidad no se puede verificar o se agota el timeout, la promoción falla explícitamente y conserva rollback.
- El Installer Hub GUI solo declara éxito con el payload activo, manifiesto coherente y runtime saludable.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Revalida PID, instante de inicio y ruta del ejecutable | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-002 | Trata un proceso que termina durante el cierre como detenido | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-003 | No termina otro proceso que reutiliza el PID | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-004 | Conserva fallos explícitos de identidad y timeout | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-005 | El diagnóstico no incluye argumentos ni secretos | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-006 | Verifica promoción y salud antes de declarar éxito | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |

## Fuera de Alcance

- Cambiar la política de retención o el respaldo SQLite.
- Alterar credenciales o ACL de Windows.
- Omitir la verificación Authenticode/SHA-256 ni instalar sin la acción informada que requiere SPEC-091.
