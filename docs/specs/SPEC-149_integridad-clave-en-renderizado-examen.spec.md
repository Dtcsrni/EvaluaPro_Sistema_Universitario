---
id: SPEC-149
titulo: Evitar filtraciones de clave en PDF de examen
version: 1.0.0
fecha: 2026-10-29
autor: Codex / EvaluaPro Team
modulo: modulo_generacion_pdf
estado: approved
---

## Contexto

La inspección de los paquetes del Primer y Segundo Parcial encontró reactivos cuyo
texto de opción aparece aislado en una fila de ancho completo, mientras los
distractores se distribuyen debajo en columnas. En una hoja escaneada del Segundo
Parcial, la etiqueta aislada coincide con las respuestas rellenadas en los nueve
reactivos visibles. El renderizador activa esta distribución por longitud del texto
y no por una intención editorial; el patrón observado puede revelar la clave y
comprometer la validez del examen.

## Requisitos Funcionales

- **REQ-001 — Neutralidad de presentación:** el PDF no debe revelar ni destacar la
  opción correcta mediante posición, tamaño, color, tipografía, fondo, orden,
  agrupación, separación o metadatos visibles. Las decisiones de layout no deben
  depender de cuál opción es correcta.
- **REQ-002 — Legibilidad:** las opciones extensas deben conservar texto completo,
  etiqueta visible y separación suficiente usando un layout uniforme que no
  destaque una sola respuesta frente a sus distractores.
- **REQ-003 — Correspondencia OMR:** cada opción impresa, su letra visible, el
  círculo asociado y la clave del mapa de variante deben conservar la misma
  correspondencia exacta tras el cambio de layout.
- **REQ-004 — QA imprimible:** la validación debe revisar extracción y geometría
  del PDF generado para casos donde la opción correcta sea la más larga y donde no
  lo sea; debe incluir regresión de las plantillas de Primer y Segundo Parcial.
- **REQ-005 — Reemisión trazable:** los PDF sustitutos deben generarse como un lote
  nuevo con QR y snapshot de mapa/clave registrados. No deben reutilizarse firmas
  históricas si la llave correspondiente no está disponible.

## Criterios de Aceptación

1. Ningún elemento visible del PDF identifica o diferencia la respuesta correcta.
2. Las cinco opciones y etiquetas visibles coinciden con la variante registrada y
   con las posiciones de burbuja evaluadas por OMR.
3. Opciones largas se muestran completas y el layout empleado es independiente de
   la clave correcta.
4. Las pruebas cubren el caso de filtración observado y los casos opuestos, y una
   verificación visual de ambos lotes confirma legibilidad y ausencia de énfasis.
5. Un lote sustituto conserva identidad, QR, hash de artefacto, mapa de variante y
   snapshot de clave coherentes antes de volver a escanearlo.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Neutralidad del layout y legibilidad de opciones extensas | `apps/backend/tests/pdf.paridad.test.ts`, `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Validados en suites focales; QA de lotes reales pendiente |
| REQ-003, REQ-004 | Correspondencia de variante, etiquetas OMR y geometría del PDF | `apps/backend/tests/pdf.paridad.test.ts`, `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Validados en suites focales; QA de lotes reales pendiente |
| REQ-005 | Integridad y trazabilidad de lote/PDF generado | `apps/backend/tests/pdf.lote.integridad.test.ts` | Pendiente; reemisión trazable no ejecutada |
