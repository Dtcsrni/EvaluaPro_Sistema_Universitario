# AGENTS.md - Sistema EvaluaPro

Guia operativa para cualquier agente de IA que trabaje en este repositorio.

## 1) Fuente de verdad (orden de precedencia)
1. Este archivo (`AGENTS.md`).
2. `docs/IA_TRAZABILIDAD_AGENTES.md`.
3. Instrucciones de asistente IDE:
   - `.github/copilot-instructions.md`
4. Contrato CI/CD:
   - `ci/pipeline.contract.md`
   - `ci/pipeline.matrix.json`
5. Workflows:
   - `.github/workflows/ci.yml`
   - `.github/workflows/package.yml`
6. Gates de release y operacion:
   - `docs/RELEASE_GATE_STABLE.md`
   - `docs/RUNBOOK_OPERACION.md`
   - `docs/SEGURIDAD_OPERATIVA.md`
7. Baselines y versionado:
   - `docs/ENGINEERING_BASELINE.md`
   - `docs/DEVOPS_BASELINE.md`
   - `docs/VERSIONADO.md`

Si hay conflicto entre documentos, actualizar todos para alinear el estado real y dejar evidencia en `CHANGELOG.md`.

## 2) Protocolo obligatorio para agentes
1. Leer primero:
   - `README.md`
   - `docs/README.md`
   - `docs/IA_TRAZABILIDAD_AGENTES.md`
   - `.github/copilot-instructions.md`
2. No asumir estado de olas/gates sin verificar con comandos reales.
3. Mantener trazabilidad:
   - objetivo de la sesion,
   - `sessionId` y estado `draft|final`,
   - archivos tocados,
   - comandos ejecutados,
   - resultado exacto de gates,
   - decisiones, riesgos y siguiente paso.
4. Antes de continuar con una solicitud, analizar la naturaleza de la tarea y sugerir el modelo recomendado para ejecutarla.
   - En planeaciones, arquitectura y decisiones ambiguas, priorizar `GPT-5.4`.
   - En trabajo de codigo multiarchivo o debugging complejo, priorizar `GPT-5.3-Codex`.
   - En tareas mecanicas, de baja ambiguedad o con foco en ahorro de tokens, priorizar `GPT-5.4-Mini` o `GPT-5.1-Codex-Mini`.
5. No registrar prompts completos, secretos o salidas crudas extensas en handoff/documentacion.
6. No degradar calidad para "pasar rapido":
   - no bajar thresholds,
   - no excluir modulos para ocultar deuda,
   - no introducir stubs vacios.
7. Si un gate falla:
   - documentar causa exacta,
   - proponer/ejecutar correccion minima,
   - actualizar docs de estado.
8. Para mantener archivos autoexplicativos:
   - agregar/ajustar docblock de cabecera por archivo,
   - usar `npm run ia:docblocks` como apoyo y revisar manualmente los modulos criticos.
9. Si el runtime del agente no expone proveedor/modelo/version exactos:
   - usar `unknown`,
   - no inferir ni documentar valores inventados.

## 2.1) Inventario exhaustivo de instrucciones IA
1. El inventario oficial vive en:
   - `docs/IA_TRAZABILIDAD_AGENTES.md` (detalle operativo)
   - `docs/INVENTARIO_PROYECTO.md` (estado integral)
2. Para actualizar inventario, escanear solo archivos versionados del repo (excluir `node_modules`).
3. No usar instrucciones de dependencias de terceros como fuente de gobierno del proyecto.

## 3) Gates minimos antes de cerrar cambios
Ejecutar en este orden:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:frontend:ci`
4. `npm run test:coverage:ci`
5. `npm run test:tdd:enforcement:ci`
6. `npm run test:backend:ci`
7. `npm run test:portal:ci`
8. `npm run perf:check`
9. `npm run pipeline:contract:check`
9. Si el alcance toca Olas Big Bang:
   - `npm run bigbang:olas:check`
   - `npm run bigbang:olas:strict`

Si por alcance no aplica alguno, dejar justificacion explicita en el reporte de sesion.

## 4) Regla para evolucion multi-sesion
Cada sesion debe dejar actualizado:
1. `docs/INVENTARIO_PROYECTO.md` (estado de avance y brechas).
2. `docs/ENGINEERING_BASELINE.md` (metricas/gates del corte).
3. `CHANGELOG.md` (cambios concretos).
4. Reporte de handoff generado por script:
   - `npm run ia:handoff:quick`
   - salida canonica en `docs/handoff/sesiones/<YYYY-MM-DD>/` (`.json` + `.md`).
5. Inventario de codigo regenerado:
   - `npm run inventario:codigo`
   - salida en `docs/INVENTARIO_CODIGO_EXHAUSTIVO.md`.

## 5) Estado de referencia (corte actual)
Ver `docs/IA_TRAZABILIDAD_AGENTES.md` para snapshot operativo vigente.

## 6) Enforcement del contrato IA
- Validacion dedicada del contrato:
  - `npm run test:ia:traceability`
- Esta validacion forma parte de:
  - `npm run ci:policy:audit`
