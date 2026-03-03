# Pruebas automatizadas

## Objetivo
Asegurar confiabilidad funcional y de seguridad del sistema completo en cada cambio.

## Politica TDD (obligatoria)
- Todo cambio funcional debe incluir prueba nueva o ajuste de regresion en el mismo PR.
- Se exige cobertura en lineas modificadas (`diff coverage`) con umbral minimo `90%`.
- Las exclusiones de cobertura solo se aceptan como deuda temporal con:
  - owner asignado,
  - fecha de expiracion,
  - razon tecnica,
  - registro en `docs/tdd-exclusions-debt.json`.
- El gate `test:coverage:exclusions:debt` falla si una deuda temporal vence.

## Capas de prueba
- Backend (`apps/backend/tests`):
  - unitarias
  - contrato/validaciones
  - integracion de flujo
  - seguridad/autorizacion/RBAC
  - OMR y calificacion
- Portal cloud (`apps/portal_alumno_cloud/tests`):
  - sesion alumno
  - sincronizacion
  - seguridad por API key y middleware
- Frontend (`apps/frontend/tests`):
  - smoke y comportamiento de cliente
- Subproyectos Vite historicos (`client/proyectos_vite/**`):
  - smoke estructural por proyecto (entrypoints + scripts minimos)

## CI modular por dominio
- Workflows independientes activos:
  - `.github/workflows/ci-backend.yml` (`CI Backend Module`)
  - `.github/workflows/ci-frontend.yml` (`CI Frontend Module`)
  - `.github/workflows/ci-portal.yml` (`CI Portal Module`)
  - `.github/workflows/ci-docs.yml` (`CI Docs Module`)
  - `.github/workflows/ci-policy-audit.yml` (`CI Policy Audit`)
- Objetivo:
  - aislar fallos por dominio y mantener señal de calidad de los demas modulos.
- Comportamiento esperado:
  - si falla un modulo, los otros workflows siguen ejecutando y reportando resultado.
  - el workflow monolitico `CI Checks` permanece como gate integrador de compatibilidad global.
- Hardening aplicado:
  - `CI Backend Module` prepara runtime `sharp` en linux (`npm install --no-save --include=optional --os=linux --cpu=x64 sharp`) para evitar fallos de dependencias nativas.

## Proteccion de rama main (Ruleset)
- Ruleset objetivo: `main-v1b-minimo`.
- Alcance: `refs/heads/main`.
- Reglas activas:
  - bloqueo de borrado de rama (`deletion`),
  - bloqueo de force-push (`non_fast_forward`),
  - PR obligatorio con 1 aprobación mínima,
  - descarte de approvals stale al recibir nuevos commits,
  - resolucion obligatoria de conversaciones,
  - branch actualizado obligatoriamente antes de merge (`strict required status checks policy`).
- Checks requeridos para merge:
  - `Verificaciones Core (PR bloqueante)` (`CI Checks`).
  - `Verificaciones Extendidas (Main/Release)` (`CI Checks`, `main/release`).
  - `Installer Windows (MSI + Bundle)` (`CI Installer Windows`).
  - `Security CodeQL (JS/TS)` (`Security CodeQL`).
- Nota operativa:
  - los workflows modulares por `paths` no se marcan como `required` para evitar PR bloqueados por checks no disparados.
  - el contrato de ruleset exige reglas base (`deletion`, `non_fast_forward`, `pull_request`, `required_status_checks`) y prohíbe marcar `Backend Module`, `Frontend Module`, `Portal Module` y `Docs Module` como checks requeridos de merge.

## Flujos criticos cubiertos
- Flujo de examen end-to-end backend.
- Generacion/regeneracion de examenes y PDF.
- Vinculacion de entrega por folio.
- Escaneo QR/OMR y deteccion de mismatch.
- Calificacion y reglas de topes.
- Aislamiento entre docentes.
- Publicacion/sincronizacion hacia portal.
- Gate mixto OMR TV3 con dataset sintético (`omr_samples_tv3`) y real (`omr_samples_tv3_real`).
- Modulo de evaluaciones continuas y politicas configurables (SV/LISC).
- Integracion Google Classroom en modo `pull` (OAuth y mapeo de evidencias).

