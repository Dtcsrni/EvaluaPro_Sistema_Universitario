---
id: SPEC-087
titulo: Límite seguro de archivos y datos del helper elevado
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: modulo_installer_windows
estado: approved
---

## Contexto

El Bootstrapper escribe solicitudes JSON bajo `%ProgramData%\EvaluaPro\installer-hub\logs\<sesión>\requests` y conserva los archivos después del flujo. Las solicitudes incluyen configuración sensible, como claves de portal y código de activación. El helper vuelve a abrir la ruta desde un proceso elevado cuando instala en una raíz protegida. En la ACL observada en el entorno de auditoría, `BUILTIN\Usuarios` tiene permiso de escritura heredable en la carpeta de logs; la ruta se crea desde la BA sin aplicar una ACL privada. Esto permite leer solicitudes entre usuarios y alterar la entrada que consume el proceso elevado.

El límite debe proteger confidencialidad e integridad del handoff sin registrar secretos en logs persistentes ni ejecutar un payload sustituido.

## Requisitos Funcionales

- REQ-001: Solicitudes/respuestas con secretos no se conservan en un directorio compartido escribible por otros usuarios; los archivos temporales usan ACL restrictiva y se eliminan al terminar, incluso tras timeout o error.
- REQ-002: El proceso elevado no confía en un JSON reabrible desde una ruta controlada por un usuario sin privilegios; verifica el origen/integridad del contenido y limita las rutas de instalación y payload a las raíces autorizadas.
- REQ-003: El payload ejecutado por el helper se vincula al bundle/MSI verificado; un campo agregado o alterado en el request no puede seleccionar un ZIP arbitrario.
- REQ-004: Logs, mensajes de error y diagnósticos no incluyen código de activación, claves compartidas ni valores secretos de configuración.
- REQ-005: Ante ACL abierta, request alterada, ruta fuera de allowlist, payload con hash no esperado o archivo reemplazado durante el handoff, la operación falla antes de una mutación privilegiada.
- REQ-006: El intercambio Bootstrapper-helper tiene contrato JSON versionado, esquema estricto, operación/correlation ID, vencimiento y consumo único; solo acepta campos declarados y rechaza campos desconocidos, modos no permitidos y versiones incompatibles.
- REQ-007: La autoridad privilegiada recibe comandos de dominio acotados (`detect`, `configure`, `apply`, `verify`, `uninstall`) y valida precondiciones/estado; no ejecuta comandos, rutas ni nombres de artefacto arbitrarios proporcionados por el llamador.
- REQ-008: El payload procede exclusivamente del bundle/MSI firmado asociado a la operación y se verifica antes de extraer; se elimina la selección por `PayloadZip`, variables de entorno o búsqueda ambigua de archivos como autoridad para la operación elevada.
- REQ-009: Los secretos se protegen en tránsito y reposo con ACL privada y protección de credenciales apropiada al flujo UAC; no aparecen en argumentos de proceso, respuestas, logs ni artefactos persistentes. La operación retira el material temporal tras éxito, fallo o expiración.
- REQ-010: El helper aplica la misma política de canonicalización y allowlist de rutas a raíz, payload, respuesta y artefactos temporales; rechaza junctions/symlinks/reparse points en cualquier componente que permita escapar los límites.
- REQ-011: La verificación y preparación del payload ocurren antes de modificar configuración o servicios; las escrituras de `.env` y archivos de estado son atómicas y participan en rollback o se reconstruyen desde el estado anterior.
- REQ-012: El protocolo conserva adaptadores de compatibilidad explícitos por versión para solicitudes emitidas por releases soportadas; solicitudes antiguas no eluden validación ni se reinterpretan silenciosamente.

## Criterios de Aceptación

- Un usuario distinto al dueño del flujo no puede leer ni modificar request/response con secretos.
- Cambiar el request entre su creación y consumo elevado impide la ejecución y no modifica la instalación.
- Request con `PayloadZip` fuera del payload verificado es rechazado antes de extracción.
- Requests y respuestas se limpian tras éxito, error y timeout, conservando solo logs redactados.
- Hashes, errores y eventos de soporte permiten correlacionar el intento sin exponer secretos.
- Las pruebas usan cuentas/rutas QA aisladas y nunca elevan ni modifican la instalación real.
- Un request con campos extra, versión futura, operación vencida o correlación reutilizada se rechaza sin invocar comandos privilegiados.
- Sustituir el ZIP, modificar variables de entorno de selección o crear candidatos homónimos no cambia el payload consumido por el helper.
- Un fallo al configurar `.env` deja byte por byte intacta la configuración anterior y permite recuperación idempotente.
- Instaladores de versiones soportadas migran por el adaptador declarado; versiones no soportadas fallan con guía de recuperación.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-004, REQ-009 | ACL privada, consumo/eliminación temporal y redacción de secretos | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Aprobado; implementación pendiente |
| REQ-002, REQ-005, REQ-006, REQ-007, REQ-010, REQ-012 | Handoff versionado, campos permitidos, identidad de request, rutas y rechazo antes de mutación | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Aprobado; implementación pendiente |
| REQ-003, REQ-008 | Payload del bundle verificado e imposibilidad de ZIP arbitrario | `scripts/tests/installer-hub-contract.test.mjs` | Aprobado; implementación pendiente |
| REQ-011 | Escritura atómica y rollback de configuración | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Aprobado; implementación pendiente |
| Integración Windows | UAC, usuario estándar/administrador y limpieza de request/response | `scripts/tests/installer-hub-e2e-docente.ps1` | Aprobado; implementación pendiente |

## Riesgos y decisiones

- El helper elevado y su proceso padre usan identidades distintas durante UAC; el transporte debe seguir siendo verificable ante reemplazo de ruta y conservar compatibilidad con PowerShell 5.1.
- DPAPI por usuario permite proteger secretos frente a otros usuarios locales manteniendo el uso del perfil durante la elevación UAC; hay que comprobarlo en el flujo real de Windows y no asumirlo por contrato.
- No se debe resolver la confidencialidad eliminando trazas útiles: el esquema de redacción debe conservar códigos de fase, PID, hash y ubicación diagnóstica sin secretos.
- La ACL observada es evidencia local de este entorno; la implementación debe calcular/verificar permisos efectivos en el Windows destino y fallar cerrada si no puede validarlos.
