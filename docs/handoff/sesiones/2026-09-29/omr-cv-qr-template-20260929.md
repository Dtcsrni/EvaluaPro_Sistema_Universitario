# Handoff IA - Sesion

- traceSchemaVersion: 1.0.0
- sessionId: omr-cv-qr-template-20260929
- parentSessionId: -
- status: draft
- generatedAt: 2026-09-29T13:34:18Z
- validationProfile: full

## Agente
- name: Codex
- version: unknown
- provider: OpenAI
- kind: agente-ia
- channel: desktop

## Solicitud
- Procesar todos los lotes CamScanner, globales y parciales recientes, y datasets fotográficos PDF/imagen para mejorar OMR, QR y plantilla.

## Objetivo
- Iterar con todos los datasets fotográficos etiquetados disponibles y los globales/Parciales recientes para mejorar el motor OMR, QR y la plantilla; cerrar solo con exactitud, eficiencia y verificación física suficientes.

## Alcance
- 39 capturas de teléfono (38 contenidos únicos, 32 páginas, 424 reactivos únicos), incluyendo el lote parcial reciente.
- 48 escaneos Global48 (360 posiciones); el benchmark no tiene etiquetas de respuesta vinculadas.
- 4 PDF CamScanner rasterizados en 16 páginas; sin etiquetas de respuesta.
- 8 etiquetas manuales de forma X/trazo cruzado enlazadas a la página 3 del conjunto Global48.

## Restricciones
- Preservar cambios preexistentes del árbol de trabajo.
- No incluir identidades ni folios en la traza.
- No escribir calificaciones ni ejecutar publicación o impresión física.
- Etiquetas existentes no son una verdad terreno independiente.

