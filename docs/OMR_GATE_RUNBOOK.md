# Runbook OMR canónico

## Objetivo

Ejecutar y validar la única plantilla OMR soportada por EvaluaPro, desde la generación del PDF hasta la calificación automática.

## Prerrequisitos

- Node 24.
- Dependencias instaladas (`npm ci`).
- Backend CV operativo (`npm -C apps/backend run omr:cv:smoke`).
- Dataset sintético vigente: `omr_samples_tv4/`.
- Piloto de captura real: `omr_samples_tv4_pilot_real/`.

## Flujo operativo

Generar y evaluar el dataset sintético:

```bash
npm -C apps/backend run omr:generate:synthetic
npm -C apps/backend run omr:eval:synthetic
```

Preparar o validar el piloto real:

```bash
npm -C apps/backend run omr:build:pilot-real
npm -C apps/backend run omr:validate:pilot-real
npm -C apps/backend run omr:diagnose:pilot-real
```

Ejecutar el gate bloqueante de CI:

```bash
npm run test:omr:canonical:gate:ci
```

## Evidencia generada

- `reports/qa/latest/omr/canonical-synthetic-eval.json`
- `reports/qa/latest/omr/canonical-pilot-real-validation.json`

El reporte sintético separa la lectura cruda de la decisión de calificar: `precision`,
`falsePositiveRate`, `invalidDetectionRate` y `pagePassRate` evalúan lectura; `autoGradeTrustRate`
evalúa solo notas que la misma política de producción habría emitido; `autoCoverageRate` mide
cuántas páginas claramente elegibles fueron autocalificadas. `automaticGradeDiscordances` debe
ser cero. Una abstención no se cuenta como nota discordante y tampoco aumenta la cobertura.
Estas métricas sintéticas no habilitan el gate real ni sustituyen etiquetas humanas independientes.
- `reports/qa/latest/omr/canonical-pilot-real-failures.json`
- `reports/qa/latest/omr-canonical-gate-wrapper.json`

## Dataset de captura real

El piloto vigente conserva `manifest.json`, mapas y verdad esperada. No copies las etiquetas automáticas de `panel_darkness_v1` como verdad terreno. Etiqueta a ciegas desde la captura original todas las páginas con identidad ya asociada, incluidas las que la ingesta marca `accepted`; las respuestas sugeridas, candidatas, confianza y señales OMR/OCR permanecen ocultas. La UI requiere cargar la captura original y confirmar la revisión ciega. La API guarda la etiqueta en `groundTruthReview`, separada de las predicciones, estado y paquete del examen, con `reviewerAttested: true`, `omrPredictionsHidden: true`, revisor seudónimo y fecha. El exportador y el validador requieren esa atestación además de la evidencia `manual_visual_review`; etiquetas históricas sin la marca se conservan pero no cuentan ni se exportan. La UI las identifica como no verificadas y solicita crear una ingesta nueva para revisarlas porque la etiqueta guardada es inmutable. El validador compara `pageImageSha256` con la imagen exacta incluida en el dataset; las filas con evidencia de detector, sin atestación o cuyo hash no coincide quedan fuera del gate. También rechaza la misma imagen exacta asignada a folios distintos, y comprueba que el QR de manifest/mapa sea idéntico y represente el folio, página y versión TV4 declarados (una firma presente debe validar). Las etiquetas deben incluir casos válidos, blancos, dobles marcas, tachaduras y anotaciones del bono antes de incorporarse al manifest de validación.

Si el lote contiene variantes, agrega `answerKeyByFolioPath` al manifest y proporciona una clave visible completa por cada folio. El validador rechaza folios sin clave y claves distintas entre páginas del mismo examen; conserva además el hash SHA-256 del archivo de claves por folio.

El exportador QA conserva el PDF de origen sin recomprimir y un manifiesto de etiquetas sin nombres, folios ni IDs de examen. Verifica el SHA-256 del ZIP exportado antes de procesarlo. No edites el original ni marques como revisado un resultado derivado solo del detector. Las etiquetas guardadas por versiones anteriores de la UI no acreditan revisión ciega y deben volver a capturarse antes de usarse como verdad terreno.

El ZIP también contiene `pilot-real/` listo para el builder: páginas fuente rasterizadas a 300 dpi, mapas TV4 extraídos del manifiesto de recuperación firmado, etiquetas manuales por reactivo y claves completas por folio. Extrae el ZIP a una carpeta temporal y ejecuta:

```bash
npm -C apps/backend run omr:build:pilot-real -- --dataset ../../omr_samples_tv4_pilot_real --source-manifest <ruta-extraida>/pilot-real/pilot_import.json
npm -C apps/backend run omr:validate:pilot-real
```

El paquete incluye contenido identificable en las capturas y PDF originales; guárdalo solo en el almacenamiento local aprobado. La clave se obtiene del manifiesto firmado del examen y nunca de las respuestas del alumno. El builder compara cada etiqueta contra el mapa y no rellena reactivos faltantes.

