# Timeline Gate Estable 1.2.8

- SHA candidato: `e8832846e5786ac5da219db30176501cc2ef46a1`
- Rama evaluada: `main`
- Fecha local: 2026-10-21 (America/Mexico_City)
- Resultado: candidato construido y probado; promoción estable pendiente.

## Evidencia por etapa

1. [OK] CI Checks #1573 (run 39569029218), SHA exacto.
2. [OK] Security CodeQL #939 (run 39569029170), SHA exacto.
3. [OK] CI Antivirus Gate #363 (run 39569029187), SHA exacto.
4. [OK] CI Installer Windows #782 (run 39569392976), SHA exacto: build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifest/hash y artifacts.
5. [OK] En #782 pasaron instalación, actualización desde baseline oficial v1.2.3 y reparación GUI.
6. [OK] En #782 pasó E2E visual de vista y descarga PDF en Microsoft Edge.
7. [OK] IDs, tamaños y SHA-256 ZIP de artifacts #782 registrados en `integridad_sha256.json`.
8. [OMITIDO POR IMPACTO] CI Checks omitió Core Frontend y Core Backend/Portal por mapa de impacto; no se consideran ejecutados.
9. [PENDIENTE] Stable Gate sobre el SHA actual. El run #105 (39573177258) falló antes de iniciar QA porque aún no existía un commit posterior limitado al directorio de evidencia; no publicó.
10. [PENDIENTE] Integrar esta actualización de evidencia y repetir el Stable Gate. Aplicar el alcance diferencial indicado por cambios; conservar los gates requeridos.
11. [PENDIENTE] E2E del asset draft y público, promoción estable v1.2.8 y verificación de assets.
12. [NO EJECUTADO] Flujo docente productivo e instalación local. No se usaron credenciales/datos reales; SQLite productiva no se leyó ni modificó.

## Resultado

Aún no hay release estable v1.2.8. El build candidato #782 pasó; la ejecución Stable Gate #105 se detuvo por evidencia posterior faltante antes de QA. Faltan integrar evidencia, repetir el gate, probar el ciclo de publicación y verificar la release pública.
