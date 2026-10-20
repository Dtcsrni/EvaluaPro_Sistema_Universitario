---
id: SPEC-121
titulo: Mostrar versión dinámica de la edición en Installer Hub
version: 1.0.0
fecha: 2026-10-18
autor: Codex
modulo: installer_ui
estado: approved
---

## Contexto

> Integrada como componente de release en [SPEC-122](SPEC-122_estabilizacion_release_1_2_8.spec.md); esta ficha conserva la aprobación y el origen del requisito.

En la primera pasada visual del candidato 1.2.8 `docente-local`, el encabezado del Installer Hub mostró `1.2.8.0`, mientras el resumen de la edición decía `EvaluaPro Docente Local (v1.1.1)`. La segunda etiqueta está escrita como texto fijo en XAML. El registro local y el log Burn identifican el bundle actual como `1.2.8.0`; por tanto, el resumen puede inducir al docente a creer que está instalando una versión distinta.

## Requisitos Funcionales

- **REQ-001:** El resumen de edición para `docente-local` debe mostrar la versión del bundle actualmente ejecutado, obtenida de la misma fuente de versión que el encabezado del Hub; no debe contener una versión de release fija en XAML.
- **REQ-002:** La versión debe actualizarse al compilar un candidato con otra versión, sin requerir cambios manuales al texto del resumen.
- **REQ-003:** La automatización UI debe verificar que la edición visible y el encabezado concuerdan con la versión del bundle y conservar la captura de ese estado.
- **REQ-004:** La corrección debe mantener nombre de edición y versión legibles y no afectar el flujo docente, la selección del flavor ni las operaciones del instalador.

## Criterios de Aceptación

- El candidato 1.2.8 `docente-local` no muestra `v1.1.1` en el resumen; el resumen refleja la misma versión de build que el encabezado del Hub.
- La prueba de contrato falla si se reintroduce una versión de release literal en el texto de la edición.
- El E2E visual nativo confirma mediante UI Automation la coincidencia de versiones y captura el estado de revisión.
- Dos pasadas visuales consecutivas del mismo bundle terminan con reporte aprobado, capturas válidas y sin errores de versión.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | El contrato impide un texto fijo de versión y exige una fuente dinámica del Hub | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Implementado; 27/27 contratos locales aprobados; pendiente CI |
| REQ-003, REQ-004 | UI Automation valida la edición visible y conserva capturas del flujo del Hub | `scripts/tests/installer-hub-ui-lifecycle.ps1` | Dos pasadas locales aprobadas, 9 capturas cada una; pendiente CI |
