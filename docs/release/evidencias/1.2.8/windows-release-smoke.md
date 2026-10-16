# Evidencia Windows — EvaluaPro 1.2.8

Fecha: 2026-10-16
Versión: 1.2.8
SHA candidato: ab784c4c4fca0ca24d86cab8a37ceaca22d5e0d1

## CI Installer Windows

- Workflow run #686 (ID 38966875002), rama `main`, resultado `success`, SHA candidato exacto.
- MSI/Bundle docente-local, gate de footprint, smoke GUI del bundle Burn, manifiesto/hash y antivirus: aprobados.
- E2E completa sobre el bundle empaquetado, incluyendo actualización desde v1.2.3: aprobada.
- E2E visual de vista y descarga PDF en Microsoft Edge: aprobada.
- Artefactos del run: `installer-windows` (ID 12076850310), `installer-windows-internal` (ID 12075934461) y `installer-hub-e2e-38966875002` (ID 12075494436).

## CI completa y UX/UI

- CI Checks #1451 (ID 38967109067), full, SHA candidato exacto: `success`.
- CI Checks #1452 (ID 38973718479), full, SHA candidato exacto: `success`.
- Ambas corridas completaron cobertura backend/portal, OMR canónico, impresión PDF, recorrido docente-alumno y `ux-visual-check`.

## Límite de alcance

La evidencia acredita los gates automatizados de CI y el E2E del instalador en Windows. No acredita una instalación manual en el equipo local ni un flujo humano con datos de producción externa; ese paso no se ejecutó en esta validación.
