# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-21 (America/Mexico_City)  
Versión: 1.2.8  
SHA candidato: `e8832846e5786ac5da219db30176501cc2ef46a1`

## CI Installer Windows

- CI Installer Windows #782 (run ID 39569392976), rama `main`, SHA exacto: `success`.
- Pasaron build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifiesto/hash, antivirus y publicación de artifacts.
- E2E cubrió instalación/reparación, actualización desde baseline oficial v1.2.3 y vista/descarga PDF en Edge.
- IDs, tamaños y SHA-256 ZIP de artifacts están en `integridad_sha256.json`. Son hashes de ZIPs de GitHub, no hashes de los EXE extraídos.
- E2E de publicación draft/público no se ejecutó en el run candidato, que se despachó sin `release_tag`.

## CI, seguridad y UX/UI

- CI Checks #1573 (run 39569029218), mismo SHA: `success`.
- Security CodeQL #939 (run 39569029170), mismo SHA: `success`.
- CI Antivirus Gate #363 (run 39569029187), mismo SHA: `success`.
- CI Checks omitió Core Frontend y Core Backend/Portal por mapa de impacto; no se reportan como ejecutados.
- Installer GUI y PDF visual pasaron en #782. Matriz responsive y ciclo docente permanecen pendientes del Stable Gate.

## Promoción pendiente

Stable Gate #105 (run 39573177258) se detuvo antes de QA: no existía todavía un commit posterior al candidato limitado a este directorio de evidencia. El workflow no publicó ni cambió el borrador.
El candidato evaluado es `e8832846e5786ac5da219db30176501cc2ef46a1`; tras integrar esta actualización, repetir el gate sobre el mismo candidato.

No acredita flujo docente contra producción ni instalación local. No se usaron credenciales ni datos reales y la base SQLite productiva no se leyó ni modificó. La versión aún no es estable.
