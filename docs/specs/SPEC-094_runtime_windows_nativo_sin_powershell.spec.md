---
id: SPEC-094
titulo: Runtime Windows nativo y reducción de PowerShell en EvaluaPro
version: 1.0.0
fecha: 2026-10-12
autor: Codex
modulo: modulo_instalador_windows
estado: approved
---

## Contexto

Los flujos Windows de EvaluaPro dependen de PowerShell y Windows Script Host para iniciar el Hub, operar accesos directos y ejecutar tareas del bootstrapper Burn. Esto añade procesos y políticas de ejecución al runtime instalado, genera errores difíciles de atribuir y duplica lógica de orquestación. Ya existe un bootstrapper WinExe autocontenido en .NET 8 y Burn/WiX es responsable de instalar y elevar.

Se requiere reducir esos puntos de fallo sin retirar herramientas que sigan siendo la opción nativa correcta para CI, firma, análisis antivirus o tareas de mantenimiento Windows. El runtime docente debe poder instalarse, actualizarse, repararse, abrirse y recuperarse sin iniciar PowerShell ni Windows Script Host. La aplicación debe conservar confirmación explícita, validación criptográfica, preservación de datos y transacción recuperable.

## Requisitos Funcionales

- REQ-001: Inventariar cada invocación de PowerShell/Windows Script Host que forme parte del payload instalado o de un flujo ejecutado por el usuario. Cada uso restante debe clasificarse como eliminado, sustituido o justificado por una limitación concreta de Windows/toolchain.
- REQ-002: Los accesos directos instalados y regenerados deben iniciar ejecutables nativos de EvaluaPro. No deben invocar `powershell.exe`, `pwsh.exe`, `wscript.exe`, `cscript.exe`, scripts `.ps1` ni `.vbs` para abrir la aplicación/Hub, reparar, detener, reiniciar, actualizar o desinstalar.
- REQ-003: Sustituir las operaciones de runtime del helper PowerShell de Burn por código C#/.NET mantenible, integrado en la BA .NET 8 existente o en un helper WinExe autocontenido y versionado con ella. No agregar servicios Windows ni procesos privilegiados persistentes.
- REQ-004: Mantener Burn/MSI como único dueño de instalación, elevación UAC, upgrade, rollback y desinstalación. El Hub solicita confirmación, descarga y valida hash SHA-256 y Authenticode antes de delegar al bundle firmado; no reemplaza archivos en ejecución ni crea un segundo mecanismo de instalación.
- REQ-005: El runtime nativo debe aplicar límites de tiempo, cancelación del árbol de procesos, inventario fail-closed, logs estructurados sanitizados, códigos de salida estables y errores recuperables con indicación accionable. Un fallo al enumerar procesos, comprobar prerequisitos, verificar el paquete o recuperar el estado previo debe impedir reportar éxito.
- REQ-006: Usar Node.js para orquestación de build/CI portable cuando reduzca dependencias y preserve la semántica. Mantener solo las tareas PowerShell de build/CI que requieran explícitamente APIs/herramientas Windows sin alternativa equivalente; documentar cada excepción y evitar empaquetarlas o ejecutarlas al abrir la app.
- REQ-007: Actualizar contratos, manifiestos, documentación y detección de instalación para que el payload no declare scripts de runtime retirados como archivos críticos; mantener compatibilidad de upgrade desde instalaciones previas sin romper accesos directos ni eliminar datos.
- REQ-008: Añadir cobertura automatizada para invocaciones runtime ausentes, instalación y actualización, cancelación, errores de permisos, verificación de firma/hash, fallos de proceso, rollback, regeneración de accesos directos y upgrade desde una versión con launchers PowerShell. Ejecutar smoke/E2E en Windows antes de declarar el runtime migrado.

## Criterios de Aceptación

1. Un inventario versionado incluye todas las invocaciones detectadas y razón técnica de cualquier PowerShell que permanezca.
2. Los paquetes y accesos directos de usuario final no ejecutan PowerShell ni Windows Script Host en apertura, actualización, reparación, detención, reinicio o desinstalación.
3. La BA/runtime de producción realiza las operaciones requeridas sin depender de que PowerShell esté instalado, habilitado o permitido por ExecutionPolicy.
4. Burn continúa gestionando elevación y transacciones; no se agrega un servicio persistente ni se ejecuta código de actualización antes de la confirmación del usuario.
5. En errores de permisos, red, firma, timeout o enumeración, la operación termina de forma explícita, no altera datos ni reemplaza payload parcialmente, y deja diagnóstico sanitizado.
6. La actualización conserva los datos docentes, migra accesos directos y completa el flujo desde una instalación previa con los launchers actuales.
7. CI Windows compila BA/helper/MSI/bundle y ejecuta pruebas de contrato más el smoke/E2E de instalación/actualización aplicable.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Inventario y clasificación de invocaciones runtime | `docs/installer/windows-runtime-inventory.md` | Implementado; validar exhaustividad en release |
| REQ-002 | Accesos directos nativos y ausencia de WSH/PowerShell | `scripts/tests/installer-hub-contract.test.mjs` | Contrato docente-local aprobado |
| REQ-003 | Helper nativo para operaciones Burn | `scripts/tests/installer-hub-contract.test.mjs` | BA compila; smoke Windows pendiente |
| REQ-004 | Delegación al bundle Burn firmado y transaccional | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente E2E |
| REQ-005 | Timeout, cancelación, fail-closed, logging y rollback | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Implementado en helper; casos de interrupción pendientes |
| REQ-006 | Orquestación portable con Node y excepciones Windows | `scripts/tests/native-startup.contract.test.mjs` | PowerShell limitado a tooling Windows/flavors heredados; pendiente validar CI |
| REQ-007 | Upgrade y regeneración de shortcuts/manifiestos | `scripts/tests/installer-instance-lifecycle.test.mjs` | Contrato de WiX/MSI actualizado; upgrade real pendiente |
| REQ-008 | Pruebas y smoke/E2E en Windows | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente smoke/E2E de instalación, reparación y desinstalación |

## Alternativas y decisión

- **PowerShell oculto:** menor coste inmediato, pero conserva dependencia de ejecución de scripts y la clase de fallos que se busca retirar.
- **Helper C#/.NET autocontenido:** opción seleccionada para runtime Windows; aprovecha el stack existente, evita hosts de scripts externos y permite tipos/errores/contratos compilados. Su coste es mantener y firmar el ejecutable y validar su ciclo de actualización.
- **Node.js para todo:** útil en tooling portable, pero añade dependencia al runtime y no es la mejor capa para integración con Burn, UAC, Shell Link, Authenticode y APIs Windows.
- **MSIX/App Installer:** puede gestionar updates nativamente, pero migrar el MSI/Burn existente y sus requisitos de instalación excede este cambio; queda como alternativa arquitectónica separada.

## Límites

- Esta spec cubre la instalación `docente-local`, sus flujos runtime de Windows y la reducción de PowerShell en tooling de build/CI donde exista alternativa equivalente.
- No prohíbe PowerShell en desarrollo local ni en tareas Windows sin sustituto seguro y compatible; las excepciones deben quedar documentadas fuera del payload del producto.
- Esta spec supersede los requisitos de SPEC-091 que ordenen invocar PowerShell/WSH desde el Hub. Banner, confirmación, verificación y delegación de actualización definidos en SPEC-091 se conservan.
