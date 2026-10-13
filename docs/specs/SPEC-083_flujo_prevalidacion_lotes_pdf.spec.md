---
id: SPEC-083
titulo: Flujo previsible de validación y generación de lotes PDF
version: 0.1.0
fecha: 2026-10-12
autor: Codex
modulo: modulo_generacion_pdf
estado: approved
---

## Contexto

Durante la preparación del primer parcial, la plantilla superó su vista previa pero una plantilla de 16 reactivos produjo PDFs de tres páginas y el lote falló al validar los archivos individuales. La validación sucede después de iniciar la generación y puede dejar registros parciales que complican el cambio de plantilla o el reintento. Además, editar o crear una plantilla no sincroniza automáticamente la selección del generador.

La implementación actual comprueba que exista un `resolvedLayout` vigente antes del lote; luego `generarPdfExamen` y `validarPdfIndividualLoteAplicacion` corren dentro del ciclo por alumno, antes de persistir cada examen. Ese orden permite descubrir tarde incompatibilidades de paginación o variante.

## Objetivo

Hacer que la preparación y generación de un lote sean guiadas, anticipables y recuperables: antes de iniciar, confirmar la plantilla vigente, la cohorte y que cada examen destinado al lote cumple páginas, reactivos y geometría OMR; al iniciar, evitar reprocesar validaciones que ya se hicieron.

## Alcance

- Interacción entre edición/guardado de plantilla, selección de plantilla y consola de generación.
- Prevalidación del lote con la misma plantilla, reactivos, alumnos, orden/variantes y renderizador que se usarán en el lote definitivo.
- Inicio, errores previos al lote, persistencia, progreso, reintento y recuperación de la generación masiva.
- Pruebas backend, frontend y de integración para los flujos anteriores.

Fuera de alcance: cambios al diseño visual del examen, reglas OMR, banco de preguntas, integración Classroom, publicación de calificaciones y rediseño general de la app.

## Requisitos Funcionales

