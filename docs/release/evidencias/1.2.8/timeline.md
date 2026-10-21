# Timeline Gate Estable 1.2.8

- SHA candidato: `d44212a5869fc7162180e981307c0163cc42ba1f`
- Rama evaluada: `main`
- Fecha local: 2026-10-20 (America/Mexico_City)
- Resultado: No-Go temporal; falta correr el Stable Gate después de este commit de evidencia.

## Evidencia por etapa

1. [OK] CI Checks #1551 (run 39520388769), SHA exacto: agregados Core/Extended, Contract/Docs/Gov y Security/Compliance aprobaron.
2. [OMITIDO POR IMPACTO] #1551 omitió Core Frontend, Core Backend/Portal y algunas suites extendidas. No se consideran ejecutadas.
3. [OK] CodeQL #917 (run 39520388807), SHA exacto.
4. [OK] CI Antivirus Gate #352 (run 39520388754), SHA exacto.
5. [OK] CI Installer Windows #758 (run 39520497900), SHA exacto: build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifest/hash, antivirus y E2E completa.
6. [OK] En #758 pasó upgrade GUI desde baseline oficial v1.2.3.
7. [OK] En #758 pasó E2E visual de vista/descarga PDF en Microsoft Edge.
8. [OK] IDs, tamaños y SHA-256 ZIP de artifacts de #758 en `integridad_sha256.json`.
9. [FALLO PREVALIDACIÓN] Stable Gate #101 (run 39523371654) se detuvo antes de QA: faltaba el commit posterior con evidencia. No descargó el artefacto; publicación, Latest y limpieza quedaron skipped.
10. [PENDIENTE] Stable Gate completo: QA, matriz visual, E2E responsive/ciclo/PDF.
11. [PENDIENTE] E2E del asset draft y del asset público, promoción estable e inventario final de releases.
12. [NO EJECUTADO] Flujo docente productivo e instalación local. No se usaron datos reales y la base SQLite productiva no fue leída ni modificada.

## Resultado

No hay release estable v1.2.8. El inventario consultado muestra la beta `v1.2.8-beta.7`; el intento #101 no alteró releases. Esta evidencia refleja el candidato d442... y no presenta suites omitidas como aprobadas.
