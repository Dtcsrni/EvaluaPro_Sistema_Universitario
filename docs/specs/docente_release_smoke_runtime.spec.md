---
id: SPEC-DOCENTE-RELEASE-SMOKE
titulo: Release smoke del flavor docente nativo
version: 1.0.0
fecha: 2026-07-14
autor: Codex
modulo: installer_hub_docente
estado: approved
---

## Contexto

El flavor `docente-local` debe instalar un runtime nativo ligero y verificable. El smoke y el E2E de release se ejecutan directamente en la PC Windows de QA; no dependen de VM, Hyper-V, WinRM, snapshots ni credenciales remotas.

## Requisitos Funcionales

- REQ-001: El smoke debe verificar que `docente-local` declara `native-node-sqlite` como runtime objetivo.
- REQ-002: El smoke debe comprobar manifest, shortcuts y control plane sin depender de Docker/WSL2.
- REQ-003: El smoke debe conservar una expectativa explícita de estado operativo para detectar regresiones de bundle.
- REQ-004: La UX docente debe respetar el contrato visual de radios contenidos y matriz canónica de pantallas.
- REQ-005: El E2E local debe crear cuentas dummy, tres materias y tres alumnos, y recorrer el ciclo docente completo con datos aislados y eliminables.
- REQ-006: El Installer Hub debe iniciar con una ventana de 1280×820, exigir como mínimo una pantalla de 1280×720 y recomendar 1920×1080.
- REQ-007: El post-install debe elevarse únicamente cuando la ruta objetivo esté protegida por Windows; para rutas de usuario debe operar sin UAC. Si la elevación requerida es rechazada, el resultado debe ser `ok=false` con error accionable. El E2E debe esperar la presencia completa del payload canónico antes de invocar el broker.
- REQ-008: La UX/UI debe usar tipografía local-first legible, soporte de texto enriquecido semántico y glassmorphism degradable con contraste y foco accesibles; ningún estado crítico puede depender solo de transparencia, color o una fuente remota.
- REQ-009: El Hub debe presentar una introducción navegable con logo, versión y carrusel accesible de funciones; debe mostrar licencia y privacidad como documentos identificables por separado, exigir aceptación explícita de ambos y registrar versión/fecha de aceptación en la sesión.

## Criterios de Aceptación

- El test `windows-release-smoke` pasa contra el bundle docente generado por `origin/main`.
- Ninguna aserción del smoke docente exige `wsl2-docker-minimal`.
- La validación mantiene cobertura de manifest, runtime embebido, shortcuts y `/api/status`.
- El contrato visual y la matriz de pantallas pasan sin radios oversized ni pantallas omitidas.
- El runner local produce evidencia de las cuentas, materias y alumnos dummy y valida install, operación, navegación, persistencia y uninstall.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Runtime nativo docente | `scripts/tests/windows-release-smoke.test.mjs` | Completado |
| REQ-002 | Integridad del bundle y control plane | `scripts/tests/windows-release-smoke.test.mjs` | Completado |
| REQ-003 | Smoke activo y límite de footprint | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
| REQ-004 | Contrato visual y matriz UX/UI | `scripts/tests/gui-design-contract.test.mjs` | Completado |
| REQ-005 | Ciclo docente local con datos dummy | `scripts/tests/seed-docente-dummy.mjs` | Implementado; pendiente de ejecución local |
| REQ-006 | Resolución mínima y ventana legible | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-007 | Elevación condicional y payload post-install | `scripts/tests/installer-hub-contract.test.mjs`, `scripts/tests/installer-hub-e2e-docente.ps1` | Implementado; pendiente de E2E local |
| REQ-008 | Tipografía, marca y superficies accesibles | `docs/DESIGN.md`, `apps/frontend/src/styles.css` | Implementado; pendiente de validación visual |
| REQ-009 | Intro, carrusel y aceptación auditable | `packaging/wix/BurnBootstrapperApp/MainWindow.xaml`, `MainWindow.xaml.cs` | En implementación |
### REQ-010 - Cierre acotado del runner E2E local

El runner E2E del flavor `docente-local` debe registrar el estado final y cerrar
Hub/Burn/MSI con un timeout acotado. Un proceso residual no puede bloquear la
prueba indefinidamente: debe registrarse como evidencia y detenerse de forma
controlada antes de continuar con la validación del payload.

### REQ-011 - Correlación única de operaciones del helper

Cada invocación del helper de detección, configuración, reparación o
desinstalación debe usar archivos de solicitud y respuesta con un identificador
único. Operaciones concurrentes o dos invocaciones dentro del mismo segundo no
pueden sobrescribir evidencia ni consumir la respuesta de otra operación.

### REQ-012 - Modos de lifecycle alcanzables

El helper nativo debe aceptar y enrutar explícitamente `detect-prereqs`,
`post-install`, `update` y `uninstall`. Ningún modo implementado puede quedar
fuera de su contrato de parámetros; si una operación no puede ejecutarse, debe
devolver un envelope JSON accionable y no terminar silenciosamente.
