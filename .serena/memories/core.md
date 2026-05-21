# EvaluaPro core
- Monorepo npm workspaces. Apps principales: `apps/backend` API docente local, `apps/frontend` UI React con destinos docente/alumno, `apps/portal_alumno_cloud` portal cloud alumno read-model.
- Fuente de verdad operativa para agentes: `AGENTS.md`, `docs/IA_TRAZABILIDAD_AGENTES.md`, `docs/POLITICA_ECONOMIA_TOKENS_CODEX.md`, `.github/copilot-instructions.md`, contrato CI en `ci/`.
- Arquitectura vigente: backend docente como monolito modular; portal cloud desacoplado y no fuente primaria de escritura academica.
- Flavor `docente-local`: operacion prod local sobre `WSL2 + Docker Engine` por defecto; `Docker Desktop` solo compatibilidad. Stack minimo local: `mongo_local`, `api_docente_prod`, `web_docente_prod`.
- Para arquitectura/backend leer `mem:tech_stack` y `mem:conventions`; para cierre leer `mem:task_completion`.