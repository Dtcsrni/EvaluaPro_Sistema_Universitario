Checklist: sesión sesion-2026-03-27T09-31-40.802Z

- **Session file**: docs/handoff/sesiones/2026-03-27/sesion-2026-03-27T09-31-40.802Z.json
- **Campos a revisar/completar**:
  - agent.{name,version,provider,kind,channel}
  - request.summary / request.objective
  - decisions, risks, nextStep
  - completion fields
- **Reconciliación Git**:
  - Revisar `repo.workingTreeStatus` y `files.changed`
  - Ejecutar `git status`/`git diff` si corresponde
  - Commit / stash / revert según decisión
- **Validación**:
  - Validar JSON contra schema
  - Ejecutar pruebas de trazabilidad
- **Resultado esperado**: sesión finalizada y validada
- **Notas**: registrar identidad del agente o justificar `unknown`
