# Trazabilidad IA del Proyecto

Fecha de corte: 2026-03-22
Objetivo: continuidad verificable entre agentes heterogeneos con evidencia reproducible, comparable y sanitizada.

## 1) Fuentes de verdad para agentes
1. `AGENTS.md`
2. `docs/IA_TRAZABILIDAD_AGENTES.md`
3. `docs/POLITICA_SDD.md`
4. `.github/copilot-instructions.md`
5. `ci/pipeline.contract.md`
6. `ci/pipeline.matrix.json`
7. `.github/workflows/ci.yml`
8. `docs/INVENTARIO_PROYECTO.md`
9. `docs/ENGINEERING_BASELINE.md`
10. `docs/RELEASE_GATE_STABLE.md`
11. `CHANGELOG.md`

## 2) Contrato canonico de trazabilidad
- Schema machine-readable: `docs/handoff/trace.schema.json`
- Guia corta de uso: `docs/handoff/CONTRATO_TRAZABILIDAD_IA.md`
- Plantilla humana: `docs/handoff/PLANTILLA_HANDOFF_IA.md`
- Generador oficial:
  - `npm run ia:handoff:quick`
  - `npm run ia:handoff:full`
- Salidas oficiales por sesion:
  - `docs/handoff/sesiones/<YYYY-MM-DD>/<sessionId>.json`
  - `docs/handoff/sesiones/<YYYY-MM-DD>/<sessionId>.md`

## 3) Reglas normativas del contrato
1. La salida canonica es el JSON; el Markdown es un render humano del mismo contrato.
2. El contrato es agnostico a proveedor, modelo, version y canal de ejecucion.
3. Si el runtime no expone identidad tecnica exacta del agente, usar `unknown`; no inventar valores.
4. Si la sesion trata sobre seleccion de modelo, compactacion de contexto o apertura de chat nuevo para Codex en VS Code, consultar `docs/POLITICA_ECONOMIA_TOKENS_CODEX.md`; esa politica es repo-local y no forma parte del contrato del sistema ni de los gates.
4.1. En sesiones de agentes en este repo, Caveman es obligatorio como modo operativo por defecto; debe activarse al inicio de sesion y mantenerse activo salvo peticion explicita del usuario.
5. Toda sesion nueva debe incluir como minimo:
   - `traceSchemaVersion`
   - `sessionId`
   - `status`
   - `generatedAt`
   - `validationProfile`
   - `agent.{name,version,provider,kind,channel}`
   - `request.summary`
   - `objective`
   - `scope[]`
   - `constraints[]`
   - `actions[]`
   - `files.{read,changed,artifacts}`
   - `commands[]`
   - `decisions[]`
   - `assumptions[]`
   - `risks[]`
   - `nextStep`
5. `status=draft` es valido estructuralmente, pero indica campos semanticos pendientes.
6. `status=final` solo aplica cuando la sesion ya puede ser retomada por otro agente sin decisiones importantes faltantes.

## 4) Politica de datos y sanitizacion
1. No guardar prompts completos ni instrucciones sensibles.
2. No volcar stdout/stderr crudo extenso por defecto; registrar solo resumen operativo.
3. No registrar secretos, tokens, PII ni credenciales.
4. La trazabilidad debe priorizar:
   - objetivo de sesion,
   - decisiones tomadas,
   - archivos implicados,
   - comandos ejecutados,
   - resultado exacto de gates,
   - riesgos abiertos,
   - siguiente paso recomendado.

## 5) Reglas operativas de ejecucion
1. Leer primero:
   - `README.md`
   - `docs/README.md`
   - `docs/IA_TRAZABILIDAD_AGENTES.md`
   - `.github/copilot-instructions.md`
   - `docs/POLITICA_SDD.md`
1.1. Activar Caveman al inicio de la sesion (`$caveman`) y mantenerlo activo durante la ejecucion del trabajo, salvo excepcion explicita del usuario.
2. Verificar estado real antes de editar; no asumir olas, gates o release.
2.1. Si la sesion toca runtime local/launcher/instalador, verificar por CLI:
   - `docker version`
   - `docker context ls`
   - `wsl --status`
   - `wsl -l -v`
   No asumir Docker Desktop ni WSL2 listos sin evidencia.
3. No reducir umbrales ni ocultar deuda para forzar verde.
4. Cerrar cambios con handoff oficial y evidencia reproducible.
5. Si se toca el contrato de trazabilidad IA, ejecutar:
   - `npm run test:ia:traceability`
   - `npm run ci:policy:audit`
6. Cumplir estrictamente con la política de Spec-Driven Development (SDD). Verificar que toda especificación en `docs/specs/*.spec.md` sea válida ejecutando:
   - `npm run sdd:audit`

## 6) Validacion y enforcement
- Validacion dedicada del contrato IA:
  - `npm run test:ia:traceability`
- Auditoria consolidada de politicas:
  - `npm run ci:policy:audit`
- Politica de legado:
  - el historico previo en `docs/handoff/sesiones/**` basado solo en Markdown queda como legado
  - no bloquea la validacion nueva mientras no se convierta al contrato JSON canonico

## 7) Matriz minima de cierre de cambios
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:frontend:ci`
4. `npm run test:coverage:ci`
5. `npm run test:tdd:enforcement:ci`
6. `npm run test:backend:ci`
7. `npm run test:portal:ci`
8. `npm run perf:check`
9. `npm run pipeline:contract:check`

## 8) Snapshot operativo vigente
- Version tecnica objetivo: `1.0.0`
- Version visible objetivo: `1.0.0b`
- API activa: `/api/*`
- Sync activo: schema v2 + fingerprint `sync-v2-lww-updatedAt-schema2`
- Gate de arquitectura limpia activo en CI
