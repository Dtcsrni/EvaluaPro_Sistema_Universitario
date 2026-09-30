# Handoff IA - Regresión QR preimpresión

- traceSchemaVersion: 1.0.0
- sessionId: omr-qr-preprint-regression-20260923
- parentSessionId: omr-qr-real-dataset-20260923
- status: final
- generatedAt: 2026-09-23T20:30:47Z
- validationProfile: focused

## Solicitud
- Continuar la validación QR del dataset fotográfico contra los PDF previos a impresión y proteger el generador futuro.

## Hallazgos
- En la primera página del PDF de Diseño y Desarrollo, dos objetos QR de 1560x1560 están colocados en la misma caja física: x=497.4488..576.8189 pt, top=57.2913..136.6614 pt. Los objetos se decodifican aislados, pero el raster QR compuesto no.
- Auditoría independiente Poppler/jsQR a 300 DPI: Diseño y Desarrollo 0/8 páginas; Inteligencia de Negocios 0/24; PDF TV4 nuevo 1/1.
- En las 38 fotos del reporte benchmark, QR directo=0, rescate geométrico=0, coincidencias exactas=0. El reporte de OMR contiene identidad de contingencia; no se promovió a lectura QR.
- `@prisma/adapter-better-sqlite3@7.10.0` ya estaba instalado; no se modificaron dependencias para esta validación.

## Cambios
- Actualizada `docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md` a v1.9.0; agrega REQ-019 para rasterizar PDF real y exigir payload exacto del manifiesto.
- `apps/backend/tests/pdf.canonico.test.ts` ahora rasteriza en memoria el PDF generado con PDF.js a 2550 px de ancho, recorta la caja QR persistida y comprueba decodificación exacta.
- No se cambiaron reglas productivas del OMR ni se alteraron los PDF fuente.

## Validación
- `npm -C apps/backend run test -- tests/pdf.canonico.test.ts tests/omr.qr.preimpresion.test.ts --run`: 2 archivos, 10 pruebas aprobadas.
- `npm -C apps/backend run typecheck`: aprobado; generó Prisma Client local.
- `npm run sdd:audit`: aprobado para todas las specs.
- `git diff --check -- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md apps/backend/tests/pdf.canonico.test.ts`: aprobado.
- Auditoría Poppler/jsQR: terminó y rechazó los PDF históricos (0/32) y el dataset QR (0/38); control PDF nuevo pasa 1/1.
- `npm run pipeline:contract:check`: falló 2/18 por contratos preexistentes de workflows editados (`ext_perf_arquitectura` exige una forma de `npm ci` que no coincide y `ext_funcionales` marca `npm ci` faltante). No se tocaron esos workflows porque son ajenos al alcance QR.

## Límites
- La prueba nueva demuestra legibilidad del QR del PDF generado en una rasterización PDF.js; el control generado también pasó Poppler a 300 DPI. No implica que las fotografías ya impresas recuperen QR.
- Los QR históricos están mezclados en origen; no hay una modificación solo del decoder que pueda validarse como recuperación fiable de esos códigos.
- La meta global de 100% de respuestas OMR sigue abierta; este cambio protege la plantilla futura y el gate preimpresión, no aumenta la cobertura de marcas del dataset.
- Checkout canónico contiene numerosos cambios preexistentes; conservarlos.
