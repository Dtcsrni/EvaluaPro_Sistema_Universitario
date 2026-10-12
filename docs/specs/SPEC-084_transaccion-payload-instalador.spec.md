---
id: SPEC-084
titulo: Promoción transaccional y recuperación del payload del instalador
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: modulo_installer_windows
estado: approved
---

## Contexto

La expansión actual extrae y valida el payload en staging, pero después elimina cada destino existente antes de mover la entrada nueva. Si una promoción se interrumpe a mitad, una instalación previa puede quedar parcialmente reemplazada. Además, `Get-EvaluaProOwnedNodeProcessIds` captura errores de inventario y devuelve una lista vacía; el instalador interpreta esa condición como ausencia de procesos y puede modificar archivos sin confirmar que el backend propio terminó. El paro espera un intervalo fijo y luego revisa procesos, sin una espera acotada para que terminen normalmente.

La mitigación debe proteger install, repair y update contra concurrencia, fallos de proceso, fallos de movimiento y terminación abrupta del helper. Debe preservar datos de usuario y no detener procesos ajenos.

## Requisitos Funcionales

- REQ-001: Toda mutación de una instalación adquiere un lock exclusivo asociado a su ruta canónica; install, repair y update concurrentes para esa raíz esperan o fallan con diagnóstico antes de cambiar archivos.
- REQ-002: Si Windows no puede enumerar procesos o verificar su identidad, el helper falla cerrado y no modifica configuración ni payload. Solo termina procesos cuya línea de comandos o ejecutable coincida con la instalación y confirma su salida con límite y PID reportados.
- REQ-003: El helper extrae y valida completamente el payload en staging antes de modificar destinos existentes.
- REQ-004: Antes de promover archivos, el helper registra una transacción recuperable y conserva las entradas anteriores que reemplazará. Si falla una promoción, restaura el payload previo y mantiene `data` y archivos de usuario intactos.
- REQ-005: Al comenzar una operación, el helper detecta y recupera de forma segura una transacción incompleta previa antes de configurar o iniciar servicios.
- REQ-006: El helper confirma la transacción solo tras completar las validaciones críticas de payload, runtime, configuración y manifiesto. Retira el respaldo únicamente después del commit.
- REQ-007: Si la recuperación o rollback falla, la instalación queda marcada como no lista, conserva diario y respaldos diagnósticos, informa rutas/PID/etapa sin secretos y no presenta éxito.
- REQ-008: El lock y toda recuperación validan que las rutas operadas permanezcan bajo la raíz canónica solicitada; nunca detienen procesos ajenos ni eliminan datos fuera del payload administrado.

## Criterios de Aceptación

- Inyectar error de inventario impide la expansión y deja intactos archivos y configuración.
- Un proceso propio lento termina dentro del límite; uno que no termina bloquea la operación con PID identificable. Procesos Node ajenos permanecen activos.
- Fallos inyectados antes, durante y después de mover entradas restauran la versión previa y los datos de usuario; una segunda ejecución recupera una operación interrumpida tras crear su diario.
- Dos operaciones simultáneas sobre la misma raíz no intercalan etapas; una operación sobre otra raíz independiente puede continuar.
- Un payload inválido nunca crea ni reemplaza destinos.
- Solo un commit completo elimina el respaldo transaccional; errores de recuperación conservan evidencia y fallan cerrados.
- El E2E Windows verifica install, repair, upgrade, persistencia SQLite, rollback y ausencia de procesos residuales sobre rutas QA aisladas.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-008 | Exclusión mutua por raíz y límites seguros de ruta | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Implementado; validación de contrato |
| REQ-002 | Inventario fail-closed y cierre verificado de procesos propios | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Implementado; E2E Windows pendiente |
| REQ-003, REQ-004 | Staging validado y rollback de promoción | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Implementado; inyección de fallos pendiente |
| REQ-005, REQ-007 | Recuperación ante transacción incompleta y fallo de rollback | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Implementado; recuperación Windows pendiente |
| REQ-006 | Commit y eliminación de respaldo tras validar manifiesto | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Implementado; E2E Windows pendiente |
| Criterios Windows | Instalación, reparación, upgrade, persistencia y procesos residuales | `scripts/tests/installer-upgrade-e2e-contract.test.mjs`, `scripts/tests/installer-hub-e2e-docente.ps1` | Pendiente |

## Riesgos y decisiones

- La recuperación automática requiere un diario explícito y validación estricta de rutas para que un archivo manipulado no permita operar fuera de la instalación.
- El lock debe liberarse en `finally` y tolerar el cierre abrupto mediante recuperación al siguiente arranque, sin borrar el diario antes del commit.
- Las pruebas de fallo deben ejecutarse exclusivamente bajo rutas QA aisladas y nunca sobre `%ProgramData%` de producción.
