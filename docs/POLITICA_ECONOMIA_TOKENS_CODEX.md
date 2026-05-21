# Politica Repo-Local de Economia de Tokens para Codex

Esta guia define una politica repo-local para usar Codex en VS Code con menos desperdicio de contexto.

## Alcance
- Aplica a decisiones de trabajo asistido por Codex en este repositorio.
- Cubre seleccion de modelo, nivel de reasoning, compactacion de contexto y criterio para abrir un chat nuevo.
- No forma parte del runtime del sistema, ni de los throttles del proveedor, ni de los gates de CI/CD o release.

## Seleccion de modelo
- `GPT-5.4` con reasoning `high` para:
  - politica, arquitectura y estrategia;
  - decisiones ambiguas;
  - definicion de contrato o guia operativa.
- `GPT-5.3-Codex` con reasoning `high` para:
  - debugging complejo;
  - trabajo multiarchivo;
  - refactors con riesgo funcional.
- `GPT-5.4-Mini` con reasoning `medium` para:
  - desarrollo normal;
  - tareas acotadas con contexto suficiente;
  - iteraciones de implementacion sin ambiguedad alta.
- `GPT-5.1-Codex-Mini` con reasoning `low` para:
  - tareas mecanicas;
  - cambios repetitivos;
  - ediciones de bajo riesgo y alta certeza.

## Compactacion de contexto
- Mantener una sola intencion activa por chat.
- Reducir contexto a:
  - objetivo inmediato;
  - archivos relevantes;
  - constraints reales;
  - evidencia necesaria para decidir.
- Cuando el hilo ya no aporte nueva informacion util, resumir lo decidido y continuar en un chat nuevo.
- Evitar arrastrar historicos largos cuando la tarea puede resolverse con un resumen breve y trazable.

## Cuanto abrir un chat nuevo
- Abrir chat nuevo cuando cambie el objetivo principal.
- Abrir chat nuevo cuando cambie el modelo recomendado entre `GPT-5.4`, `GPT-5.3-Codex`, `GPT-5.4-Mini` o `GPT-5.1-Codex-Mini`.
- Abrir chat nuevo cuando aparezcan subproblemas no relacionados que mezclen politica, debugging y documentacion sin un bloque comun claro.
- Abrir chat nuevo cuando el contexto heredado ya no ayude a decidir y solo añada ruido.

## Apoyo local
- Selector repo-local:
  - `npm run ai:model:pick -- --task "<descripcion>" [--budget low|balanced|high] [--mode auto|coding|reasoning|cheap] [--json]`
- Prueba local del router:
  - `npm run test:ai:model-router`

## Integracion Caveman (repo-local)
- Objetivo: reducir tokens de salida y mejorar legibilidad operativa en sesiones con agentes.
- Referencia oficial: [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)
- Estado en este repo:
  - `.codex/config.toml` habilita hooks de Codex.
  - `.codex/hooks.json` define activacion en inicio/reanudacion de sesion.
  - `npm run ai:caveman:status` valida que la integracion local este completa.
- Protocolo obligatorio de uso para agentes:
  - Activar Caveman al inicio de cada sesion (`$caveman`).
  - Mantener Caveman activo durante toda la sesion.
  - Si los hooks no activan Caveman (caso comun en Windows segun plataforma/configuracion), activarlo manualmente al iniciar sesion.
  - Solo desactivar Caveman temporalmente cuando el usuario lo solicite de forma explicita (`stop caveman` o `normal mode`).
- Alcance:
  - Esta integracion no instala plugins por si misma.
  - Solo define comportamiento repo-local para sesiones en este workspace.

## Integracion Serena (repo-local)
- Objetivo: reducir gasto de tokens por lectura/busqueda repetitiva usando herramientas semanticas de Serena via MCP.
- Referencia oficial: [Serena docs - Codex](https://oraios.github.io/serena/02-usage/030_clients.html#codex-cli-and-app)
- Estado en este repo:
  - `.codex/config.toml` registra `mcp_servers.serena` con `--project-from-cwd` y `--context=codex`.
  - `scripts/serena-mcp.sh` resuelve `serena` desde `PATH` o `~/.local/bin` para evitar fallos por PATH en WSL/Linux.
  - `.codex/hooks.json` agrega recordatorio al inicio para activar proyecto en Serena.
  - `npm run ai:serena:status` valida configuracion y disponibilidad del binario `serena`.
- Uso:
  - Verificar estado: `npm run ai:serena:status -- --json`
  - En sesion Codex App: pedir `Activate the current dir as project using serena`
  - Verificar conexion MCP: comando `/mcp`
  - Nota: este repo ahora incluye un conjunto recomendado de herramientas opcionales en `.serena/project.yml` para mejorar la navegación y consultas semánticas (por ejemplo `find_symbol`, `get_symbols_overview`, `read_memory`, `write_memory`).
- Nota Windows/WSL:
  - Si `serena.commandAvailable=false`, instalar Serena en el `PATH` del entorno donde corre Codex.
  - Si Codex App no inicia en el cwd del repo, activar proyecto manualmente con el prompt anterior.
- Alcance:
  - Esta integracion no instala Serena automaticamente.
  - Solo deja configuracion repo-local verificable y compatible con Codex.

### Protocolo obligatorio de uso (sin degradar calidad)
Regla: **Serena obligatorio por defecto** en tareas de codigo (explorar, leer, localizar, editar).

1. Activar proyecto al inicio:
   - Prompt recomendado: `Activate the current dir as project using serena`.
2. Consultas semanticas primero:
   - priorizar `find_symbol`, `get_symbols_overview`, `find_referencing_symbols`, `search_for_pattern`.
3. Acotar siempre el alcance:
   - usar `relative_path` especifico por modulo/archivo.
   - evitar busquedas en todo el repo salvo exploracion inicial.
4. Limitar tamaño de respuesta:
   - usar `max_answer_chars` bajo e iterar (subir solo si falta contexto).
5. Fallback a shell solo cuando Serena no alcance:
   - `rg` puntual y con globs restrictivos; no volcar archivos completos sin necesidad.
6. No repetir onboarding:
   - mantener sesiones activas por objetivo y evitar reabrir hilos sin necesidad.
7. Calidad innegociable:
   - si la respuesta compacta no basta para decidir, ampliar contexto gradualmente hasta evidencia suficiente.

## Politica global (usuario Codex)
- Ubicacion: `~/.codex/config.toml` y `~/.codex/hooks.json`.
- Reglas minimas:
  - `mcp_servers.serena` activo con `--project-from-cwd` y `--context=codex`.
  - `features.codex_hooks=true`.
  - hook `SessionStart` con recordatorio de activacion de proyecto + protocolo de acotacion.
- Verificacion integral:
  - `npm run ai:serena:policy:status -- --json`

## Regla de oro
- Si la tarea es de politica o estrategia sobre Codex, VS Code o economia de tokens, priorizar razonamiento y claridad antes que ahorro de tokens.
- Si la tarea es mecanica, priorizar la ruta mas barata que conserve exactitud.
