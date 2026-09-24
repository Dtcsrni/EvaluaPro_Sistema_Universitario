---
id: SPEC-042
titulo: Estudio de Diseño de Exámenes y Producción Masiva con Folios Únicos
version: 1.26.0
fecha: 2026-09-12
autor: Antigravity / EvaluaPro Team
modulo: modulo_diseno_examenes
estado: implemented
---

## Contexto
Maquetación de la estructura del examen por temas y producción masiva de paquetes PDF con folios únicos, códigos QR individualizados y hojas de burbujas OMR.

## Norma de alcance y precedencia

Esta especificación define la primera plantilla operativa canónica del sistema. Su identidad es `OMR canónico · v4` / `omr-canonical-v4`; la versión de la aplicación es un dato independiente. La plantilla canónica sustituye las generaciones anteriores: no se permite seleccionar, detectar, calificar, reconstruir ni importar una versión histórica mediante `latest`, nombres de archivo, heurísticas o fallback silencioso.

Los requisitos de esta sección son normativos y prevalecen sobre ejemplos visuales antiguos, PDFs temporales, capturas de pantalla y documentos de versiones previas. Un artefacto visual solo se considera aceptado cuando coincide con el mapa geométrico persistido y supera los gates automatizados, de rasterización y, cuando corresponda, de captura física.

## Especificación técnica exacta del PDF

### 1. Página, margen y zona imprimible

- Formato físico: Letter, `612 × 792 pt` (`215.9 × 279.4 mm`), sin rotación.
- Margen nominal del contenido: `10 mm = 28.346 pt` en los cuatro lados.
- Zona segura inferior adicional: `4.5 mm = 12.756 pt`; ningún contenido, panel OMR, línea, fiducial o texto puede terminar por debajo de `y = 41.102 pt`.
- Las marcas de registro son cuadrados negros de `7 mm = 19.843 pt`, con quiet zone de `0.8 mm = 2.268 pt`, completamente dentro de la hoja y sin abrirse hacia el exterior del papel.
- El renderer debe fallar explícitamente ante cualquier rectángulo fuera de la página, fuera del margen seguro o fuera del contenedor que lo gobierna.
- El PDF debe rasterizarse y revisarse a `150 DPI` y `300 DPI`; la comprobación a 300 DPI es la referencia de detalle y la de 150 DPI la comprobación conservadora de legibilidad.

### 2. Encabezado estructural canónico

- Altura de la primera cabecera: dinámica, `max(headerHeightFirst, 102 pt, qrSize + 2·qrPadding + separacionQRFiducial + 2 pt)`; el mapa debe registrar la altura efectiva. Las páginas de continuación solo conservan la reserva estructural mínima definida por `headerHeightOther` y no reservan una caja ni una banda de separación superior.
- El encabezado conserva la estructura funcional: logotipos configurados, reserva aislada del QR, campos de nombre y grupo, y las indicaciones integradas en una fila propia debajo de los campos de datos.
- La plantilla canónica dibuja el título funcional y la identidad institucional solicitada directamente sobre el fondo geométrico, sin crear un bloque blanco independiente: institución, motto, materia y docente ocupan líneas medidas, con slots estables para logotipos, QR, campos e indicaciones. `mostrarMarcaInstitucional` es `true` en la plantilla canónica de producción.
- El fondo del encabezado es una superficie azul muy clara con degradado y patrón geométrico visible; no es una caja blanca central. El patrón debe permanecer de bajo contraste relativo y no invadir el QR, logotipos, campos ni texto.
- Los logotipos deben provenir de imágenes con canal alfa cuando exista transparencia; no se agrega fondo blanco, marco ni borde artificial alrededor de ellos. Si un logo no está disponible, se omite y se registra el diagnóstico; no se inventa un logo sustituto dentro de un marco.
- El QR tiene una reserva blanca independiente solo para preservar contraste y quiet zone. Debe incluir leyenda breve de folio/página sin añadir una franja blanca innecesaria debajo.
- Las líneas de `Nombre del alumno` y `Grupo` viven en una banda propia, debajo del título funcional, y nunca coinciden con una línea decorativa. La misma banda incluye dos campos manuales independientes: `Reactivos` con línea para anotar el conteo contestado, admitiendo medios reactivos (`0.5`), seguido del total dinámico `/ N reactivos`; y `Calificación (0-5)` con su propia línea continua. La calificación del examen se obtiene mediante `(reactivos contestados / total de reactivos) x 5`; los 5 puntos restantes corresponden a evaluación continua.
- En los exámenes de producción masiva, la banda de identificación imprime las iniciales derivadas del nombre del alumno junto a la línea de captura del nombre; el texto es breve, visible y no invade grupo, indicaciones, QR ni geometría OMR.
- Los campos `Nombre del alumno`, `Grupo` e `Indicaciones` incluyen iconos funcionales vectoriales, de trazo simple y alto contraste; no dependen de emojis ni de fuentes externas, quedan contenidos en la cabecera y no pueden invadir etiquetas, líneas, QR, logos o texto.
- La banda de captura incluye una textura geométrica secundaria continua y de baja opacidad, con malla fina, rombos, círculos y cruces alternadas; cubre todo el bloque para evitar zonas visualmente abandonadas, pero excluye únicamente las franjas de escritura para conservarlas despejadas.
- El texto de indicaciones se coloca en la banda inferior del encabezado, en una fila propia debajo de nombre, grupo, conteo de reactivos y calificación, con etiqueta visible y colchón tipográfico; incluye lectura completa, una sola marca por reactivo, relleno con tinta oscura, corrección mediante borrado total, revisión de datos, registro de medios reactivos (`0.5`), fórmula de conversión a escala de 0 a 5 y protección de fiduciales/QR. No se reserva una caja independiente que desplace artificialmente el primer reactivo ni comparte fila con los campos de captura.

