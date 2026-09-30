---
id: SPEC-061
titulo: Banco de reactivos versionado e ingesta contractual IA
version: 1.1.0
fecha: 2026-09-25
autor: Codex
modulo: modulo_banco_preguntas
estado: approved
---

## Contexto

El banco actual conserva versiones de texto, pero resuelve materias y temas por
nombre, no tiene un contrato estable para generadores externos y la selección
de reactivos de una plantilla puede cambiar después de un preview. Esta spec
define una primera migración compatible: contrato JSON/JSONL estricto,
preview/confirmación idempotentes, reactivos con ciclo de vida y snapshot de
selección para plantillas.

El formato de producción continúa siendo OMR de cinco opciones A-E. La
información psicométrica se registra como evidencia medida y no se confunde con
hipótesis generadas por IA. Un lote de un tema conserva el contrato histórico;
cuando reúne varios temas, cada fila declara el único tema de destino para
evitar propagar etiquetas del lote a preguntas no relacionadas.

## Requisitos Funcionales

- REQ-001: El backend debe publicar un JSON Schema versionado para lotes de reactivos.
- REQ-002: El backend debe rechazar lotes con materia o tema inexistente, opciones distintas de A-E, más de una respuesta correcta, HTML inseguro o campos ambiguos.
- REQ-003: El preview debe ser de solo lectura y producir un `planHash` determinista.
- REQ-004: La confirmación debe exigir el `planHash`, ejecutarse en transacción y ser idempotente.
- REQ-005: Los reactivos importados deben conservar `externalKey`, procedencia, hash de contenido y versiones inmutables.
- REQ-006: Los reactivos deben admitir los estados `draft`, `review`, `published` y `retired`.
- REQ-007: La publicación debe poder alimentar el banco compatible actual sin perder la identidad del reactivo nuevo.
- REQ-008: El preview válido de una plantilla debe guardar IDs, versiones y hashes del conjunto utilizado.
- REQ-009: La generación debe reutilizar el snapshot del preview cuando exista y marcar la plantilla como obsoleta si cambió el conjunto.
- REQ-010: La API debe exponer historial y calibrar únicamente con calificaciones persistidas asociadas a una versión exacta y auditoría OMR aceptada/confirmada; el cliente no puede suministrar estadísticas confiables.
- REQ-011: La migración SQLite debe crear un respaldo antes de cambios y el backfill debe usar explícitamente la base indicada, preservar filas legadas y enviar relaciones ambiguas o inválidas a cuarentena.
- REQ-012: La sincronización debe transportar reactivos canónicos, versiones, opciones, asignaciones, importaciones, calibraciones y activos; debe conservar lectura compatible con paquetes v2.
- REQ-013: Editar un reactivo canónico desde el formulario manual debe crear una versión nueva y pasar por preview, confirmación, revisión y publicación; nunca sobrescribir la versión publicada.
- REQ-014: La API y la UI deben distinguir `banco:ingestar`, `banco:revisar` y `banco:publicar`; los perfiles con el permiso histórico `banco:gestionar` conservarán temporalmente esas capacidades.
- REQ-015: Las rutas de escritura heredadas deben delegar al pipeline canónico o impedir explícitamente escrituras que lo evadan; no crear ni actualizar reactivos solo en `BancoPregunta`/`VersionPregunta`.
- REQ-016: El adaptador DOCX existente debe conservarse con cuarentena de filas ambiguas. El XLSX v1 de reactivos debe usar hojas y encabezados exactos, convertirse al lote JSON canónico y pasar por el mismo preview/confirmación; no resolverá relaciones por nombre.
- REQ-017: Un E2E de navegador debe atravesar el flujo completo: ingestión/revisión/publicación, blueprint, preview, generación masiva y calificación, con fixtures controlados y estados OMR explícitos.
- REQ-018: Cada reactivo debe quedar asociado a un solo tema canónico. Un lote multitema exige `temaId` por fila, validado contra los temas del periodo; lotes históricos de un solo tema siguen siendo válidos y una reasignación exige nueva versión, revisión y publicación.

## Criterios de Aceptación

