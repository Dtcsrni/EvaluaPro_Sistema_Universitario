# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-20 (America/Mexico_City)  
Versión: 1.2.8  
SHA candidato: `d44212a5869fc7162180e981307c0163cc42ba1f`

## CI Installer Windows

- CI Installer Windows #758 (run ID 39520497900), rama `main`, SHA exacto: `success`.
- Pasaron build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifiesto/hash, antivirus y artifacts.
- E2E del Installer Hub cubrió instalación/reparación/desinstalación, actualización desde baseline oficial v1.2.3 y validación visual de vista/descarga PDF en Edge.
- IDs, tamaños y SHA-256 ZIP de artifacts están en `integridad_sha256.json`.

## CI, seguridad y UX/UI

- CI Checks #1551 (run 39520388769), mismo SHA: agregados Core/Extended `success`; Core Frontend, Core Backend/Portal y algunas suites extendidas se omitieron por mapa de impacto.
- CodeQL #917 (run 39520388807), mismo SHA: `success`.
- CI Antivirus Gate #352 (run 39520388754), mismo SHA: `success`.
- E2E visual del Installer Hub y PDF aprobada en #758. Matriz visual responsive, ciclo docente y QA completa del Stable Gate pendientes.

## Promoción pendiente

Stable Gate #101 (run 39523371654) falló antes de iniciar QA porque no había commit posterior con evidencia. No descargó el artifact candidato ni inició publicación. Deben ejecutarse Stable Gate y E2E de assets draft/público.

No acredita flujo docente humano contra producción ni instalación local. No se usaron credenciales ni datos reales y la base SQLite productiva no fue leída ni modificada. La versión todavía no es estable.
