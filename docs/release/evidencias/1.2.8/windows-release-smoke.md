# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-18
Versión: 1.2.8
SHA candidato: 94bc5c881ea1bb8739911814dc7f05e52def94d6

## CI Installer Windows

- Workflow CI Installer Windows #711 (run ID 39096847674), rama `main`, SHA candidato exacto, resultado `success`.
- Build MSI/Bundle, footprint, manifiesto/hash, antivirus y smoke GUI del bundle Burn: aprobados.
- E2E del bundle empaquetado, incluida actualización desde v1.2.3: aprobado.
- E2E visual de vista y descarga PDF en Microsoft Edge: aprobado.
- Artefactos:
  - `installer-windows` ID 12125527616, digest ZIP SHA-256 `eac35a42102adedefffc12970088bef566f6a481fd05f6b0999a2ecd403584e1`.
  - `installer-windows-internal` ID 12125895583, digest ZIP SHA-256 `ed91b4a8a6095757476ad48ffda248d4d2cee2ab08a1640dcad9780dae761024`.
  - `installer-hub-e2e-39096847674` ID 12125995147, digest ZIP SHA-256 `5ddef317362aca261a069ac4ac101aaabd3fe28cac11a2bfc3cff1e8d9ecb4e8`.

## CI completa y UX/UI

- CI Checks #1495 (run ID 39096808969), corrida full sobre el SHA candidato: `success`.
- CI Checks #1496 (run ID 39102658491), corrida full consecutiva sobre el mismo SHA: `success`.
- Ambas corridas aprobaron cobertura backend/portal, auditoría Classroom, OMR canónico, PDF/impresión, E2E de ciclo y gates visuales UX/UI.
- Las suites responsive de GUI docente, alumno y administración aprobaron en ambas corridas.
- Artefactos UX/UI:
  - #1495: `e2e-visual-39096808969` ID 12126559810, digest ZIP SHA-256 `87d1b64d2b66ec3e577e8ff15c49900d9b956fd6b337280f00fe876175dd6b61`.
  - #1496: `e2e-visual-39102658491` ID 12129900265, digest ZIP SHA-256 `36a88c3a6d4f0333df92bfc6dc099d1d5a8263ef2791b67d158c2b20c08e74ee`.

## Alcance

La evidencia acredita los gates automatizados y el E2E del instalador Windows. No acredita un flujo humano docente en producción externa ni una instalación manual en el equipo local; esos pasos no se ejecutaron en esta validación.