### 3. QR, identidad y trazabilidad

- Reserva QR: símbolo de `31 mm`, padding exterior blanco de `3 mm` por lado, huella total de `37 mm`, quiet zone de `4 módulos`, corrección de errores `H` y escala raster entera `24`.
- El QR se genera por página después de conocer los reactivos realmente dibujados; nunca codifica una distribución prevista distinta de la distribución física. Su tarjeta debe quedar separada del fiducial superior derecho por una separación positiva explícita, además de las quiet zones de ambos elementos.
- El payload incluye como mínimo: identidad OMR canónica, versión de plantilla, `examId`, folio, número de página, reactivos de la página, versión de esquema, `keyId`, hash de manifiesto y firma HMAC.
- La misma información se conserva en `recoveryManifest` y `recoveryBundle`, con hashes verificables y referencias a la clave mediante `keyId`; no se almacenan claves secretas dentro del PDF.
- Debe ser posible reconstruir la clave del examen si se pierde la clave de corrección: el manifiesto firmado conserva la correspondencia de orden de preguntas/opciones, la identidad del examen, la versión de plantilla y las referencias de recuperación necesarias para localizar o reconstruir el bundle autorizado.
- La reconstrucción exige firma, hash, tenant, actor autorizado y coincidencia de versión; cualquier discrepancia detiene la operación y no intenta una versión anterior.

### 4. Composición de reactivos y aprovechamiento del espacio

- El reactivo completo es la unidad visual. Cada reactivo usa un único fondo tenue alternado entre cuatro tonos de baja saturación; ese fondo cubre enunciado, recurso visual y respuestas.
- Las respuestas individuales no tienen fondos ni barras independientes. Las fórmulas, diagramas, fragmentos de código e imágenes tampoco tienen relleno o marco propio salvo que el contenido interno lo requiera semánticamente.
- El panel OMR queda fuera de la tarjeta visual del reactivo y conserva fondo blanco/azul casi blanco, para que su ROI sea inequívoco en la captura.
- En modo compacto, las respuestas utilizan retícula `3 + 2` cuando cinco opciones caben; las filas comparten su altura entre columnas. Una opción excepcionalmente larga puede ocupar una fila propia si es la alternativa que evita solape o una página adicional.
- Se aprovecha todo el ancho disponible hasta la separación segura con el panel OMR. El ancho de la primera pregunta de una continuación puede limitarse por la reserva superior del QR; las siguientes recuperan el ancho normal.
- La configuración base de lectura usa `10.4 pt` para enunciados y `8.8 pt` para opciones (`8.4 pt` código inline y `8.3 pt` bloques de código); la reducción es deliberadamente mínima y no puede bajar de `10 pt`/`8.5 pt` en la escala editorial base. La separación texto-OMR nominal es `6 pt`, manteniendo la geometría, quiet zones y separación positiva de las burbujas.
- El planificador y el renderer deben usar exactamente las mismas alturas, ajuste de retícula, filas compartidas y separación. La generación se detiene si el número de reactivos planificados difiere del número dibujado.
- La separación entre reactivos debe ser mínima pero visible (`0.6 pt` en compacto, con la retícula y la holgura tipográfica efectiva); jamás se permite contacto entre glifos, reglas, fondos, insignias o paneles.
- Para distribuir sobrante vertical sin reducir la capacidad física, el planificador reserva `2 pt` entre bloques; una vez fijado el corte, el renderer puede repartir el espacio libre hasta `18 pt` por separación en el perfil horizontal cuando existan más de cuatro reactivos, siempre limitado por el margen inferior seguro. Los bloques cortos de hasta cuatro reactivos pueden usar hasta `60 pt` si el espacio disponible lo permite. Esta redistribución no puede abrir una hoja adicional ni alterar la paridad plan-render.
- El objetivo primario es maximizar los reactivos dentro de cada par dúplex de dos páginas consecutivas. El planificador debe llenar cada página hasta su capacidad física antes de abrir la siguiente; `totalPaginas` funciona como meta editorial y no como motivo para balancear artificialmente o expulsar reactivos que todavía caben en el par actual.
- Cuando `autoFitPages` y `autoFitTypography` están activos, el motor prueba candidatas de mayor a menor escala y solo acepta una candidata si conserva todos los reactivos dentro del objetivo de páginas y las cajas de enunciado, respuestas, imágenes y OMR no tienen intersecciones. Una colisión invalida esa candidata y permite continuar con la siguiente escala menor; nunca se solapan elementos para conservar el tamaño de letra.
- La previsualización PDF reutiliza en memoria el resultado válido mientras su fingerprint no cambie; la vista visual no debe rasterizar ni regenerar de nuevo una plantilla sin cambios. La generación masiva debe mantener progreso visible durante toda la operación, evitar sondeos concurrentes y conceder un timeout acorde con el número de alumnos.
- Cada reactivo conserva una reserva mínima de dos pistas verticales para evitar encabezados comprimidos; con cinco opciones corresponde a la retícula 3+2 y no añade espacio vacío en la plantilla base.
- El máximo editorial configurable por defecto es `25` reactivos por página, pero la capacidad real la determina la geometría y la altura del contenido. En la plantilla compacta corta, 25 reactivos deben caber en dos páginas como línea base; en contenido rico, el resultado depende de imágenes, fórmulas, código y envolvimiento, y debe reportarse.

