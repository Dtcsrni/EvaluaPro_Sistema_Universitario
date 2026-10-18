# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-18
Versión: 1.2.8
SHA candidato: 21ef1ef414a765cfff83851a841686812b4cd795

## CI Installer Windows

- Workflow CI Installer Windows #714 (run ID 39113401895), rama `main`, SHA candidato exacto, resultado `success`.
- Build MSI/Bundle, footprint, manifiesto/hash, antivirus y smoke GUI del bundle Burn: aprobados.
- E2E del bundle empaquetado, incluida actualización desde v1.2.3: aprobado.
- E2E visual de vista y descarga PDF en Microsoft Edge: aprobado.
- Artefactos:
  - `installer-windows` ID 12131808550, digest ZIP SHA-256 `50fd7251a9fee4ca8e265f916006cfb59a2a34c0de84e5405493f09e7de1b2f5`.
  - `installer-windows-internal` ID 12131549321, digest ZIP SHA-256 `007dfdcc996cc3550e57f3a530594f037dcfde8cadd9be10aa422ca9e3661d5a`.
  - `installer-hub-e2e-39113401895` ID 12131808530, digest ZIP SHA-256 `76e657402fcbafeca739f0450e8c6721f7a353137b468e0435ed4fa43caded3d`.

## CI completa y UX/UI

- CI Checks #1502 (run ID 39144073253), corrida full sobre el SHA candidato: `success`.
- CI Checks #1503 (run ID 39155029767), corrida full consecutiva sobre el mismo SHA: `success`.
- Ambas corridas aprobaron cobertura backend/portal, auditoría Classroom, OMR canónico, PDF/impresión, E2E de ciclo y gates visuales UX/UI.
- Las suites responsive de GUI docente, alumno y administración aprobaron en ambas corridas.
- Artefactos UX/UI:
  - #1502: `e2e-visual-39144073253` ID 12145840381, digest ZIP SHA-256 `0089c02b711f9e83f13148762dbe292af79fae0f57911c36916c3f89fde1f4fb`.
  - #1503: `e2e-visual-39155029767` ID 12148588273, digest ZIP SHA-256 `c9043ed993874d3d45b64d022c8cd7de9ebe8a463c419e341a7125d2f4d9308a`.

## Alcance

La evidencia acredita los gates automatizados y el E2E del instalador Windows. No acredita un flujo humano docente en producción externa ni una instalación manual en el equipo local; esos pasos no se ejecutaron en esta validación.
