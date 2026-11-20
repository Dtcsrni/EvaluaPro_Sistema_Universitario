---
id: SPEC-068
titulo: Integridad y recuperación de lotes de exámenes PDF
version: 1.3.0
fecha: 2026-11-20
autor: Erick Vega / Codex
modulo: modulo_generacion_pdf
estado: approved
---

## Contexto

La generación de un lote crea PDFs individuales, persiste registros y manifiestos, y después concatena los documentos para descarga. Un fallo intermedio puede dejar un lote parcial o inaccesible. La aceptación debe comprobar el paquete completo, no sólo que cada PDF individual tenga alguna página. El flujo también debe conservar el diseño validado de la plantilla, la identidad del alumno, la zona de engrapado y la geometría OMR; la visualización distinta entre Edge y un renderizador independiente debe diagnosticarse contra los mismos bytes, sin regenerar automáticamente un archivo válido.

## Requisitos Funcionales

- REQ-001: Validar cada PDF individual antes de publicarlo: no exceder el máximo de páginas de plantilla, usar tamaño Carta en todas las páginas, contener todos los reactivos y mantener congruencia de folio/QR/mapa OMR. Todos los ejemplares del lote deben tener el mismo número real de páginas.
- REQ-002: Validar el consolidado antes de exponer la descarga: total de páginas igual a estudiantes por páginas reales uniformes por examen y dentro del máximo configurado al generar, orden estable y Carta en todas las páginas. Persistir nombre, hash SHA-256 y conteos del archivo. La descarga histórica se valida contra esos conteos y huella persistidos (o los mapas de página del lote legado), nunca contra una preferencia que pudo cambiar después; rechazar bytes, páginas o total de exámenes divergentes del registro.
- REQ-003: Congelar para el lote el fingerprint de banco/plantilla y el layout validado; usar una misma escala tipográfica para todos los ejemplares. Rechazar antes de publicar si una variante desborda, omite reactivos o incumple el mínimo de legibilidad definido por la plantilla aprobada.
- REQ-004: Renderizar la identidad del alumno como primer nombre completo seguido de guion bajo e iniciales restantes, en cursiva menor, fuera del campo manuscrito «Nombre del alumno». No imprimir una etiqueta «Iniciales».
- REQ-005: Preservar la reserva de engrapado y la geometría OMR; la zona y la etiqueta «GRAPA» se orientan verticalmente, y texto, QR, fiduciales y burbujas no pueden invadir las zonas protegidas. En páginas interiores, el despeje se aplica aunque la distribución de preguntas no use una cantidad objetivo de páginas.
- REQ-006: Mantener estado persistente de lote y transición explícita `iniciando -> generando -> validando -> completado` o `fallido`. Un lote no ofrece descarga hasta `completado`.
- REQ-007: Una falla recuperable debe permitir reanudar el mismo lote sin duplicar alumnos, folios ni manifiestos. Una falla en persistencia del artefacto debe dejar los exámenes en estado fallido y sin habilitar descarga; al corregirse la condición, el mismo ID reanuda el lote idempotentemente.
- REQ-008: La UI sólo marca completo si coincide la cantidad de alumnos/exámenes, el total de páginas y el SHA-256; retiene el mismo ID para reintentar y permite descargar sólo el paquete validado.
- REQ-009: La descarga de Blob debe conservar los bytes hasta que el navegador haya iniciado la descarga, renovar una sesión 401 cuando sea posible, verificar SHA-256 y no presentar como listo un lote incompleto o alterado.
- REQ-010: Prueba de interoperabilidad de Edge usa un artefacto sintético de prueba y verifica render/descarga sin alterar ni volver a generar lotes reales. Si Edge difiere, registrar navegador/versión, hash y páginas afectadas antes de clasificarlo como defecto del PDF.
- REQ-011: El artefacto consolidado admite archivo/restauración atómica por API y GUI con auditoría idempotente. Archivar conserva los exámenes y sus entregas, calificaciones y referencias OMR; restaurar valida archivo, SHA-256 y estructura PDF, y un lote archivado no puede regenerarse con el mismo ID.
- REQ-012: Al servir correctamente el PDF consolidado o el ZIP de un lote, registrar `descargadoEn` para todos los exámenes incluidos, de modo que el historial refleje los artefactos enviados al navegador y proteja la regeneración accidental.
- REQ-013: La vista de generación y el historial identifican por separado PDF consolidado y ZIP de individuales; mientras se procesa una descarga muestran progreso solo para el formato activo, evitan solicitudes duplicadas y confirman cuándo EvaluaPro respondió el archivo y solicitó su descarga al navegador. El texto del historial aclara que la cifra cuenta exámenes con descarga registrada y no confirma que el navegador guardó el archivo.
- REQ-014: La descarga PDF y ZIP conserva el nombre canónico descriptivo del lote (`evaluapro_paquete_examenes_..._lote-<ID>`); el ZIP reutiliza el nombre del PDF del artefacto persistido y cambia únicamente la extensión. No sustituir este nombre por el título breve de la plantilla.
- REQ-015: El nombre canónico del lote incluye sus grupos: un lote limitado muestra el grupo elegido y un lote de materia completa muestra todos los grupos representados, ordenados y normalizados (p. ej. `grupos-25_26a`). El QR firmado incluye el lote y cada página imprimible repite una referencia legible del lote junto con folio/página en su pie.
- REQ-016: Los elementos de cabecera no se solapan entre sí ni invaden QR, campos manuscritos o zonas OMR. El patrón geométrico de cabecera tiene trazos vectoriales nítidos, complejidad visible y contraste suficiente, sin reducir legibilidad ni cobertura de tinta de las zonas funcionales. El contorno del enunciado y el fondo del reactivo mantienen una holgura visual positiva respecto del texto y de reactivos contiguos.
- REQ-017: La descarga del PDF consolidado conserva el ID del lote, presenta etapa, bytes recibidos y tiempo transcurrido; valida la cabecera PDF, longitud cuando el servidor la publica y SHA-256 antes de solicitar la descarga del navegador. Un tiempo de espera o error ofrece reintento del mismo lote sin regenerarlo. La UI distingue entre archivo entregado al navegador y guardado local, que no es observable por la aplicación.
- REQ-018: Los exámenes de un lote se generan en el orden persistente `ordenLista` del padrón, conservado desde su importación. La importación agrega la fila de origen como nueva posición; los cambios posteriores no reordenan a los alumnos.
- REQ-019: Parcial usa exactamente 2 páginas (1 hoja dúplex) y global exactamente 4 páginas (2 hojas engrapadas). `reactivosObjetivo` orienta la estimación, pero no trunca el banco ni impone un conteo uniforme. La selección por examen es determinista usando lote/cohorte/alumno/blueprint; el renderer mide el conjunto que cabe y se persisten su conteo, mapa OMR y snapshot de versiones. En política `shared`, el orden de opciones por reactivo compartido se conserva, mientras la selección y el conteo pueden variar por alumno; al reanudar se verifican y reutilizan las asignaciones guardadas y se comprueba que las claves coincidan en reactivos comunes. La compactación ordena por tema con una variación ponderada y acotada por semilla, seguida de medición real del renderer; es una heurística y no garantiza el óptimo global de empaquetado.

