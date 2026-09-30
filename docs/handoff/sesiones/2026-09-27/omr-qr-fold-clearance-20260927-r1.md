# Handoff IA - Sesión

- traceSchemaVersion: 1.0.0
- sessionId: 01a0aec6-c99b-7b22-8520-0f45d784ea9a-qr-fold-clearance-r1
- status: draft
- generatedAt: 2026-09-27T20:26:37Z
- validationProfile: quick

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: coding assistant
- channel: Codex desktop

## Solicitud
- Continuar la evolución de plantilla OMR/QR y aprovechar el espacio sin perder capacidad ni fiabilidad.

## Objetivo
- Reducir la susceptibilidad del QR de futuras plantillas a pliegues de borde, conservando capacidad, coordenadas de referencia y lectura OMR/QR.

## Alcance
- Aumentar 6 mm el despeje horizontal de la tarjeta QR del borde derecho.
- Sincronizar la estimación de espacio para continuaciones.
- Añadir guardia geométrica y actualizar SPEC-062.

## Restricciones
- No alterar marcas ni etiquetas del dataset histórico.
- No modificar el motor OMR ni la base de calificaciones.
- No afirmar mejora fotográfica sin rebenchmark ni impresión física.
- Preservar otros cambios concurrentes del checkout.

## Acciones
- [ok] Diagnóstico: scan-02 muestra un pliegue que cruza el QR; scan-20 sirve como contraste visual. La prueba previa midió 68.63 pt de despeje, bajo el mínimo de 85.04 pt.
- [ok] Mejora: el inset real y el estimado por el planificador pasan de 5 mm a 11 mm; la guarda exige 30 mm al borde derecho.
- [ok] Validación: layout 31/31, QR/preimpresión 16/16, ESLint focal y `tsc --noEmit` pasan.

## Archivos cambiados
- `apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts`
- `apps/backend/tests/pdf.layout.visual.guard.test.ts`
- `docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md`

## Riesgos y siguiente paso
- No se reejecutó el dataset fotográfico porque sus QR ya están impresos; la mejora aplica a futuras plantillas. El siguiente paso es imprimir y fotografiar un lote de control, contrastando cada QR con el PDF de referencia y verificando OMR, pliegue y dúplex.
- El fallback OCR del pie sigue pendiente de autorización para empaquetar motor y modelo español offline.