Si el manifiesto no tiene capturas, el wrapper registra `not_applicable`, `validated: false` y termina con código 1. Un piloto vacío no puede producir un pase de CI.

El gate exige que los límites inferiores unilaterales exactos Clopper–Pearson al 95% de concordancia de nota final y del bono sean ambos `>= thresholds.gradeConsistencyLower95Min` (0.99 por defecto). La comparación de nota incluye el bono humano visible y el tope de 5; la comparación aparte del bono detecta errores ocultos por ese tope. En cada proporción, para `n` comparaciones y `k` concordancias, el límite es el cuantil `0.05` de una distribución Beta con parámetros `k` y `n-k+1`; sin concordancias el límite es cero. Con cero discordancias se requieren al menos 299 exámenes completos e independientes por comparación. La primera página de cada folio debe incluir la etiqueta humana ciega `bonusVisible`; no se infiere del estado de entrega ni del OCR. Si el OCR no confirma literalmente `+0.25`, la detección del bono queda indeterminada, el examen se excluye de la muestra de notas automáticas y requiere revisión humana; la incertidumbre no se registra como `bonus:absent`. `metrics.bonusAbstentions` cuenta esas abstenciones por examen y `perCapture[].bonusDetectionStatus` distingue `confirmed`, `indeterminate` y `not_applicable`. Las capturas deben representar las condiciones previstas y no agrupar recapturas o exámenes dependientes como observaciones independientes. Si algún límite es nulo o menor al umbral, el gate falla aunque la concordancia observada sea 100%.

Además del umbral estadístico, el lote más reciente se valida como conjunto completo: todas las páginas declaradas deben estar presentes y pasar (`pagePassRate = 1`), todas las páginas claramente elegibles deben quedar calificadas automáticamente (`autoCoverageRate = 1`) y toda calificación automática debe concordar con la verdad terreno (`autoGradeTrustRate = 1`). El runtime no abre el gate si falta alguna de estas métricas o si es menor que 1. El manifest de lote debe derivarse de la asociación canónica folio/página y declarar todas las páginas esperadas; no se puede demostrar completitud comparando solo dos conteos agregados.

El reporte incluye concordancia por condición (`mark:valid`, `mark:blank`, `mark:double`, `mark:smudge`, `bonus:visible` y `bonus:absent`). Para cada condición informa reactivos/bonos comparados y exámenes completos e independientes, contando un examen como discordante si alguna unidad de esa condición difiere; incluye concordancia observada y límite inferior exacto unilateral al 95%. Estos estratos son diagnósticos adicionales y no se agregan al tamaño de muestra global. También incluye `evidenceHashes.omrRuntimeConfigSha256`, calculado con `NODE_ENV` y todas las variables `OMR_*` presentes al validar (se publica solo la huella, no sus valores). Para abrir el gate, configura `EVALUAPRO_OMR_TV4_REAL_PILOT_REPORT` con la ruta local del reporte aprobado que produjo el validador. El runtime exige `status: passed`, todos los checks en true, huellas completas, al menos 299 comparaciones independientes de nota y bono, límites inferiores >=0.99, pagePassRate = 1, autoGradeTrustRate = 1, autoCoverageRate = 1 y coincidencia exacta de la configuración OMR. Un valor genérico, un reporte fallido/incompleto, una ruta ausente o una configuración diferente mantienen el gate cerrado. Si cambia una variable OMR, vuelve a ejecutar el piloto antes de habilitar el nuevo entorno.

## Checklist de liberación

- Smoke CV aprobado.
- Gate sintético aprobado.
- Gate de captura real aprobado con imágenes y ground truth reales.
- Para el lote más reciente: `pagePassRate = 1`, `autoGradeTrustRate = 1` y `autoCoverageRate = 1`.
- Sin regresiones en las pruebas OMR/PDF críticas.
- No existen rutas de compatibilidad ni datasets de versiones anteriores.

## Troubleshooting

- `falsePositiveRate` alto: revisar `OMR_RESPUESTA_CONF_MIN`, `OMR_SCORE_MIN` y `OMR_DELTA_MIN`.
- `autoGradeTrustRate` bajo: revisar `OMR_AUTO_CONF_MIN`, `OMR_AUTO_AMBIGUAS_MAX` y `OMR_AUTO_DETECCION_MIN`.
- `autoCoverageRate` bajo: revisar `perCapture[].motivosAutoCalificacion`; no reducir límites sin revisar señales por reactivo.
- `autoCoverageRate < thresholds.autoCoverageMin`: revisar calidad, geometría y páginas con mayor número de mismatches; no forzar páginas en producción.
- `fuera_roi` o errores geométricos: revisar fiduciales, `OMR_ALIGN_RANGE`, `OMR_VERT_RANGE` y el perfil geométrico activo.
