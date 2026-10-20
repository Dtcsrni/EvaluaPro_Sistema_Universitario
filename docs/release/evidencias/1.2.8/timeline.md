# Timeline Gate Estable 1.2.8

- SHA candidato: `0d97e29e5755e4fc22fcc1a2f9d1af462353c117`
- Rama evaluada: `main`
- Fecha: 2026-10-20
- Resultado: CI Checks, CodeQL, auditoría de políticas y dos corridas consecutivas de CI Installer Windows aprobaron en el SHA candidato. Falta el Release Stable Gate y la E2E del asset público.

## Pasos

1. [OK] CI Checks #1537 (run 39398384778) sobre el SHA candidato: Core y Extended concluyeron success.
2. [OK] En CI Checks #1537 pasaron lint/typecheck/tests/build backend, security scan, legal-docs-check, contract-check y los gates agregados.
3. [OMITIDO POR IMPACTO] Coverage, portal/Classroom audit, Core Frontend, UX visual y suites no afectadas no se ejecutaron en #1537; no se cuentan como aprobados por esa corrida.
4. [OK] Security CodeQL #904 (run 39398384754), mismo SHA, success.
5. [OK] CI Policy Audit #232 (run 39405868975), mismo SHA, success.
6. [OK] Primera pasada CI Installer Windows #745 (run 39399161350), mismo SHA, success: build, contratos, footprint, smoke GUI, hashes, antivirus, E2E completa y artefactos.
7. [OK] Segunda pasada consecutiva CI Installer Windows #746 (run 39402733656), mismo SHA, success: build, contratos, footprint, smoke GUI, hashes, antivirus, E2E completa y artefactos.
8. [OK] En #745 y #746, E2E GUI del Installer Hub cubrió instalación, reparación y desinstalación en un entorno QA aislado.
9. [OK] Baseline oficial v1.2.3 verificado y E2E de actualización aprobada en #745 y #746.
10. [OK] E2E visual de vista y descarga de PDF en Microsoft Edge aprobada en #745 y #746.
11. [OK] Artefactos MSI/Bundle y E2E publicados y con digest ZIP SHA-256; IDs y hashes en `integridad_sha256.json`.
12. [NO EJECUTADO] Flujo docente humano contra producción; no se usaron credenciales ni datos reales.
13. [NO EJECUTADO] Actualización en el equipo local; se conservan sin tocar los datos productivos.
14. [PENDIENTE] Stable Gate, promoción de v1.2.8, E2E del asset draft, E2E del asset público y verificación de que quede una sola release estable.

## Resultado

Las dos corridas Installer Windows #745 y #746 aprobaron para el mismo SHA candidato. Sus artefactos se generaron por separado y tienen digests distintos; cada corrida completó sus propios E2E. El candidato todavía no es una release estable. El Stable Gate debe evaluar la evidencia versionada; solo después se despachará el flujo que valida el asset draft y el público.
