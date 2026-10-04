# Handoff IA - Sesión

- traceSchemaVersion: 1.0.0
- sessionId: omr-reference-runtime-validation-20260929
- parentSessionId: 2026-09-29-google-login-bonus-omr
- status: draft
- generatedAt: 2026-09-29 UTC
- validationProfile: full

## Resultado DDAW
- Poppler numera algunos archivos rasterizados con ceros a la izquierda; el rasterizador ahora resuelve las salidas por número lógico y usa un prefijo temporal único.
- La GUI cotejó el PDF y seleccionó el lote DDAW `DE6B2F6D` (4 exámenes); el historial sigue sin trabajos OMR.
- La API reportó estado `ok` y SQLite conectada. No se procesaron capturas ni se escribieron calificaciones.

## Paridad actual Global/Classroom/bono
- GUI: suites de calificaciones, evaluación y mapeo Classroom, 16/16 pruebas aprobadas.
- Backend: integración Classroom, proyección de lista y bono, 17/17 aprobadas.
- SDK API docente: 38/38 pruebas aprobadas.
- Hashes: bundle de Calificaciones y 5 módulos API instalados coinciden con el build local; el bundle contiene Global y vista previa/confirmación del bono.

## Pendiente BI
- `Examen_Global_Inteligencia_de_Negocios.pdf` tiene 48 páginas; los 21 lotes archivados están disponibles en Edge.
- La herramienta de navegador abre el selector «Elegir archivo», pero no expone la selección del PDF local; no se cargó el documento ni se ejecutó su cotejo.
- Próximo paso: seleccionar ese PDF local en Edge y avisar cuando aparezca seleccionado; entonces cotejarlo en GUI/API.

## Validación de código
- `npm run lint`, backend `npm run typecheck`, `npm run build`, `npm run api:contract:check`, `npm run sdd:audit`: aprobados.
- Paridad PDF: 14/14; integración API de cotejo QR: 1 aprobada, 11 omitidas.
- `npm run test:ia:traceability`: 7/7; traza JSON valida.
- `git diff --check` global reporta whitespace en numerosos archivos del checkout sucio/generados; diff focalizado sin errores.

## Clasificación de paquetes API/GUI
- Se incluyó alumno como sexto nivel de carpeta junto con curso, materia, parcial, docente y grupo; los nombres de descarga son acotados y contienen alumno, folio e ID canónico.
- Al corregir una página, el paquete regenerado queda dentro del mismo árbol categorizado, se guarda con una ruta nueva y reemplaza el anterior después de actualizar el job.
- Integración `omrJobsWorkflow.test.ts` focalizada: 2 aprobadas (carga multipart/clasificación y resolución manual), 10 omitidas. Verifica carpetas, re-descarga de paquetes y que no se escriben calificaciones.
- Build raíz, typecheck backend, ESLint focalizado y diff-check focalizado aprobados.
- El runtime instalado tenía una versión antigua de `qrReferenciaPdf.js` que no exportaba `prepararQrsEsperados`; con respaldo se sincronizaron ese módulo y el controlador de ingesta. SHA-256 del QR instalado y compilado coincide.
- Dashboard de producción reinició el stack `prod`; `GET /api/salud/ready` devolvió `ok` con SQLite conectada y `http://127.0.0.1:4173/` devolvió HTTP 200. La pantalla de login mostró el correo/contraseña prellenados, pero el intento de acceso respondió “Correo o contraseña incorrectos”; no se realizaron más intentos. La verificación autenticada de la GUI queda pendiente.

## Respaldo del runtime
El rasterizador compilado fue instalado con respaldo en `backups/runtime-patches/pdf-raster-padding-20260929-173500/rasterizadorPdfPreview.js.before`; SHA-256 de fuente/destino coinciden. `prod` se reinició con autorización y la API quedó saludable.
