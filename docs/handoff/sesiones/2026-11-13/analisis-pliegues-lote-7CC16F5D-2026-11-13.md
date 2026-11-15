# Revisión de pliegues y fiduciales — lote 7CC16F5D

Fecha: 2026-11-13

Alcance: auditoría visual de 48 páginas escaneadas y cambios OMR/PDF asociados.

## Corpus y método

- `CamScanner 07-11-2026 02.33.pdf`: páginas fuente 1–47.
- `CamScanner 07-11-2026 03.12.pdf`: página fuente 48.
- Se rasterizaron las páginas para revisar por separado las esquinas superiores izquierda y derecha; se cotejaron las marcas de orientación, el QR, el encabezado y el pie.
- Los originales no se copiaron al repositorio. La clasificación es visual y cualitativa: un borde de otra hoja o pliegue cercano no prueba por sí solo que el fiducial esté totalmente cubierto.

## Hallazgos de orientación y pliegue

- Las 48 capturas muestran el encabezado y el texto en orientación vertical normal; no se observó un giro cardinal de la hoja. La marca direccional hueca corresponde a la esquina superior izquierda y el cuadrado sólido a la superior derecha; el QR aparece en la cabecera.
- Los pliegues/solapamientos diagonales se concentran en bordes superiores y alternan de lado entre páginas. Ejemplos visibles junto a la esquina superior derecha: 2, 10, 14, 21, 25, 29, 33, 37, 41, 45 y 48.
- Ejemplos visibles junto a la esquina superior izquierda: 7, 11, 15, 18, 22, 26, 30, 34, 38, 42 y 46.
- En esos ejemplos algunos cuadrados siguen visibles y otros quedan parcialmente deformados o próximos a la línea del pliegue. La revisión no asigna un porcentaje de oclusión: no hay máscara de verdad terreno por píxel.
- La guía impresa de grapado está arriba a la izquierda en la primera página. Las capturas no permiten afirmar que todos los pliegues observados procedan de una grapa; en particular, varios pliegues visibles llegan desde el borde derecho. Se conserva la guía sin ampliarla sobre logo o fiduciales.

## Cambios implementados

- El ajuste local de respuestas usa consenso robusto con tres o más marcas no colineales y elimina puntos atípicos. Con dos marcas aplica únicamente escala y traslación por eje, dentro de límites; no inventa puntos del lado opuesto para mapas antiguos.
- Si se pierde una marca global de esquina pero el QR tiene geometría fiable, el QR proporciona la referencia global y se emite una advertencia con el conteo parcial. Sin QR, una orientación geométrica incompleta no se presenta como homografía confiable.
- El margen físico de `GRAPA` conserva el despeje que pasa las guardas de layout. Una ampliación adicional de 8 mm se probó y rechazó porque invadía logo e iconos; no se dejó ese cambio.
- El patrón de cabecera ahora integra rombos, diagonales y rosetones poligonales vectoriales de dos tonos, con mayor presencia visual. QR, fiduciales, burbujas y zonas de respuesta mantienen sus reservas limpias y de alto contraste.

## Verificación

- Backend typecheck: `npm run typecheck` — aprobado.
- Suites focales OMR/PDF: 6 archivos, 112/112 pruebas aprobadas; incluyen rescate de una esquina, ajuste local parcial, QR rasterizado, paridad a 150/300 DPI y exclusión de GRAPA.
- La prueba raster visual de 39 casos tardó aproximadamente 129 s.
- Pendientes: impresión física con pliegues controlados y OCR independiente sobre una copia impresa. El análisis visual no certifica todos los daños de papel ni reemplaza una verdad terreno anotada.