### 5. Tipografía y contenido enriquecido

- `fontScale` y `lineSpacing` son parámetros explícitos y se aplican idénticamente al cálculo y al dibujo.
- El editor simple admite negritas (`strong`/`b`), cursivas (`em`/`i`), subrayado (`u`), subíndices (`sub`), superíndices (`sup`), código inline, bloques fenced de código y fórmulas LaTeX mediante `data-latex`/representación matemática.
- El renderer debe conservar el estilo, envolver por segmentos y mantener juntos los grupos de fórmula cuando sea posible. Un exponente o subíndice no puede quedar separado de su base por un salto de línea.
- Los bloques JavaScript deben usar fuente monoespaciada, sangría estable, contraste alto y altura medida por línea. Las fórmulas y diagramas deben conservar sus trazos completos y sin fondos accidentales.
- No se permite texto Markdown, comandos LaTeX crudos, caracteres de reemplazo ni glifos truncados en el PDF final. Si un recurso falla, se registra `imageRenderStatus` y la generación no puede ocultar silenciosamente el fallo.

### 6. Panel OMR canónico

- La plantilla compacta usa orientación horizontal: cinco burbujas en una fila, centros equidistantes, paso horizontal de `23 pt`, radio de `3 mm = 8.504 pt`, diámetro aproximado de `17.008 pt` y caja de `129 pt` de ancho.
- El borde del panel es de `0.9 pt`; el panel es blanco y no puede ser cubierto por fondos de preguntas, reglas, QR, texto o imágenes.
- En orientación horizontal, la altura efectiva nominal del panel es aproximadamente `30.2 pt` y no puede superar `30.5 pt`; esta compactación elimina aire estructural sin reducir el diámetro de `6 mm`, el paso de `23 pt`, las quiet zones ni la separación entre burbujas.
- Cada panel contiene etiqueta numérica separada del fiducial superior, rótulo `RESP.`, letras `A–E` y cinco círculos. Las letras quedan debajo de los círculos y todas las cajas de etiqueta/círculo quedan contenidas en el panel.
- Los cuatro fiduciales del panel son cuadrados de `2 mm`, con quiet zone canónica de `0.5 mm` y margen interior mínimo de `1.2 pt`. Ninguna burbuja puede intersectar su quiet zone.
- La caja OMR debe ser únicamente del tamaño suficiente para cubrir fiduciales, etiqueta, letras y círculos; no se añade espacio ornamental. Cualquier reducción adicional que afecte el diámetro, la separación o la lectura móvil está prohibida.
- En continuaciones, el primer reactivo aprovecha la zona superior izquierda libre y su panel puede colocarse debajo del QR; la relación debe seguir siendo inequívoca. Los paneles posteriores se apilan con separación positiva calculada, no con desplazamientos fijos. No se dibuja una caja de separación de sección.

### 7. Detección y calificación desde fotografía

