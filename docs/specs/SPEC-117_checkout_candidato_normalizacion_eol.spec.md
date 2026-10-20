---
id: SPEC-117
titulo: Validación exacta del checkout candidato con finales de línea heredados
version: 1.0.0
fecha: 2026-10-18
autor: Codex
modulo: release_stable_gate
estado: approved
---

> Agrupada para ejecución y trazabilidad de release en [SPEC-122](SPEC-122_estabilizacion_release_1_2_8.spec.md). Se conserva esta aprobación y el detalle específico del incidente EOL.

## Contexto

Stable Gate #97 (run `39161862364`) se detuvo antes de preparar QA. El checkout del SHA candidato estaba limpio en GitHub, pero tres archivos versionados se marcaron como modificados por diferencias CRLF/LF al final del archivo:

- `docs/specs/SPEC-109_aislamiento_regeneracion_examen_en_cobertura.spec.md`
- `scripts/testing/run-backend-coverage-batches.mjs`
- `scripts/tests/backend-coverage-batches.test.mjs`

La comparación local confirmó que `git diff --ignore-cr-at-eol` no observa cambios de contenido para esos archivos, mientras que la comparación regular sí. Durante la sincronización del candidato 1.2.8 también se detectó el mismo fenómeno en los JSON de evidencia de release, porque el blob histórico conserva CRLF aunque `.gitattributes` define LF. El guard debe distinguir diferencias puramente EOL en cualquier ruta rastreada de cambios reales; no debe permitir archivos sin seguimiento, cambios preparados ni diferencias semánticas.

## Requisitos Funcionales

- **REQ-001:** Comprobar primero el estado regular del checkout, incluyendo cambios preparados y archivos sin seguimiento.
- **REQ-002:** Si existe suciedad inicial, permitir diferencias exclusivamente CR al final de línea en cualquier archivo rastreado con modificación no preparada; validar con `git diff --ignore-cr-at-eol` para cada ruta.
- **REQ-003:** Rechazar toda modificación semántica, cambios de tipo/modo, cambios preparados y archivos sin seguimiento; informar las rutas observadas.
- **REQ-004:** Reutilizar una única función de comprobación durante los guardas inicial, intermedios y final para que `npm ci`, Prisma, Poppler, Playwright y E2E mantengan la misma política.
- **REQ-005:** Añadir regresiones para diferencias EOL en una ruta histórica y en otra ruta no allowlisted, además de cambios semánticos, cambios preparados y archivos sin seguimiento.
- **REQ-006:** No usar `git reset`, restauraciones amplias, retries ni aumento de timeouts. Conservar el guard estricto de checkout antes y después de QA.
- **REQ-007:** Calcular `workingTreeClean` y `dirtyPathCount` del manifiesto QA con la misma regla semántica: EOL-only unstaged no cuenta como fuente sucia; cambios staged, contenido distinto y archivos sin seguimiento sí cuentan.

## Criterios de Aceptación

- En un checkout candidato con diferencias solo CRLF/LF en archivos rastreados, incluido JSON de evidencia, el guard continúa y conserva los checkpoints por etapa.
- Una alteración de contenido, un cambio de tipo/modo, un cambio preparado o un archivo sin seguimiento produce fallo con diagnóstico de rutas.
- El manifiesto QA reporta árbol limpio ante EOL-only unstaged y reporta suciedad ante cambios staged, sin seguimiento o semánticos.
- Las pruebas de contrato del workflow reproducen ambos resultados localmente antes de enviar el candidato corregido a CI.
- El nuevo SHA candidato supera dos CI completos consecutivos y CI Installer Windows; Stable Gate solo puede producir Go si vuelve a pasar todos los requisitos y la QA visual.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Aceptar solo diferencias EOL sin cambio semántico en rutas rastreadas; rechazar cambios de contenido, staged y no rastreados | `scripts/tests/candidate-clean-guard.test.mjs` | Aprobado; implementación en curso |
| REQ-004, REQ-006 | Aplicar el mismo guard en todos los checkpoints sin restauraciones amplias | `scripts/tests/candidate-clean-guard.test.mjs` | Aprobado; implementación en curso |
| REQ-005 | Regresión de EOL, contenido, cambios preparados y archivos sin seguimiento | `scripts/tests/candidate-clean-guard.test.mjs` | Aprobado; implementación en curso |
| REQ-007 | Conteo semántico del árbol fuente en el manifiesto QA | `scripts/tests/release-stable-promotion.test.mjs` | Aprobado; implementación en curso |
