# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-18
Versión: 1.2.8
SHA candidato: c436b2ea87871c4843e2ad90731e45628b73e869

## CI Installer Windows

- Workflow CI Installer Windows #706 (run ID 39086197623), rama `main`, SHA candidato exacto, resultado `success`.
- Build MSI/Bundle, footprint, manifiesto/hash, antivirus y smoke GUI del bundle Burn: aprobados.
- E2E del bundle empaquetado, incluida actualización desde v1.2.3: aprobado.
- E2E visual de vista y descarga PDF en Microsoft Edge: aprobado.
- Artefactos:
  - `installer-windows` ID 12121561847, digest ZIP SHA-256 `9ac5deb575f95b2c98cfb1d18dea5c4300a7e7f011f0ff94f0c08fbfe52ec66e`.
  - `installer-windows-internal` ID 12121432325.
  - `installer-hub-e2e-39086197623` ID 12121571773, digest ZIP SHA-256 `9e3c5058aacb2e03b72d65ab2b0ac356942145b4a1e87a13529848d56152f7ed`.

## CI completa y UX/UI

- CI Checks #1486 (run ID 39085845113), corrida full sobre el SHA candidato: `success`.
- CI Checks #1487 (run ID 39091609380), corrida full consecutiva sobre el mismo SHA: `success`.
- Ambas corridas aprobaron cobertura backend/portal, Classroom audit, OMR canónico, PDF/impresión, E2E de ciclo y gates visuales UX/UI.
- Las suites responsive de GUI docente, alumno y administración aprobaron en ambas corridas.
- Artefactos UX/UI:
  - #1486: `e2e-visual-39085845113` ID 12123131604, digest ZIP SHA-256 `2b13b5aa45dce3499056e17c596271a8a4e9d8e542d3bbe9aa3debf09cbcfa1a`.
  - #1487: `e2e-visual-39091609380` ID 12124117104, digest ZIP SHA-256 `0920b28b26c81f513efd0fa7eed58369f8b5811022d7b1cd0adc639d5a2651ce`.

## Alcance

La evidencia acredita los gates automatizados y el E2E del instalador Windows. No acredita un flujo humano docente en producción externa ni una instalación manual en el equipo local; esos pasos no se ejecutaron en esta validación.
