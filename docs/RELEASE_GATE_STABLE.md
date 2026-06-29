# Gate de Promocion a Estable

## Objetivo
Definir una regla estricta y auditable para promover una version `beta` a `estable`.

## Regla Go/No-Go
Se promueve a estable solo si se cumplen todos:

1. 10 corridas CI consecutivas en verde.
2. Gating de calidad beta completo en verde (`lint`, `typecheck`, `tests`, `coverage`, `perf`, `security`, `docs`, `routes`, `pipeline contract`).
3. Evidencia QA automatizada completa en `reports/qa/latest/manifest.json`.
4. `clean-architecture-check` en verde y evidencia `reports/qa/latest/clean-architecture.json` presente.
5. Evidencia versionada en `docs/release/evidencias/<version>/`.
6. Checklist de rollback readiness validado (`rollback_readiness.json`).

Si falla cualquier punto: **No-Go**.

Automatizacion bloqueante:
- workflow `.github/workflows/release-stable-gate.yml` (tags `v*` sin `-alpha/-beta/-rc` y `workflow_dispatch`).
- script orquestador: `npm run release:validate:stable -- --version=<version>`.

## QA automatizada obligatoria
El release estable no requiere validacion humana manual como condicion bloqueante. La UX/UI y el flujo docente quedan cubiertos por evidencias automatizadas y reproducibles.

Artefactos obligatorios:

1. `reports/qa/latest/dataset-prodlike.json`
2. `reports/qa/latest/e2e-docente-alumno.json`
3. `reports/qa/latest/global-grade.json`
4. `reports/qa/latest/evaluaciones-policy.json`
5. `reports/qa/latest/evaluaciones-e2e.json`
6. `reports/qa/latest/pdf-print.json`
7. `reports/qa/latest/ux-visual.json`
8. `reports/qa/latest/clean-architecture.json`

El manifiesto `reports/qa/latest/manifest.json` debe declarar `resumen.estado=ok`, `resumen.faltantes=0` y todos los artefactos anteriores presentes. Cuando un artefacto incluya propiedad `ok`, debe ser `true`.

## Script de evidencia
Comando:

```bash
npm run release:gate:prod-flow -- --version=1.0.0 --periodo-id=<periodoId> --manual=docs/release/manual/prod-flow.json
```

Variables opcionales:

- `RELEASE_GATE_API_BASE` (ej. `https://api.midominio.com/api`)
- `RELEASE_GATE_DOCENTE_TOKEN`
- `RELEASE_GATE_DOCENTE_ID`
- `RELEASE_GATE_DOCENTE_HASH_SALT`
- `RELEASE_GATE_CI_GREEN`

El script genera:

- `docs/release/evidencias/<version>/manifest.json`
- `docs/release/evidencias/<version>/timeline.md`
- `docs/release/evidencias/<version>/metrics_snapshot.txt`
- `docs/release/evidencias/<version>/integridad_sha256.json`
- requiere `docs/release/evidencias/<version>/rollback_readiness.json`
- valida referencia a evidencia Windows de install/repair/launcher/Hub

El gate estable genera ademas:
- `reports/release/stable-gate/<version>/decision.json` con decision `Go/No-Go`.

## Evidencia manual opcional
El flujo humano productivo y Classroom real pueden ejecutarse como smoke operativo, pero no bloquean la promocion estable si la evidencia automatizada obligatoria esta completa.

Checklist base de rollback:

`docs/release/manual/rollback-readiness.template.json`

## Criterio de seguridad operativa
Todo smoke humano opcional debe ejecutarse en ventana controlada y con plan de rollback preparado.
No usar datos de estudiantes reales fuera de politica institucional vigente.
