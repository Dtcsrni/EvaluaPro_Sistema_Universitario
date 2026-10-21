# Timeline Gate Estable 1.2.8

- SHA candidato: `7af46bb4a864e774e2dbfd987c43efe49b4100c4`
- Rama evaluada: `main`
- Fecha local: 2026-10-20 (America/Mexico_City)
- Resultado: candidato construido y probado; promoción estable pendiente.

## Evidencia por etapa

1. [OK] CI Checks #1560 (run 39537231762), SHA exacto.
2. [OK] Security CodeQL #926 (run 39537231779), SHA exacto.
3. [OK] CI Antivirus Gate #354 (run 39537231744), SHA exacto.
4. [OK] CI Installer Windows #768 (run 39537882649), SHA exacto: build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifiesto/hash y artifacts.
5. [OK] En #768 pasó instalación, actualización desde baseline oficial v1.2.3 y reparación GUI.
6. [OK] En #768 pasó E2E visual de vista y descarga PDF en Microsoft Edge.
7. [OK] IDs, tamaños y SHA-256 ZIP de artifacts #768 en `integridad_sha256.json`.
8. [OMITIDO POR IMPACTO] CI Checks omitió Core Frontend y Core Backend/Portal por mapa de impacto; no se consideran ejecutados en este candidato.
9. [PENDIENTE] Stable Gate sobre el SHA actual. El run #103 (39526576612) pertenece al SHA anterior 4ccde... y se detuvo en prevalidación por evidencia obsoleta; no inició QA ni publicación.
10. [PENDIENTE] Validar solo módulos modificados desde la última evidencia válida y completar E2E de assets draft/público; evitar repetir suites de módulos sin cambios.
11. [PENDIENTE] Promoción estable v1.2.8 y verificación de assets públicos.
12. [NO EJECUTADO] Flujo docente humano productivo e instalación local. No se usaron credenciales/datos reales; SQLite productiva no se leyó ni modificó.

## Resultado

Aún no hay release estable v1.2.8. El build candidato #768 pasó; faltan evidencia integrada, validación diferencial del gate, E2E de publicación y promoción.
