# Engineering Baseline

Fecha de baseline: 2026-02-19
Version: `1.0.0-beta.0`

## Estado vigente
- Monorepo NPM workspaces:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`
- API canonica unificada en `/api/*`.
- OMR y PDF operan en TV4 como contrato canonico, preservando el baseline visual A050929D.
- Sincronizacion con schema v2.
- Contrato CI alineado con gate `clean-architecture-check`.

## Verificacion minima
- `npm run lint`
- `npm run typecheck`
- `npm run test:frontend:ci`
- `npm run test:coverage:ci`
- `npm run perf:check`
- `npm run pipeline:contract:check`
- `npm run qa:clean-architecture:strict`
- `npm run test:wix:policy`
- `npm run test:ruleset:policy`
- `npm run test:release:policy`
- `npm run test:security:policy`

## Riesgos tecnicos activos
1. Complejidad residual en modulos UI grandes.
2. Rampa de cobertura frontend hacia metas semanales.
3. Costo de ejecucion en tests de integracion PDF/OMR bajo cobertura.

## Reglas de gobernanza
1. No merge sin gates base en verde (`lint`, `typecheck`, tests, build).
2. `main` requiere checks: Core + Extended + Installer Windows + Security CodeQL.
3. Cambios de contrato en API/OMR/PDF/Sync deben incluir pruebas.
4. Todo cambio de arquitectura debe reflejarse en:
   - `docs/INVENTARIO_PROYECTO.md`
   - `docs/ENGINEERING_BASELINE.md`
   - `CHANGELOG.md`

## Requisitos verificables (resumen)
- RF: autenticacion, RBAC, gestion academica, flujo examen, OMR, calificacion, sincronizacion.
- RNF: seguridad de entrada, rate limit, observabilidad, performance, CI modular, contrato pipeline.
- Evidencia principal: tests automatizados + artefactos `reports/qa/latest/*`.
