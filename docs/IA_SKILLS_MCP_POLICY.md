# Politica de Skills y MCP para EvaluaPro

Guia operativa para seleccionar skills, plugins y MCP en sesiones de agentes sobre EvaluaPro.

## Objetivo
- Priorizar herramientas que aporten evidencia o accion directa sobre el repo.
- Reducir ruido de conectores no necesarios.
- Mantener trazabilidad para que otro agente retome sin reinterpretar prioridades.

## Matriz obligatoria
Usar por defecto en sesiones tecnicas:

- `Serena`: lectura, busqueda y edicion semantica de codigo. Activar proyecto antes de leer o editar.
- `Caveman`: salida breve y operativa salvo excepcion explicita del usuario.
- `GitHub`: repos remotos, PRs, issues, ramas, commits, diffs, CI y checks.
- `Codex Security`: cambios o revisiones de auth, PII, cumplimiento, secretos, CI/CD, release, instaladores y superficies expuestas.
- `Browser`: verificacion local de frontend, portal, dashboard, UI responsive, screenshots y flujos localhost.
- `Superpowers`: debugging sistematico, TDD, planes multiarchivo, revision y verificacion antes de cierre.

## Matriz condicional
Usar solo cuando el alcance lo pida:

- `Google Drive`, `Google Docs`, `Google Sheets`, `Google Slides`: referencias externas explicitas, documentos compartidos o entregables conectados.
- `Documents`, `Spreadsheets`, `Presentations`: artefactos locales `.docx`, `.xlsx`, `.pptx` o entregables equivalentes.
- `Cloudflare`: portal cloud, Workers, Pages, D1/KV/R2, deploy o configuracion Cloudflare.
- `OpenAI Docs`: uso de OpenAI API, Codex, modelos, tools o documentacion oficial actualizada.
- `Gmail` y `Google Calendar`: solo con peticion explicita; no enviar, borrar ni modificar sin confirmacion clara.

## Excluidos por defecto
- `Figma`: no usar por defecto. Si el usuario lo pide explicitamente, usarlo solo para diseño UI, tokens, componentes o archivos Figma.
- `Canva`: no usar por defecto. Si el usuario lo pide explicitamente, usarlo solo para material comercial, social, presentaciones o traduccion de diseños Canva.

## Alternativa UI gratuita
- `Excalidraw` queda como alternativa gratuita principal para bocetos, diagramas de flujo y wireframes rapidos.
- La fuente implementable de UI sigue siendo repo-local:
  - `docs/DESIGN.md`
  - `docs/UX_QUALITY_CRITERIA.md`
  - componentes reales en codigo
  - matriz GUI y Playwright
  - screenshots/evidencia generada por gates
- Para componentes UI no crear una dependencia externa nueva: documentar el boceto con Excalidraw y bajar la decision a componentes versionados + pruebas visuales.

## Reglas por tipo de tarea
- Debugging: Serena primero; si hay fallo, reproducir con comando real; usar Superpowers systematic debugging cuando el fallo no sea trivial.
- PR/CI/remoto: GitHub primero; usar `gh-fix-ci` si el bloqueo vive en GitHub Actions.
- Seguridad/compliance: Codex Security primero; no exponer secretos ni PII; validar diff o ruta afectada.
- Frontend/UI: Browser + Playwright; Excalidraw solo para boceto; aceptar cambios con docs UX y evidencia visual.
- Docs/handoff: actualizar `docs/INVENTARIO_PROYECTO.md`, `docs/ENGINEERING_BASELINE.md`, `CHANGELOG.md` y handoff si el alcance lo exige.
- Release/Installer Hub: leer `docs/INSTALLER_HUB.md`, `docs/DESIGN.md`, `scripts/tests/installer-hub-e2e-docente.ps1` y contrato Hub antes de tocar scripts o docs.

## Verificacion
- Estado repo/global:
  - `npm run ai:skills-mcp:status -- --json`
- Serena:
  - `npm run ai:serena:policy:status -- --json`
- Caveman:
  - `npm run ai:caveman:status -- --json`

## Checklist retomable
- `[x]` Serena/Caveman integrados en repo y global.
- `[x]` Politica skills/MCP versionada.
- `[x]` Excalidraw definido como alternativa gratuita por defecto para bocetos.
- `[x]` Figma/Canva excluidos por defecto.
- `[ ]` En cada sesion futura, ejecutar el verificador si se cambia configuracion Codex o plugins globales.
