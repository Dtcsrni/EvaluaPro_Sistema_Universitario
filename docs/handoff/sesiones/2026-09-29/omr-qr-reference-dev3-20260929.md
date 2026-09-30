# Handoff: cotejo QR de referencia PDF — dev.3

Se optimizó el cotejo de QR de referencia: los payloads firmados y sus matrices se preparan una vez por PDF; cada geometría muestrea la página una vez por desplazamiento y compara matrices empaquetadas por bloques de 32 bits. Se conserva la tolerancia de 3.5 %, la identidad firmada y el requisito de una sola coincidencia.

La versión independiente del motor es `evaluapro-omr-qr@1.0.0-dev.3` (`development`), separada de la versión de EvaluaPro y de TV4. Un benchmark sintético de 100 candidatos y 8 páginas midió 209.05 ms en el cotejo lineal y 22.09 ms con matrices empaquetadas (9.46×), con coincidencia idéntica. El resultado es una medida focal de ejecución, no una métrica de exactitud fotográfica.

Pasaron las pruebas OMR/QR 15/15, QR preimpreso 12/12, integración local del cotejo 1/1, typecheck, ESLint focalizado, política de versión 7/7 y `sdd:audit`. El test de integración usó un lote efímero y verificó que la prevalidación no modifica jobs ni calificaciones.

Faltan los PDFs reales recientes asociados a sus geometrías persistidas, validar la GUI/API instalada, volver a ejecutar todos los corpora etiquetados, adjudicar las marcas ambiguas y validar una hoja impresa/capturada. La versión sigue en desarrollo y el objetivo global continúa activo. Evidencia detallada: [reporte QA](../../../../qa/omr-qr-reference-dev3-2026-09-29.md).

Envelope interoperable: `omr-qr-reference-dev3-20260929.handoff.json`.
