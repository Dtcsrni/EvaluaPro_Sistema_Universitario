# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-18
Versión: 1.2.8
SHA candidato: e67e7cb41d8f39bff034432053ec634f9b8ccd93

## CI Installer Windows

- Workflow CI Installer Windows #703 (run ID 39082944315), rama `main`, SHA candidato exacto, resultado `success`.
- Build MSI/Bundle, footprint, manifiesto/hash, antivirus y smoke GUI del bundle Burn: aprobados.
- E2E del bundle empaquetado, incluida actualización desde v1.2.3: aprobada.
- E2E visual de vista y descarga PDF en Microsoft Edge: aprobada.
- Artefactos:
  - `installer-windows` ID 12120710054, digest ZIP SHA-256 `4ff54c0644bbd846a532255aa787f1f6b0c1211ee213ba6d93aa521323286720`.
  - `installer-windows-internal` ID 12120435969.
  - `installer-hub-e2e-39082944315` ID 12120094490.

## CI completa y UX/UI

- CI Checks #1480 (run ID 39071161801), corrida full sobre el SHA candidato: `success`.
- CI Checks #1481 (run ID 39076579171), corrida full consecutiva sobre el mismo SHA: `success`.
- Ambas corridas aprobaron cobertura backend/portal, Classroom audit, OMR canónico, PDF/impresión, E2E de ciclo y gates visuales UX/UI.
- Suites responsive de GUI docente, alumno y administración aprobaron; sus artefactos visuales quedaron publicados.

## Alcance

La evidencia acredita los gates automatizados y el E2E del instalador Windows. No acredita un flujo humano docente en producción externa ni una instalación manual en el equipo local; esos pasos no se ejecutaron en esta validación.
