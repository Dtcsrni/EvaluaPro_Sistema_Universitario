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
- Instalador en PR:
  - cambios afectados en Installer Hub, packaging o manifiestos de instalador activan `npm run test:installer-hub:contract` y `npm run test:wix:policy` dentro de `CI Checks`.
  - el workflow Windows que construye MSI + Bundle queda para tag `v*` o `workflow_dispatch`; no sustituye el contrato de PR y aporta evidencia de empaquetado/release.
- Hardening aplicado:
  - `CI Backend Module` prepara runtime `sharp` en linux (`npm install --no-save --include=optional --os=linux --cpu=x64 sharp`) para evitar fallos de dependencias nativas.

## Politica actual de rama main
- Ruleset objetivo: `main-v1b-minimo`.
- Alcance: `refs/heads/main`.
- Estado actual:
  - el ruleset remoto está activo para la estabilizacion V1.0.
  - `main` exige Pull Request, bloquea borrado/non-fast-forward y requiere `Verificaciones Core (PR bloqueante)`.
  - los checks extendidos, CodeQL e Installer Windows se endurecen para release/RC sin bloquear todavía el lote minimo de estabilizacion.
- Nota operativa:
  - al acercarse a `1.0.0-rc.0`, ampliar los checks obligatorios con el release gate aprobado.

## Flujos criticos cubiertos
- Flujo de examen end-to-end backend.
- Generacion/regeneracion de examenes y PDF.
- Vinculacion de entrega por folio.
- Escaneo QR/OMR y deteccion de mismatch.
- Calificacion y reglas de topes.
- Aislamiento entre docentes.
- Publicacion/sincronizacion hacia portal.
- Gate OMR por template version (`TV`) con baseline seleccionable desde CI y datasets versionados por contrato.
- Modulo de evaluaciones continuas y politicas configurables (SV/LISC).
- Integracion Google Classroom en modo `pull` (OAuth y mapeo de evidencias).
- Auditoria focal Classroom reproducible:
  - `npm run test:classroom:audit:ci`
  - cambios afectados en rutas Classroom activan este gate dentro de `CI Checks`.
  - evidencia documental: `docs/CLASSROOM_AUDIT_2026-03-22.md`

## Matriz unica de gates MVP comercial
### Gate de merge (main)
- `Verificaciones Core`
- `Verificaciones Extendidas (Main/Release)`
- `Installer Windows (MSI + Bundle)`
- `Security CodeQL (JS/TS)`
- `legal-docs-check` + `pii-leak-check` + `retention-policy-check`

### Gate extendido (nightly/main/release)
- `npm run test:omr:tv:gate:ci`
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

Seleccion de baseline TV activa:
- por defecto el runner usa `tv3`
- para cambiar de baseline sin renombrar el gate CI usar `OMR_TV_GATE_VERSION=tv4 npm run test:omr:tv:gate:ci`

### Gate de promocion estable (tag v* sin prerelease)
- `npm run release:validate:stable -- --version=<version>`
- Racha de 10 corridas `CI Checks` en verde.
- Evidencia obligatoria en `docs/release/evidencias/<version>/`.
- Guard automatico: cualquier tag `v*` sin release asociado se elimina para evitar tags huerfanos.

## Criterio de calidad para release
Se considera candidato estable cuando pasan:
```bash
npm run test:ci
npm run test:flujo-docente:ci
npm run test:coverage:ci
npm run test:tdd:enforcement:ci
npm run test:client:proyectos:ci
npm run test:omr:tv:gate:ci
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
- OMR en produccion se considera TV4-first para generacion y auto-calificacion.

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
