# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: ci-modular-coverage-01a0f1b5-90bd-7121-91d0-2e8ce4267547
- parentSessionId: -
- status: draft
- generatedAt: 2026-10-09T02:26:15.862Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: agente-ia
- channel: Codex desktop

## Solicitud
- Eliminar el umbral arbitrario de diff coverage y hacer que CI seleccione pruebas afectadas por módulo, evitando la cobertura instrumentada repetida de 34 minutos.

## Objetivo
- Actualizar CI y la política de pruebas para que los PR validen cambios mediante pruebas relacionadas y reserven cobertura integral para una ejecución completa explícita.

## Alcance
- Selección incremental de tests backend, frontend y portal
- Cobertura como diagnóstico sin umbral global por defecto
- Contrato CI y documentación

## Restricciones
- Mantener docente-local como único flavor activo.
- No declarar release completa mientras los checks remotos sigan pendientes.
- No interpretar la ausencia local de node_modules como fallo funcional del código.

## Acciones
- [ok] ci-policy: Eliminé el gate porcentual 90%; diff coverage quedó diagnóstico y cobertura completa se ejecuta solo con force_full_ci. (2026-10-09T02:26:15.862Z)
- [ok] incremental-tests: Backend, frontend y portal usan selección Vitest --changed cuando el diff toca sus fuentes o pruebas; cambios de dependencias/configuración caen a suite completa. (2026-10-09T02:26:15.862Z)
- [pending] remote-ci: CI Checks, CodeQL, Installer Windows y workflows de módulos iniciados para el commit 9281c40a. (2026-10-09T02:26:15.862Z)
- [ok] ci-failure-fixes: Corregí el contrato obsoleto de descarga de base y el parámetro sin uso que bloqueó lint backend; 13 pruebas focales pasan. (2026-10-09T02:29:00Z)

## Archivos leidos
- AGENTS.md
- docs/specs/ci_cd_integrity.spec.md
- scripts/testing/run-backend-test-batches.mjs
- scripts/testing/run-module-coverage.mjs
- .github/workflows/ci.yml

## Archivos cambiados
- .github/workflows/ci.yml
- scripts/testing/run-backend-test-batches.mjs
- scripts/testing/check-diff-coverage.mjs
- scripts/tests/ci-workflow-contract.test.mjs
- scripts/tests/backend-test-batches.test.mjs
- apps/backend/tests/archivoTemporalOmr.test.ts
- scripts/tests/security-workflow-policy.test.mjs
- docs/specs/ci_cd_integrity.spec.md
- docs/PRUEBAS.md
- docs/QA_GATE_CRITERIA.md
- docs/handoff/sesiones/2026-10-08/ci-modular-coverage-01a0f1b5-90bd-7121-91d0-2e8ce4267547.json
- docs/handoff/sesiones/2026-10-08/ci-modular-coverage-01a0f1b5-90bd-7121-91d0-2e8ce4267547.md

## Validacion ejecutada
- backend runner tests: `node --test scripts/tests/backend-test-batches.test.mjs` -> ok (exitCode=0, duracionMs=150)
  resultado: 8/8 pruebas pasaron.
- CI modular coverage contract: `node --test --test-name-pattern="diff coverage no impone|CI selecciona pruebas afectadas" scripts/tests/ci-workflow-contract.test.mjs` -> ok (exitCode=0, duracionMs=105)
  resultado: 2/2 contratos relevantes pasaron.
- CI contracts full local: `node --test scripts/tests/ci-workflow-contract.test.mjs` -> falla (exitCode=1, duracionMs=153)
  resultado: 36/37 pasaron; el único fallo local fue MODULE_NOT_FOUND: proxy-addr, porque este checkout no tiene node_modules.
- syntax and whitespace: `node --check scripts/testing/run-backend-test-batches.mjs; node --check scripts/testing/check-diff-coverage.mjs; node --check scripts/tests/backend-test-batches.test.mjs; node --check scripts/tests/ci-workflow-contract.test.mjs; git diff --check` -> ok (exitCode=0, duracionMs=1900)
  resultado: Sintaxis y diff whitespace limpios.
- push PR branch: `git push origin security/fix-codeql-v126` -> ok (exitCode=0, duracionMs=3300)
  resultado: Push exitoso; PR #130 actualizado al SHA 9281c40aed4a537fc8aaeaf476b6bc200395b214.
- pipeline workflow contract: `npm run pipeline:contract:check` -> falla (exitCode=1, duracionMs=3682)
  resultado: 36/37 contratos; el fallo local es el mismo MODULE_NOT_FOUND: proxy-addr por dependencias no instaladas.
- targeted tests after remote CI failures: `node --test scripts/tests/security-workflow-policy.test.mjs scripts/tests/backend-test-batches.test.mjs` -> ok (exitCode=0)
  resultado: 13/13 pasaron; incluye el nuevo contrato CI modular y los 8 tests del runner backend.
- combined local contracts: `node --test scripts/tests/security-workflow-policy.test.mjs scripts/tests/backend-test-batches.test.mjs scripts/tests/ci-workflow-contract.test.mjs` -> parcial (exitCode=1)
  resultado: 50/51 pasaron; único fallo `MODULE_NOT_FOUND: proxy-addr` por dependencias ausentes en el clon.
- whitespace: `git diff --check` -> ok (exitCode=0)
  resultado: diff sin errores de whitespace.

## Decisiones
- Usar Vitest --changed para seleccionar archivos de prueba relacionados con el cambio mediante dependencias estáticas.
- Fallback a suite completa cuando no hay cambios modulares comprobables; Vitest también fuerza suite completa ante cambios de package.json/configuración.
- Quitar la cobertura instrumentada de PR y de la corrida nocturna para no duplicar ejecución; conservarla con dispatch force_full_ci.

## Supuestos
- El contrato de PR ejecutará npm ci y por ello tendrá las dependencias requeridas, incluida proxy-addr.
- Los workflows remotos iniciados validarán la semántica de --changed en el entorno GitHub.

## Riesgos abiertos
- Vitest no está instalado en el clon local; la ejecución funcional TypeScript depende de CI remoto.
- CI debe repetirse sobre el commit que contiene las correcciones de lint y contrato; PR #130 no está listo para merge ni release.

## Estado del arbol
```txt
?? docs/handoff/sesiones/2026-10-08/ci-modular-coverage-01a0f1b5-90bd-7121-91d0-2e8ce4267547.json; ?? docs/handoff/sesiones/2026-10-08/ci-modular-coverage-01a0f1b5-90bd-7121-91d0-2e8ce4267547.md
```

## Siguiente paso recomendado
- Subir las correcciones, revisar los checks nuevos y luego continuar merge de PRs y verificar la release pública v1.2.6 con E2E completa.

## Artefactos generados
- https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/pull/130
- 9281c40aed4a537fc8aaeaf476b6bc200395b214

## Completitud semantica
- isComplete: false
- CI remota terminal
- merge y release pública verificada
