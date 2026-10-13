---
id: SPEC-093
titulo: Exportación de dataset OMR desde la GUI docente
version: 1.0.0
fecha: 2026-10-12
autor: Codex / Agente IA
modulo: escaneo_omr
estado: approved
---

## Contexto

El flujo de OMR ya conserva fuentes y permite revisar/corregir páginas, pero no ofrece exportación de un dataset QA desde la GUI. La persona docente necesita descargar un paquete local verificable sin subirlo al repositorio, instalador o servicio externo. El usuario aprobó implementar la exportación con aviso de datos identificables.

La salida debe separar evidencia original de etiqueta confirmada: una predicción automática de QR u OMR nunca se considera ground truth (etiqueta de referencia). Solo una página con resolución manual guardada y selección explícita del docente puede incluir respuestas etiquetadas. Las fuentes PDF pueden seguir mostrando datos personales en sus píxeles, por lo que la GUI requiere confirmar esa advertencia antes de iniciar la descarga.

El bloqueo de acceso automatizado de Codex al navegador local corresponde a una política externa y queda fuera del producto; no se elude usando otro host, esquema o superficie.

## Requisitos Funcionales

- REQ-001: La GUI permitirá exportar desde un job OMR completado los PDF fuente y un manifiesto de etiquetas en un ZIP descargable local.
- REQ-002: Antes de exportar, la GUI mostrará páginas elegibles, páginas seleccionadas y páginas excluidas/sin etiqueta. No inferirá identidad, respuestas, variante ni calificación.
- REQ-003: Solo serán elegibles páginas con identidad/examen/página asociados y resolución manual persistida (`resolutionReason` y todas las respuestas marcadas `manual_review`). El docente elegirá cuáles exportar. Páginas automáticas, ambiguas sin resolver, rechazadas o duplicadas no reciben etiquetas positivas.
- REQ-004: El ZIP incluirá archivos fuente con nombres anonimizados y sin recompresión, más manifiesto con procedencia mínima, SHA-256, bytes y etiquetas confirmadas. El backend verificará SHA-256 de cada fuente incorporada y del ZIP generado.
- REQ-005: La exportación se descargará como artefacto externo; no se incorporará al instalador, payload de producción, repositorio ni almacenamiento de calificaciones. No creará una segunda fuente de notas.
- REQ-006: La GUI advertirá que los píxeles de capturas originales pueden contener nombres, matrícula o QR identificables, incluso en páginas no seleccionadas de los PDF fuente completos, y exigirá confirmación antes de generar el ZIP. El manifiesto, nombres de archivo, URL, errores y telemetría no expondrán valores de identidad/QR.
- REQ-007: La ruta respetará permiso docente y propiedad del job. Usará la sesión existente de GUI y su renovación; no pedirá ni extraerá tokens.
- REQ-008: La GUI informará hash SHA-256 del ZIP, conteo de fuentes/etiquetas y errores recuperables. La operación no modificará job, originales ni calificaciones.
- REQ-009: Un `401` en una llamada API directa sin sesión no se presentará como prueba de que la GUI perdió autenticación.

## Criterios de Aceptación

- AC-001: Un docente puede seleccionar páginas manualmente resueltas, confirmar la advertencia de privacidad y descargar un ZIP desde GUI.
- AC-002: El servidor rechaza páginas no elegibles, selecciones vacías o la falta de confirmación de datos identificables.
- AC-003: Un fixture sintético prueba que fuentes y ZIP tienen SHA-256 verificado y que nombres, identidad, folios y QR no aparecen en nombres ni manifiesto.
- AC-004: Etiquetas solo provienen de página resuelta manualmente; páginas no seleccionadas o sin resolución permanecen sin etiquetar.
- AC-005: El endpoint requiere `omr:analizar`, verifica propiedad del job y no persiste cambios.
- AC-006: Un fallo de generación/descarga no modifica el job ni calificaciones y deja error recuperable para reintento.
- AC-007: Pruebas de componente cubren conteos, selección, advertencia obligatoria, error y descarga. QA visual/E2E se ejecuta si la política del navegador lo permite; el bloqueo de Codex se registra como limitación externa sin intentar evadirlo.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-004, REQ-008 | ZIP stream, contenido, SHA-256 y fallo de integridad | `apps/backend/tests/omrDatasetExport.test.ts` | Pendiente |
| REQ-002, REQ-003, REQ-006 | Selección de páginas y confirmación explícita de privacidad | `apps/frontend/tests/plantillasOmrWorkflow.test.tsx` | Pendiente |
| REQ-005, REQ-007, REQ-009 | Autorización, aislamiento por docente y contrato HTTP | `apps/backend/tests/integracion/omrDatasetExportApi.test.ts` | Pendiente |
| REQ-001 a REQ-009 | Integración del flujo y privacidad con datos sintéticos | `apps/backend/tests/omrDatasetExport.test.ts`; `apps/backend/tests/integracion/omrDatasetExportApi.test.ts`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `scripts/tests/evaluapro-client.test.mjs` | Pendiente |

## Decisiones

- La aprobación del usuario autoriza el paquete descargable con aviso y confirmación explícitos de datos identificables.
- Una resolución manual persistida es requisito de elegibilidad; una mera predicción OMR/QR no es etiqueta de referencia.
- El paquete contiene PDF originales sin recomprimir; la exportación no escribe en el repositorio ni en la base de calificaciones.
- La política de navegador de Codex es externa al alcance de EvaluaPro.

## Fuera de alcance

- Alterar allowlists o controles del navegador de Codex.
- Extraer/reutilizar tokens desde `localStorage`, cookies o perfiles.
- Exportar automáticamente a Classroom, escribir/rectificar calificaciones, o subir el dataset a un repositorio, servicio externo o instalador.
