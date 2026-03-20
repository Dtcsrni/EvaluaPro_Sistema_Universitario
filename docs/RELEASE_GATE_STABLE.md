# Gate de Promocion a Estable

## Objetivo
Definir una regla estricta y auditable para promover una version `beta` a `estable`.

## Regla Go/No-Go
Se promueve a estable solo si se cumplen todos:

1. 10 corridas CI consecutivas en verde.
2. Gating de calidad beta completo en verde (`lint`, `typecheck`, `tests`, `coverage`, `perf`, `security`, `docs`, `routes`, `pipeline contract`).
3. `clean-architecture-check` en verde y evidencia `reports/qa/latest/clean-architecture.json` presente.
4. Flujo docente humano en produccion completado sin fallos criticos.
5. Evidencia versionada en `docs/release/evidencias/<version>/`.
6. Checklist de rollback readiness validado (`rollback_readiness.json`).

Si falla cualquier punto: **No-Go**.

Automatizacion bloqueante:
- workflow `.github/workflows/release-stable-gate.yml` (tags `v*` sin `-alpha/-beta/-rc` y `workflow_dispatch`).
- script orquestador: `npm run release:validate:stable -- --version=<version>`.

## Flujo docente humano obligatorio (produccion)
Pasos:

1. Autenticacion docente valida.
2. Creacion/seleccion de materia o periodo operativo.
3. Alta/seleccion de alumno.
4. Seleccion/creacion de reactivos y plantilla.
5. Generacion de examen.
6. Vinculacion de entrega.
7. Calificacion completa.
8. Exportacion CSV/DOCX/firma.
9. Verificacion de integridad SHA-256.
10. Confirmacion de metricas de exportacion en `/api/metrics`.

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

## Entrada manual requerida
Archivo JSON de validacion humana (plantilla base):

`docs/release/manual/prod-flow.template.json`

Checklist base de rollback:

`docs/release/manual/rollback-readiness.template.json`

Se recomienda copiar a:

`docs/release/manual/prod-flow.json`

## Criterio de seguridad operativa
El flujo humano debe ejecutarse en ventana controlada y con plan de rollback preparado.
No usar datos de estudiantes reales fuera de politica institucional vigente.