- El detector usa exclusivamente el mapa OMR de la plantilla v4, el QR firmado y los fiduciales de la página/panel. No infiere otra geometría por posición aproximada ni usa una ruta runtime alternativa.
- La corrección geométrica usa homografía proyectiva cuando los fiduciales son confiables; el ajuste local está acotado y nunca puede mover una burbuja al ROI de otra opción.
- Umbral base de confianza geométrica: `OMR_GEOMETRY_TRUST_MIN = 0.72`, limitado al intervalo `[0.65, 0.90]`. Por debajo del umbral se conserva el diagnóstico y la página requiere revisión humana.
- Umbrales operativos de autocalificación: calidad mínima de revisión `0.52`, confianza media `0.58`, cobertura de detección `0.60`, proporción máxima de ambiguas `0.40`; cierre duro si confianza `<= 0.30`, ambiguas `>= 0.85`, cobertura `<= 0.35` o calidad rechazada.
- Umbrales de respuesta: score mínimo base `0.05`, diferencia mínima entre primera y segunda opción `0.012`, score fuerte `0.06`, razón secundaria `0.75`, score secundario de doble marca `0.14`, razón secundaria de doble marca `0.14`, núcleo secundario de doble marca `0.45`, rango seguro mínimo `4 px` y deriva máxima acotada por `0.42` del radio operativo.
- Las marcas dobles, parciales, tachadas, fuera de ROI o de bajo contraste no se convierten en respuestas válidas; se clasifican como inválidas o se envían a revisión según la política.
- La batería sintética cubre perspectiva leve, iluminación no uniforme, viñeta, ruido, compresión JPEG, desenfoque y reducción de resolución. Esa batería no demuestra por sí sola exactitud sobre papel impreso: el gate real requiere un piloto con hojas impresas y fotografías de celular.

### 8. Compatibilidad de implementación

- Backend, scripts de generación, detector, pruebas y herramientas de auditoría usan ESM (`package.json` con `type: module`, imports explícitos con extensión `.js` en el código fuente TypeScript). No se agregan nuevos módulos CommonJS ni `require`.
- La plantilla canónica es la única versión operativa. Las generaciones anteriores y sus temporales son obsoletos y deben retirarse del código/documentación operativa sin borrar evidencia histórica autorizada de recuperación.

### 9. Producción dúplex por pares de páginas

- La unidad física de impresión es una hoja Letter a doble cara: las páginas lógicas impares son el frente y las pares el reverso de la misma hoja (`hoja = ceil(numeroPagina / 2)`), con volteo por borde largo.
- Las páginas se agrupan consecutivamente de dos en dos para impresión dúplex; no se agregan páginas ni caras en blanco. Si el contenido termina en una página impar, la última hoja física conserva únicamente el frente impreso.
- La secuencia PDF debe conservar el orden lógico de páginas y el mapa OMR debe persistir, por página, `hoja`, `lado` e `indiceEnHoja`; el manifiesto de recuperación conserva esos datos al copiar el mapa.
- El renderer no crea registros de páginas sin contenido. El tipo `reverso-vacio` se conserva únicamente como defensa de lectura para mapas históricos ya persistidos; no es una salida válida de generación actual.
- La configuración recomendada para la Epson EcoTank L1250 es Letter, escala 100 %, sin `Fit to page` y doble cara con volteo por borde largo. La validación de la impresora sigue siendo física y no se considera satisfecha por el PDF rasterizado.

