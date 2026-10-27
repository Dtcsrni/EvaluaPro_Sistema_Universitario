---
id: SPEC-104
titulo: Identificacion de lote en QR y pie de paginas PDF de examen
version: 1.0.0
fecha: 2026-10-23
autor: Codex
modulo: modulo_generacion_pdf
estado: approved
---

## Contexto

Los PDF nuevos de examen ya conservan `loteId` en sus registros, pero las paginas impresas no lo muestran en el pie ni lo incluyen en el QR firmado. Una copia separada del paquete pierde asi su vinculo verificable con el lote y con las demas paginas del mismo examen. El usuario confirmo este alcance y autorizo su implementacion. `loteId`, `folio` y `examId` son identificadores distintos; ninguno se deriva de otro.

## Requisitos Funcionales

- REQ-001: Los caminos de generacion individual y por lote deben pasar al PDF el `loteId` real que ya recibieron o generaron. No se debe inferir desde folio, `examId` ni nombre de archivo.
- REQ-002: El QR de una pagina nueva con lote debe incluir el campo opcional `LI:<loteId>` dentro del payload firmado con el contrato HMAC vigente (`SG:H1`). El parser debe exponer el `loteId` verificado sintacticamente. Las paginas historicas sin `LI`, incluidas las firmas compactas historicas, deben seguir parseandose sin `loteId`.
- REQ-003: Cada pagina nueva con lote debe imprimir `LOTE <loteId> · FOLIO <folio> · Pagina <pagina> de <total>` en el pie. El texto debe pasar las guardas existentes de ancho, fiduciales y colisiones; si no cabe, la generacion debe fallar claramente en vez de recortarlo.
- REQ-004: La extension no debe cambiar el algoritmo OMR de asociacion/coincidencia, la extraccion de respuestas, ni los PDFs archivados. El campo nuevo solo aporta procedencia opcional.

## Criterios de Aceptación

- Una prueba de generacion de PDF multipagina confirma en cada pagina que el QR decodificado desde el raster contiene el lote esperado, el folio y el ordinal de pagina, y que la firma HMAC es valida.
- La extraccion del texto del PDF confirma en cada pagina el mismo `loteId`, folio y numero/total de pagina.
- Una prueba de payload historico sin `LI` confirma que sigue parseandose, conserva su firma/identidad anterior y devuelve `loteId` ausente.
- Las pruebas cubren que `folio`, `examId` y `loteId` se mantienen como campos independientes.
- Las guardas visuales y de integridad de PDF existentes siguen pasando; no se regeneran ni editan PDFs archivados.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Propagacion de `loteId` en generaciones individual y por lote | `apps/backend/tests/pdf.canonico.test.ts`; `apps/backend/tests/qr.examen.test.ts` | Validado |
| REQ-002 | Campo LI firmado, parseo y compatibilidad historica | `apps/backend/tests/qr.examen.test.ts` | Validado |
| REQ-003 | QR raster y pie textual para cada pagina generada | `apps/backend/tests/pdf.canonico.test.ts`; `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Validado |
| REQ-004 | No regresion de contrato OMR ni artefactos historicos | `apps/backend/tests/pdf.canonico.test.ts`; `apps/backend/tests/qr.examen.test.ts`; `apps/backend/tests/pdf.lote.integridad.test.ts` | Validado en pruebas focales |