- REQ-001: Al crear o guardar cambios de una plantilla, el generador selecciona esa plantilla cuando el usuario sigue en el flujo de generación. El cambio se refleja en el selector y estados dependientes (vista previa, modalidad, errores y reanudación) sin dejar una selección silenciosa de una plantilla distinta.
- REQ-002: El generador muestra el estado de validación de la plantilla seleccionada y la fecha/versión o fingerprint asociado. Si cambia plantilla, banco, configuración de páginas, instrucciones con efecto de layout o versión OMR, invalida el estado anterior y ofrece la acción necesaria antes de permitir iniciar el lote.
- REQ-003: Antes de crear el lote o persistir exámenes/folios, el servidor valida cada examen que formará el lote usando los mismos datos, renderizador, distribución, tipografía, variantes y contrato de validación individual del lote final. La prevalidación no crea registros de examen, manifiestos ni archivos definitivos.
- REQ-004: La prevalidación cubre a todos los destinatarios confirmados y verifica al menos: número uniforme de páginas dentro del máximo, Carta, todos los reactivos esperados, folio/QR/mapa OMR congruentes, ausencia de desbordamiento y reglas vigentes de legibilidad. No basta validar un alumno o una variante representativa cuando el lote asigna variantes aleatorias.
- REQ-005: Si la prevalidación falla, no inicia ni persiste el lote y presenta un resumen accionable: alumno/variante afectada cuando corresponda, causa entendible, límite implicado y acción concreta (por ejemplo, reducir reactivos, ajustar páginas o actualizar la plantilla). El docente puede volver a editar y validar sin encontrar una reanudación incompatible creada por este intento.
- REQ-006: Una prevalidación exitosa queda ligada a un fingerprint de plantilla, banco, roster, configuración OMR y parámetros de render. Si cualquiera cambia, se invalida. El inicio del lote consume solo una prevalidación vigente; no vuelve a generar en segundo plano una variante distinta de la validada.
- REQ-007: El flujo indica claramente los pasos y estados: plantilla seleccionada, vista previa vigente, cohorte/resumen, validación de lote, generación, verificación del paquete y descarga disponible. Los mensajes de error distinguen corrección requerida, reintento recuperable y fallo persistente.
- REQ-008: Los fallos ocurridos después de comenzar la persistencia siguen siendo recuperables e idempotentes con el mismo ID de lote conforme a SPEC-068. Los fallos de prevalidación no reservan ni retienen un ID que impida usar una plantilla corregida.
- REQ-009: La interfaz evita iniciar dos validaciones o generaciones concurrentes del mismo lote, mantiene progreso visible y permite reintentar una petición cuyo resultado sea incierto consultando el mismo estado persistido.
- REQ-010: Mantener compatibilidad con los contratos existentes de vista previa, generación individual, lotes ordinarios, extraordinarios y recuperación; los cambios de API serán aditivos o tendrán migración/versionado documentado.
- REQ-011: Cuando el nombre completo del alumno viene con apellidos antes de los nombres y no hay campos estructurados, las iniciales impresas después del primer nombre se ordenan con los nombres restantes primero y los apellidos después (p. ej. `S V Mario A` → `Mario_ASV`).
- REQ-012: El título visible del examen y el nombre de descarga del PDF consolidado del lote muestran solo el nombre corto del parcial cuando el título de plantilla empieza con esa etiqueta (p. ej. `Primer Parcial`); la materia, el grupo, el conteo de reactivos y el ID de lote no aparecen en el nombre visible. El nombre interno del artefacto conserva un identificador único para prevenir sobrescrituras.
- REQ-013: Antes de generar un lote ordinario, el docente elige su formato de entrega: ZIP con un PDF individual por alumno o PDF consolidado. Ambos formatos conservan los mismos exámenes generados y también están disponibles por separado desde el historial. La descarga ZIP es un artefacto distinto del PDF consolidado. Antes de responder, el servidor comprueba estado completo, retención, unicidad de folios, integridad de cada PDF, tamaño Carta y correspondencia entre páginas, folio y mapa OMR; cualquier inconsistencia impide descargar el ZIP. Los archivos se nombran de forma segura y determinista, y la UI distingue las dos descargas.
- REQ-014: La generación masiva ordinaria se limita a una cohorte identificada por grupo. La UI muestra grupos con alumnos activos del periodo de la plantilla, selecciona automáticamente el único grupo cuando existe y exige elección explícita cuando hay varios; el total, la confirmación y el progreso reflejan solo ese grupo. La API valida el grupo contra alumnos activos del periodo y rechaza grupo faltante en periodos multigrupo, grupo inexistente o una cohorte vacía antes de crear artefactos. El sondeo de progreso conserva el tamaño confirmado de la cohorte, incluidos extraordinarios con selección individual. Los extraordinarios conservan la selección individual existente.
- REQ-015: Antes de incluir un PDF individual en el ZIP, el backend verifica la firma del manifiesto de recuperación, su correspondencia con examen/folio/lote/mapa OMR y el SHA-256 del archivo contra el hash firmado. Un manifiesto ausente, alterado o cuyo PDF no coincida detiene la descarga completa sin entregar ZIP parcial.

## Criterios de Aceptación

