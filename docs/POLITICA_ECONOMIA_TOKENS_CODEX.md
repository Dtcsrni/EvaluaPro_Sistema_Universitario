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

## Regla de oro
- Si la tarea es de politica o estrategia sobre Codex, VS Code o economia de tokens, priorizar razonamiento y claridad antes que ahorro de tokens.
- Si la tarea es mecanica, priorizar la ruta mas barata que conserve exactitud.
