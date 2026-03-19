# QA Gate Criteria (`1.0.0-beta.0`)

## Objetivo
Definir criterios verificables para aprobar una release candidata antes de la validacion humana en produccion.

## Gates bloqueantes
1. `npm run test:dataset-prodlike:ci`
2. `npm run test:e2e:docente-alumno:ci`
3. `npm run test:global-grade:ci`
4. `npm run test:pdf-print:ci`
5. `npm run test:ux-visual:ci`
6. `npm run test:qa:manifest`
7. `npm run test:flujo-docente:ci`
8. `npm run perf:check`
9. `npm run perf:check:business`
10. `npm run qa:clean-architecture:strict`
11. `npm run test:coverage:exclusions:debt`
12. `npm run test:coverage:diff`

## Evidencias obligatorias (`reports/qa/latest`)
- `dataset-prodlike.json`
- `e2e-docente-alumno.json`
- `global-grade.json`
- `pdf-print.json`
- `ux-visual.json`
- `clean-architecture.json`
- `manifest.json`

## Criterios de aprobacion
- Todos los comandos en verde.
- Sin bypass manual en CI.
- Artefactos presentes y consistentes.
- `diff coverage` >= 90% en lineas modificadas.
- Sin deuda de exclusiones vencida.

## Trazabilidad requisito -> prueba -> evidencia -> workflow
| Requisito | Prueba/Gate | Evidencia | Workflow |
| --- | --- | --- | --- |
| Merge seguro a `main` | `Verificaciones Core` | Logs + artefactos de CI | `CI Checks` |
| Cobertura de regresion extendida | `Verificaciones Extendidas (Main/Release)` | `reports/qa/latest/*` | `CI Checks` |
| Instalador comercial reproducible | `npm run test:wix:policy` + build MSI/Bundle | `dist/installer/*` | `CI Installer Windows` |
| SAST baseline | `Security CodeQL (JS/TS)` | Alertas de security tab / run logs | `Security CodeQL` |
| Promocion estable auditable | `npm run release:validate:stable` | `reports/release/stable-gate/<version>/decision.json` + `docs/release/evidencias/<version>/` | `Release Stable Gate` |