1. Un caso de lote de 12 alumnos y plantilla de 16 reactivos que renderiza 3 páginas cuando el máximo es 2 se rechaza en la validación previa, sin examen, folio, manifiesto ni lote parcial persistido.
2. Un caso equivalente cuya plantilla cabe en 2 páginas para las 12 variantes confirma la validación y genera el lote usando los mismos PDFs/variantes validados, con 12 exámenes, 24 páginas tamaño Carta y SHA-256 persistido para el consolidado.
3. Una variante aleatoria que excede páginas o no contiene todos los reactivos hace fallar la prevalidación completa; no se inicia el lote aunque otras variantes pasen.
4. Cambio en roster, reactivos, plantilla, páginas o configuración OMR entre prevalidación e inicio invalida el token/fingerprint y produce un mensaje accionable; no se consume una aprobación obsoleta.
5. Al guardar una plantilla desde edición, esa plantilla queda seleccionada para generar; refrescar/recuperar estado no deja el formulario mostrando una plantilla diferente a la que usa la API.
6. Un error de prevalidación permite corregir la plantilla y comenzar de nuevo sin residuos ni colisión de reanudación. Una falla inyectada después de persistir un examen conserva el comportamiento idempotente de SPEC-068.
7. La generación muestra avance y resultado terminal coherentes; la descarga solo aparece después de comprobar total de alumnos/exámenes, páginas y hash.
8. Los flujos individual, extraordinario, restauración/reanudación y permisos no cambian su contrato ni fallan en las pruebas existentes afectadas.
9. El caso de apellidos antes de nombres produce `Mario_ASV`; el paquete de un lote con título de plantilla extendido se descarga con nombre visible `Primer_Parcial.pdf` y el almacenamiento interno sigue usando una ruta única por lote.
10. Antes de iniciar la generación de un lote ordinario se puede seleccionar ZIP de individuales o PDF consolidado; la elección queda visible y se ofrece la descarga correspondiente al completar el lote. El historial ofrece ambas alternativas. El ZIP completo contiene exactamente un PDF por examen, coincidente con el total registrado en el manifiesto cuando existe; cada integrante conserva el número de páginas del examen y páginas Carta. Un lote incompleto, archivado, con folios duplicados, artefactos ausentes/expurgados o PDFs/mapas inconsistentes devuelve un error explícito y no crea una descarga parcial.
11. En un periodo con dos grupos y alumnos activos distribuidos entre ambos, omitir el grupo es rechazado; seleccionar A genera y reporta solo alumnos activos de A, sin incluir B. Un grupo desconocido y un grupo vacío fallan antes de persistir el lote. La UI con dos grupos no habilita generación hasta elegir uno y muestra el conteo del elegido; con un solo grupo lo preselecciona. Los extraordinarios siguen usando solo los alumnos marcados.
12. Una alteración de bytes, del manifiesto firmado o del mapa OMR guardado de cualquiera de los PDFs individuales impide producir el ZIP. Los archivos intactos mantienen la descarga disponible.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-007 | Guardado/creación selecciona plantilla y mantiene estado visible | `apps/frontend/tests/plantillas.refactor.test.tsx` | Verificado localmente: 19 pruebas |
| REQ-003, REQ-004, REQ-005, REQ-006 | Prevalida variantes del lote antes de persistir | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Verificado localmente: 7 pruebas |
| REQ-008, REQ-009, REQ-010 | Recuperación, reintento y contratos existentes | `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts`; `apps/backend/tests/integracion/examenesLotesApi.test.ts` | Recuperación verificada; contrato existente no ejecutado |
| REQ-011 | Orden de iniciales en padrón con apellidos primero | `apps/backend/tests/inicialesAlumno.test.ts` | Verificado localmente: 3 pruebas |
| REQ-012 | Título PDF corto y nombre descargado con nombre interno único | `apps/backend/tests/pdf.canonico.test.ts`; `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts` | Verificado localmente: prueba unitaria e integración |
| REQ-013 | Selector previo de formato, descarga ZIP individual íntegra y controles de descarga separados | `apps/backend/tests/integracion/examenesLotesApi.test.ts`; `apps/frontend/tests/plantillas.refactor.test.tsx`; `scripts/tests/exam-batch-openapi.test.mjs` | Backend: 12 PDFs, 24 páginas Carta y fallos de conteo/artefacto rechazados; frontend: selector; contrato ZIP binario y catálogo verificados localmente; CI pendiente |
| REQ-014 | Cohorte por grupo seleccionada, validada y contabilizada en UI, API y progreso | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts`; `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts`; `apps/frontend/tests/plantillas.refactor.test.tsx` | Backend: multigrupo, rechazo sin grupo/incorrecto, progreso exacto de A con alumnos activos de B, y límite de consulta; frontend: selección y conteo por grupo; CI pendiente |
| REQ-015 | ZIP compara cada PDF con el hash cubierto por manifiesto firmado y su mapa OMR | `apps/backend/tests/integracion/examenesLotesApi.test.ts` | Verificado localmente: PDF mutado rechazado con 409; PDF original descarga |

## Decisiones implementadas

- La prevalidación debe cubrir todos los alumnos y generar las variantes exactas que se conservarán para el lote; esto usa más CPU y memoria antes de mostrar avance de generación, pero evita iniciar lotes inválidos y evita renderizar dos veces.
- La confirmación de cohorte existente se conserva. En el flujo ordinario, la lista se congela al validar; si cambia antes del inicio, se exige validación nueva.
- El artefacto guardado mantiene un nombre interno único por lote. La descarga expone solo el nombre corto del parcial para evitar colisiones de almacenamiento y nombres redundantes para el usuario.
