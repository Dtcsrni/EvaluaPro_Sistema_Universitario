---
id: SPEC-127
titulo: Recuperación local de QR TV4 por geometría registrada en ingesta
version: 1.0.0
fecha: 2026-10-26
autor: Codex / EvaluaPro
modulo: modulo_escaneo_omr
estado: approved
---

## Contexto

En capturas rotadas o degradadas, el lector QR directo puede no decodificar el símbolo aunque el lote incluya el PDF generado y el mapa de página firmado. La página queda sin identidad y exige asociación manual. El docente ya aprobó el flujo OMR local de alta precisión; esta especificación acota la recuperación de identidad por geometría registrada. No autoriza calificar, persistir notas ni aceptar datos de servicios externos.

## Requisitos Funcionales

- **REQ-001 — Recuperación geométrica local:** si la lectura QR directa falla, el ingreso puede probar el analizador local sobre la captura original y las geometrías TV4 asociadas a los QR registrados del lote. No consulta servicios remotos ni usa OCR para seleccionar identidad.
- **REQ-002 — Validación estricta:** solo se recupera el payload exacto que aparece en el examen, su mapa de página y el PDF de referencia verificado. Se exige firma HMAC válida, plantilla TV4, folio y número de página coincidentes, `examId` coincidente cuando esté presente y una única coincidencia en el lote. Ante firma inválida, mapa TV3, QR ausente/no registrado, discordancia o ambigüedad, se abstiene.
- **REQ-003 — Sin calificación:** la recuperación únicamente resuelve identidad y página para clasificar la ingesta. Conserva `autoGradable: false`, registra una advertencia auditable y no crea ni modifica calificaciones.

## Criterios de Aceptación

1. Una página de prueba rotada cuya lectura directa falla se vincula por la geometría QR registrada, muestra `OMR_QR_GEOMETRIA_RESCATADA` y mantiene la identidad y página exactas.
2. El recuperador acepta un HMAC de prueba válido y se abstiene ante firma alterada, mapa TV3, QR no registrado, discrepancia entre examen y mapa o payload duplicado.
3. El análisis usa la imagen original y no convierte el rescate de identidad en aprobación automática de respuestas.
4. La prueba de integración comprueba que la ingesta conserva su invariante de no escribir calificaciones.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | QR firmado, identidad exacta y abstenciones por firma, referencia, mapa, versión, página y `examId` | `apps/backend/tests/omr.recuperarQrIngesta.test.ts` | Implementado; deben ejecutarse las pruebas añadidas en el SHA candidato |
| REQ-001, REQ-003 | Ruta geométrica observable durante ingesta rotada, sin escrituras de notas | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | En validación; requiere CI en el SHA del PR |