- Reimportar el mismo archivo con el mismo hash no crea duplicados.
- Un conflicto de versión se informa por fila y no modifica datos.
- Un preview inválido no crea reactivos, versiones, asignaciones ni auditoría confirmada.
- Una confirmación repetida con el mismo `planHash` devuelve el resultado previo.
- Una versión publicada nunca se sobrescribe.
- La generación masiva usa el mismo conjunto y versiones que el preview confirmado.
- La base existente y los exámenes históricos permanecen legibles.
- La respuesta de calibración distingue `sin_evidencia`, `evidencia_insuficiente` y `calibrado`.
- El backfill es idempotente, conserva el banco legado y pone las asignaciones no resolubles en cuarentena.
- Una edición manual conserva la versión publicada anterior y publica la nueva solo después del flujo de revisión.
- Los paquetes de sincronización v2 siguen siendo legibles; exportar/importar v3 conserva las entidades canónicas.
- Los roles de lectura no pueden ingestar, revisar ni publicar; los roles históricos de gestión conservan el flujo sin ampliar permisos de solo lectura.
- Las rutas legacy no pueden insertar o versionar un reactivo fuera del modelo y auditoría canónicos.
- Las importaciones DOCX/XLSX ambiguas no se confirman ni se mapean a IDs por heurística sin revisión humana.
- XLSX v1 solo admite las hojas visibles `Lote` y `Reactivos`, encabezados exactos, celdas sin fórmulas, IDs canónicos, hasta 500 filas y opciones A-E con una clave correcta. El preview devuelve el payload canónico validado para confirmar el mismo plan.
- La plantilla XLSX de descarga debe usar el contrato vigente; su carga no puede escribir datos durante el preview.
- El E2E integral demuestra el uso de las mismas versiones congeladas desde banco/blueprint hasta generación y calificación.
- Un lote multitema sin `temaId` por reactivo o con un ID ajeno se rechaza antes de escribir; el preview comunica el tema resuelto por fila.
- El XLSX actualizado incluye `temaId` y el parser conserva compatibilidad con encabezados anteriores para lotes de un tema.
- Cambiar solo el tema de un reactivo ya existente no se registra como no-op: crea una nueva versión en borrador, que requiere revisión y publicación explícitas.
- El hash de versión incorpora el tema canónico para permitir historial de reasignación sin colisionar con la restricción única del banco; los hashes históricos sin tema siguen siendo idempotentes.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | El contrato publicado contiene la estructura canónica | `apps/backend/tests/reactivosContrato.test.ts` | Verificado localmente |
| REQ-002 | El validator rechaza payloads ambiguos o inseguros | `apps/backend/tests/reactivosContrato.test.ts` | Verificado localmente |
| REQ-003 | Preview no escribe; hash determinista; prueba cuenta reactivos, activos, importaciones y filas | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-004 | Confirmación transaccional e idempotente | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-005 | Versiones y procedencia se conservan | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-006 | El ciclo draft → review → published está protegido | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-007 | La publicación alimenta la fachada OMR compatible | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-008 | Preview persiste snapshot de preguntas/versiones | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Verificado localmente |
| REQ-009 | Producción rechaza snapshot obsoleto | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Verificado localmente |
| REQ-010 | Historial y calibración usan evidencia persistida; rechaza datos del cliente | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-010 | Estadísticas y muestra psicométrica | `apps/backend/tests/reactivosCalibracion.test.ts` | Verificado localmente |
| REQ-011 | Backup previo e idempotencia de migración SQLite | `scripts/tests/migrate-reactivos-sqlite.test.mjs` | Verificado localmente |
| REQ-011 | Destino explícito y cuarentena de tema inválido en backfill | `scripts/tests/migrate-reactivos-backfill.test.mjs` | Verificado localmente |
| REQ-012 | Roundtrip de entidades canónicas y compatibilidad v2 | `apps/backend/tests/sincronizacion.test.ts` | Verificado localmente |
| REQ-013 | La edición manual crea nueva versión borrador; revisión y publicación son acciones separadas | `tests/gui-responsive/banco-reactivos.spec.ts` | Verificado localmente |
| REQ-014 | Enforcement granular en API y compatibilidad histórica | `apps/backend/tests/integracion/rolesPermisos.test.ts` | Verificado localmente |
| REQ-014 | Enforcement de scopes en la UI | `apps/frontend/tests/permisosBanco.hooks.test.tsx` | Verificado localmente |
| REQ-015 | Las rutas legacy responden 410 y no escriben ni borran datos | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-016 | DOCX estricto con tema canónico y cuarentena de filas ambiguas | `apps/backend/tests/integracion/hidratacionCursos.test.ts` | Verificado localmente |
| REQ-016 | Contrato XLSX de reactivos, preview sin escritura y confirmación del payload normalizado | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-016 | Rechazo de fórmulas XLSX antes de persistir | `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-017 | Captura/importación, revisión, publicación e historial en navegador | `tests/gui-responsive/banco-reactivos.spec.ts` | Verificado localmente |
| REQ-017 | Flujo Playwright desde banco manual/IA hasta preview, PDF masivo y calificación | `tests/gui-responsive/banco-reactivos.spec.ts` | Verificado localmente |
| REQ-018 | Tema único por fila, validación contra temas del lote, compatibilidad XLSX y ausencia de escrituras ante asignación ambigua | `apps/backend/tests/reactivosContrato.test.ts`; `apps/backend/tests/integracion/reactivosIngesta.test.ts` | Verificado localmente |
| REQ-018 | Preview de importación muestra tema asignado por fila | `apps/frontend/tests/bancoImportacionReactivos.test.tsx` | Verificado localmente |

## Hallazgos de auditoría E2E (2026-09-23)

- `REQ-003` corregido: el preview ahora calcula el `inputSha256`, el `importId`
  determinista y el `planHash` en memoria. La confirmación recibe el lote validado,
  vuelve a calcular el plan y verifica el hash antes de escribir. El registro de
  importación y sus filas nacen en la misma transacción que las versiones; un
  fallo revierte todo. La integración verifica cero escrituras durante preview y
  el E2E recompilado recorrió el flujo.
- La captura y edición manual ya dejan borradores. La UI requiere acciones
  explícitas separadas para enviar a revisión y publicar; no publica al guardar.
- El adaptador DOCX ya transforma solo filas OMR estrictas (A-E, clave correcta
  única y tema canónico explícito) al pipeline JSON canónico. Las filas ambiguas
  o sin tema se guardan en cuarentena y no crean reactivos; la cuarentena es
  idempotente por docente y SHA-256, incluso ante cargas concurrentes. El XLSX
  de reactivos v1 usa hojas `Lote` y `Reactivos`; sus columnas están definidas
  en `docs/contracts/reactivos-xlsx.v1.md`. Un adaptador lo convierte al mismo
  lote JSON antes de resolver IDs y calcular hashes.
- Las rutas heredadas `POST /api/banco-preguntas` y
  `POST /api/banco-preguntas/:preguntaId/actualizar` responden HTTP 410 y no
  ejecutan escrituras. Los datos históricos se conservan; se retira el camino
  de escritura, no los registros ni las calificaciones. El listado marca como
  pendientes de migración los registros sin identidad canónica y no ofrece una
  acción de edición que inevitablemente fallaría.
- La ingestión XLSX convierte las celdas a la misma estructura JSON validada,
  rechaza fórmulas/hojas o encabezados no canónicos, y la confirmación utiliza
  el payload devuelto por el preview. La plantilla descargable se verifica por
  integración. Las URLs remotas y contenido HTML inseguro se rechazan en el
  validador canónico, también para las filas convertidas desde XLSX.
- El E2E Playwright cubre captura manual e importación XLSX por UI (más JSON
  inválido para el camino de error), validación,
  confirmación, revisión/publicación, historial/versiones, preview, creación del
  PDF masivo, descarga, vinculación a alumno y calificación por API autenticada.
  Se verificó con backend recompilado y SQLite aislada. Snapshot obsoleto y
  calibración conservan pruebas backend separadas. No simula ni afirma validar
  captura OMR física de hojas impresas.
