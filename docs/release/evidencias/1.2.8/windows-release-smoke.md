# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-20  
Versión: 1.2.8  
SHA candidato: `0d97e29e5755e4fc22fcc1a2f9d1af462353c117`

## CI Installer Windows

- Primera pasada: #745 (run ID 39399161350), rama `main`, SHA exacto: `success`.
- Segunda pasada consecutiva: #746 (run ID 39402733656), rama `main`, mismo SHA: `success`.
- Ambas pasaron build MSI/Bundle docente-local, contratos, fixture Burn, footprint, smoke GUI, manifiesto/hash, antivirus y verificación de artefactos.
- Ambas completaron E2E GUI de instalación, reparación y desinstalación en runner QA aislado.
- En ambas se verificó baseline oficial v1.2.3 y la E2E de actualización.
- En ambas pasó la E2E visual de vista y descarga PDF en Microsoft Edge.
- Los runs generaron bundles distintos. Sus digests ZIP y los de sus artefactos E2E están listados por run en `integridad_sha256.json`; no son hashes de los ejecutables individuales.

## CI, seguridad y UX/UI

- CI Checks #1537 (run ID 39398384778), mismo SHA: Core y Extended `success`.
- Security CodeQL #904 (run ID 39398384754), mismo SHA: `success`.
- CI Policy Audit #232 (run ID 39405868975), mismo SHA: `success`.
- En #1537 el mapa de impacto omitió coverage, auditoría Classroom, Core Frontend y UX visual, además de otras suites no afectadas. No se reportan como ejecutadas.
- Las capturas GUI del Installer Hub y la validación visual del PDF en Edge están incluidas en los artefactos E2E de #745 y #746.

## Alcance pendiente

Esta evidencia acredita las corridas automatizadas descritas. No acredita un flujo humano docente contra producción ni la instalación en el equipo local. La base SQLite productiva no fue leída ni modificada. Sigue pendiente ejecutar Release Stable Gate, validar el asset de draft y el asset público y comprobar la lista final de releases.
