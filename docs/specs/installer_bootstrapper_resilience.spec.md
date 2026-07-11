---
id: SPEC-INSTALLER-BOOTSTRAPPER-RESILIENCE
titulo: Resiliencia del Bootstrapper del Instalador
version: 1.0.0
fecha: 2026-07-11
autor: Antigravity / Agente IA
modulo: devops
estado: draft
---

# SPEC-INSTALLER-BOOTSTRAPPER-RESILIENCE: Resiliencia del Bootstrapper del Instalador

## Contexto
El bootstrapper del instalador de EvaluaPro (BurnBootstrapperApp) ha experimentado fallos silenciosos y cierres abruptos sin notificar al usuario. Los problemas detectados incluyen:
1. Crash al intentar leer `assembly.Location` en entornos Single-File donde la propiedad retorna vacío.
2. Comportamiento errático o cierre silencioso cuando el producto ya está instalado en el sistema, en lugar de mostrar el asistente con el estado actual permitiendo Reparar o Desinstalar.
3. Ausencia de diálogos de error visuales en caso de excepciones fatales durante el inicio del asistente.

## Requisitos Funcionales
- **REQ-001:** `MainWindow.SetHubVersionLabel()` debe obtener la versión del assembly de forma segura mediante reflexión (leyendo `AssemblyInformationalVersionAttribute`) si `assembly.Location` está vacío o arroja error.
- **REQ-002:** El bootstrapper debe interceptar `OnDetectPackageComplete` y determinar si el paquete `EvaluaProMsi` ya está presente (`PackageState.Present`).
- **REQ-003:** Si el MSI ya está instalado, el modelo de detección del bootstrapper debe marcar `Installed = true` y preseleccionar el modo `"repair"` (o `"uninstall"`) en lugar de asumir `"install"`.
- **REQ-004:** Cualquier excepción fatal no controlada en `StartUiThread` o al inicio de la aplicación debe mostrar una ventana de error/diálogo de alerta visual (MessageBox) si no está en modo headless.

## Criterios de Aceptación
- **AC-001 (REQ-001):** La aplicación no arroja error si `assembly.Location` es una cadena vacía y recupera la versión de los atributos del assembly.
- **AC-002 (REQ-002):** Al detectar el paquete principal, se actualiza el estado de instalación interna.
- **AC-003 (REQ-003):** Ejecutar el instalador cuando ya existe una versión instalada muestra la interfaz de reparación/desinstalación.
- **AC-004 (REQ-004):** Si ocurre un error fatal en el hilo de la UI, se muestra un MessageBox informando al usuario en lugar de cerrar el proceso silenciosamente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Obtención segura de versión del assembly | `scripts/tests/windows-release-smoke.test.mjs` | Pendiente |
| REQ-002 | Detección de presencia de paquete MSI | `scripts/tests/installer-hub-contract.test.mjs` | Pendiente |
| REQ-003 | Preselección de modo repair si ya está instalado | `scripts/tests/installer-hub-contract.test.mjs` | Pendiente |
| REQ-004 | Mostrar alerta visual en excepciones fatales | `scripts/tests/installer-hub-contract.test.mjs` | Pendiente |
