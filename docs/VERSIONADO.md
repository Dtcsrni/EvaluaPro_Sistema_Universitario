# Versionado

## Politica
Se usa SemVer en raiz del monorepo.

## Estado actual
- Version declarada actual: `1.0.0`.
- Version visible en GUI: `1.0.0b`.
- Canal operativo: beta funcional (MVP extendido).
- Politica objetivo: `1.0-beta` con cero fallos de gates; promoción a estable con gate humano en produccion.
- Publicacion beta automatica: activa desde CI/CD cuando `CI Checks` completa en verde sobre `main` y el diff respecto a la version previa es significativo.
- Seguimiento de olas y bloqueos vigente: `docs/INVENTARIO_PROYECTO.md`.
- Trazabilidad de continuidad entre agentes: `AGENTS.md` y `docs/IA_TRAZABILIDAD_AGENTES.md`.

## Definiciones
- Alpha: cambios de alto movimiento con contratos inestables.
- Beta: contratos principales funcionales con ajustes controlados.
- Estable: release candidata cuando pasa bateria completa de calidad y no hay cambios breaking pendientes.

## Criterios para promover release estable
Debe pasar:
- `npm run test:ci`
- `npm run test:coverage:ci`
- `npm run perf:check`
- `npm run test:dataset-prodlike:ci`
- `npm run test:e2e:docente-alumno:ci`
- `npm run test:global-grade:ci`
- `npm run test:pdf-print:ci`
- `npm run test:ux-visual:ci`
- `npm run test:qa:manifest`
- `npm run test:portal`
- `npm run test:frontend`
- `npm run routes:check`
- `npm run docs:check`
- `npm run diagramas:check`
- `npm run diagramas:render:check`
- `npm run diagramas:consistencia:check`
- `npm run release:validate:stable -- --version=<version>`
- 10 corridas CI consecutivas verdes.
- Flujo docente humano activo en produccion con evidencia de integridad y metricas.

## Rampa de calidad asociada a releases
| Semana | Cobertura backend | Cobertura frontend | Cobertura portal | Reglas ESLint complejidad |
| --- | --- | --- | --- | --- |
| Semana 1 | 55 | 39/40/31/37 (L/F/B/S) | 50 | `complexity=18`, `max-depth=5`, `max-params=5` |
| Semana 2 | 62 | 52 | 58 | `complexity=16`, `max-depth=4`, `max-params=5` |
| Semana 3 | 70 | 60 | 65 | `complexity=15`, `max-depth=4`, `max-params=4` |

## Convenciones de cambio
- Cambios funcionales relevantes: actualizar docs y pruebas en el mismo ciclo.
- Cambios en rutas o permisos: validar guardarrailes y diagramas.
- Cambios OMR/calificacion: incluir pruebas de regresion.
- Convencion de commits recomendada:
  - `feat:`
  - `fix:`
  - `refactor:`
  - `docs:`
  - `chore:`

## Proceso de release (mínimo)
1. Ejecutar contrato de calidad:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test:ci`
   - `npm run test:dataset-prodlike:ci`
   - `npm run test:e2e:docente-alumno:ci`
   - `npm run test:global-grade:ci`
   - `npm run test:pdf-print:ci`
   - `npm run test:ux-visual:ci`
   - `npm run test:qa:manifest`
   - `npm run build`
2. Verificar pipeline contract:
   - `npm run pipeline:contract:check`
3. Actualizar `CHANGELOG.md` y publicar versión SemVer.
4. Publicar contrato de instalador Windows estable:
   - `EvaluaPro-Instalador-Windows.zip`
   - `EvaluaPro-Instalador-Windows.zip.sha256`
   - `antivirus-scan-report.txt`
   - `EvaluaPro-saas-completo.msi`
   - `EvaluaPro-saas-completo.msi.sha256`
   - `EvaluaPro-InstallerHub-saas-completo.exe`
   - `EvaluaPro-docente-local.msi`
   - `EvaluaPro-docente-local.msi.sha256`
   - `EvaluaPro-InstallerHub-docente-local.exe`
   - `EvaluaPro-release-manifest.json`
   - con gate antivirus bloqueante sobre el `.zip` para canal stable.
5. Ejecutar gate de estable:
   - `npm run release:gate:prod-flow -- --version=<version> --periodo-id=<periodoId> --manual=docs/release/manual/prod-flow.json`
6. Versionar evidencias en:
   - `docs/release/evidencias/<version>/`
7. Incluir checklist de rollback readiness:
   - `docs/release/evidencias/<version>/rollback_readiness.json`
7. Validar decision automatica de estable:
   - workflow `Release Stable Gate` en verde y artefacto `decision.json` publicado.

## Publicacion beta automatica
1. CI completo en `main`:
   - `CI Checks` en verde.
2. Evaluacion de alcance:
   - `npm run release:validate:beta -- --version=<version> --head-sha=<sha> --base-ref=<baseRef>`
3. Si el diff es significativo:
   - el workflow `Release Beta` genera un prerelease `v<version>-beta.<n>` y evidencia `notes.md` + `diff-summary.json` derivadas del diff.
   - publica un paquete simple para usuario final: `EvaluaPro-Instalador-Windows.zip` (extraer y ejecutar `EvaluaPro-Setup.exe`).
   - ejecuta un gate antivirus bloqueante (Microsoft Defender) sobre el `.zip` antes de publicar la prerelease.
4. Si el diff es solo documental o regenerable:
   - no se publica beta nueva.
5. La beta no sustituye el gate estable:
   - el gate estable sigue requiriendo el flujo humano en produccion.

## Publicacion beta manual
1. Se puede disparar `Release Beta` por `workflow_dispatch` sin depender de `main`.
2. Debes proporcionar:
   - `version`
   - `head_sha`
   - `base_ref` si quieres comparar contra una base concreta
   - `reason` para dejar trazabilidad del motivo de la beta manual
3. El criterio de publicacion sigue siendo el mismo:
   - no publica si el diff no toca superficies de release relevantes
   - publica prerelease solo si el corte merece beta
   - genera `notes.md` y `diff-summary.json` en la misma evidencia para release/body
