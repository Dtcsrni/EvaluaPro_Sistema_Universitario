# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: hub-bootstrap-visible-prompt-20261026
- parentSessionId: -
- status: final
- generatedAt: 2026-10-27T02:14:47.139Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: assistant
- channel: Codex desktop

## Solicitud
- Corregir el acceso Hub que sigue sin arrancar y renovar accesos e iconos.

## Objetivo
- Preparar un cambio revisable sobre main para el bootstrap Hub, cierre WPF y reconciliación nativa de accesos directos.

## Alcance
- packaging/app-host
- perfil docente y endpoint local de regeneración
- contratos de regresión y SPEC-094

## Restricciones
- No modificar datos de producción.
- No fusionar a main ni publicar una release.
- Conservar SHA-256 oficial y Authenticode de actualizaciones firmadas.

## Acciones
- [omitido] validation: Ejecucion de lint (2026-10-27T02:14:47.139Z)
- [omitido] validation: Ejecucion de typecheck (2026-10-27T02:14:47.139Z)
- [omitido] validation: Ejecucion de test_frontend_ci (2026-10-27T02:14:47.139Z)
- [omitido] validation: Ejecucion de test_coverage_ci (2026-10-27T02:14:47.139Z)
- [omitido] validation: Ejecucion de test_tdd_enforcement_ci (2026-10-27T02:14:47.139Z)
- [omitido] validation: Ejecucion de test_backend_ci (2026-10-27T02:14:47.139Z)
- [omitido] validation: Ejecucion de test_portal_ci (2026-10-27T02:14:47.139Z)
- [omitido] validation: Ejecucion de perf_check (2026-10-27T02:14:47.139Z)
- [falla] validation: Ejecucion de pipeline_contract_check (2026-10-27T02:14:47.139Z)
- [falla] validation: Ejecucion de docs_check (2026-10-27T02:14:47.139Z)

## Archivos leidos
- Sin lecturas registradas.

## Archivos cambiados
- apps/backend/src/modulos/modulo_autenticacion/controladorAutenticacion.ts
- apps/frontend/src/apps/app_docente/SeccionCuenta.tsx
- apps/frontend/tests/seccionCuenta.test.tsx
- docs/specs/SPEC-094_runtime_windows_nativo_sin_powershell.spec.md
- packaging/app-host/App.xaml.cs
- packaging/app-host/MainWindow.xaml.cs
- scripts/tests/app-host-health.contract.test.mjs
- docs/handoff/sesiones/2026-10-27/
- packaging/app-host/ShortcutReconciler.cs

## Validacion ejecutada
- lint: `npm run lint` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- typecheck: `npm run typecheck` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_frontend_ci: `npm run test:frontend:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_coverage_ci: `npm run test:coverage:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_tdd_enforcement_ci: `npm run test:tdd:enforcement:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_backend_ci: `npm run test:backend:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- test_portal_ci: `npm run test:portal:ci` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- perf_check: `npm run perf:check` -> omitido (exitCode=-, duracionMs=0)
  resultado: omitido por perfil quick
- pipeline_contract_check: `npm run pipeline:contract:check` -> falla (exitCode=1, duracionMs=15847)
  resultado: ✔ Stable Gate invoca el mismo guard para checkout inicial, checkpoints y guard final (37.2208ms) | ▶ el guard del checkout candidato solo permite EOL sin cambios semánticos | ✔ acepta diferencias CRLF/LF sin contenido distinto (2567.0039ms) | ✔ acepta EOL-only en JSON de evidencia fuera de la allowlist histórica (2730.9773ms) | ... | at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) | Node.js v24.18.0
- docs_check: `npm run docs:check` -> falla (exitCode=1, duracionMs=12901)
  resultado: npm notice run evaluapro@1.2.10 docs:check | npm notice run node scripts/docs.mjs --check | [docs] desactualizado: docs/AUTO_ENV.md | [docs] corre: npm run docs:generate

## Decisiones
- Permitir bootstrap por SHA-256 oficial cuando no hay Hub firmado previo; conservar Authenticode para actualización desde un Hub firmado.
- Usar instancia única del bootstrap y temporales únicos para evitar colisiones.
- Reconstruir accesos mediante Shell Link nativo y notificación SHChangeNotify.

## Supuestos
- El AppHost instalado permanece en %LOCALAPPDATA%\EvaluaPro\EvaluaPro.exe.

## Riesgos abiertos
- Falta validar UI real de Windows; pruebas de React y WCAG se bloquearon por dependencias ausentes en el worktree.
- El SHA-256 procede de la release oficial y depende de la seguridad del repositorio/distribución.

## Estado del arbol
```txt
M apps/backend/src/modulos/modulo_autenticacion/controladorAutenticacion.ts
 M apps/frontend/src/apps/app_docente/SeccionCuenta.tsx
 M apps/frontend/tests/seccionCuenta.test.tsx
 M docs/specs/SPEC-094_runtime_windows_nativo_sin_powershell.spec.md
 M packaging/app-host/App.xaml.cs
 M packaging/app-host/MainWindow.xaml.cs
 M scripts/tests/app-host-health.contract.test.mjs
?? docs/handoff/sesiones/2026-10-27/
?? packaging/app-host/ShortcutReconciler.cs
```

## Siguiente paso recomendado
- Revisar diff y gates focales, crear commit en la rama aislada y abrir PR revisable sin fusionar ni publicar release.

## Artefactos generados
- docs/handoff/sesiones/2026-10-27/hub-bootstrap-visible-prompt-20261026.json
- docs/handoff/sesiones/2026-10-27/hub-bootstrap-visible-prompt-20261026.md

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
