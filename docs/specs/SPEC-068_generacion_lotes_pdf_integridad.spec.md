---
id: SPEC-068
titulo: Integridad y recuperación de lotes de exámenes PDF
version: 1.1.0
fecha: 2026-09-27
autor: Erick Vega / Codex
modulo: modulo_generacion_pdf
estado: approved
---

## Contexto

La generación de un lote crea PDFs individuales, persiste registros y manifiestos, y después concatena los documentos para descarga. Un fallo intermedio puede dejar un lote parcial o inaccesible. La aceptación debe comprobar el paquete completo, no sólo que cada PDF individual tenga alguna página. El flujo también debe conservar el diseño validado de la plantilla, la identidad del alumno, la zona de engrapado y la geometría OMR; la visualización distinta entre Edge y un renderizador independiente debe diagnosticarse contra los mismos bytes, sin regenerar automáticamente un archivo válido.

## Requisitos Funcionales

- REQ-001: Validar cada PDF individual antes de publicarlo: no exceder el máximo de páginas de plantilla, usar tamaño Carta en todas las páginas, contener todos los reactivos y mantener congruencia de folio/QR/mapa OMR. Todos los ejemplares del lote deben tener el mismo número real de páginas.
- REQ-002: Validar el consolidado antes de exponer la descarga: total de páginas igual a estudiantes por páginas reales uniformes por examen, no mayores al máximo configurado, orden estable y Carta en todas las páginas. Persistir nombre, hash SHA-256 y conteos del archivo; rechazar una descarga si bytes, páginas o total de exámenes difieren del registro.
- REQ-003: Congelar para el lote el fingerprint de banco/plantilla y el layout validado; usar una misma escala tipográfica para todos los ejemplares. Rechazar antes de publicar si una variante desborda, omite reactivos o incumple el mínimo de legibilidad definido por la plantilla aprobada.
- REQ-004: Renderizar la identidad del alumno como primer nombre completo seguido de guion bajo e iniciales restantes, en cursiva menor, fuera del campo manuscrito «Nombre del alumno». No imprimir una etiqueta «Iniciales».
- REQ-005: Preservar la reserva de engrapado y la geometría OMR; la zona y la etiqueta «GRAPA» se orientan verticalmente, y texto, QR, fiduciales y burbujas no pueden invadir las zonas protegidas. En páginas interiores, el despeje se aplica aunque la distribución de preguntas no use una cantidad objetivo de páginas.
- REQ-006: Mantener estado persistente de lote y transición explícita `iniciando -> generando -> validando -> completado` o `fallido`. Un lote no ofrece descarga hasta `completado`.
- REQ-007: Una falla recuperable debe permitir reanudar el mismo lote sin duplicar alumnos, folios ni manifiestos. Una falla en persistencia del artefacto debe dejar los exámenes en estado fallido y sin habilitar descarga; al corregirse la condición, el mismo ID reanuda el lote idempotentemente.
- REQ-008: La UI sólo marca completo si coincide la cantidad de alumnos/exámenes, el total de páginas y el SHA-256; retiene el mismo ID para reintentar y permite descargar sólo el paquete validado.
- REQ-009: La descarga de Blob debe conservar los bytes hasta que el navegador haya iniciado la descarga, renovar una sesión 401 cuando sea posible, verificar SHA-256 y no presentar como listo un lote incompleto o alterado.
- REQ-010: Prueba de interoperabilidad de Edge usa un artefacto sintético de prueba y verifica render/descarga sin alterar ni volver a generar lotes reales. Si Edge difiere, registrar navegador/versión, hash y páginas afectadas antes de clasificarlo como defecto del PDF.
- REQ-011: El artefacto consolidado admite archivo/restauración atómica por API y GUI con auditoría idempotente. Archivar conserva los exámenes y sus entregas, calificaciones y referencias OMR; restaurar valida archivo, SHA-256 y estructura PDF, y un lote archivado no puede regenerarse con el mismo ID.

## Criterios de Aceptación

- En una prueba de lote con dos alumnos y máximo de cuatro páginas, los dos exámenes conservan el mismo número real de páginas Carta (sin exceder cuatro) y el consolidado coincide exactamente con su suma; cualquier valor divergente bloquea la descarga. La validación unitaria también cubre exceder el máximo y geometría/tamaño incorrectos.
- Las páginas contienen exactamente el conjunto esperado de reactivos, sin huecos ni duplicados, y cada QR corresponde al folio del examen y al ordinal de página.
- La validación ocurre antes de declarar completo/publicable el lote; el hash del archivo servido coincide con el hash persistido.
- Inyectar una falla al persistir el registro del artefacto y alterar un PDF válido de igual número de páginas no produce duplicados ni habilita descargas inválidas; reanudar conserva alumno-folio y termina con un paquete íntegro.
- Un lote con textos largos conserva escala tipográfica uniforme, no invade campos manuscritos ni reserva de engrapado y no degrada el mapa OMR.
- La etiqueta «GRAPA» es vertical, queda dentro de su reserva con margen, y la zona conserva separación mínima de la quiet zone del fiducial superior izquierdo.
- Las pruebas del cliente verifican la descarga de bytes, expiración/liberación del Object URL y presentación de errores; la prueba Edge automatizada usa únicamente fixtures de QA, no datos o PDFs reales del usuario.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Páginas individuales, tamaño carta, reactivos y QR | `apps/backend/tests/pdf.lote.integridad.test.ts`; `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts` | Validado |
| REQ-002 | Conteo y orden del PDF consolidado, hash persistido y descarga | `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts`; `scripts/tests/migrate-examen-lote-artefactos-pdf-sqlite.test.mjs` | Validado |
| REQ-003 | Layout de variantes y densidad validada | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Validado |
| REQ-004 | Formato de identidad del alumno | `apps/backend/tests/inicialesAlumno.test.ts` | Validado |
| REQ-005 | Reserva de engrapado y colisiones OMR, con y sin distribución por páginas objetivo | `apps/backend/tests/pdf.ink-sparing-staple.test.ts`; `apps/backend/tests/pdf.extraordinario.dosHojas.test.ts` | Validación focal pendiente |
| REQ-006 | Estados visibles y descarga sólo al completar | `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts` | Validado |
| REQ-007 | Fallo en persistencia, recuperación idempotente y sin duplicados | `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts` | Validado |
| REQ-008 | Retención del ID y validación de resumen en UI | `apps/frontend/tests/plantillas.loteSesion.test.ts` | Validado |
| REQ-009 | Descarga de Blob, SHA-256, liberación diferida y sesión | `apps/frontend/tests/plantillas.hooks.test.tsx` | Parcial: SHA y liberación validados; renovación 401 no cubierta |
| REQ-010 | Render/descarga Edge con fixture sintético | `tests/gui-responsive/plantillas-pdf-edge.spec.ts` | Validado en Edge headless |
| REQ-011 | Archivo/restauración de lote, preservación de referencias, idempotencia, auditoría y paridad API/GUI | `apps/backend/tests/integracion/examenesLotesApi.test.ts`; `apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/tests/migrate-examen-lotes-ciclo-vida-sqlite.test.mjs` | Validado en pruebas focales |
