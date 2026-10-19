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

La comparación local confirmó que `git diff --ignore-cr-at-eol` no observa cambios de contenido para esos archivos, mientras que la comparación regular sí. El guard actual confunde esa normalización heredada con una modificación de código y aborta. Quitar el guard o tolerar cualquier ruta sucia reduciría la protección contra cambios reales.

## Requisitos Funcionales

- **REQ-001:** Comprobar primero el estado regular del checkout, incluyendo cambios preparados y archivos sin seguimiento.
- **REQ-002:** Si existe suciedad inicial, permitir únicamente diferencias CR al final de línea en la lista cerrada de tres rutas indicada en Contexto; validar con `git diff --ignore-cr-at-eol` para esas rutas.
- **REQ-003:** Rechazar toda modificación semántica en esas rutas, cualquier ruta adicional modificada, cambios preparados o archivos sin seguimiento; informar las rutas observadas.
- **REQ-004:** Reutilizar una única función de comprobación durante los guardas inicial, intermedios y final para que `npm ci`, Prisma, Poppler, Playwright y E2E mantengan la misma política.
- **REQ-005:** Añadir regresiones para las diferencias EOL permitidas y para cambios semánticos, cambios fuera de la allowlist, cambios preparados y archivos sin seguimiento.
- **REQ-006:** No usar `git reset`, restauraciones amplias, retries ni aumento de timeouts. Conservar el guard estricto de checkout antes y después de QA.

## Criterios de Aceptación

- En un checkout candidato que difiera solo por CRLF/LF en los tres archivos permitidos, el guard continúa y conserva los checkpoints por etapa.
- Una alteración de contenido en cualquiera de las rutas permitidas, una modificación fuera de la lista, un cambio preparado o un archivo sin seguimiento produce fallo con diagnóstico de rutas.
- Las pruebas de contrato del workflow reproducen ambos resultados localmente antes de enviar el candidato corregido a CI.
- El nuevo SHA candidato supera dos CI completos consecutivos y CI Installer Windows; Stable Gate solo puede producir Go si vuelve a pasar todos los requisitos y la QA visual.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Aceptar solo la diferencia EOL heredada de las rutas exactas; rechazar contenido o rutas distintas | `scripts/tests/candidate-clean-guard.test.mjs` | Aprobado; implementación en curso |
| REQ-004, REQ-006 | Aplicar el mismo guard en todos los checkpoints sin restauraciones amplias | `scripts/tests/candidate-clean-guard.test.mjs` | Aprobado; implementación en curso |
| REQ-005 | Regresión de EOL, contenido, cambios preparados y archivos sin seguimiento | `scripts/tests/candidate-clean-guard.test.mjs` | Aprobado; implementación en curso |
