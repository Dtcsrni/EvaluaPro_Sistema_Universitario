---
id: SPEC-069
titulo: Benchmark reproducible de concurrencia para lotes backend
version: 1.0.0
fecha: 2026-09-27
autor: Codex
modulo: testing_backend
estado: implemented
---

## Contexto

Los runners del backend aceptan concurrencia acotada, pero se requiere evidencia
medida para comparar límites sin confundir aceleración con contención ni ocultar
fallos mediante reintentos. El benchmark debe permitir escoger una muestra de
lotes y ejecutar la misma selección con distintos niveles de concurrencia.

## Requisitos Funcionales

- REQ-001: Exigir selección explícita de lotes y niveles de concurrencia entre 1 y 4.
- REQ-002: Repetir cada nivel en orden equilibrado y usar los mismos lotes; cada
  lote se ejecuta una sola vez por ronda, sin reintentos.
- REQ-003: Registrar duración, código de salida, concurrencia, entorno básico y
  rutas únicas de log/cobertura para cada ejecución.
- REQ-004: No fusionar cobertura parcial ni cambiar el umbral de cobertura; el
  benchmark solo compara tiempo y conserva estado de aprobación/fallo.
- REQ-005: Validar argumentos inválidos antes de lanzar procesos y emitir un
  informe JSON con resultados por ejecución y resumen por concurrencia.
- REQ-006: Seleccionar concurrencia predeterminada 3 solo con al menos 12 GiB de
  memoria y 4 CPU lógicas disponibles; en equipos menores conservar 2. Un override
  explícito válido sigue teniendo precedencia.

## Criterios de Aceptación

- Con igual muestra/repeticiones, todos los niveles ejecutan exactamente la misma
  selección de lotes.
- Fallos quedan registrados y no se reintentan ni se presentan como éxito.
- Logs y artefactos no colisionan entre niveles ni repeticiones.
- El informe separa duración observada y estado; no promueve automáticamente una
  concurrencia desde las mediciones del benchmark.
- El runner usa el nivel 3 únicamente cuando se satisfacen ambos umbrales de
  recursos; el override de entorno y el límite máximo permanecen validados.

## Ejecución

`npm run benchmark:backend:concurrency -- --batches=backend-root-05,backend-root-08,backend-root-14,backend-root-23 --concurrency=2,3 --repeats=2`

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Valida concurrencia y lotes explícitos | `scripts/tests/backend-concurrency-benchmark.test.mjs` | Implementado |
| REQ-002 | Equilibra orden y repite sin reintentos | `scripts/tests/backend-concurrency-benchmark.test.mjs` | Implementado |
| REQ-003 | Aísla salidas y resume mediciones | `scripts/tests/backend-concurrency-benchmark.test.mjs` | Implementado |
| REQ-004 | No fusiona cobertura ni oculta fallos | `scripts/tests/backend-concurrency-benchmark.test.mjs` | Implementado |
| REQ-005 | Escribe reporte comparable | `scripts/tests/backend-concurrency-benchmark.test.mjs` | Implementado |
| REQ-006 | Default acotado por memoria/CPU y override | `scripts/tests/backend-test-batches.test.mjs` | Implementado |
