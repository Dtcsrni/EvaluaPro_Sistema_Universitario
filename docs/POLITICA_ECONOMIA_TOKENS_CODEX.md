# Politica Repo-Local de Economia de Tokens para Codex

Esta guia define una politica repo-local para usar Codex en VS Code con menos desperdicio de contexto.

## Alcance
- Aplica a decisiones de trabajo asistido por Codex en este repositorio.
- Cubre seleccion de modelo, nivel de reasoning, compactacion de contexto y criterio para abrir un chat nuevo.
- No forma parte del runtime del sistema, ni de los throttles del proveedor, ni de los gates de CI/CD o release.

## Seleccion de modelo
- Nivel de razonamiento alto (High reasoning) para:
  - politica, arquitectura y estrategia;
  - decisiones ambiguas;
  - definicion de contrato o guia operativa.
- Nivel de razonamiento alto enfocado en programacion (High reasoning coding) para:
  - debugging complejo;
  - trabajo multiarchivo;
  - refactors con riesgo funcional.
- Nivel de razonamiento medio (Medium reasoning) para:
  - desarrollo normal;
  - tareas acotadas con contexto suficiente;
  - iteraciones de implementacion sin ambiguedad alta.
- Nivel de razonamiento bajo (Low reasoning) para:
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
- Abrir chat nuevo cuando cambie el nivel de razonamiento o enfoque recomendado para la tarea (por ejemplo, de razonamiento avanzado a modelo economico).
- Abrir chat nuevo cuando aparezcan subproblemas no relacionados que mezclen politica, debugging y documentacion sin un bloque comun claro.
- Abrir chat nuevo cuando el contexto heredado ya no ayude a decidir y solo añada ruido.

## Apoyo local
- Selector repo-local:
  - `npm run ai:model:pick -- --task "<descripcion>" [--budget low|balanced|high] [--mode auto|coding|reasoning|cheap] [--json]`
- Prueba local del router:
  - `npm run test:ai:model-router`
- Politica repo-local de skills/MCP:
  - `docs/IA_SKILLS_MCP_POLICY.md`
- Verificador repo/global de skills/MCP:
  - `npm run ai:skills-mcp:status -- --json`

## Integracion Caveman (repo-local)
- Objetivo: reducir salida innecesaria y mejorar legibilidad operativa, sin confundir bytes
  locales con tokens facturados por un proveedor.
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
- `npm run ai:caveman:status -- --json` debe distinguir configuracion local (`repoReady`),
  plugin instalado (`ready`) y activacion efectiva (`active`). La inspeccion estatica no puede
  declarar `active=true`.
- Alcance:
  - Esta integracion no instala plugins por si misma.
  - Solo define comportamiento repo-local para sesiones en este workspace.

## Handoff multi-proveedor
- La traza JSON/Markdown documenta una sesion; `docs/handoff/handoff.schema.json` transporta
  solo el contexto minimo, estado y referencias a artefactos.
- El envelope es compacto, versionado, sanitizado, idempotente por `messageId` y no ejecuta
  comandos importados.
- A2A se reserva para interoperabilidad agente-a-agente por red; MCP para herramientas,
  recursos y datos. Ninguno sustituye la evidencia local ni autoriza efectos secundarios.
- Medir por separado bytes, tokens de entrada/salida, tokens cacheados, coste, latencia,
  preservacion semantica y tasa de reanudacion.

## Politica global (usuario Codex)
- Ubicacion: `~/.codex/config.toml` y `~/.codex/hooks.json`.
- Reglas minimas:
  - `features.codex_hooks=true`.
  - hook `SessionStart` con recordatorio de continuidad y handoff.
  - plugins prioritarios activos: GitHub, Browser, Codex Security, Superpowers, Google Drive, Cloudflare, Documents, Spreadsheets y Presentations.
  - Figma y Canva deshabilitados o no recomendados por defecto; usarlos solo por peticion explicita.
- Verificacion integral:
  - `npm run ai:skills-mcp:status -- --json`

## Regla de oro
- Si la tarea es de politica o estrategia sobre Codex, VS Code o economia de tokens, priorizar razonamiento y claridad antes que ahorro de tokens.
- Si la tarea es mecanica, priorizar la ruta mas barata que conserve exactitud.
