---
id: SPEC-095
titulo: Confirmación persistente del lote en el historial docente
version: 1.0.0
fecha: 2026-10-12
autor: Erick Vega / Codex
modulo: modulo_generacion_pdf
estado: implemented
---

## Contexto

Un PDF de lote puede existir en disco y aun así no estar registrado en el historial de la instancia docente que usa la GUI. En ese estado el archivo parece generado, pero no puede recuperarse, auditarse ni vincularse de forma confiable con los exámenes del grupo. La generación solo debe considerarse exitosa cuando el registro persistente y sus artefactos se pueden volver a consultar desde la API activa.

La retención ya establecida conserva los registros e historial académico. Archivar es una baja lógica reversible; expurgar archivos conforme a una política autorizada no equivale a borrar el lote del historial.

## Requisitos Funcionales

- REQ-001: La GUI no marcará un lote como completado, ni habilitará su descarga, basándose únicamente en la respuesta inicial del generador o en la existencia local de un PDF. Después de generar o reanudar, consultará la API con el mismo `loteId` y confirmará que el lote aparece en el historial del docente, con estado completo, total de exámenes esperado y manifiesto/huella coincidentes.
- REQ-002: Si la respuesta de generación se pierde o la verificación posterior no confirma el registro, la GUI conservará el mismo `loteId` y `clientRequestId`, mostrará estado incierto o fallido y bloqueará la descarga. Antes de reintentar consultará progreso e historial; no creará otro lote automáticamente ni tratará un PDF de otro directorio o instancia como resultado válido.
- REQ-003: La API no expondrá una descarga como resultado completado si no puede resolver el artefacto persistido desde el registro canónico del lote y verificar su integridad contra la huella y conteos almacenados.
- REQ-004: Archivar/restaurar un lote mantendrá los exámenes, entregas, calificaciones, referencias OMR, manifiesto y auditoría. Archivar solo cambia su visibilidad activa; la consulta histórica debe permitir localizar el lote archivado y restaurarlo según el flujo aprobado.
- REQ-005: Ningún proceso de retención eliminará las filas del historial académico ni la identidad/auditoría del lote. Cualquier expurgo permitido por la política vigente podrá afectar solo los artefactos expresamente sujetos a retención, mantendrá el estado de retención y evidencia auditable, y no podrá alcanzar lotes por una ruta genérica de borrado.
- REQ-006: El mensaje de éxito distinguirá generación confirmada en historial de archivo local no registrado, lote incompleto, artefacto no disponible y fallo de verificación; cada estado indicará la acción recuperable apropiada sin sugerir que un lote inexistente en la API está guardado.

## Criterios de Aceptación

- La GUI solo habilita descargas después de volver a leer el lote exacto por API y comprobar estado, cantidad y huella.
- Una respuesta perdida seguida de reintento recupera el mismo lote sin duplicar alumnos, folios ni auditoría; si no existe registro canónico, no se ofrece el PDF como generado.
- Un PDF presente en una carpeta local, pero ausente del historial API, se clasifica como no registrado y no como lote completado.
- Archivar y restaurar conservan la identidad del lote y su historial; una purga permitida no borra los registros académicos ni de auditoría.
- Los fallos de lectura, historial incompleto, hash divergente o API inaccesible bloquean la descarga y dejan visible un estado recuperable.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-006 | Confirmación posterior de historial, recuperación idempotente y bloqueo de resumen incongruente | `apps/frontend/tests/plantillas.loteSesion.test.ts` | Validado localmente; E2E GUI pendiente |
| REQ-003 | Descarga solo desde manifiesto canónico íntegro; progreso no confirma PDFs alterados | `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts`; `apps/backend/tests/pdf.lote.integridad.test.ts` | Validado localmente |
| REQ-004 | Archivo/restauración conserva recursos e historial | `apps/backend/tests/integracion/examenesLotesApi.test.ts`; `apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx` | Cubierto por SPEC-068 |
| REQ-005 | Retención conserva filas históricas y deja auditoría | `apps/backend/tests/integracion/examenesRetention.test.ts`; `apps/backend/tests/integracion/examenesLotesApi.test.ts` | Validado localmente |