## Criterios de Aceptación

- En una prueba de lote con dos alumnos y máximo de cuatro páginas, los dos exámenes conservan el mismo número real de páginas Carta (sin exceder cuatro) y el consolidado coincide exactamente con su suma; cualquier valor divergente bloquea la descarga. La validación unitaria también cubre exceder el máximo y geometría/tamaño incorrectos.
- Las páginas contienen exactamente el conjunto esperado de reactivos, sin huecos ni duplicados, y cada QR corresponde al folio del examen y al ordinal de página.
- La validación ocurre antes de declarar completo/publicable el lote; el hash del archivo servido coincide con el hash persistido.
- Cambiar la preferencia de páginas del docente después de archivar un lote extraordinario no invalida su descarga si el PDF conserva los conteos y la huella persistidos.
- Inyectar una falla al persistir el registro del artefacto y alterar un PDF válido de igual número de páginas no produce duplicados ni habilita descargas inválidas; reanudar conserva alumno-folio y termina con un paquete íntegro.
- Un lote con textos largos conserva escala tipográfica uniforme, no invade campos manuscritos ni reserva de engrapado y no degrada el mapa OMR.
- La etiqueta «GRAPA» es vertical, queda dentro de su reserva con margen, y la zona conserva separación mínima de la quiet zone del fiducial superior izquierdo.
- Las pruebas del cliente verifican la descarga de bytes, expiración/liberación del Object URL y presentación de errores; la prueba Edge automatizada usa únicamente fixtures de QA, no datos o PDFs reales del usuario.
- Al descargar PDF consolidado o ZIP, todos los exámenes del lote quedan con fecha de servicio; una respuesta rechazada o un artefacto inválido no marca exámenes como descargados.
- En generación e historial, PDF y ZIP tienen etiquetas separadas; el formato activo muestra el estado de carga, el otro formato evita doble envío y un mensaje final distingue respuesta servida de guardado local.
- Las respuestas de descarga PDF y ZIP incluyen en `Content-Disposition` el nombre canónico descriptivo del artefacto, preservando materia, plantilla, cantidad y lote; ambos nombres comparten la misma base.
- En los nombres de lote, un grupo explícito produce `grupo-<grupo>` y materia completa incluye `grupos-<grupo1>_<grupo2>...`; para un padrón mixto, ningún grupo activo se omite. El QR por página se decodifica a un payload cuya firma valida e incluye `LI:<loteId>`. Cada página de examen muestra `LOTE <loteId>` y `FOLIO <folio> · P<n>` en el pie sin colisionar con zonas OMR o fiduciales.
- La prueba geométrica detecta intersecciones/holguras negativas entre elementos de cabecera y confirma que QR, campos y texto crítico permanecen legibles. La cabecera conserva patrón cyberpunk geométrico complejo en vectores con contraste revisado en render. El contorno de enunciado queda separado por al menos 3 pt del texto y el fondo del reactivo conserva margen positivo de texto; no hay colisión entre reactivos consecutivos.
- La prueba de descarga cubre progreso por chunks, validación del archivo completo, timeout, HTTP no exitoso, reintento con el mismo ID y estado accesible en GUI; nunca inicia un lote nuevo por un fallo de descarga ni declara confirmado el guardado en Descargas.
- El lote completo, su PDF consolidado y el lote limitado a un grupo respetan el orden persistido del padrón aunque la matrícula esté en orden inverso; una reimportación preserva la posición previa y una alta nueva se agrega al final.
- Parciales y globales producen siempre 2 y 4 páginas respectivamente; el renderer rechaza overflow en modo estricto. La previsualización puede confirmar el presupuesto cuando al menos un reactivo cabe y muestra los reactivos elegidos en el propio PDF. Un lote no trunca por `reactivosObjetivo`; reactivos cortos/largos se prueban con banco agotado y sobrante, conteos variables posibles por alumno, reanudación del mismo lote y mapas/clave reproducibles.

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
| REQ-012 | Marcar exámenes del lote cuando se sirve PDF consolidado o ZIP | `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts` | Validado |
| REQ-013 | Formatos, estado, feedback y explicación del conteo en generación e historial | `apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx`; `apps/frontend/tests/plantillas.hooks.test.tsx` | Validado |
| REQ-014 | Nombre canónico consistente para descarga PDF y ZIP | `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts` | Validado |
| REQ-015 | Grupo(s) en el nombre, payload QR firmado y etiqueta de lote en pie | `apps/backend/tests/qr.examen.test.ts`; `apps/backend/tests/pdf.ecofont.test.ts`; `apps/backend/tests/lotePdf.naming.test.ts`; `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | En implementación |
| REQ-016 | Cabecera sin solapamientos, patrón geométrico nítido y separación de contorno del enunciado | `apps/backend/tests/pdf.layout.visual.guard.test.ts`; `apps/backend/tests/pdf.ecofont.test.ts` | En implementación |
| REQ-017 | Progreso, validación, timeout y reintento de descarga conservando el ID | `apps/frontend/tests/plantillas.hooks.test.tsx`; `apps/frontend/tests/plantillas.descarga.estado.test.tsx` | En implementación |
| REQ-018 | Orden persistente del padrón en lote y PDF | `scripts/tests/migrate-alumnos-orden-lista-sqlite.test.mjs`; `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | En implementación |
| REQ-019 | Presupuesto físico fijo, ajuste de capacidad y mapas reproducibles por alumno | `apps/backend/tests/pdf.numeroPaginasPlantilla.test.ts`; `apps/backend/tests/pdf.layout.visual.guard.test.ts`; `apps/backend/tests/pdf.orden-capacidad.test.ts`; `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | En implementación |
