# Carga OCR diferida y procedencia explícita

- Estado: draft; OMR/QR evolutivo sigue abierto.
- Cambio: Tesseract.js se resuelve mediante `import('tesseract.js')` procesable por Vite; el código queda separado en `vendor-ocr` y se carga dinámicamente. La UI distingue identidad leída del QR de folio/página recuperados por OCR.
- Validación: 19/19 pruebas frontend focales, TypeScript, ESLint y build Vite a carpeta temporal aprobados. Chunk `vendor-ocr`: 10.64 kB (5.00 kB gzip), referenciado mediante import dinámico desde la sección de escaneo.
- Límite: `workerPath` y datos de idioma/core usan defaults de Tesseract.js; si no hay cache, descargan recursos externos. No se agregaron ni empaquetaron modelos. La precisión sobre fotos y orientación siguen sin medir.
- Baseline fotográfico existente: 48 páginas, QR exacto directo 31/48 y un rescate geométrico adicional; 15 sin lectura; 255/360 respuestas determinadas; cero claves/etiquetas independientes, así que no prueba exactitud de respuestas.
- Próximo paso: decidir si aceptar el incremento de tamaño de empaquetar worker/core/modelos locales; después calibrar sobre QR misses sin contar OCR como detección QR.
