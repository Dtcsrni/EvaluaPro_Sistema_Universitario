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
- `RELEASE_NOTES.md`

Estado actual:
- la decisión reproducible del corte es `Go`
- la evidencia remota actualizada reporta `ci-streak=21/10`
- el gate humano de producción está persistido con `gateHumanoProduccion.resultado=ok`
- el archivo de salida esperado del validador queda en `reports/release/stable-gate/1.0.0/decision.json`
- el corte documenta el proceso de preparación para cursos ya iniciados y examen global en `docs/PROCESO_GLOBAL_CURSO_INICIADO.md`
- los insumos revisados incluyen listas XLSX, temarios/encuadres DOCX y parciales previos DOCX de Administración de la Calidad y Electrónica y Aplicaciones Digitales

La evidencia Windows ya validada y reutilizable vive en:
- [windows-release-smoke-2026-03-20.md](C:/Users/evega/EvaluaPro_Sistema_Universitario/docs/release/evidencias/1.0.0-beta.1/windows-release-smoke-2026-03-20.md)

Para revalidar el corte:
- `node scripts/release/validate-stable-promotion.mjs --version=1.0.0 --repo=Dtcsrni/EvaluaPro_Sistema_Universitario`
- si no hay acceso a GitHub CLI, usar el fixture local solo como evidencia reproducible secundaria

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Documentacion funcional/operativa para despliegue, seguridad y cumplimiento.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../../comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../../comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-06-23.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
