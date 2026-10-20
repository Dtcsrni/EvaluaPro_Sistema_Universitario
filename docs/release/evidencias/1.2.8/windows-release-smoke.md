# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-20  
Versión: 1.2.8  
SHA candidato: `841c04ca4d24b884ab8970b7c33fae18e2a3ac6c`

## CI Installer Windows

- Primera pasada: #749 (run ID 39504605928), rama `main`, SHA exacto: `success`.
- Segunda pasada: #755 (run ID 39508287194), rama `main`, mismo SHA: `success`.
- Ambas pasaron build MSI/Bundle docente-local, contratos, fixture Burn, footprint, smoke GUI, manifiesto/hash, antivirus y verificación de artefactos.
- Ambas completaron E2E GUI de instalación, reparación y desinstalación en runner QA aislado.
- En ambas se verificó baseline oficial v1.2.3 y la E2E de actualización.
- En ambas pasó la E2E visual de vista y descarga PDF en Microsoft Edge.
- Los artefactos de cada corrida se generaron por separado. Sus digests ZIP y tamaños están en `integridad_sha256.json`; no son hashes de los ejecutables individuales.

## CI, seguridad y UX/UI

- CI Checks #1542 (run ID 39504346353), mismo SHA: gates Core y Extended `success`.
- Security CodeQL #908 (run ID 39504346298), mismo SHA: `success`.
- CI Policy Audit #232 (run ID 39405868975) fue exitoso en otro SHA (`0d97e29e5755e4fc22fcc1a2f9d1af462353c117`); no se atribuye al candidato actual.
- En #1542 se omitieron Core Backend/Portal, Core Frontend, Extended Compliance/Evidencia, Extended Funcionales y Extended Perf/Arquitectura por el mapa de impacto. No se reportan como ejecutadas.
- La GUI del Installer Hub y la validación visual del PDF en Edge están cubiertas por las E2E de #749 y #755. El Stable Gate repetirá QA y la matriz/E2E visuales GUI antes de promoción.

## Alcance pendiente

Esta evidencia acredita las corridas automatizadas descritas. No acredita un flujo humano docente contra producción ni instalación en el equipo local. La base SQLite productiva no fue leída ni modificada. Sigue pendiente Release Stable Gate y E2E del asset draft/público.