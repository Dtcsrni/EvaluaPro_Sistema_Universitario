---
id: SPEC-112
titulo: Rasterizado confiable de previsualizacion PDF
version: 1.0.0
fecha: 2026-10-16
autor: Codex
modulo: modulo_generacion_pdf
estado: draft
---

## Contexto

El gate estable de EvaluaPro 1.2.8 ejecutó las pruebas de GUI y falló en `tests/gui-responsive/banco-reactivos.spec.ts`: la solicitud de previsualización visual PDF excedió el timeout de API de 20 s. En la misma ejecución, otra solicitud de la misma ruta respondió en 1.548 s; en un CI completo anterior el endpoint respondió en 1.885 s. El servidor no registró el cierre de la solicitud que expiró.

El código actual intenta Poppler, luego Sharp y finalmente Chromium, pero el proceso Poppler invocado mediante `execFile` no declara un timeout. El log disponible no identifica la etapa que ocupó la solicitud. La falla debe investigarse con medición por etapa y corregirse en la etapa demostrada, conservando el contrato HTTP y los límites del gate. No se elevará el timeout de 20 s ni se aceptarán reintentos como evidencia de estabilidad.

## Requisitos Funcionales

- **REQ-001:** El rasterizado registrará duración, resultado y alternativa usada para cada etapa, sin registrar contenido de exámenes, nombres, tokens ni bytes del PDF.
- **REQ-002:** La implementación tendrá un límite de tiempo y limpieza verificables para cada proceso externo que pueda quedar bloqueado. Al expirar, terminará el proceso, limpiará sus archivos temporales y avanzará a un fallback solo si el presupuesto global todavía permite responder dentro del timeout API de 20 s.
- **REQ-003:** La investigación seleccionará la corrección según evidencia de la etapa bloqueante. No se cambiará la calidad/DPI, número de páginas, contrato del endpoint ni timeout API para hacer pasar la prueba.
- **REQ-004:** Solicitudes concurrentes de previsualización conservarán respuestas PDF/raster válidas y no dejarán procesos ni archivos temporales huérfanos. Si se aplica coalescencia de trabajo o límite de concurrencia, las llamadas concurrentes deberán mantener el mismo resultado observable.
- **REQ-005:** El E2E del banco comprobará respuesta dentro del límite actual, integridad del PDF y metadatos de páginas. El recorrido GUI seguirá capturando y validando la pantalla del banco con aserciones UX/UI de la SPEC-102; no habrá reintentos automáticos.
- **REQ-006:** Se mantendrán los fallbacks compatibles para entornos Windows/Linux y se validará el comportamiento cuando cada rasterizador externo esté ausente, falle o exceda su límite.

## Criterios de Aceptación

- La etapa causante del timeout queda identificada mediante evidencia reproducible y el arreglo corresponde a esa causa.
- El endpoint visual PDF responde en menos de 20 s en el caso de banco de reactivos del gate, con código 200, PDF legible por `PDFDocument.load`, cantidad de páginas correcta y raster PNG con dimensiones no vacías.
- Las pruebas de fallo y expiración comprueban terminación del proceso hijo y eliminación del directorio temporal; no dejan procesos colgados.
- Las solicitudes concurrentes del mismo PDF finalizan dentro del límite, no producen respuestas corruptas y no duplican trabajo costoso cuando la implementación use coalescencia.
- El caso E2E no usa `retries`, no sube los timeouts y captura evidencia visual actual de la GUI con sus aserciones de estado, accesibilidad y layout.
- Pasan las pruebas focalizadas del módulo, los E2E GUI afectados y el flujo QA establecido; la matriz SDD queda actualizada y `npm run sdd:audit` pasa.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-006 | Medición por etapa, expiración, cierre del proceso externo, limpieza y fallbacks | `apps/backend/tests/pdf.paridad.test.ts` | Pendiente de aprobación |
| REQ-003, REQ-004 | Renderizado concurrente y preservación de contrato/límites | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Pendiente de aprobación |
| REQ-005 | Flujo de banco de reactivos, PDF válido y evidencia visual de GUI | `tests/gui-responsive/banco-reactivos.spec.ts` | Pendiente de aprobación |

