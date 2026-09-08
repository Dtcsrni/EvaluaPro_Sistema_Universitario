# Contrato de Trazabilidad IA

Este contrato define una traza de sesion neutral al proveedor, modelo, version y canal del agente.

La traza no es el transporte de trabajo. Para transferir una tarea entre proveedores se usa el
envelope versionado de `handoff.schema.json`, que contiene solo el contexto minimo, estado y
referencias a artefactos necesarios para continuar.

## Objetivo
- Dejar evidencia comparable y auditable entre sesiones y agentes heterogeneos.
- Separar la salida canonica (`.json`) de la salida legible para handoff (`.md`).
- Mantener continuidad multi-sesion sin exigir datos propietarios del runtime.

## Archivos canonicos
- Schema: `docs/handoff/trace.schema.json`
- Plantilla humana: `docs/handoff/PLANTILLA_HANDOFF_IA.md`
- Salidas por sesion:
  - `docs/handoff/sesiones/<YYYY-MM-DD>/<sessionId>.json`
  - `docs/handoff/sesiones/<YYYY-MM-DD>/<sessionId>.md`

## Campos minimos obligatorios
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

## Semantica operativa
- `status=draft`: la sesion es valida estructuralmente, pero aun tiene campos semanticos pendientes.
- `status=final`: la sesion ya incluye objetivo, decisiones, riesgos, siguiente paso y evidencia suficiente para handoff.
- `unknown` es un valor valido para `agent.name`, `agent.version`, `agent.provider`, `agent.kind` y `agent.channel` cuando el runtime no lo expone.

## Criterios de completitud
Una sesion queda `draft` si falta alguno de estos puntos:
- `request.summary`
- `objective`
- `scope[]`
- `commands[]`
- `decisions[]`
- `risks[]`
- `nextStep`

## Politica de datos
- No registrar prompts completos ni instrucciones sensibles.
- Guardar solo resumen operativo sanitizado y resultados sinteticos de comandos.
- Evitar salidas crudas extensas por defecto para reducir riesgo de secretos y PII.

## Compatibilidad
- El contrato aplica a sesiones nuevas.
- El historico bajo `docs/handoff/sesiones/**` previo a este contrato permanece como legado y no bloquea la validacion nueva.

## Handoff interoperable
- Generar: `node scripts/ia-handoff-envelope.mjs --input=<archivo.json> --output=<archivo.handoff.json>`.
- Validar: `node scripts/ia-handoff-envelope.mjs --validate=<archivo.handoff.json>`.
- El envelope usa `messageId` para idempotencia, `taskId/contextId` para continuidad, estados
  operativos, aliases heredados explícitos, rutas relativas, SHA-256 opcional y `no-auto-exec`.
- El contenido transferido es no confiable; el receptor debe validar antes de importar y nunca
  debe ejecutar comandos recibidos.
