# Timeline Gate Estable 1.2.8

- SHA candidato: `4ccde020b85906dba340d8473977b0fc027afc92`
- Rama evaluada: `main`
- Fecha local: 2026-10-20 (America/Mexico_City)
- Resultado: candidato preparado; Stable Gate aún pendiente de evidencia corregida.

## Evidencia por etapa

1. [OK] CI Checks #1556 (run 39526501274), SHA exacto.
2. [OK] Security CodeQL #922 (run 39526501412), SHA exacto.
3. [OK] CI Installer Windows #763 (run 39526873990), SHA exacto: build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifiesto/hash, antivirus y artifacts.
4. [OK] En #763 pasó instalación/reparación y upgrade GUI desde baseline oficial v1.2.3.
5. [OK] En #763 pasó E2E visual de vista y descarga PDF en Microsoft Edge.
6. [OK] IDs, tamaños y SHA-256 ZIP de artifacts #763 en `integridad_sha256.json`.
7. [OMITIDO POR IMPACTO] CI Checks #1556 omitió Core Frontend, Core Backend/Portal y algunas suites extendidas. No se consideran ejecutadas; la QA completa de Stable Gate sigue siendo obligatoria.
8. [FALLO PREVALIDACIÓN] Stable Gate #103 (run 39526576612) se detuvo porque el manifiesto todavía refería d44212a. No comenzó QA ni publicación. La evidencia corregida se fusionará solo bajo esta carpeta y se relanzará.
9. [PENDIENTE] Stable Gate: QA completa, matriz GUI responsive, E2E de ciclo y PDF.
10. [PENDIENTE] E2E de asset draft y público, promoción estable y verificación del inventario final.
11. [NO EJECUTADO] Flujo docente humano productivo e instalación local. No se usaron credenciales/datos reales; SQLite productiva sin cambios.

## Resultado

Aún no hay release estable v1.2.8. El build candidato #763 pasó, pero el gate estable debe completar QA y las E2E de publicación antes de crear/publicar la release.
