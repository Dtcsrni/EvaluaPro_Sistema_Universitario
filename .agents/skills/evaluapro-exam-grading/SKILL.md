---
name: evaluapro-exam-grading
description: Revisa, interpreta y califica exámenes de EvaluaPro con clave, variante y evidencia OMR verificadas. Úsala para revisar hojas contestadas o resultados; persiste calificaciones solo cuando el usuario lo solicite explícitamente.
---

# Revisión y calificación de exámenes en EvaluaPro

Usa EvaluaPro como sistema de registro. Mantén separadas la lectura OMR, la calificación calculada, la calificación persistida y cualquier exportación o sincronización posterior.

## Verificación antes de calificar

1. Identifica el examen exacto con sus datos registrados: `loteId`, `folio`, `examId`, alumno, tipo, plantilla y variante. Conserva los identificadores por separado; muestra `LOTE-FOLIO` como clave legible cuando corresponda.
2. Verifica que la hoja corresponda a ese examen y alumno mediante los identificadores disponibles. No emparejes por nombre de archivo solamente ni combines páginas de folios distintos.
3. Recupera la clave de respuestas y el orden de preguntas/opciones de la variante registrada. Si la clave o la variante no se puede confirmar, no emitas una calificación final.
4. Procesa la hoja con el flujo OMR soportado por la instancia de EvaluaPro. Inspecciona sus advertencias, confianza y estados por pregunta. Usa la API documentada y `scripts/api/evaluapro-client.mjs`; no accedas directamente a SQLite/Prisma ni uses una IA externa para asociar alumno/examen o convertir predicciones en notas.
   Si el acceso interactivo al portal es necesario, aplica antes `evaluapro-local-session-readiness` y confirma que API y UI respondan antes de abrir el navegador.
5. Mantén QR/folio e imagen de respuestas como análisis separados. Si una rotación se aplicó para recuperar el QR, vuelve a la página fuente para leer OMR; no reutilices la imagen rotada como evidencia de respuestas.

## Interpretación

- Separa respuestas detectadas, respuestas ambiguas, omisiones, errores de lectura y reactivos anulados. No conviertas una detección ausente o ilegible en una respuesta elegida.
- Si hay doble marca, tachadura, baja confianza, página faltante, asociación conflictiva o diferencia entre clave/variante, deja el reactivo pendiente de revisión humana y explica qué evidencia falta.
- Calcula el puntaje solo con la clave y regla de puntuación vigentes para ese examen; declara escala, denominador y redondeo si el resultado depende de ellos. No inventes tolerancias ni ajustes.
- Distingue una omisión OMR legible de trabajo pendiente o dato faltante en otra fuente. Nunca conviertas una tarea pendiente, una imagen ilegible o un fallo de importación en cero.
- Mantén el resultado OMR separado de componentes manuales y de calificaciones de Classroom. No copies el resultado a una columna de lista institucional ni sincronices Classroom por inferencia.

## Autocalificación OMR local

- Antes de usarla, verifica que la función esté disponible en la UI/API del runtime activo y que el gate de precisión esté abierto. Cambios de worktree, pruebas sintéticas o respuestas antiguas de la UI no prueban que la instalación la tenga habilitada.
- Envía las capturas originales al servidor para que vuelva a validar QR, lote, folio, página, variante y clave registrados. No uses OCR generativo, nombres de archivo ni datos aportados por el cliente como autoridad para identidad o respuestas.
- Permite nota automática solo cuando todas las páginas y reactivos requeridos estén presentes, no duplicados, con identidad/variante exactas y sin estados ambiguos, dobles marcas, tachaduras o baja confianza. Una omisión confirmada cuenta como incorrecta; una lectura faltante o incierta queda en revisión.
- Procesa los exámenes elegibles por separado. Una excepción de un alumno no debe detener a los demás ni permitir que una respuesta o bono se comparta entre folios.
- Para lote, prepara una tabla con `loteId`, `folio`, `examId`, `alumnoId`, páginas, variante, clave, respuestas, excepciones, aciertos/total, bono y estado de escritura. Muestra primero solo las excepciones que requieren revisión.
- Tras registrar, vuelve a leer cada nota y verifica identidad, folio, aciertos, total, bono y nota final. Un timeout o respuesta incierta exige consultar el job/historial antes de reintentar.
- No habilites autocalificación general hasta validar el gate con capturas reales representativas y verdad terreno revisada independientemente. Exige que el límite inferior unilateral exacto Clopper–Pearson al 95% de concordancia de notas sea `>= 0.98`; con cero discordancias requiere 149 exámenes completos e independientes. Cuenta una observación por examen, no por página ni recaptura. Reporta por separado cota, concordancia observada y cobertura; el éxito sintético no sustituye evidencia real.

