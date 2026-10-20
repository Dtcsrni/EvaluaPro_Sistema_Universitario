# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-20  
Versión: 1.2.8  
SHA candidato: `84a89c0df5e7ae542dba11ff45e55ea3c7c40638`

## CI Installer Windows

- Workflow CI Installer Windows #741 (run ID 39382108606), rama `main`, SHA candidato exacto: `success`.
- Build MSI/Bundle, contrato Installer Hub, footprint, manifiesto/hash y antivirus: aprobados.
- E2E completa sobre el bundle docente candidato: aprobada.
- Baseline oficial v1.2.3 y E2E de actualización: aprobados.
- E2E visual de vista/descarga PDF en Microsoft Edge: aprobada.
- Artefactos:
  - `installer-windows` ID 12246976717, 272084140 bytes, digest ZIP SHA-256 `785f89b8464f2097f1a1fbc67a9f870a7e52a7e48be2f865b57856b8c350d404`.
  - `installer-windows-internal` ID 12246584697, digest ZIP SHA-256 `62140fbadb088ec75a0f3dd51cf6eab1e4ae501f6b520ede9b9bc93d7ef13b83`.
  - `installer-hub-e2e-39382108606` ID 12246594648, digest ZIP SHA-256 `260d3a1bbe12977150071eff29828d5568f3ffac122a1b885266fd66edb8d90a`.

## CI y UX/UI

- CI Checks #1527 (run ID 39381668637), sobre el SHA candidato: `success`; etapa UX visual y publicación de evidencia: aprobadas.
- Coverage backend/frontend se omitió por el mapa de impacto y no se considera ejecutado.
- Security CodeQL #894 (run ID 39381668632): `success`.
- CI Antivirus Gate #350 (run ID 39381668664): `success`.
- Evidencia UX/UI: `e2e-visual-39381668637` ID 12246991944, digest ZIP SHA-256 `30842f3dd220b8b7e1b4bc1bd5590f688955182bf2e00726c00321ac025e9038`.

## Alcance pendiente

La evidencia acredita los gates automatizados indicados y el E2E del instalador Windows. No acredita un flujo humano docente en producción externa ni instalación manual en el equipo local. La promoción estable requiere completar Release Stable Gate y verificar el asset público.

