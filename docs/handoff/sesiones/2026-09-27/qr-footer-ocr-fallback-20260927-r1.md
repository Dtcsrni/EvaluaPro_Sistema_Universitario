# Fallback OCR de pie para identidad OMR

- Estado: draft; falta calibración sobre el dataset fotográfico real.
- Objetivo: cuando el QR no identifique la página, obtener folio y página del pie impreso y cotejarlos con el examen y el mapa OMR del backend.
- Implementación: reutiliza `tesseract.js` del frontend; recorta el pie, exige confianza ≥75/100 y un único par folio/página. QR mantiene prioridad. Si el texto es ambiguo, no coincide con la entrada manual o no puede leerse, se detiene y pide captura manual. Nunca se inventa un QR ni una firma.
- Pruebas: OCR/escaneo 18/18; TypeScript y ESLint focales aprobados. La prueba de X confirma que los rasgos la reconocen como marca, pero deja la respuesta ambigua cuando la orientación de la página no se pudo demostrar; no se relajó ese guardrail.
- Pendiente: medir precisión/recobrado del OCR con páginas CamScanner sin QR, validar rotaciones y disponibilidad offline del modelo de idioma, y corregir la fixture OMR de X para que tenga orientación verificable.
- Evidencia de comandos y archivos: ver el JSON hermano de esta traza.
