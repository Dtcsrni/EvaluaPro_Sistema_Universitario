# Evidencia estable 1.0.0

Este directorio contiene el paquete auditable del corte estable técnico `1.0.0` con etiqueta visible `1.0.0b`.

Artefactos presentes:
- `manifest.json`
- `timeline.md`
- `metrics_snapshot.txt`
- `integridad_sha256.json`
- `rollback_readiness.json`
- `ci-runs.fixture.json`
- `installer-release-manifest.fixture.json`

Estado actual:
- la decisión reproducible del corte es `No-Go`
- la causa no es un fallo del contrato técnico local, sino la ausencia del gate humano real de producción en este equipo
- el archivo de salida esperado del validador queda en `reports/release/stable-gate/1.0.0/decision.json`

La evidencia Windows ya validada y reutilizable vive en:
- [windows-release-smoke-2026-03-20.md](C:/Users/evega/EvaluaPro_Sistema_Universitario/docs/release/evidencias/1.0.0-beta.1/windows-release-smoke-2026-03-20.md)

Para convertir este corte a `Go`, todavía falta ejecutar el gate humano real en producción con:
- `docs/release/manual/prod-flow.json`
- variables `RELEASE_GATE_*`
- ventana operativa aprobada
