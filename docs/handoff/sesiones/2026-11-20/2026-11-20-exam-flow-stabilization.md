# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: 2026-11-20-exam-flow-stabilization
- parentSessionId: -
- status: final
- generatedAt: 2026-11-20T16:57:38.740Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: assistant
- channel: desktop

## Solicitud
- Estabilizar la creación de banco/exámenes y corregir los fallos detectados al adelantar CI.

## Objetivo
- Cerrar regresiones de capacidad compartida, presupuesto PDF, orden/nombre de lotes, iniciales, scopes API, trazabilidad Classroom, UI responsive y validación WCAG local contra la base del PR.

## Alcance
- Generación y descarga PDF
- Variantes reproducibles y recuperación de lotes
- Orden de padrón y nombre de grupos
- Banco responsive y recuperación de borradores
- Scopes API y trazabilidad Classroom
- Iniciales unificadas
- Guardrail WCAG y contrato de CI

## Restricciones
- Sin bump de versión
- Sin registrar secretos o credenciales
- No fusionar antes de CI verde ni sin evidencia OMR física
- Excluir auxiliar PDF temporal del commit

## Acciones
- [omitido] validation: Ejecucion de lint (2026-11-20T16:57:38.740Z)
- [omitido] validation: Ejecucion de typecheck (2026-11-20T16:57:38.740Z)
- [omitido] validation: Ejecucion de test_frontend_ci (2026-11-20T16:57:38.740Z)
- [omitido] validation: Ejecucion de test_coverage_ci (2026-11-20T16:57:38.740Z)
- [omitido] validation: Ejecucion de test_tdd_enforcement_ci (2026-11-20T16:57:38.740Z)
- [omitido] validation: Ejecucion de test_backend_ci (2026-11-20T16:57:38.740Z)
- [omitido] validation: Ejecucion de test_portal_ci (2026-11-20T16:57:38.740Z)
- [omitido] validation: Ejecucion de perf_check (2026-11-20T16:57:38.740Z)
- [ok] validation: Ejecucion de pipeline_contract_check (2026-11-20T16:57:38.740Z)
- [falla] validation: Ejecucion de docs_check (2026-11-20T16:57:38.740Z)

## Archivos leidos
- Sin lecturas registradas.

## Archivos cambiados
- .github/workflows/ci.yml
- apps/frontend/src/styles/screens.css
- apps/frontend/tests/plantillas.refactor.test.tsx
- docs/handoff/sesiones/2026-11-20/2026-11-20-exam-flow-stabilization.json
- docs/handoff/sesiones/2026-11-20/2026-11-20-exam-flow-stabilization.md
- scripts/wcag-guard.mjs
- apps/backend/tmp_pdf_visual_check.ts

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
- pipeline_contract_check: `npm run pipeline:contract:check` -> ok (exitCode=0, duracionMs=4621)
  resultado: ✔ Stable Gate invoca el mismo guard para checkout inicial, checkpoints y guard final (1.7508ms) | ▶ el guard del checkout candidato solo permite EOL sin cambios semánticos | ✔ acepta diferencias CRLF/LF sin contenido distinto (656.4703ms) | ✔ acepta EOL-only en JSON de evidencia fuera de la allowlist histórica (631.5259ms) | ... | npm notice run evaluapro@1.2.25 pipeline:contract:check | npm notice run node scripts/pipeline-contract-check.mjs
- docs_check: `npm run docs:check` -> falla (exitCode=1, duracionMs=1399)
  resultado: npm notice run evaluapro@1.2.25 docs:check | npm notice run node scripts/docs.mjs --check | [docs] desactualizado: docs/AUTO_ENV.md | [docs] corre: npm run docs:generate

## Decisiones
- Shared conserva el orden de opciones y ajusta selección/conteo por alumno con semilla estable.
- Parcial fija 2 páginas y global 4; la UI no edita el presupuesto y el renderer rechaza overflow.
- WCAG audita el diff desde el merge-base real del PR y el árbol de trabajo; se elimina el fetch del snapshot histórico.

## Supuestos
- Los tests de integración usan loopback; EACCES inicial era restricción del sandbox y pasaron al ejecutar localmente con autorización.

## Riesgos abiertos
- El corpus piloto OMR real está vacío; el corpus sintético local pasó.
- El SHA 53629d2 tuvo fallo frontend por comparar contra snapshot WCAG histórico; la corrección pasó localmente, pero falta repetir CI en un SHA nuevo.
- No se ejecutó backend/portal/coverage CI completo.

## Estado del arbol
```txt
M .github/workflows/ci.yml
 M apps/frontend/src/styles/screens.css
 M apps/frontend/tests/plantillas.refactor.test.tsx
 M docs/handoff/sesiones/2026-11-20/2026-11-20-exam-flow-stabilization.json
 M docs/handoff/sesiones/2026-11-20/2026-11-20-exam-flow-stabilization.md
 M scripts/wcag-guard.mjs
?? apps/backend/tmp_pdf_visual_check.ts
```

## Siguiente paso recomendado
- Crear commit de la corrección del guardrail y las expectativas UI; publicar en la rama del PR #326 y validar el nuevo CI. No fusionar hasta gates verdes y capturas OMR físicas representativas.

## Artefactos generados
- docs/handoff/sesiones/2026-11-20/2026-11-20-exam-flow-stabilization.json
- docs/handoff/sesiones/2026-11-20/2026-11-20-exam-flow-stabilization.md

## Completitud semantica
- isComplete: true
- Sin pendientes semanticos.
