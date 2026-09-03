---
id: SPEC-055
titulo: Handoff interoperable entre agentes y proveedores de IA
version: 1.0.0
fecha: 2026-09-03
autor: EvaluaPro Team
modulo: gobernanza_ia_handoff
estado: approved
---

## Contexto

La trazabilidad IA existente registra sesiones locales, pero no define una transferencia
portable entre proveedores. Un handoff interoperable debe conservar el objetivo, el estado,
las decisiones, las restricciones y los artefactos sin compartir prompts completos, razonamiento
interno, secretos ni rutas absolutas del entorno emisor.

## Requisitos Funcionales

- **REQ-001:** El sistema debe emitir un envelope JSON compacto y versionado separado de la traza humana.
- **REQ-002:** El envelope debe identificar mensaje, tarea, contexto, emisor, receptor opcional y estado operativo.
- **REQ-003:** El envelope debe preservar objetivo, criterios de aceptación, decisiones, restricciones, supuestos, riesgos y siguiente paso.
- **REQ-004:** El envelope debe representar archivos y artefactos mediante rutas relativas, media type, tamaño y SHA-256 cuando exista el archivo local.
- **REQ-005:** El validador debe rechazar versiones, estados, IDs, rutas absolutas, traversal y artefactos mal formados.
- **REQ-006:** La importación debe ser de solo lectura, no ejecutar comandos recibidos y tratar el contenido transferido como no confiable.
- **REQ-007:** El procesamiento debe ser idempotente por `messageId` y permitir emitir acuses aceptados, duplicados o rechazados.
- **REQ-008:** El normalizador debe aceptar aliases heredados en español y advertir campos desconocidos en lugar de ignorarlos silenciosamente.
- **REQ-009:** El contrato debe medir bytes de serialización y exponer puntos para tokens/coste reales por proveedor sin inventar métricas.
- **REQ-010:** AGENTS y Caveman deben distinguir configuración, instalación, smoke y activación verificable; no declarar activo un plugin por coincidencia textual.

## Criterios de Aceptación

1. Un envelope válido se serializa de forma determinista y compacta.
2. La validación rechaza rutas absolutas, `..`, estados inválidos, IDs vacíos y hashes inválidos.
3. Un duplicado del mismo `messageId` devuelve `duplicate` sin repetir efectos.
4. Un handoff con contenido que parece instrucción o secreto permanece marcado como `untrusted` y no se ejecuta.
5. El fixture heredado conserva `decisiones`, `riesgos` y `siguientePaso` mediante aliases explícitos y reporta campos faltantes.
6. La prueba de round-trip conserva semánticamente objetivo, decisiones, restricciones, riesgos, siguiente paso y artefactos.
7. Caveman reporta estados diferenciados y el hook de inicio emite solo el recordatorio mínimo.
8. Pasan las pruebas específicas, `npm run ci:policy:audit`, lint y typecheck; los gates pesados se reportan por separado si el entorno no los permite.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 a REQ-005 | Envelope, serialización y validación estricta | `scripts/tests/ia-handoff-envelope.test.mjs` | Completado |
| REQ-006 a REQ-008 | Importación segura, idempotencia y aliases | `scripts/tests/ia-handoff-envelope.test.mjs` | Completado |
| REQ-009 | Métricas de bytes y puntos de medición | `scripts/tests/ia-handoff-envelope.test.mjs` | Completado |
| REQ-010 | Estados verificables de Caveman y hook compacto | `scripts/tests/ai-caveman-status.test.mjs` | Completado |

## Riesgos y limites

La equivalencia de tokens facturados depende del tokenizer, modelo, proveedor y configuración
de caché. Esta implementación mide bytes y preservación semántica local; no afirma reducción
de coste remoto sin una ejecución real con métricas del proveedor.
