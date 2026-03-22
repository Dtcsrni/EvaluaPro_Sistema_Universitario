# Handoff IA - Plantilla Oficial

Esta plantilla refleja el contrato canonico de `docs/handoff/trace.schema.json`.

## Metadatos
- `traceSchemaVersion`:
- `sessionId`:
- `parentSessionId`:
- `status`: `draft|final`
- `generatedAt`:
- `validationProfile`: `quick|full`

## Agente
- `agent.name`:
- `agent.version`:
- `agent.provider`:
- `agent.kind`:
- `agent.channel`:

## Solicitud
- `request.summary`:

## Objetivo
- `objective`:

## Alcance
- `scope[]`:

## Restricciones
- `constraints[]`:

## Acciones
- `actions[]`:
  - `type`:
  - `summary`:
  - `timestamp`:
  - `status`:

## Archivos
- `files.read[]`:
- `files.changed[]`:
- `files.artifacts[]`:

## Validacion ejecutada
- `commands[]`:
  - `name`:
  - `command`:
  - `status`:
  - `exitCode`:
  - `durationMs`:
  - `resultSummary`:

## Decisiones
- `decisions[]`:

## Supuestos
- `assumptions[]`:

## Riesgos abiertos
- `risks[]`:

## Siguiente paso recomendado
- `nextStep`:
