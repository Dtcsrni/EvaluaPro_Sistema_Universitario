# Evidencia Windows — EvaluaPro 1.2.8

Fecha de validación: 2026-10-20 (America/Mexico_City)  
Versión: 1.2.8  
SHA candidato: `7af46bb4a864e774e2dbfd987c43efe49b4100c4`

## CI Installer Windows

- CI Installer Windows #768 (run ID 39537882649), rama `main`, SHA exacto: `success`.
- Pasaron build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifiesto/hash, antivirus y publicación de artifacts.
- E2E cubrió instalación/reparación, actualización desde baseline oficial v1.2.3 y vista/descarga PDF en Edge.
- IDs, tamaños y SHA-256 ZIP de artifacts están en `integridad_sha256.json`. Los hashes son de ZIPs de GitHub, no del EXE extraído.
- Los E2E de publicación draft/público se omitieron porque el run candidato no recibió `release_tag`.

## CI, seguridad y UX/UI

- CI Checks #1560 (run 39537231762), mismo SHA: `success`.
- Security CodeQL #926 (run 39537231779), mismo SHA: `success`.
- CI Antivirus Gate #354 (run 39537231744), mismo SHA: `success`.
- CI Checks omitió Core Frontend y Core Backend/Portal por mapa de impacto; no se reportan como ejecutadas.
- Installer GUI y PDF visual pasaron en #768. Matriz responsive/ciclo docente no está verificada en este candidato; se debe reutilizar evidencia válida si sus módulos no cambiaron o ejecutar solo las pruebas que correspondan a cambios confirmados.

## Promoción pendiente

Stable Gate #103 (run 39526576612) corresponde al candidato anterior y falló antes de iniciar QA porque el manifiesto de evidencia estaba obsoleto. El SHA candidato actual es `7af46bb4a864e774e2dbfd987c43efe49b4100c4`; esta evidencia se actualiza para ese SHA.

No acredita flujo docente contra producción ni instalación local. No se usaron credenciales ni datos reales y la base SQLite productiva no se leyó ni modificó. La versión aún no es estable.