## Matriz unica de gates MVP comercial
### Gate de merge (main)
- `Verificaciones Core (PR bloqueante)`
- `Verificaciones Extendidas (Main/Release)`
- `Installer Windows (MSI + Bundle)`
- `Security CodeQL (JS/TS)`
- `legal-docs-check` + `pii-leak-check` + `retention-policy-check`

### Gate extendido (nightly/main/release)
- `npm run test:omr:tv3:gate:ci`
- `npm run test:e2e:docente-alumno:ci`
- `npm run test:global-grade:ci`
- `npm run test:evaluaciones:policy:ci`
- `npm run test:evaluaciones:e2e:ci`
- `npm run test:pdf-print:ci`
- `npm run test:ux-visual:ci`
- `npm run perf:check`
- `npm run perf:check:business`
- `npm run qa:clean-architecture:strict`
- `npm run test:compliance:dsr-flow`
- `npm run compliance:evidence:generate`

### Gate de promocion estable (tag v* sin prerelease)
- `npm run release:validate:stable -- --version=<version>`
- Racha de 10 corridas `CI Checks` en verde.
- Evidencia obligatoria en `docs/release/evidencias/<version>/`.

## Criterio de calidad para release
Se considera candidato estable cuando pasan:
```bash
npm run test:ci
npm run test:flujo-docente:ci
npm run test:coverage:ci
npm run test:tdd:enforcement:ci
npm run test:client:proyectos:ci
npm run test:omr:tv3:gate:ci
npm run test:evaluaciones:policy:ci
npm run test:evaluaciones:e2e:ci
npm run perf:check
npm run security:env:check
npm run security:audit
npm run test:portal
npm run test:frontend
npm run routes:check
npm run docs:check
npm run diagramas:check
npm run diagramas:render:check
npm run diagramas:consistencia:check
npm run test:wix:policy
npm run test:wix:bundle
npm run test:ruleset:policy
npm run test:release:policy
npm run test:security:policy
npm run ci:policy:audit
npm run ci:policy:audit:remote
```

Adicional obligatorio para promover a estable:
- 10 corridas CI consecutivas en verde.
- evidencia de flujo docente humano en producción (`docs/release/evidencias/<version>/`).

## Criterio candidato beta 1.0.0
Se considera candidato `1.0.0-beta.0` cuando ademas de los gates funcionales se cumple:
- `CI Backend Module` en verde.
- `CI Frontend Module` en verde.
- `CI Portal Module` en verde.
- `CI Docs Module` en verde.
- `CI Checks` en verde.

## Comandos de uso frecuente
- Backend completo:
```bash
npm -C apps/backend run test
```
- Portal cloud:
```bash
npm -C apps/portal_alumno_cloud run test
```
- Frontend:
```bash
npm -C apps/frontend run test
```
- Smoke subproyectos Vite historicos:
```bash
npm run test:client:proyectos:ci
```
- Suite integrada raiz:
```bash
npm run test:ci
```

## Estado operativo actual
- El backend mantiene una bateria amplia de pruebas de contrato e integracion.
- OMR tiene pruebas unitarias especificas (doble marca, burbuja hueca, trazos lineales, colorimetria).
- Existen pruebas de integracion para QR/OMR y flujo de examen.
- OMR en produccion se considera TV3-only para auto-calificacion.

## Evidencia de auditoria instalador/docente (2026-03-03)
- Reporte consolidado:
  - `reports/qa/latest/installer-docente-audit-2026-03-03.md`
- Registro en manifiesto QA:
  - `reports/qa/latest/manifest.json`
- Alcance validado en la auditoria:
  - contrato Installer Hub (fases/codigos/fail-fast/configuracion segura),
  - dashboard UI y update manager,
  - E2E responsive docente (desktop/tablet/mobile).

## Regla de mantenimiento
Todo cambio en:
- rutas,
- permisos,
- OMR,
- calificacion,
- sincronizacion,
debe acompanarse de prueba nueva o ajuste de regresion.

