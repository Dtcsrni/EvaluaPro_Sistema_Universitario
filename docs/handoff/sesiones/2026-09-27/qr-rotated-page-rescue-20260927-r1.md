# Handoff IA - Sesión

- `sessionId`: `qr-rotated-page-rescue-20260927-r1`
- `parentSessionId`: `qr-footer-ocr-fallback-20260927-r1`
- `status`: `draft`
- `generatedAt`: `2026-09-27T23:04:57Z`
- `validationProfile`: `quick`

## Objetivo

Mejorar lectura QR cuando la hoja llega girada en la captura, manteniendo aislada la geometría OMR original.

## Cambios

- El lector intenta al final una copia rotada y hasta dos recortes de la cabecera; no modifica el raster OMR.
- En análisis OMR solo acepta el payload exacto esperado. El texto recuperado se registra como `rotacion_pagina`, pero `qrDetalle` permanece nulo para impedir que coordenadas del marco girado afecten respuestas.
- La SPEC-062 incluye REQ-036 y tres regresiones sintéticas cubren giro 90°, 180° y 270°, coordenadas originales y rechazo de payload ajeno.
- El runner de benchmark y el resumen por página distinguen `page_rotation_rescue` de lectura directa y de rescate geométrico; 12/12 pruebas de integridad pasan.

## Validación

- `npm test -- tests/omr.test.ts tests/omr.geometry.reference.test.ts tests/omr.qr.preimpresion.test.ts`: 49/49 pruebas.
- TypeScript y ESLint focales: aprobados.
- Foto real `scan-16.png` (folio 035BC62C, página 4): payload exacto recuperado por rotación en 7.05 s; el benchmark guardado antes del cambio no había leído el QR. `scan-12.png` permaneció ilegible pese a tener el QR visible y `scan-06.png` tiene oclusión física; el rescate dio resultado en 1/3 ejemplos focales.
- `scan-12.png` fue comparada visualmente con página 28 del PDF de referencia: el QR fuente está limpio, mientras la captura lo desplaza y degrada.
- `npm run sdd:audit`: falla por una ruta de test inexistente en SPEC-070, fuera de estos cambios.
- No se ejecutó el benchmark global de 48 páginas ni se validó impresión física.
- El benchmark futuro separará las lecturas directas, rotacionales y geométricas para evitar atribuir rescates a la lectura primaria.

## Siguiente paso

Medir el resultado y el costo con el benchmark completo autorizado para estas 48 páginas, sin escribir calificaciones; comparar QR directo/rescatado, latencia y vectores OMR por página antes de promover el rescate.