## Requisitos Funcionales
- **REQ-001 (Maquetación OMR)**: Configuración de materia, temas y estimación de reactivos.
- **REQ-002 (Generación Masiva)**: Creación de lotes con folios y códigos QR individuales por alumno.
- **REQ-003 (Custodia e Historial)**: Descarga de ZIP/PDF, regeneración y trazabilidad forense.
- **REQ-004 (Layout PDF Imprimible)**: El PDF debe reservar espacio suficiente entre encabezado, instrucciones y primer reactivo; ningún texto de pregunta puede invadir el encabezado ni la caja de instrucciones.
- **REQ-005 (Referencia Visual OMR)**: El PDF debe conservar una jerarquía visual consistente con la referencia aprobada: indicaciones integradas en la banda funcional del encabezado, reactivos legibles con retícula de ancho completo y panel OMR visible con identificador de pregunta.
- **REQ-006 (Densidad y tipografía configurable)**: La pantalla de diseño debe permitir elegir el tamaño de fuente y el espaciado de línea. El motor debe aplicar esos valores de forma consistente a la medición y al dibujo, llenando cada página del par dúplex hasta su capacidad física, respetando legibilidad y zona segura; si no es posible, debe continuar en otra página sin producir solapes.
- **REQ-007 (Cabecera estructural canónica)**: La cabecera debe reservar slots estables para los logotipos configurados, QR, institución, motto, título, materia, docente, campos del alumno e indicaciones sin sobreposiciones. La identidad se integra sobre el patrón geométrico; no se admite una caja blanca central independiente.
- **REQ-008 (Jerarquía editorial de cabecera)**: La primera página debe presentar una cabecera funcional con fondo geométrico azul claro visible, institución y motto legibles, logotipos sin marco artificial, QR aislado de los fiduciales y banda inferior para nombre, grupo e indicaciones. Todos los elementos deben conservar contraste, alineación y separación verificables al renderizar a 300 DPI.
- **REQ-009 (Aprovechamiento de continuación)**: En páginas posteriores, la reserva superior del QR no debe desplazar innecesariamente todo el contenido hacia abajo. El primer reactivo puede utilizar la zona superior izquierda con ancho limitado para no invadir el QR, mientras su panel OMR se coloca en la columna derecha, debajo de la reserva QR y separado del texto; los reactivos siguientes deben recuperar el layout normal, con geometría registrada y sin colisiones.
- **REQ-010 (Ritmo vertical)**: Cuando una página tenga sobrante vertical después de colocar sus reactivos, el motor debe distribuirlo entre los separadores de los bloques para aprovechar el área imprimible, sin superar una separación máxima editorial ni afectar el área segura inferior.
- **REQ-011 (Escala tipográfica de cabecera)**: Al aumentar la escala tipográfica configurada, la cabecera canónica debe conservar separación visual entre identidad institucional, título funcional, campos del alumno e indicaciones integradas; el ajuste no debe generar colisiones ni recortes.
- **REQ-012 (Campos de captura de cabecera)**: Las líneas de nombre y grupo, el campo de conteo de reactivos y la calificación deben permanecer en una banda funcional propia, debajo del título y sin atravesar texto, indicaciones ni decoración; no deben confundirse con una caja de sección ni con líneas ornamentales. El conteo debe admitir valores parciales de `0.5` y mostrar el total dinámico `/ N reactivos`. La calificación debe tener una línea independiente, identificarse como `Calificación (0-5)` y corresponder a `(reactivos contestados / total de reactivos) x 5`; los 5 puntos restantes son de evaluación continua. La banda usa únicamente puntos vectoriales tenues y excluye las franjas de escritura.
- **REQ-013 (Versión OMR única)**: La generación, previsualización, escaneo, calificación y recuperación deben usar exclusivamente el contrato OMR moderno canónico. Deben eliminarse ramas, tipos, rutas, scripts, fixtures y datasets de versiones anteriores; los valores de versión distintos del contrato canónico deben rechazarse explícitamente.
- **REQ-014 (Política de identidad de versiones)**: El contrato OMR canónico debe tener una identidad única, estable y visible (`OMR canónico · v4` / `omr-canonical-v4`) distinta de la versión de la aplicación. Todo artefacto, payload, reporte, endpoint de versión y superficie de la GUI que determine o muestre el flujo OMR debe declarar esa identidad; ningún componente puede seleccionar una versión por nombre de archivo, valor `latest` o fallback silencioso. Las versiones antiguas o desconocidas deben rechazarse en los límites de generación, escaneo, calificación, recuperación y carga de datasets.
- **REQ-015 (Composición geométrica cerrada)**: En la primera página, la reserva exterior completa del QR y los slots de logotipos deben quedar contenidos dentro de la cabecera; ninguna regla decorativa puede intersectar los bloques tipográficos. El QR debe quedar alineado al borde interior derecho de la cabecera y conservar una separación positiva, horizontal o vertical, respecto del fiducial superior derecho y su quiet zone; las marcas de registro, reservas OMR y elementos de identidad deben permanecer dentro del área imprimible.
- **REQ-016 (Contenido completo de cabecera)**: La identidad institucional, el título funcional, los campos de captura y las indicaciones canónicas no deben truncarse silenciosamente. Si el ancho disponible no basta, el renderer debe envolver las líneas y ampliar la cabecera de forma controlada, manteniendo el área imprimible y la densidad del examen sin solapes.
- **REQ-017 (QR canónico resiliente)**: El QR debe generarse con corrección de errores alta, quiet zone completa y escala raster entera; el detector debe buscar únicamente la reserva física del QR canónico y rechazar firmas que no sean HMAC del contrato activo.
- **REQ-018 (Capacidad física y páginas excedentes)**: El renderer debe estimar la capacidad física real de cada página, llenar ambas caras del par dúplex antes de abrir otro par y continuar automáticamente cuando el contenido exceda esa capacidad, evitando balance artificial, blancos innecesarios y solapes.
- **REQ-019 (Geometría OMR única)**: El ancho de la caja OMR, el diámetro de las burbujas, la separación de sus centros y el desplazamiento etiqueta-burbuja deben proceder del mismo perfil canónico que se persiste en el mapa. No se admiten valores alternos entre dominio, renderer y detector.
- **REQ-020 (Tolerancias de impresión y captura)**: Cada panel OMR debe conservar un borde seguro interior, quiet zones de fiduciales, burbujas completamente contenidas y separación positiva entre burbujas, fiduciales, encabezado y texto. Las invariantes deben comprobarse con coordenadas PDF y con el PDF rasterizado a 150 y 300 DPI.
- **REQ-021 (Contrato de centros de respuesta)**: La plantilla compacta canónica debe declarar explícitamente que las cinco opciones se imprimen en una sola fila horizontal, con centros equidistantes, paso de 25 pt y separación mayor que el diámetro de la burbuja. El mapa debe conservar el paso horizontal real y la orientación del bloque para que el detector no infiera una geometría histórica distinta.
- **REQ-022 (Contenido matemático robusto)**: El editor de reactivos debe conservar negritas, cursivas, subrayado, subíndices, superíndices y fórmulas LaTeX o imágenes matemáticas sin glifos de sustitución, recortes ni pérdida de legibilidad al medir, generar y rasterizar el PDF. La muestra QA rica debe aplicar una temática de formato coherente a todos los reactivos solicitados, incluidos los que excedan las primeras siete muestras.
- **REQ-023 (Perspectiva de cámara)**: El detector debe conservar la correspondencia de los centros OMR cuando una captura de celular introduce una deformación proyectiva leve, usando la homografía de los fiduciales y rechazando geometrías que no sean confiables.
- **REQ-024 (Condiciones fotográficas leves)**: El detector debe conservar la lectura cuando una captura móvil introduce variaciones leves y reproducibles de iluminación, contraste, compresión JPEG, desenfoque y resolución, sin convertir una marca ambigua en respuesta válida.
- **REQ-025 (Paridad plan-render)**: La altura que usa el planificador debe ser exactamente la altura que consume la retícula dibujada, incluyendo filas compartidas entre columnas; cualquier divergencia debe detener la generación explícitamente.
- **REQ-026 (Unidad visual del reactivo)**: Cada reactivo debe usar un único fondo alternado para agrupar enunciado, contenido enriquecido e índice de respuestas. Las respuestas individuales y los recursos matemáticos o diagramas no deben añadir rellenos que fragmenten la lectura; el panel OMR debe conservar su reserva blanca.
- **REQ-027 (Implementación ESM)**: El código activo de generación PDF, preview, escaneo, calificación, recuperación y QA debe usar ES modules; no se admiten nuevos módulos CommonJS, `require` ni fallbacks de importación.
- **REQ-028 (Retiro de obsoletos)**: Las generaciones anteriores, temporales y documentos operativos obsoletos deben retirarse del árbol activo y de las rutas de ejecución; la evidencia histórica autorizada se conserva únicamente dentro de los bundles/manifiestos de recuperación verificables.
- **REQ-029 (Pares dúplex)**: La salida canónica debe organizar sus páginas consecutivas en pares frente/reverso para impresión a doble cara por borde largo, sin insertar páginas en blanco. Si falta el reverso del último par, la última hoja puede conservar solo el frente; el mapa OMR debe declarar la hoja física y el lado de cada página existente.
- **REQ-030 (Identidad del alumno)**: Cada examen de producción masiva debe mostrar las iniciales derivadas del nombre del alumno en la cabecera y persistir el `alumnoId` correspondiente; la identificación no debe invadir campos, QR, reactivos ni geometría OMR.

