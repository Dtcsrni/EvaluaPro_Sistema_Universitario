# Roadmap de Requisitos Verificables

Fecha: 2026-02-19
Base de evidencias: `reports/qa/latest/*`, `reports/perf/*.json`.

## Objetivo
Cerrar brechas entre beta operativa y estable auditable, manteniendo trazabilidad requisito -> evidencia -> gate.

## Fase 1 - Consolidacion de contrato unico
- API canonica `/api/*` sin rutas versionadas.
- OMR/PDF TV4 como contrato unico, con paridad estructural respecto a A050929D.
- Sync schema v2 en backend/frontend/portal/scripts.

Salida:
- `npm run lint`
- `npm run typecheck`
- `npm run pipeline:contract:check`

## Fase 2 - Cierre de calidad automatizada
Evidencias requeridas:
- `dataset-prodlike.json`
- `e2e-docente-alumno.json`
- `global-grade.json`
- `pdf-print.json`
- `ux-visual.json`
- `clean-architecture.json`
- `manifest.json`

Salida:
- `npm run qa:full`
- `npm run perf:check`
- `npm run perf:check:business`
- `npm run test:tdd:enforcement:ci`

## Fase 3 - Promocion a estable
Salida:
- 10 corridas CI consecutivas en verde.
- Flujo humano en produccion validado.
- Evidencias versionadas en `docs/release/evidencias/<version>/`.

## Riesgos y mitigaciones
| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Deriva documental | Alto | `docs:check` + actualizacion obligatoria de baseline/inventario |
| Falso verde por evidencia incompleta | Alto | `test:qa:manifest` bloqueante |
| Regresion de contrato | Alto | tests de integracion y gate de clean architecture |
| Release sin validacion humana | Alto | bloqueo por `release:gate:prod-flow` |