## Acciones
- [ok] validation: Ejecucion de omr_focus (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de backend_typecheck (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de frontend_ci (2026-09-29T18:00:00Z)
- [falla] validation: Ejecucion de coverage_ci (2026-09-29T18:00:00Z)
- [falla] validation: Ejecucion de tdd_enforcement (2026-09-29T18:00:00Z)
- [falla] validation: Ejecucion de backend_ci (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de portal_ci (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de perf_check (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de pipeline_contract (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de docs_check (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de traceability_tests (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de handoff_tests (2026-09-29T18:00:00Z)
- [falla] validation: Ejecucion de ci_policy_audit (2026-09-29T18:00:00Z)
- [falla] validation: Ejecucion de lint (2026-09-29T18:00:00Z)
- [ok] validation: Ejecucion de sdd_audit (2026-09-29T18:00:00Z)
- [ok] validation: Replay OMR de todas las capturas fotográficas etiquetadas (39/39) (2026-09-29T09:04:08.01Z)
- [ok] validation: Replay completo Global48 como control de estados/QR (48/48, sin etiquetas de respuesta) (2026-09-29T09:04:08.01Z)
- [ok] validation: Replay completo de 16 páginas CamScanner (sin etiquetas de respuesta) (2026-09-29T09:04:08.01Z)
- [ok] validation: Cotejo de 8 etiquetas manuales X/trazo cruzado en la página 3 (2026-09-29T09:04:08.01Z)
- [pending] validation: Consulta de criterio de adjudicación para X repasada dentro de una burbuja (2026-09-29T09:04:08.01Z)
- [ok] validation: Repetición idéntica del replay de 39 capturas para validar tiempo y RSS (2026-09-29T09:34:51.431Z)
- [ok] validation: Replay fotográfico con la regla experimental (39/39) (2026-09-29T11:33:23.706Z)
- [ok] validation: Replay fotográfico tras retirar la regla experimental (39/39) (2026-09-29T12:03:22.202Z)
- [ok] validation: Comparación de respuestas, estados, scores y QR entre variante y repetición restaurada (2026-09-29T12:03:22.202Z)
- [ok] validation: Prueba focal de estado OMR posterior a la retirada (2026-09-29T11:38:59Z)
- [ok] validation: Typecheck backend posterior a la retirada (2026-09-29T11:39:10Z)
- [ok] validation: Comparación de vectores scoreDetails completos entre los replays actual y previo (2026-09-29T12:12:00Z)
- [ok] validation: Prueba de huella geométrica OMR y protección de identificadores/payload (2026-09-29T12:46:52Z)
- [ok] validation: Smoke del evaluador con una captura y verificación del hash (2026-09-29T12:46:52Z)
- [ok] validation: Replay completo de 39 fotos con huellas de mapa y código (2026-09-29T12:44:49.754Z)
- [ok] validation: Comparación exacta del replay fingerprinted con el replay restaurado previo (2026-09-29T12:46:52Z)
- [ok] validation: Smoke con la nueva huella SHA-256 del módulo de geometría (2026-09-29T12:52:53Z)

## Archivos leidos
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omr/decision/consensoRespuesta.ts
- apps/backend/tests/omr.consenso.robusto.test.ts
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
- output/qa/omr-mark-shapes-20260928/manifest.json
- apps/backend/scripts/omr-eval-real-dataset.mjs

## Archivos cambiados
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts
- apps/backend/tests/omr.consenso.robusto.test.ts
- docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md
- CHANGELOG.md
- reports/perf/latest.json
- docs/handoff/sesiones/2026-09-29/omr-cv-qr-template-20260929.json
- docs/handoff/sesiones/2026-09-29/omr-cv-qr-template-20260929.md
- apps/backend/scripts/omr-eval-real-dataset.mjs
- apps/backend/scripts/omr-map-geometry-fingerprint.mjs
- apps/backend/scripts/tests/omr-map-geometry-fingerprint.test.mjs

## Validacion ejecutada
- omr_focus: `npm run test -- --run tests/omr.consenso.robusto.test.ts` -> ok (exitCode=0, duracionMs=0)
  resultado: 45 pruebas OMR focalizadas pasaron.
- backend_typecheck: `npm run typecheck --workspace apps/backend` -> ok (exitCode=0, duracionMs=0)
  resultado: Prisma Client se generó y el typecheck backend terminó con exitCode=0.
- frontend_ci: `npm run test:frontend:ci` -> ok (exitCode=0, duracionMs=0)
  resultado: 69 archivos y 304 pruebas pasaron.
- coverage_ci: `npm run test:coverage:ci` -> falla (exitCode=124, duracionMs=0)
  resultado: backend-root-25 excedió 480 s dos veces; se detuvo el tercer intento.
- tdd_enforcement: `npm run test:tdd:enforcement:ci` -> falla (exitCode=1, duracionMs=0)
  resultado: Deuda de exclusiones: patrón inexistente en recoveryBundleGeneracion.test.ts.
- backend_ci: `npm run test:backend:ci` -> falla (exitCode=1, duracionMs=0)
  resultado: Reintentó 3 veces; E2E CSV espera cabecera antigua y falla con columnas actuales de global.
- portal_ci: `npm run test:portal:ci` -> ok (exitCode=0, duracionMs=0)
  resultado: 11 archivos y 32 pruebas pasaron.
- perf_check: `npm run perf:check` -> ok (exitCode=0, duracionMs=0)
  resultado: 4 presupuestos verificados; variables locales efímeras de configuración.
- pipeline_contract: `npm run pipeline:contract:check` -> ok (exitCode=0, duracionMs=0)
  resultado: 19 de 19 contratos pasaron.
- docs_check: `npm run docs:check` -> ok (exitCode=0, duracionMs=0)
  resultado: npm run docs:check terminó con [docs] ok en esta actualización.
- traceability_tests: `npm run test:ia:traceability` -> ok (exitCode=0, duracionMs=0)
  resultado: 7 de 7 pasaron.
- handoff_tests: `npm run test:ia:handoff` -> ok (exitCode=0, duracionMs=0)
  resultado: 11 de 11 pasaron.
- ci_policy_audit: `npm run ci:policy:audit` -> falla (exitCode=1, duracionMs=0)
  resultado: Se detuvo en toolchain policy: aprobación mejor-sqlite3 ausente y lock backend no incluye @tesseract.js-data/spa.
- lint: `npm run lint` -> falla (exitCode=1, duracionMs=0)
  resultado: Error no-useless-assignment en controladorIngestaPdfOmr.ts:250, archivo ajeno a este cambio.
- sdd_audit: `npm run sdd:audit` -> ok (exitCode=0, duracionMs=0)
  resultado: Auditoría SDD pasó.
- omr_photo_corefill_39: `benchmark completo de capturas fotográficas con core-fill, scoreDetails y concurrencia 2` -> ok (exitCode=0, duracionMs=1472416)
  resultado: 39/39 procesadas; 443/487 respuestas observadas determinadas y concordantes frente a 338/487 en la referencia; 356/397 respuestas únicas concordantes frente a 283/397; 2 páginas vacías y 1 doble permanecen; QR 2/39 exactos, 0 payloads erróneos; duración 24.5 min, RSS pico 2209 MiB.
- omr_global48_corefill_48: `benchmark completo Global48 con core-fill y concurrencia 2` -> ok (exitCode=0, duracionMs=896123)
  resultado: 48/48 procesadas; 295 respondidas frente a 283; 63 ambiguas frente a 74; 25 dobles/tachadas frente a 27; no se agregaron dobles nuevas; QR 32/48 directos y 34/48 exactos tras rescates, 0 payloads erróneos; sin etiquetas de respuesta.
- omr_camscanner_corefill_16: `benchmark completo de cuatro PDF CamScanner rasterizados con core-fill y concurrencia 2` -> ok (exitCode=0, duracionMs=525398)
  resultado: 16/16 procesadas; 49 respondidas frente a 47; 46 ambiguas frente a 48; 2 inválidas frente a 2; QR 0/16 exactos y 0 payloads erróneos; sin etiquetas de respuesta.
- omr_manual_shapes_page3: `cotejo de etiquetas manuales de formas contra la página 3 procesada de Global48` -> ok (exitCode=0, duracionMs=0)
  resultado: 8/8 preguntas mapeadas. De 6 X, 3 coinciden con la opción observada y 3 permanecen dobles; 0 X se leen como otra opción. De 2 trazos cruzados, uno se emite y otro se abstiene; la intención de la muestra emitida está pendiente de adjudicación.
- omr_photo_corefill_repeat_39: `repetición exacta del benchmark fotográfico con concurrencia 2, scoreDetails y las mismas 39 capturas` -> ok (exitCode=0, duracionMs=1449391)
  resultado: 39/39 procesadas; resultados idénticos a la corrida anterior (0 diferencias de respuesta, estado, score y QR); 24.16 min, RSS pico 1580 MiB. La primera corrida midió 2,209 MiB; este pico no se reprodujo. La referencia midió 1,598 MiB/25.18 min.
- omr_photo_experiment_39: `node --import tsx apps/backend/scripts/omr-eval-real-dataset.mjs (concurrencia 2; mapa runtime fixture)` -> ok (exitCode=0, duracionMs=1470224)
  resultado: 39/39 procesadas; 376/487 respuestas emitidas concordantes con etiquetas heredadas; 311/397 concordancias únicas; 111 ambiguas; QR 2/39 exactos, 0 payloads erróneos; 24:30 min, RSS pico 1,616 MiB.
- omr_photo_after_revert_39: `node --import tsx apps/backend/scripts/omr-eval-real-dataset.mjs (concurrencia 2; mismos hints runtime fixture)` -> ok (exitCode=0, duracionMs=1437214)
  resultado: 39/39 procesadas; idéntica a la corrida experimental en respuestas, estados, score details y QR; 376/487 respuestas emitidas concordantes con etiquetas heredadas; 311/397 concordancias únicas; QR 2/39 exactos; 23:57 min, RSS pico 1,570 MiB; 0 errores.
- omr_estado_reversion: `npm -C apps/backend run test -- --run tests/omr.estado-respuesta.test.ts` -> ok (exitCode=0, duracionMs=0)
  resultado: 19/19 pruebas focales pasaron; Vite mostró avisos de configuración nativa no soportada.
- backend_typecheck_after_revert: `npm run typecheck --workspace apps/backend` -> ok (exitCode=0, duracionMs=0)
  resultado: Prisma Client v7.10.0 generado y TypeScript terminó correctamente.
- docs_check_after_trace: `npm run docs:check` -> ok (exitCode=0, duracionMs=0)
  resultado: [docs] ok.
- traceability_tests_after_trace: `npm run test:ia:traceability` -> ok (exitCode=0, duracionMs=0)
  resultado: 7/7 pruebas pasaron.
- handoff_tests_after_trace: `npm run test:ia:handoff` -> ok (exitCode=0, duracionMs=0)
  resultado: 11/11 pruebas pasaron.
- omr_score_vector_comparison: `comparación agregada de los reportes JSON OMR de 39 capturas` -> ok (exitCode=0, duracionMs=0)
  resultado: Variante y repetición restaurada: 0 diferencias en scores completos, respuesta, estado y QR. Frente al reporte anterior, 25 filas tienen vectores scoreDetails distintos y concentran 67 cambios de respuesta.
- omr_map_fingerprint_test: `node --test apps/backend/scripts/tests/omr-map-geometry-fingerprint.test.mjs` -> ok (exitCode=0, duracionMs=92)
  resultado: 2/2 pruebas pasaron: hash estable excluye ids/payload QR y cambia al mover geometría OMR/QR.
- omr_photo_fingerprinted_39: `node --import tsx apps/backend/scripts/omr-eval-real-dataset.mjs (concurrencia 2; scoreDetails y hints runtime fixture)` -> ok (exitCode=0, duracionMs=1640284)
  resultado: 39/39, 376/487 emitidas concordantes con etiquetas heredadas, 311/397 concordancias únicas; QR 2/39, sin rescates y sin payload erróneo; 0 errores; 27:20 min y RSS pico 2,169 MiB. 39 mapas hasheados, 32 hashes únicos; huella OMR de 27 archivos y del evaluador incluida.
- omr_fingerprinted_repeat_compare: `comparación agregada entre reportes JSON OMR de 39 capturas` -> ok (exitCode=0, duracionMs=0)
  resultado: 39 filas: 0 diferencias de respuesta, estado, score y metadata geométrica frente a la repetición restaurada previa; clave y observaciones coinciden 39/39.
- omr_fingerprint_metadata_smoke: `node --import tsx apps/backend/scripts/omr-eval-real-dataset.mjs (una captura, concurrencia 1)` -> ok (exitCode=0, duracionMs=0)
  resultado: 1/1 procesada; mapGeometrySha256, omrSourceSha256 y geometryFingerprintModuleSha256 válidos. El QR de esa captura no se leyó; el smoke valida la instrumentación, no la calidad QR.

## Decisiones
- Habilitar recuperación de candidata parcial solo con confianza >=0.72 y compacidad >=0.35 y permiso de estado/origen.
- Mantener abstención para doble marca/tachadura.
- Interpretar los replays contra etiquetas almacenadas como concordancia y no como exactitud independiente.
- La ruta core-fill queda acotada por núcleo, margen, score competidor, compacidad, centro, contraste y rechazo de marcas invalidantes; las etiquetas fotográficas heredadas se reportan como concordancia condicionada.
- La lectura QR por foto sigue sin mejora: conservar identidad exacta y rescates separados, sin inferir legibilidad a partir de los objetos PDF.
- Mantener en revisión el caso de X/tachadura hasta adjudicar si una X repasada en una sola burbuja representa respuesta válida.
- No declarar eficiencia estable: una corrida tuvo más RSS pico pese a tardar 0.7 min menos; repetir medición en condiciones comparables.
- El pico de 2,209 MiB observado en un replay no es reproducible en una repetición idéntica (1,580 MiB); no atribuirlo al cambio OMR sin nuevas mediciones.
- Retirar la regla experimental de abstención parcial: su ejecución y la repetición después de retirarla tuvieron cero diferencias agregadas y por reactivo, sin beneficio medible.
- No atribuir la diferencia de 67 respuestas frente al benchmark anterior: coinciden los vectores de clave y etiquetas observadas en 39/39 filas, pero no se guardaron los mapas geométricos completos; dos filas difieren en metadatos geométricos.
- Frente al replay anterior cambian 67 respuestas y sus scores en las mismas 25 capturas; no se guardaron los mapas geométricos, hash de base de datos ni huella de código. No se asigna causa.
- Se incorpora huella SHA-256 del mapa geométrico OMR por página y huella de los archivos fuente del módulo y del evaluador para que futuras iteraciones prueben equivalencia de mapas/código sin guardar IDs ni payload QR.
- En las 67 diferencias frente al replay antiguo, 64 letras previas aún son el máximo score actual; la señal es parcial y débil, pero las etiquetas heredadas impiden calibrar o emitirlas como verdad independiente.
- Huella del replay completo: módulo OMR 27 archivos SHA-256 aa5afa7f9588004596af7d2219b1868284ad767144027511d916e18a1a8e0e0b; evaluador SHA-256 9a74d8a1fec97313c6e8b07159e302e03766c29f917c49c0158b0fdfa3346823; módulo de huella SHA-256 3a72089e2f1d955e7b593d38981ea489ffaabd79eab1ff55e1b8a514dc4327c9 (calculado después del replay, sin cambios al archivo).

## Supuestos
- Ninguna etiqueta almacenada se considera adjudicación independiente salvo inspección visual de los 8 recortes manuales.
- Global48 y los PDF CamScanner carecen de etiquetas de respuesta enlazadas en estos reportes; sus resultados solo miden cobertura, estados y QR.
- Las ocho etiquetas manuales son observaciones visuales no adjudicadas; no se tratan como verdad terreno independiente.

## Riesgos abiertos
- Un replay fotográfico previo mostró 443/443 letras emitidas concordantes con etiquetas observadas y 356/397 respuestas únicas; la procedencia heredada impide presentarlo como exactitud independiente. Un replay posterior emitió 376/487 y 311/397, pero faltan mapas geométricos completos para atribuir la diferencia.
- Global48 suma 12 respuestas y elimina 11 ambigüedades, pero carece de etiquetas de respuesta para confirmar si las nuevas determinaciones son correctas.
- QR exacto: 2/39 fotos móviles, 34/48 Global48 tras rescates y 0/16 páginas CamScanner; ningún payload incorrecto observado.
- En ocho ejemplos manuales de formas, tres de seis X coinciden con la opción visual y tres quedan dobles; un trazo cruzado produce respuesta automática y requiere adjudicación.
- El pico RSS de 2,209 MiB ocurrió una vez; una repetición idéntica registró 1,580 MiB frente a 1,598 MiB de referencia y tardó 24.16 min frente a 25.18 min. La primera medición atípica no se reprodujo.
- No hay evidencia de impresión física y captura fotográfica de una plantilla nueva.
- El árbol ya tenía cientos de cambios preexistentes; no se hizo commit ni se revirtieron archivos ajenos.
- Comparación fotográfica: la variante experimental y la repetición tras retirarla son idénticas. Frente al benchmark anterior cambian 67 respuestas y sus vectores de score en las mismas 25 capturas; solo dos filas cambian geometryMode, y faltan transformaciones completas, hash de base de datos y huella del código. La causa no está aislada.
- El replay fingerprinted repite exactamente respuestas, estados y scores respecto a la corrida restaurada, pero el tiempo subió a 27:20 y el RSS a 2,169 MiB frente a 23:57/1,570 MiB. Eficiencia de recursos no reproducible en dos corridas.

## Estado del arbol
```txt
árbol compartido con cientos de cambios preexistentes; cambios ajenos preservados; sin commit
```

## Siguiente paso recomendado
- Usar el replay fingerprinted como baseline; obtener adjudicación independiente de las candidatas parciales débiles antes de calibrar decisión OMR. Diagnosticar el QR en las 37 capturas sin lectura/rescate y seguir validando impresión física de TV4 en varios dispositivos.

## Artefactos generados
- docs/handoff/sesiones/2026-09-29/omr-cv-qr-template-20260929.json
- docs/handoff/sesiones/2026-09-29/omr-cv-qr-template-20260929.md

## Completitud semantica
- isComplete: false
- adjudicar el ejemplo manual X/trazo cruzado
- mejorar y validar QR en fotografías CamScanner
- capturar hojas TV4 recién impresas
- obtener adjudicación independiente para las etiquetas de respuesta
- comparar mapas geométricos completos entre replays y explicar la variación de cobertura

## Investigación técnica de rutas de mejora

### Evidencia del repositorio y del barrido
- El lector ya usa jsQR y ZXing (`TRY_HARDER`), búsqueda focal con varios umbrales y ampliación, rectificación por geometría/fiduciales y cotejo exacto del payload. La suite geométrica dio 30/30; el evaluador pasó typecheck y `node --check`.
- SPEC-062 registra QR históricos superpuestos y evidencia 0/8 y 0/24 en PDFs previos frente a 1/1 en una página TV4 nueva. El renderer calcula el QR preliminar con `dibujar=false` y dibuja el QR final al conocer la página. Hay que separar falla estructural del impreso histórico de error de lectura sobre plantilla nueva.
- El barrido de 256, 512, 640 y 768 px en tres capturas que fallaban con 384 dio 0/3 payloads exactos por tamaño, sin errores ni payloads erróneos. No cambia el default ni demuestra mejora.

### Vertientes y orden recomendado
1. **Integridad física del símbolo.** Verificar en raster de página completa que exista un solo QR, el payload por página, una zona silenciosa de cuatro módulos y ausencia de superposición. DENSO WAVE describe ese margen libre y advierte que un diseño superpuesto puede volver imposible la lectura. La superposición histórica tiene evidencia local; no se atribuye al motor.
2. **Resolución efectiva y captura real.** Medir píxeles por módulo en el recorte rectificado, blur, compresión, inclinación, reflejo y exposición por cámara. Registrar dispositivo y distancia. Separar páginas repetidas entre calibración y validación.
3. **Geometría y detector alterno.** Preservar homografía/fiduciales actuales; comparar las cuatro esquinas con las marcas observadas y registrar error geométrico. ZXing ya es el segundo decoder. OpenCV QRCodeDetector ofrece ajuste del patrón finder y marcadores de alineación; evaluarlo offline primero, sin dependencia nueva, y aceptar solo payload exacto.
4. **Preprocesamiento y densidad del payload.** Probar variantes acotadas de grises, umbral adaptativo, contraste y remuestreo sobre el mismo crop; medir detección y costo. Comparar payload corto y legado, y niveles de corrección/versiones al mismo tamaño físico, conservando firma y lookup local. Menos módulos aumenta resolución por módulo; más corrección puede ayudar con daño, pero no recompone dos símbolos impresos encima.
5. **Calibración y posible entrenamiento OMR.** El pipeline inspeccionado es CV determinista con rasgos y umbrales; no se encontró modelo entrenable integrado. Antes de ajustar reglas o entrenar un clasificador, adjudicar marcas de forma independiente. Particionar por hoja/dispositivo/lote para evitar fuga. Medir matriz de confusión por estado, error de letra emitida, cobertura/abstención y tiempo/RSS por estrato.

### Fuentes técnicas primarias
- ISO/IEC 18004:2024 especifica simbología, dimensiones, corrección de errores y calidad de producción: https://www.iso.org/standard/83389.html
- DENSO WAVE especifica margen libre de cuatro módulos y documenta degradación por superposición: https://www.qrcode.com/en/howto/code.html y https://www.qrcode.com/en/faq.html
- OpenCV documenta QRCodeDetector, ajuste `setEpsX/Y` y marcadores de alineación: https://docs.opencv.org/4.8.0/de/dc3/classcv_1_1QRCodeDetector.html
- El código fuente ZXing muestra detección/decodificación separadas y `PURE_BARCODE`; el repo ya usa `TRY_HARDER`: https://github.com/zxing/zxing/blob/master/core/src/main/java/com/google/zxing/qrcode/QRCodeReader.java
- Un estudio primario evalúa localización QR con binarización, patrones finder y ajuste progresivo de límites bajo perspectiva. Sirve como alternativa experimental, no como evidencia de mejora en EvaluaPro: https://doi.org/10.3390/app10217814

### Evaluación de release
No se libera versión: 1.1.6 está configurada, pero no existe evidencia versionada para ella ni un manifiesto multi-flavor con binarios en `dist/installer`; el checkout tiene cambios pendientes y la traza registra gates de calidad fallidos. La promoción requiere QA fresco ligado a commit limpio, artefactos firmados, racha CI y evidencias Classroom/flujo humano. El gate stable no es satisfacible todavía.


La revisión documental posterior terminó con `npm run docs:check` en `[docs] ok`; la traza de handoff pasó 11/11 y la de trazabilidad 7/7.


## Benchmark OpenCV sobre todos los corpora

Se añadió apps/backend/scripts/diagnosticos/omr-qr-opencv-benchmark.py como herramienta offline reproducible. No agrega dependencias al runtime EvaluaPro; requiere OpenCV/Pillow/NumPy disponibles en el entorno de investigación. Compara página completa, ROI focal aproximada, CLAHE, Otsu, umbral adaptativo, ampliación cúbica y tres tolerancias epsX/Y. No emite payloads, nombres de archivo ni identificadores.

- Fotos: 38/39 filas estaban accesibles y OpenCV encontró 0 payloads exactos en todas las variantes. El cotejo SHA-256 confirma que los 38 archivos presentes conservan los 38 contenidos únicos del reporte; falta solo una copia duplicada.
- Global48: 48/48; la unión de variantes OpenCV acertó 19/48, frente a 34/48 exactos del motor actual. Los 19 coincidieron con lecturas actuales: 0 rescates exclusivos y 0 payloads erróneos.
- CamScanner: 16/16; 0 payloads exactos.
- Duración conjunta 86.97 s. Se descarta incorporar OpenCV al runtime por este resultado: no añade cobertura y tiene costo de ejecución.

Comando repetible (sustituir rutas por los JSON locales):
```powershell
python apps/backend/scripts/diagnosticos/omr-qr-opencv-benchmark.py --report photos39=<ruta-json> --report global48=<ruta-json> --report camscanner16=<ruta-json>
```


## Payloads legacy y plantilla actual

Longitudes esperadas de los reportes reales: fotos 151–156, Global48 147–150 y CamScanner 145–148 caracteres. Son formatos históricos autocontenidos. El constructor actual de ExamenPdf TV4 usa el modo compacto para emitir identidad de examen/página/versión más HMAC de 12 bytes en Base64URL. Así, esos corpora no validan directamente el tamaño del nuevo QR corto; sí validan lectura de legado y desempeño sobre páginas históricas.

El subconjunto de pruebas de QR/PDF pasó 5 pruebas; 8 quedaron filtradas por nombre. El benchmark OpenCV completo dio 0 rescates exclusivos y 0 payloads incorrectos. No hay cambio de decodificador ni de default en producción. Hace falta la captura física de una hoja TV4 recién impresa para medir QR actual con cámara real.


Estado verificado para promoción estable: versión configurada 1.1.6; no existe su carpeta de evidencias ni el manifiesto multi-flavor del instalador. dist/installer solo contiene _internal y el checkout tiene 437 rutas modificadas. Permanece No-Go.


La validación focal de PDF sí incluyó rasterización: 2 pruebas pasaron (6 omitidas). Una generó TV4 canónica; otra generó 25 reactivos en 2 páginas y decodificó payloads exactos después de rasterizar, reducir a 1600 px, aplicar blur 0.3 y JPEG calidad 72. Es cobertura sintética de captura, no impresión/foto física.
