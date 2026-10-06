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

## Persistencia

- Una petición de revisar o calcular permite preparar el resultado; escribirlo requiere una petición explícita para registrar, importar o publicar las calificaciones.
- Para una escritura autorizada, sigue el contrato de la ruta: permisos, `{ confirmarEscritura: true }`, `clientRequestId` UUID persistido antes del POST y estable para reintentos del mismo payload; envía `X-EvaluaPro-Equipo`/lease cuando esté configurado. Presenta el alcance exacto, resultados finales, pendientes y destino. Si la respuesta queda incierta, consulta por ID/historial antes de repetir; nunca reuses una clave con payload distinto.
- Usa Classroom solo a través de la UI/API de EvaluaPro. Si la integración no está disponible, detente antes de importar o modificar calificaciones.
- No cambies la clave, las respuestas ni las puntuaciones almacenadas para hacerlas coincidir con una expectativa. Conserva auditoría y resultado original; una corrección debe pasar por el flujo autorizado y trazable.

## Entrega

Informa cuántos exámenes se revisaron, cuántos quedaron calificados y cuántos requieren revisión; resume el puntaje y la evidencia relevante. Si hubo una escritura autorizada, identifica el destino, el resultado de persistencia y la comprobación de lectura. No afirmes que se imprimió, publicó o sincronizó si solo se procesó el escaneo.