### Si el gate sigue cerrado: capturar verdad terreno

1. Usa la ingesta local del `loteId` exacto y conserva separado el PDF escaneado del PDF generado. Etiqueta solo páginas con asociación canónica confirmada a `examId`, folio, alumno y número de página; resuelve primero cualquier página sin identidad segura.
2. Abre la captura original y registra cada reactivo desde esa imagen sin consultar la predicción, confianza, candidata OMR/OCR ni la clave. La UI debe indicar revisión ciega y bloquear el guardado hasta mostrar la imagen y confirmar la revisión.
3. Usa el selector único por reactivo: opción `A–E`, en blanco, doble marca o tachadura. Para una doble marca, registra todas las opciones observadas; no conviertas tachaduras o dudas en una respuesta única.
4. En la primera página del examen indica si el área de calificaciones muestra literalmente `+0.25`; no deduzcas el bono de que el alumno haya entregado o aparezca en un escaneo.
5. Guarda la etiqueta en el registro independiente y exporta solo las páginas elegibles con hash de imagen y procedencia de revisión ciega. La API debe persistir `reviewerAttested: true` junto con el revisor seudonimizado y la fecha; las etiquetas históricas sin esa marca no cuentan como verdad terreno y requieren una nueva ingesta porque son inmutables. Una etiqueta no cambia el resultado OMR ni escribe una calificación.
6. Ejecuta el validador de piloto y revisa concordancia de nota y bono, límite inferior, cobertura y discordancias. Las páginas del mismo examen, duplicados y recapturas no aumentan el tamaño independiente de muestra. Si el gate no pasa, conserva la autocalificación cerrada.

## Escala del examen y bono de acordeón

- El componente de examen usa escala 0–5 y nunca supera 5.
- El bono es exactamente `+0.25` y solo procede si aparece impreso explícitamente como `+0.25` en el área de calificaciones de esa hoja. Haber entregado o escaneado el examen no demuestra el bono. Si OCR no confirma el contenido del área, no asumas que está vacío: marca revisión docente y no guardes aún la nota automática.
- Si la revisión visual confirma que no aparece, el bono es cero. El resultado final es `min(5, nota base + bono confirmado)`; una nota base de 5 permanece en 5.

## Persistencia

- Una petición de revisar o calcular permite preparar el resultado; escribirlo requiere una petición explícita para registrar, importar o publicar las calificaciones.
- Para una escritura autorizada, sigue el contrato de la ruta: permisos, `{ confirmarEscritura: true }`, `clientRequestId` UUID persistido antes del POST y estable para reintentos del mismo payload; envía `X-EvaluaPro-Equipo`/lease cuando esté configurado. Presenta el alcance exacto, resultados finales, pendientes y destino. Si la respuesta queda incierta, consulta por ID/historial antes de repetir; nunca reuses una clave con payload distinto.
- Usa Classroom solo a través de la UI/API de EvaluaPro. Si la integración no está disponible, detente antes de importar o modificar calificaciones.
- No cambies la clave, las respuestas ni las puntuaciones almacenadas para hacerlas coincidir con una expectativa. Conserva auditoría y resultado original; una corrección debe pasar por el flujo autorizado y trazable.

## Entrega

Informa cuántos exámenes se revisaron, cuántos quedaron calificados y cuántos requieren revisión; resume el puntaje y la evidencia relevante. Si hubo una escritura autorizada, identifica el destino, el resultado de persistencia y la comprobación de lectura. No afirmes que se imprimió, publicó o sincronizó si solo se procesó el escaneo.
