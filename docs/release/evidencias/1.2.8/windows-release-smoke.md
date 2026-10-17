# Evidencia Windows — EvaluaPro 1.2.8

Fecha: 2026-10-17
Versión: 1.2.8
SHA candidato: 7752c394dad88f671037899629ab970ec6e61f7f

## CI Installer Windows

- Workflow run #689 (ID 38994719267), rama `main`, resultado `success`, SHA candidato exacto.
- MSI/Bundle docente-local, gate de footprint, smoke GUI del bundle Burn, manifiesto/hash y antivirus: aprobados.
- E2E completa sobre el bundle empaquetado, incluyendo actualización desde v1.2.3: aprobada.
- E2E visual de vista y descarga PDF en Microsoft Edge: aprobada.
- Artefactos: `installer-windows` (ID 12087720511, digest ZIP SHA-256 `571de85729b8b08d157d36fbfd86cd31e69a96e215333e3eada5cb0c6790e39a`), `installer-windows-internal` (ID 12087725600) y `installer-hub-e2e-38994719267` (ID 12087720487).

## CI completa y UX/UI

- CI Checks #1458 (ID 38996634498), corrida full, SHA candidato exacto: `success`; duración 56m16s.
- CI Checks #1459 (ID 39000282882), corrida full consecutiva sobre el mismo SHA: `success`; duración 1h33m00s.
- Ambas corridas completaron cobertura backend/portal, auditoría Classroom, OMR canónico, impresión PDF, recorrido docente-alumno y `ux-visual-check`.
- En #1459, el E2E responsive de docente, alumno y administración pasó; el recorrido integral docente registró 4 pruebas aprobadas.

## Límite de alcance

La evidencia acredita los gates automatizados de CI y el E2E del instalador en Windows. No acredita una instalación manual en el equipo local ni un flujo humano con datos de producción externa; ese paso no se ejecutó en esta validación.
