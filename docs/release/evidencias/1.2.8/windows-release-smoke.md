# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-20 (America/Mexico_City)  
Versión: 1.2.8  
SHA candidato: `4ccde020b85906dba340d8473977b0fc027afc92`

## CI Installer Windows

- CI Installer Windows #763 (run ID 39526873990), rama `main`, SHA exacto: `success`.
- Pasaron build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifiesto/hash, antivirus y publicación de artifacts.
- E2E cubrió instalación/reparación, actualización desde baseline oficial v1.2.3 y vista/descarga PDF en Edge.
- IDs, tamaños y SHA-256 ZIP de artifacts están en `integridad_sha256.json`. Los hashes son de los ZIP de GitHub, no del EXE extraído.

## CI, seguridad y UX/UI

- CI Checks #1556 (run 39526501274), mismo SHA: `success`.
- Security CodeQL #922 (run 39526501412), mismo SHA: `success`.
- CI Checks omitió Core Frontend, Core Backend/Portal y suites extendidas por mapa de impacto; no se reportan como ejecutadas.
- La QA completa, matriz responsive y E2E de ciclo/PDF pertenecen al Stable Gate y siguen pendientes.

## Promoción pendiente

Stable Gate #103 (run 39526576612) falló antes de iniciar QA porque el manifiesto aún apuntaba al candidato anterior. No descargó artifacts ni inició publicación. Se corrigirá la evidencia documental y se repetirá el gate sobre el mismo SHA candidato.

No acredita flujo docente contra producción ni instalación local. No se usaron credenciales ni datos reales y la base SQLite productiva no se leyó ni modificó. La versión aún no es estable.
