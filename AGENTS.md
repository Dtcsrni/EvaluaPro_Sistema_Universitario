# AGENTS.md - Sistema EvaluaPro

Guia operativa para cualquier agente de IA que trabaje en este repositorio.

## 1) Fuente de verdad (orden de precedencia)
1. Este archivo (`AGENTS.md`).
2. `docs/IA_TRAZABILIDAD_AGENTES.md`.
3. `docs/POLITICA_SDD.md`.
4. `docs/POLITICA_ECONOMIA_TOKENS_CODEX.md`.
5. Instrucciones de asistente IDE:
   - `.github/copilot-instructions.md`
6. Contrato CI/CD:
   - `ci/pipeline.contract.md`
   - `ci/pipeline.matrix.json`
7. Workflows:
   - `.github/workflows/ci.yml`
   - `.github/workflows/package.yml`
8. Gates de release y operacion:
   - `docs/RELEASE_GATE_STABLE.md`
   - `docs/RUNBOOK_OPERACION.md`
   - `docs/SEGURIDAD_OPERATIVA.md`
9. Baselines y versionado:
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
   - `docs/POLITICA_SDD.md`
2. No asumir estado de olas/gates sin verificar con comandos reales.
3. Mantener trazabilidad:
   - objetivo de la sesion,
   - `sessionId` y estado `draft|final`,
   - archivos tocados,
   - comandos ejecutados,
   - resultado exacto de gates,
   - decisiones, riesgos y siguiente paso.
4. Antes de continuar con una solicitud, analizar la naturaleza de la tarea y sugerir el nivel de razonamiento o enfoque recomendado para ejecutarla (por ejemplo, razonamiento alto, balanceado, rápido o económico).
   - La politica repo-local de economia de tokens para Codex en VS Code vive en `docs/POLITICA_ECONOMIA_TOKENS_CODEX.md`; aplica solo a seleccion de modelo, compactacion de contexto y apertura de chat nuevo, no al runtime ni a los gates.
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
10. Para minimizar tokens sin perder calidad:
   - usar Serena de forma predeterminada en toda tarea de exploracion/lectura/edicion de codigo,
   - activar proyecto al inicio de sesion (`Activate the current dir as project using serena`),
   - acotar consultas con `relative_path` y `max_answer_chars`,
   - usar comandos shell solo como fallback cuando Serena no cubra la necesidad.
11. Uso obligatorio de Caveman en sesiones de agentes:
   - activar Caveman al inicio de cada sesion (`$caveman`),
   - mantener Caveman activo durante toda la sesion,
   - si por plataforma no se activa via hooks, activarlo manualmente,
   - solo desactivarlo temporalmente si el usuario lo solicita de forma explicita.
12. Cumplimiento obligatorio de Spec-Driven Development (SDD) según `docs/POLITICA_SDD.md`: ningún cambio en código o pruebas se realizará sin redactar o actualizar previamente la especificación de desarrollo correspondiente en `docs/specs/*.spec.md`.

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
10. Si el alcance toca recortes estructurales u Olas Big Bang:
   - `npm run qa:clean-architecture:strict`
   - `npm run ci:policy:audit`
   - dejar evidencia del recorte en `docs/INVENTARIO_PROYECTO.md`, `docs/ENGINEERING_BASELINE.md` y `CHANGELOG.md`
   - no asumir la existencia de scripts `bigbang:olas:*` sin verificar `package.json`/`HEAD`

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
