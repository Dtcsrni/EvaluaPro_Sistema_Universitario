# Timeline Gate Estable 1.2.8

- SHA candidato: `841c04ca4d24b884ab8970b7c33fae18e2a3ac6c`
- Rama evaluada: `main`
- Fecha: 2026-10-20
- Resultado: dos corridas consecutivas de CI Installer Windows aprobaron sobre el SHA candidato. CI Checks y CodeQL también aprobaron. El Stable Gate y la E2E del asset público siguen pendientes.

## Pasos

1. [OK] CI Checks #1542 (run 39504346353) sobre el SHA candidato: gates Core y Extended concluyeron success.
2. [OMITIDO POR IMPACTO] CI Checks #1542 omitió Core Backend/Portal, Core Frontend y suites extendidas funcionales/evidencia/performance; no se cuentan como ejecutadas.
3. [OK] Security CodeQL #908 (run 39504346298), mismo SHA, success.
4. [NO APLICA AL CANDIDATO] CI Policy Audit #232 (run 39405868975) fue success sobre SHA anterior `0d97e29e5755e4fc22fcc1a2f9d1af462353c117`; no se considera vigente para este candidato.
5. [OK] Primera pasada CI Installer Windows #749 (run 39504605928), SHA exacto, success: build, contratos, footprint, smoke GUI, hashes, antivirus, E2E completa y artefactos.
6. [OK] Segunda pasada CI Installer Windows #755 (run 39508287194), mismo SHA, success: build, contratos, footprint, smoke GUI, hashes, antivirus, E2E completa y artefactos.
7. [OK] En #749 y #755, E2E GUI del Installer Hub cubrió instalación, reparación y desinstalación en runner QA aislado.
8. [OK] Baseline oficial v1.2.3 verificado y E2E de actualización aprobada en #749 y #755.
9. [OK] E2E visual de vista y descarga PDF en Microsoft Edge aprobada en #749 y #755.
10. [OK] Artefactos MSI/Bundle y E2E publicados; IDs y digests ZIP SHA-256 están en `integridad_sha256.json`.
11. [NO EJECUTADO] Flujo docente humano contra producción; no se usaron credenciales ni datos reales.
12. [NO EJECUTADO] Actualización en el equipo local; se conserva la base SQLite productiva sin leer ni modificar.
13. [PENDIENTE] Stable Gate, promoción estable de v1.2.8, E2E del asset draft y del asset público, y verificación final del inventario de releases.

## Resultado

Las dos corridas Installer Windows #749 y #755 aprobaron para el mismo SHA candidato. Cada una generó sus propios artefactos y completó E2E de instalación, reparación, desinstalación, actualización y PDF. CI Checks omitió suites backend/portal y frontend por el mapa de impacto. El candidato todavía no es una release estable.