## Criterios de Aceptación
1. El asistente de diseño permite seleccionar materias, temas y distribución de preguntas para el examen.
2. La generación masiva produce folios únicos y códigos QR diferenciados por alumno con barra de progreso interactiva.
3. El historial de lotes mantiene la custodia y permite la descarga de paquetes ZIP/PDF generados.
4. Las pruebas de generación masiva y maquetación de plantillas quedan validadas.
5. La primera pregunta de cada PDF comienza debajo del encabezado y de las instrucciones, sin solapes visuales.
6. Las indicaciones están integradas en la banda funcional del encabezado y los paneles OMR mantienen un identificador legible sin invadir las burbujas.
7. Cambiar tamaño de fuente o espaciado en el formulario se refleja en la previsualización y en la generación real, con validación geométrica de la página y sin reintroducir fondos individuales.
8. La cabecera usa los logotipos configurados cuando existen, sin marco ni fondo artificial, incorpora iconos vectoriales funcionales para alumno, grupo e indicaciones, y mantiene alineación, márgenes y separación verificables.
9. La cabecera estructural presenta patrón geométrico visible, institución, motto, título, campos, indicaciones y QR sin colisiones; no contiene una caja blanca central independiente y mantiene legibilidad humana en una muestra PDF renderizada a 300 DPI.
10. Las páginas de continuación aprovechan la zona superior libre sin invadir el QR: el primer reactivo y su panel OMR quedan separados, los siguientes conservan su composición, y cada página se llena hasta su capacidad física segura antes de abrir otra.
11. Una página con pocos reactivos no concentra todo el contenido en la parte superior: el sobrante vertical se reparte de forma uniforme y verificable entre los reactivos, manteniendo legibilidad y márgenes seguros.
12. La cabecera conserva separación entre sus líneas cuando `fontScale` aumenta y el PDF completo sigue generándose sin colisiones.
13. Las líneas de “Nombre del alumno”, “Grupo”, “Reactivos” y “Calificación (0-5)” tienen reservas propias y no intersectan el título, las indicaciones, la decoración ni los límites del encabezado; el conteo admite medios reactivos, muestra `/ N reactivos`, la calificación conserva su línea continua y no existe un campo de puntos extra.
14. El código activo no contiene ramas operativas ni datasets de TV1/TV3; la plantilla canónica es la única aceptada por generación, escaneo, calificación y recuperación.
15. Las pruebas sintéticas y de layout usan únicamente el dataset y contrato canónicos, y las referencias históricas eliminadas no aparecen en código activo, scripts ni documentación operativa.
16. La política de versiones declara una única versión OMR canónica y la comprobación automática falla si el contrato del backend, la GUI, los metadatos o los datasets activos divergen.
17. La GUI docente muestra de forma persistente el contrato activo `OMR canónico · v4` y, por separado, la versión de la aplicación; el centro de versión explica que las versiones antiguas no son operativas y no las ofrece como opción.
18. Una entrada OMR con versión distinta de 4, ausente o no reconocida no puede continuar por una ruta de compatibilidad o degradación silenciosa.
19. La reserva completa del QR de primera página queda dentro del rectángulo de cabecera y alineada a su borde interior derecho, ambos slots de logos quedan contenidos y ninguno invade el QR; el símbolo de 28 mm conserva padding de 3 mm por lado y huella de 34 mm.
20. La decoración de cabecera no atraviesa el título funcional, las indicaciones ni los campos de captura; las pruebas geométricas fallan ante un solape.
21. Las marcas de registro y sus quiet zones no salen del área de página ni se recortan por el borde nominal.
22. Una identidad, título o conjunto de indicaciones largo conserva todas sus líneas visibles, aumenta la altura solo cuando es necesario y mantiene campos, QR, indicaciones y reactivos sin colisiones; no reaparece una caja blanca central independiente.
23. El QR generado conserva una reserva física de `34 mm` (`28 mm` de símbolo + `3 mm` de padding por lado), corrección de errores `H`, quiet zone de 4 módulos, escala raster entera `24`, separación positiva respecto del fiducial y firma HMAC; el detector no utiliza tamaños ni firmas históricas como ruta operativa.
24. Un examen que requiere más de un par usa la capacidad física real de las dos caras consecutivas: llena el primer par antes de abrir el siguiente y distribuye el remanente solo en las páginas adicionales realmente necesarias, sin solapes ni reducción de legibilidad.
25. El perfil OMR persistido coincide exactamente con las dimensiones usadas para dibujar cada panel; en particular, el ancho de caja y la separación etiqueta-burbuja no divergen entre capas.
26. Cada panel compacto contiene cinco burbujas en una fila horizontal equidistante, con paso real de 25 pt; cada círculo y su quiet zone quedan dentro del panel, sin intersección con fiduciales, borde ni texto. El panel conserva ancho mínimo seguro de 137 pt sin espacio ornamental y el paso supera el diámetro de la burbuja.
27. Las pruebas de rasterización a 150 y 300 DPI conservan las marcas de registro, fiduciales y burbujas distinguibles sin recortes ni componentes fuera de su reserva geométrica.
28. El contenido enriquecido conserva estilos y sub/superíndices legibles; la extracción de texto no contiene Markdown, comandos LaTeX sin convertir ni caracteres de reemplazo, y las imágenes matemáticas quedan completas.
29. Una captura sintética con deformación proyectiva leve conserva la lectura de marcas válidas y no genera respuestas fuera de su centro; una geometría degradada se marca para revisión o rechazo.
30. La batería fotográfica controlada cubre iluminación, contraste, viñeta, ruido, compresión, desenfoque y reducción de resolución; todas las marcas válidas coinciden y las inválidas se rechazan.
31. Un reactivo con opciones de distinta altura conserva paridad entre planificación y renderizado; la generación falla de forma explícita si el número planificado y dibujado diverge.
32. La rasterización a 150 y 300 DPI muestra un fondo único y alternado por reactivo, sin tarjetas de respuesta superpuestas ni rellenos propios en fórmulas o diagramas; el encabezado estructural y la reserva OMR permanecen visibles.
33. La generación de un examen enriquecido de 25 reactivos con JavaScript, fórmulas y diagramas conserva todos los reactivos, reporta la distribución real por página y no declara como cabida una pregunta que el renderer no dibujó.
34. El código activo de generación, preview, escaneo, calificación, recuperación y QA usa ESM; no se introduce `require`, CommonJS ni importación por extensión histórica.
35. Cada página persiste su correspondencia frente/reverso y el mapa declara el modo dúplex por borde largo; un examen de tres páginas usa dos hojas físicas y el PDF conserva exactamente tres páginas, sin añadir una cuarta página vacía.
36. Para un banco compacto de 25 reactivos con objetivo de dos páginas, el autoajuste conserva los 25 reactivos, selecciona la mayor escala tipográfica que supera las guardas geométricas y rechaza cualquier candidata que cruce texto con cajas punteadas, imágenes o paneles OMR.
37. Una previsualización PDF repetida sin cambios devuelve el artefacto cacheado en memoria y no vuelve a ejecutar generación ni rasterización; cualquier cambio de plantilla, preguntas o layout invalida esa entrada.
38. La generación masiva conserva un indicador de progreso desde el inicio hasta la respuesta final, no emite sondeos solapados y no falla por el timeout fijo de una generación individual.
39. La generación masiva reutiliza la configuración y el conjunto de reactivos de la plantilla sin preprueba ni auto-fit por alumno; una plantilla no apta falla explícitamente sin descartar reactivos ni cambiar su layout.
40. Cada examen de producción masiva muestra las iniciales del alumno correspondiente y conserva su `alumnoId` asociado; las iniciales no generan colisiones en la cabecera ni alteran la paginación o el mapa OMR.
41. La resolución del conjunto de reactivos en producción masiva coincide con la resolución usada por la previsualización cuando `reactivosObjetivo` limita el banco; una previsualización válida no se rechaza por seleccionar subconjuntos distintos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Formulario de diseño y catálogo de plantillas | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-002 | Producción masiva con barra de progreso | `apps/frontend/tests/plantillasGenerados.test.tsx` | Completado |
| REQ-003 | Regeneración e historial de lotes | `apps/backend/tests/controladorListadoGenerados.regenerar.test.ts` | Completado |
| REQ-004 | Primera pregunta debajo del encabezado y sin invasión de instrucciones | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-005 | Jerarquía visual de indicaciones, opciones y panel OMR | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-006A | Configuración de tipografía y densidad | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-006B | Propagación de configuración a preview/generación | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-007 | Cabecera estructural canónica con slots de logos, QR, campos, iconos e indicaciones | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-008 | Jerarquía editorial, contraste y colisiones de la cabecera | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-009 | Uso de espacio superior en páginas de continuación sin colisiones | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-010 | Distribución vertical del sobrante sin superar el ritmo editorial | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-011 | Adaptación de cabecera a escala tipográfica sin colisiones | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-012 | Separación geométrica de campos de nombre y grupo | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-013 | Contrato OMR canónico único sin compatibilidad histórica | `apps/backend/tests/pdf.paridad.test.ts` | Completado |
| REQ-014 | Identidad única, marcado visible, rechazo de versiones antiguas y geometría del fixture activo | `scripts/tests/omr-version-policy.test.mjs` | Completado |
| REQ-015 | Contención QR/logos, decoración sin solapes y margen de registro | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-016 | Envolvimiento de título e indicaciones sin truncamiento silencioso | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-017 | QR canónico resiliente y sin rutas históricas | `apps/backend/tests/qr.examen.test.ts` | Completado |
| REQ-018 | Reparto equilibrado cuando se excede el objetivo de páginas | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-019 | Perfil OMR único entre dominio, renderer y mapa persistido | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-020 | Bordes seguros, quiet zones y separación geométrica/raster | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-021 | Paso horizontal y orientación explícitos de centros de respuesta | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-022 | Contenido rico, sub/superíndices y fórmulas sin glifos de reemplazo | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-023 | Captura con perspectiva leve y homografía de fiduciales | `apps/backend/scripts/omr-tv4-perspective-qa.ts` | Completado |
| REQ-024 | Captura móvil con degradación fotométrica leve | `apps/backend/scripts/omr-tv4-camera-qa.ts` | Completado |
| REQ-025 | Paridad de alturas entre planificador y renderer | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-026 | Fondo único por reactivo y recursos transparentes | `apps/backend/tests/pdf.layout.visual.guard.test.ts` + `output/qa/omr-tv4-visual-audit-20260911-rich25-v6/` | Completado |
| REQ-027 | Uso exclusivo de ES modules en el flujo PDF/OMR | `apps/backend/tests/pdf.paridad.test.ts` + lint/typecheck | Completado |
| REQ-028 | Retiro de generaciones obsoletas sin borrar recovery autorizado | `scripts/tests/omr-version-policy.test.mjs` | Completado |
| REQ-029 | Secuencia dúplex sin páginas vacías artificiales | `apps/backend/tests/pdf.paridad.test.ts` | Completado |
| REQ-030 | Iniciales visibles y asociación del examen al alumno en producción masiva | `apps/backend/tests/pdf.layout.visual.guard.test.ts` + `apps/backend/tests/inicialesAlumno.test.ts` | Completado |
| REQ-031 | Resolución consistente de reactivos limitados entre preview y lote | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Completado |
