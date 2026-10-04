---
id: SPEC-062
titulo: Calibracion OMR para capturas moviles y plantilla canonica reforzada
version: 1.24.34
fecha: 2026-09-29
autor: EvaluaPro Team
modulo: modulo_escaneo_omr, modulo_generacion_pdf
estado: approved
---

## Contexto

El dataset real mas reciente contiene fotografias de examenes contestados con
perspectiva, compresion, desenfoque, iluminacion no uniforme y paginas donde el
QR no siempre es legible. La evaluacion de referencia disponible mostro que el
motor conserva buena concordancia en las decisiones que si emite, pero se
abstiene en una proporcion alta. La geometria local por fiduciales ya existe,
pero se desactiva en una ruta frecuente de escala simple sin QR. Ademas, el
perfil de dominio y el renderer repetian parte de la geometria, lo que podia
generar una plantilla distinta de la que el contrato persistia.

En el benchmark fotografico de 38 paginas procesadas, el QR esperado estuvo
presente en la plantilla y en el mapa, pero la ruta directa y el rescate por
rectificacion de la primera iteracion no recuperaron ningun payload
(`qrDetected=0`, `qrMatchedExpected=0`). Esto no demuestra que el QR haya sido
generado incorrectamente: la generacion se valida por separado en pruebas de
firma, round-trip y PDF. Sin embargo, el lector no recupero el QR de ninguna de
las 38 fotografias, asi que su legibilidad operacional en este dataset no esta
validada. El render vectorial conserva patrones de busqueda, quiet zone y
correccion H. La inspeccion posterior de las 32 paginas de referencia encontro
dos imagenes QR en la misma caja fisica por pagina: una con la clave completa
del examen y otra con la clave de esa pagina. Ambos objetos se decodifican por
separado, pero al superponerse el QR visible queda mezclado y la rasterizacion
completa no se decodifica. Por ello, el 0/38 observado en fotos no puede
atribuirse solo a densidad o margen. El renderer actual calcula el QR
preliminar sin dibujarlo y solo pinta el QR final cuando ya conoce los
reactivos de la pagina. La validacion preimpresion debe comprobar la pagina
rasterizada completa contra el texto esperado; decodificar objetos incrustados
de forma aislada no es un criterio suficiente.

La auditoria preimpresion reproducible del 2026-09-23 comparo los dos PDF
historicos adjuntos (8 y 24 paginas) y una pagina PDF TV4 recien generada. El
resultado fue 0/8 y 0/24 paginas historicas legibles frente a 1/1 del control
nuevo. En la primera pagina historica, los dos objetos de imagen QR ocupan la
misma caja PDF (`x=497.45..576.82 pt`, `y=57.29..136.66 pt`); cada objeto
decodifica por separado, pero contiene un payload distinto y el recorte
rasterizado de la pagina no decodifica. Esto confirma superposicion fisica y
explica por que validar objetos o payloads aislados no basta. El renderer TV4
actual calcula la reserva sin dibujar el QR preliminar y dibuja el payload
final una sola vez; su PDF generado pasa la lectura exacta de pagina completa.
La regresion automatizada debe cubrir tambien este contrato sobre un PDF real,
no solo una matriz QR sintetica.

La plantilla compacta futura paso la prueba de generacion/firma/round-trip, pero
esa evidencia no sustituye la lectura de las fotos: el benchmark final registro
0/38 QR detectados y 0/38 coincidencias, usando el mapeo de contingencia en las
38 paginas procesables. La ultima evaluacion OMR cubrio los 499 reactivos de
esas paginas: asigno estado a 499/499, emitio 458 respuestas, dejo 6 ambiguas,
30 sin marca y 5 como doble marca; las 458 letras emitidas coincidieron con
las etiquetas visuales disponibles. La referencia observada cubre 472
reactivos, por lo que la cobertura automatica de letras sobre etiquetas
observables fue 458/472 (97.03%), no 100%; 11 reactivos etiquetados siguen sin
letra automatica. Permanecieron dos paginas vacias confirmadas. Estos son
resultados condicionados a este conjunto y a sus etiquetas existentes, no una
medida de exactitud poblacional ni una validacion independiente ciega.

La comparación adicional del 2026-09-25 sobre el lote Global de Diseño Web
(16 páginas en cuatro PDF exportados por CamScanner) confirmó 16/16 lecturas
exactas en las referencias preimpresión y 0/16 con `leerQrDesdeImagen` sobre
las imágenes originales embebidas en los PDF. Una prueba de umbral local
adaptativo no recuperó ninguna página y elevó el tiempo del pase de 85 s a
129 s, por lo que se descartó. La exploración confirmó además que el patrón QR
usado como referencia de orientación siempre se reconstruía como nivel H,
aunque el mapa persiste el nivel efectivo L/M/Q/H; se corrige esa discrepancia
y se agrega una regresión para un mapa Q cuyo tamaño de matriz difiere de H.
Esta corrección mejora la ruta de orientación por patrón conocido; no cambia
la lectura directa ni acredita una mejora del 0/16 observado.

La verificación focal del 2026-09-26 incorporó un recorte QR local con enfoque
suave: recuperó el payload exacto de `CamScanner 15-09-2026 08.05_1.jpg`; las
otras cinco caras revisadas del lote continuaron sin lectura. Al comparar los
dos PDF originales a 240 DPI, la reserva QR rasterizada coincidió exactamente
en 32/32 páginas. El reporte fotográfico combinado conserva 38 filas históricas
y solo reemplaza el resultado de esa captura: registra 3/39 lecturas exactas
(2/32 páginas únicas) y 30 páginas únicas sin lectura. No es una nueva corrida
integral ni demuestra mejora global; la lectura QR en fotografías sigue siendo
un defecto abierto, mientras que la generación preimpresión de esos PDF queda
validada para esta muestra.

Para reducir de forma sustancial la densidad del QR, se adopta para las
plantillas nuevas un payload corto firmado con folio, página y versión. Las
respuestas correctas y hashes ya no viajan en el símbolo: el escaneo debe tener
el mapa/manifiesto local generado y comparar el payload exacto con la página
esperada antes de habilitar calificación. El HMAC conserva 96 bits y su llave
se resuelve contra el anillo local; los QR TV4 históricos autocontenidos siguen
siendo verificables. Sin mapa esperado, firma válida o coincidencia exacta, el
flujo falla de forma cerrada.

La corrida integral posterior a REQ-020 reprodujo 461/472 letras observadas
determinadas y 460/461 concordantes; asigno estado a 499/499 reactivos y
conservo las dos paginas vacias. La comparacion focal de seis paginas mostro
que una pasada global de alta resolucion puede rescatar respuestas correctas y
tambien retirar otras ya determinadas. En DCA5097F, P2, la hipotesis
homografica de alta resolucion y la escala de alta resolucion coinciden en B
para Q25, pero difieren en la clasificacion de competidoras; Q26 permanece
ambigua. Esto motiva evaluar escala solo como evidencia aditiva en reactivos
pendientes, sin sustituir la geometria fiducial ni respuestas ya determinadas.

La corrida integral repetida el 2026-09-27 procesó 39 capturas sin omisiones ni
errores (38 contenidos de imagen, 32 páginas únicas y 424 reactivos únicos).
Conservó estado en las 514 instancias incluyendo recapturas, pero emitió letra
para 393 reactivos únicos frente a 397 etiquetas observables; 392/397
coincidieron (98.74% sobre etiquetas observables). Hubo cinco reactivos
observables sin coincidencia determinada y un conflicto de salida entre
recapturas. El acuerdo con clave entre las instancias determinadas fue
402/483 (83.23%), métrica de calificación separada y no de detección. QR:
3/39 capturas exactas, 2/32 páginas únicas exactas y 30 páginas únicas sin
lectura; cero payloads erróneos. El pase focal de tres capturas reprodujo dos
abstenciones por señales poco separables y una señal distribuida compatible
con doble marca; la evidencia no justifica relajar umbrales globales.

Para dúplex por borde largo, la prueba geométrica predice cero pares OMR
conflictivos en la plantilla probada, frente a 156 al simular borde corto.
Esto no equivale a una prueba física de impresión, transparencia del papel ni
registro real de impresora. No se redistribuye espacio vertical: no hay
beneficio geométrico demostrado para el giro especificado y se preserva
capacidad; la impresión real queda pendiente de verificación física.

La evaluación exploratoria del lector alterno ZXing sobre las 39 capturas
terminó en 23.16 min, con 0 errores, 3/39 lecturas directas exactas (2/32
páginas únicas), un rescate adicional validado por geometría y 30 páginas
únicas aún sin lectura directa. No se atribuye ese rescate a ZXing porque el
reporte todavía no identifica el decodificador que aportó el payload. La
concordancia observada entre etiquetas existentes y respuestas determinadas
fue 482/483 (99.79%, condicionada); la determinación fue 482 reactivos y la
concordancia con clave 401/482 (83.20%, métrica distinta). El helper ZXing
decodifica el control sintético, pero no hay evidencia aislada de ganancia en
fotografías.

La repetición integral con telemetría de origen y concurrencia cuatro terminó
el 2026-09-27 en 25 min 16 s: 39/39 capturas, cero omisiones/errores, 1.51 GiB
de RSS máximo y 0.0257 imágenes/s. Frente a la corrida comparable de
concurrencia dos (23 min 10 s; 0.0281 imágenes/s), tardó 9.1% más y procesó
8.3% menos imágenes por segundo; por tanto, cuatro no acelera este host y el
valor predeterminado permanece en dos. Las respuestas y detalles OMR por
captura coinciden con la corrida de concurrencia dos. En una captura cambió
solo la clasificación de la ruta QR (`known_geometry_rescue` a `preprocesado`)
por la corrección de atribución; el payload esperado exacto y las respuestas
no cambiaron. El reporte identifica ahora fuentes directas y de análisis: QR
directo exacto en 3/39 capturas y 2/32 páginas únicas; 4/39 coincidencias
esperadas tras análisis, cero payloads ajenos y 30 páginas únicas sin lectura
exacta. La concordancia observada fue 482/483 (99.79%, condicionada), con
482 determinadas, 5 ambiguas y acuerdo con clave 401/482 (83.20%). No se
observa una ganancia fotográfica atribuible a ZXing ni una ventaja de
concurrencia cuatro en este equipo.

La evaluación r3 del 2026-09-27 comparó el rescate QR binarizado/rotado
habilitado frente a r2 con las mismas 39 capturas, 32 páginas y 424 reactivos
únicos. Pasó la regresión sintética focal (incluidos giro, coordenadas y
rechazo de payload distinto), pero no aumentó las lecturas QR exactas (3/32
páginas; 2/32 directas), ni cambió resultados OMR, cobertura o errores. El
tiempo subió de 24.26 a 25.32 min y RSS máximo de 1.42 a 1.84 GiB; por falta de
beneficio fotográfico y con mayor costo observado, el rescate queda opt-in y no
se promueve como disponible por defecto. La variación de una corrida por
versión no demuestra por sí sola causalidad del aumento de recursos.

La disponibilidad de módulos es evolutiva y por nivel de evidencia: una
capacidad pasa a estable/disponible solo después de pruebas unitarias y de
integración, comparación representativa del dataset o control de regresiones,
beneficio medible frente a una línea base y ausencia de regresiones críticas
(identidad, páginas vacías, errores y respuestas observables). Si solo supera
pruebas focales/sintéticas o su beneficio real no está demostrado, permanece
experimental u opt-in y debe identificarse como tal en la interfaz. La
disponibilidad en una versión no implica instalación, publicación ni
activación en producción, que conservan sus gates propios.

## Objetivo

Reducir abstenciones causadas por desplazamiento local y mejorar la señal
fisica de las futuras hojas sin relajar el rechazo de doble marca, tachadura o
conflicto. Los examenes historicos deben seguir siendo legibles porque sus
mapas persistidos conservan sus coordenadas y dimensiones originales.

## Requisitos Funcionales

- **REQ-001:** El detector debe permitir ajuste local acotado por los
  fiduciales persistidos cuando la transformacion global es escala simple sin
  QR, siempre que el mapa no solicite coordenadas estrictas ni desactive la
  geometria local.
- **REQ-002:** El ajuste local debe conservar limites de desplazamiento,
  validacion de caja y rechazo de fiduciales no plausibles; no puede convertir
  por si solo una doble marca o tachadura en una respuesta valida.
- **REQ-003:** El resultado OMR debe exponer el tipo de transformacion y la
  telemetria minima de referencia de pagina necesaria para auditar el motivo
  de una abstencion o calibrar el detector.
- **REQ-004:** La plantilla canonica v4 futura debe usar un perfil movil
  reforzado con burbujas, paso y fiduciales ligeramente mayores, manteniendo
  cinco opciones horizontales y el contrato `templateVersion=4`.
- **REQ-005:** El fingerprint de layout debe cambiar al modificar la geometria
  para invalidar previews cacheados con el perfil anterior.
- **REQ-006:** Deben existir pruebas de regresion para la ruta de geometria
  local, la telemetria, el fingerprint y los limites de layout; la evaluacion
  real debe reportarse por separado de la evidencia sintetica.
- **REQ-007:** El QR de la plantilla futura debe renderizarse como modulos
  vectoriales o con una rasterizacion cuyo tamaño fisico conserve bordes
  binarios. La comprobacion debe incluir decodificacion del simbolo incrustado
  y de una rasterizacion de pagina completa, no solo del payload antes de
   insertarlo en el PDF.
- **REQ-008:** Para la plantilla futura, el QR debe omitir campos redundantes
  cuando exista un manifiesto asociado y usar el nivel de correccion mas alto
  que permita una matriz de como maximo 49 modulos. El simbolo debe medir al
  menos 32 mm, lo que conserva un modulo fisico de al menos 0.56 mm incluso con
  49 modulos y quiet zone de cuatro. Las plantillas nuevas usan un QR corto que firma solo la
  identidad de examen, pagina y version; al escanear y calificar, EvaluaPro debe
  cotejarlo byte a byte con el QR esperado del mapa/manifiesto local. La clave
  HMAC activa se identifica verificando contra el anillo local de llaves, sin
  serializar el `keyId`. La clave de respuestas y los hashes de variante/clave
  se obtienen exclusivamente del manifiesto local; si falta o no coincide, el
  QR corto no basta para calificar ni reconstruir el examen. Los QR TV4
  historicos autocontenidos deben seguir verificandose sin alteracion. El tamaño
  y el margen se persisten en el mapa OMR para reconstruir la referencia exacta;
  los mapas TV4 historicos, incluidos los de 57 modulos, no se reinterpretan.
- **REQ-009:** El detector debe conservar un canal fotometrico continuo para
  marcas tenues que queden por debajo del score binario, pero solo puede
  rescatar una opcion cuando el contraste local, el nucleo y la separacion
  respecto de las demas burbujas sean compatibles. Señales distribuidas entre
  varias opciones deben clasificarse como dobles/ambiguas y no como una letra.
  Una señal aislada demasiado débil para publicar letra debe conservarse como
  `ambigua`/`parcial_detectada`, no como `sin_marca`, para que ningún intento de
  respuesta quede oculto en una hoja aparentemente vacía.
- **REQ-010:** La evidencia de una alternativa usada para invalidar una
  respuesta debe conservar una forma compacta mínima. Una señal secundaria con
  núcleo parcial pero forma no compacta y sin anillo de tinta no debe convertir
  una marca dominante válida en `doble_marca`; dos señales con forma y núcleo
  compatibles con tinta real deben seguir invalidando la respuesta.
- **REQ-011:** La detección de intento debe incluir marcas pequeñas y no
  circulares cuando exista tinta localizada dentro de la burbuja y su contraste
  de luminancia destaque respecto de las demás opciones del mismo reactivo.
  Si el detector no emite una letra, esta evidencia solo puede llevar a
  `ambigua`/`parcial_detectada`; no puede publicar una letra sin satisfacer los
  criterios independientes de decisión. No debe borrar una opción ya resuelta.
  El ruido distribuido o un trazo no localizado no debe marcar el reactivo como
  respondido ni impedir que una hoja vacía se clasifique vacía.
- **REQ-012:** Tras fusionar las pasadas, `doble_marca` solo se conserva si
  existe evidencia compatible con tinta en al menos dos opciones. Si los rasgos
  finales contienen una sola alternativa, una marca dominante de alta
  confianza o una marca parcial con contraste suave claramente relativo,
  núcleo y ubicación centrados puede recuperarse; la señal menos concluyente
  se conserva como ambigua.
- **REQ-013:** La pasada de alta resolución puede aceptar una marca irregular
  (no circular) cuando presenta localización centrada, contraste, separación
  suficiente de la segunda opción y confianza alta; la forma no necesita ser
  un relleno circular compacto. Un trazo débil, descentrado, sin margen o
  acompañado por evidencia competidora no se convierte en respuesta. Un
  reactivo pendiente con `parcial_detectada` debe alcanzar la pasada focalizada
  de alta resolución aunque la cobertura y confianza promedio de la página no
  soliciten una repetición; las páginas sin esos intentos no agregan pasadas.
- **REQ-014:** Cuando la lectura global falle, el sistema debe ensayar una
  cantidad acotada de recortes locales alrededor de la reserva física del QR,
  conservando la zona de silencio y tolerando desplazamiento leve; no debe
  volver a decodificar ni ampliar la página completa. Solo se acepta como
  identidad el payload que coincida exactamente con la referencia esperada
  del mapa/PDF. Lectura, coincidencia y mapeo de contingencia se reportan por
  separado. La verificación preimpresión renderiza cada PDF de referencia y
  coteja el QR de cada página con su payload esperado; la validez del payload
  aislado no sustituye la legibilidad en página completa. Los rescates
  adicionales de binarización/rotación requieren opt-in hasta acreditar
  beneficio en el benchmark fotográfico integrado.
- **REQ-015:** Debe existir una comprobacion preimpresion ejecutable sobre el
  PDF final y un benchmark de referencia. La comprobacion rasteriza cada pagina
  completa, lee la reserva QR con el decodificador jsQR integrado en produccion y exige igualdad exacta
  del payload esperado, folio y pagina; para PDFs nuevos, payload y caja se
  obtienen del manifiesto de generación y se cotejan contra el pie y la página.
  Los objetos QR extraidos del PDF pueden servir para diagnostico, nunca para
  aprobar la impresion si la pagina completa no se decodifica. En el benchmark fotografico, deteccion directa,
  comparacion experimental contra patrones de referencia y mapeo de
  contingencia deben reportarse como metricas separadas; una similitud sin
  margen calibrado no puede asignar identidad.
- **REQ-016:** La evidencia de color debe medirse dentro del núcleo de cada
  burbuja y contrastarse tanto con su fondo periférico como con las otras
  opciones del reactivo. Solo se puede rescatar una marca cromática localizada
  cuando su contraste local y margen frente al competidor son altos, existe
  evidencia espacial dentro del núcleo y no hay doble marca, tachadura ni
  respuesta ya resuelta. La tinta cromática por sí sola no debe aceptar ruido
  uniforme ni modificar páginas vacías.
- **REQ-017:** Una marca tipo punto puede rescatarse cuando la imagen conserva
  un componente oscuro compacto dentro del núcleo de una sola burbuja. La
  detección debe normalizar el área por la escala de la burbuja, localizar el
  centroide dentro del círculo, contrastar el componente con las otras cuatro
  opciones y rechazar trazos elongados, competidores comparables, dobles,
  tachaduras y respuestas ya resueltas. Esta señal no puede basarse en la clave
  ni en las etiquetas del benchmark; las páginas vacías y los reactivos sin
  componente localizado deben conservar `sin_marca`.
- **REQ-018:** La selección de transformación no puede sustituir una homografía
  validada por cuatro fiduciales de esquina y calidad geométrica alta por una
  escala simple únicamente porque esta puntúa mejor sobre tinta OMR. La
  evidencia de respuestas no debe anular anclas geométricas independientes;
  se permite fallback solo si fallan los criterios geométricos explícitos o el
  usuario/configuración fuerza escala simple.
- **REQ-019:** La regresion del generador debe guardar un PDF real temporal,
  rasterizar la pagina completa a resolucion de impresion y exigir que el QR
  de la caja declarada decodifique exactamente al payload y pagina del
  manifiesto. Un PDF con simbolos QR superpuestos, ausentes o distintos debe
  fallar; una prueba de matriz sintetica no satisface este requisito.
- **REQ-020:** Una respuesta inicialmente clasificada como doble solo puede
  recuperarse con evidencia visual dominante y localizada, sin consultar la
  clave ni etiquetas. Además de la ruta multirasgo, una marca puede dominar por
  contraste de luminancia y oscuridad central cuando supera umbrales absolutos
  y márgenes explícitos frente a todas las otras burbujas. Un núcleo aparente
  sin contraste local suficiente no cuenta por sí solo como segunda marca;
  una competidora con contraste/oscuridad local o evidencia cromática localizada
  mantiene la respuesta inválida/ambigua. Tachaduras y dos marcas con evidencia
  comparable nunca se resuelven automáticamente.
- **REQ-021:** Si una pagina sin QR legible conserva al menos cuatro fiduciales
  de esquina con calidad >= 0.90, la ruta OMR existente elige escala y mantiene
  reactivos con intento pendiente, el motor puede ejecutar una pasada
  homografica fija de alta resolucion como evidencia aditiva. Solo rescata un
  reactivo no determinado cuando las pasadas homografica y de escala ordenan
  primero la misma opcion, la pasada de escala satisface
  `debeAceptarRescateAltaResolucionOmr`
  y la segunda candidata homografica carece de evidencia comparable. Nunca
sustituye una respuesta ya determinada, no se usa cuando QR fue detectado,
conserva dobles/tachaduras con competidores comparables y no puede generar
respuestas en paginas vacias. La evaluacion incluye cobertura y precision
por reactivo, cambios de estado, paginas completas sin error y latencia.
- **REQ-022:** Cuando la ruta OMR con geometria local deja intentos pendientes
  en una pagina TV4 sin QR, con cuatro fiduciales y calidad geometrica >=0.90,
  el motor puede ejecutar una pasada aditiva de alta resolucion conservando la
  geometria local. Solo puede completar reactivos sin letra que satisfagan los
  criterios existentes de rescate de alta resolucion; nunca sustituye letras
  ya determinadas, ni se ejecuta en paginas vacias, con QR aceptado o con
  referencia geometrica insuficiente. El benchmark integral debe comprobar
  letras emitidas, dobles, falsos positivos en paginas vacias y latencia frente
  al baseline.
- **REQ-023:** El benchmark debe informar por separado el número de archivos,
  contenidos binarios únicos, folios/páginas únicas y espacios
  folio/página/reactivo únicos. Recapturas no aumentan el denominador de
  concordancia; etiquetas o claves contradictorias y decisiones OMR distintas
  entre capturas deben reportarse como conflictos, no resolverse por mayoría.
  El cotejo contra clave debe mantenerse separado de la exactitud de lectura.
  Las etiquetas observadas o claves ausentes deben reportarse como referencia
  faltante, sin contarlas como vectores de longitud inconsistente; solo los
  vectores no vacíos cuya longitud difiera del número de detalles son errores
  estructurales.
- **REQ-025:** La interfaz debe distinguir visualmente, con etiqueta textual
  y estilo CSS experimental, los rescates de lectura que el motor reporte como
  aplicados y la identidad QR ausente/no coincidente. Debe explicar el límite
  de validación y pedir cotejo manual con la imagen antes de guardar. No debe
  etiquetar todo el OMR como experimental.
- **REQ-026:** La plantilla canónica OMR debe reservar una huella física de
  8 × 20 mm para una grapa 24/6 vertical junto al borde izquierdo en ambas
  caras de cada hoja dúplex. En páginas pares, el mapa expresa la huella en
  coordenadas PDF reflejadas horizontalmente (volteo por borde largo), para
  que corresponda al mismo punto físico que en el frente. La guía punteada y
  su etiqueta Ecofont solo se imprimen en la primera página; ninguna burbuja
  OMR, incluido su radio, puede intersectar la reserva reflejada en cualquier
  página. Debe conservar 2 mm respecto al fiducial y quiet zone de la guía; el
  renderer falla si una burbuja o contenido funcional invade la huella. Un
  calado blanco sin tinta elimina ornamentos y marcos subyacentes antes de
  dibujar la guía; se comprueba geometría y rasterizado sin relleno sólido de
  color.
- **REQ-027:** La composición OMR debe usar fondo blanco y tramas punteadas
  ligeras en lugar de áreas de relleno decorativas; solo se conservan sólidos
  los elementos funcionales necesarios para impresión/lectura, como módulos QR,
  fiduciales y marcas de respuesta. El cambio visual invalida previews cacheados.
- **REQ-028:** Todo texto vectorial del examen usa Ecofont Vera Sans, incluidos
  indicadores y metadatos. Texto rasterizado dentro de imágenes/logos queda
  fuera de esta transformación.
- **REQ-032:** El planificador debe aprovechar el área imprimible según la
  altura medida de texto, opciones y panel OMR, sin reparto rígido ni reducción
  del diámetro/paso de burbujas, legibilidad QR, tipografía o márgenes de
  fiduciales para aumentar conteo. La capacidad debe probarse con preguntas
  breves y con páginas múltiples, sin colisiones ni desbordamientos; el mapa
  OMR debe conservar la geometría real dibujada.
  En páginas de continuación, el primer panel OMR se ancla debajo del QR; el
  planificador debe limitar la cantidad de reactivos al espacio vertical real
  disponible para esa columna OMR, no solo al alto del texto. Debe priorizar
  llenar cada página antes de repartir preguntas a una página adicional y
  nunca ajustar un panel hacia arriba si eso lo superpone con el anterior.
  Para el perfil compacto de 38+ reactivos, se preserva la holgura OMR
  superior/inferior de 2.4/1.8 pt y el diámetro 6.4 mm, sin alterar el paso
  horizontal de 9.17 mm; las opciones breves caben hasta 43 reactivos en dos páginas (21+22) y 44
  desbordan explícitamente a una tercera (21+22+1), sin omisiones. El
  planificador prioriza llenar la capacidad física por cara y no redistribuye
  reactivos compactos solo para igualar el espacio vacío. Los campos auxiliares
  pueden consolidarse en una fila de al menos 6.4 pt y el hueco tipográfico
  entre reactivos breves puede bajar a 0.45 pt. No se reduce el diámetro ni el
  paso de las burbujas, el QR, los fiduciales ni la tipografía de preguntas y
  opciones. En ese perfil se puede omitir el número duplicado dentro del panel
  OMR solo si el número del reactivo permanece impreso en el carril de texto,
  alineado con su fila; el mapa debe conservar las coordenadas exactas de cada
  burbuja y no cambiar su diámetro ni centro relativo. La regresión debe
  comprobar dos páginas, cero colisiones OMR/dúplex y lectura exacta del QR
  bajo rasterización JPEG reducida.
- **REQ-029:** En orientación horizontal, las cinco opciones pueden ocupar una
  sola fila únicamente cuando cada texto cabe en una celda con ancho mínimo
  legible a la tipografía existente. Si una opción requiere ajuste de línea o
  el ancho no alcanza, se conserva la retícula 3+2. El estimador de altura y el
  renderer deben consumir el mismo layout; la paginación no puede recortar
  texto, crear colisiones ni modificar burbujas, fiduciales, QR o la reserva
  segura de engrapado.
- **REQ-030:** La primera página siempre identifica al docente: muestra el
  nombre provisto en la cabecera o un campo manuscrito `Docente:` cuando no hay
  nombre. El rótulo y su línea deben quedar dentro de la cabecera y fuera de
  QR, grapa, logos, indicaciones y otros campos; si no cabe, la generación
  falla explícitamente. Las regresiones cubren ambos casos.
- **REQ-031:** La planificación de paginación y altura se verifica contra cada
  bloque renderizado antes de guardar el PDF. El alto dibujado no puede exceder
  la reserva previa más un paso de retícula, y el mapa conserva ambos valores
  para auditoría. El layout de opciones usado por la estimación y el dibujo es
  el mismo; cambios que desborden el plan fallan la generación.
- **REQ-033:** Cuando el decodificador QR primario no obtiene una lectura en la
  región focalizada, el sistema puede intentar un decodificador independiente
  sobre recortes acotados de esa misma región. Las coordenadas reportadas deben
  volver a la imagen original; una identidad QR solo se acepta si el payload
  coincide byte a byte con el mapa/manifiesto esperado. El pase no debe
  debilitar el rechazo de payloads ajenos y el benchmark integral reporta
  lecturas alternas y coincidencias por separado, además de latencia. La
  siguiente plantilla conserva al menos 30 mm entre la tarjeta QR completa y
  el borde derecho de página para reducir la oclusión por pliegues observada en
  capturas CamScanner; el planificador debe usar esa misma geometría y mantener
  legibilidad rasterizada, capacidad OMR y ausencia de colisiones.
- **REQ-034:** Los runners de pruebas y benchmark deben permitir concurrencia
  acotada y reproducible, respetar el límite configurado, conservar todos los
  archivos y fallos individuales, ordenar las filas del reporte de forma
  determinista y detener el despacho de nuevos lotes al primer fallo. El
  benchmark debe registrar concurrencia, duración, rendimiento y progreso por
  archivo, además del máximo RSS del proceso; la comparación debe usar el mismo
  dataset e identidad de mapas. El incremento de concurrencia no se considera
  optimización salvo que una comparación equivalente demuestre menor latencia
  sin alterar las respuestas. El runner de cobertura debe reponer cada worker
  al terminar un lote, sin barreras por olas; debe conservar concurrencia dos
  como valor predeterminado, permitir límites explícitos de 1–4 y guardar un
  resumen por lote con duración y código de salida, incluso al fallar.
- **REQ-035:** Si el QR no permite identificar una página, la interfaz puede
  intentar OCR exclusivamente sobre franjas periféricas del pie impreso: abajo
  o arriba en retrato, y en los laterales en captura apaisada, rotando el
  recorte para normalizar la dirección del texto. Se deben excluir las zonas
  centrales con reactivos y respuestas. El fallback debe reconocer folio y
  página como una pareja inequívoca, exigir confianza OCR mínima de 75/100.
  En el token de página se permite normalizar `I`, `L` o `|` a `1`, confusión
  OCR acotada; el folio no admite corrección difusa y la referencia completa
  sigue cotejándose contra el examen/mapa del backend.
  cotejar cualquier dato manual y dejar que el backend resuelva ambos contra el
  examen y mapa OMR existentes. Un texto QR decodificado con advertencia de
  mismatch tampoco identifica la página y debe activar el mismo fallback; una
  firma QR inválida sigue siendo rechazo y nunca se elude con OCR. No debe
  fabricar ni tratar texto OCR como QR firmado. Si el texto es ambiguo,
  contradictorio o de baja confianza, se abstiene y pide captura manual; la UI
  identifica explícitamente que la referencia provino del pie OCR. El paquete
  Tesseract debe cargarse mediante import diferido resoluble por Vite y aislado
  del chunk general; worker, WASM y modelos locales/remotos se deben declarar
  explícitamente, sin asumir disponibilidad offline.
- **REQ-036:** Tras fallar los lectores QR normales y el rescate por geometría,
  el backend puede probar únicamente las orientaciones ortogonales compatibles
  con una hoja vertical (180° para captura vertical; 90°/270° para captura
  apaisada), leyendo solo la ROI de cabecera. En el flujo OMR con payload
  esperado, solo se acepta coincidencia exacta; las coordenadas rescatadas se
  registran en el marco original para el lector público, pero nunca se usan
  para proyectar respuestas: la geometría OMR permanece ligada a la captura
  original y sus fiduciales. El rescate se ejecuta al final y debe reportarse
  como origen distinto, con latencia y coincidencias medidas por separado.
- **REQ-038:** El motor debe evaluar marcas tipo X, palomita y trazos no
  circulares como posibles selecciones cuando la tinta se localiza dentro de la
  región de una opción. Solo puede emitir una letra si una única opción cumple
  los criterios independientes de contraste, ubicación y dominancia ya
  definidos; la forma por sí sola no prueba selección. Una X/tachadura que
  cruce opciones, contradiga otra marca, parezca corrección o no permita
  distinguir la intención queda como ambigua/tachada o requiere revisión
  docente, sin inferir la respuesta desde la clave. La GUI debe mostrar la
  imagen, las candidatas y el estado OMR; la API debe exponer el mismo estado y
  permitir guardar la respuesta manual con motivo y trazabilidad. La matriz de
  evaluación debe incluir ejemplos etiquetados de X, palomita, tachadura,
  marca doble, blanco y trazo fuera de la burbuja, en captura directa y PDF.
  Hasta que esa evaluación pase, X/palomita se reportan como soporte pendiente,
  no como capacidad automática confirmada.
  La respuesta pública de revisión debe conservar el estado, flags, opción
  detectada y hasta tres candidatas ordenadas por score (con estado de marca y
  relleno central). La GUI muestra esos datos junto al selector de corrección;
  una resolución manual conserva la evidencia automática original para cotejo.

**REQ-039:** La abstención de marcas parciales puede conservar una opción
clasificada como marcada si `markConfidence >= 0.72`,
`shapeCompactness >= 0.35` y la respuesta original no presenta doble marca
ni tachadura. Como excepción, una marca con núcleo aislado puede pasar los
umbrales de confianza/compacidad solo cuando `fillRatioCore >= 0.18`, el margen
de núcleo frente a la segunda opción es `>= 0.08`, el score bruto de la segunda
opción es `<= 0.08`, `markConfidence >= 0.10`,
`shapeCompactness >= 0.15`, `centroidOffsetRatio <= 0.60` y
`softCoreContrast >= 0.06`; conserva además el consenso entre pasadas y el
rechazo de doble marca/tachadura. La calibración se reporta por reactivo único
y por captura, cotejada con las etiquetas observadas disponibles; estas no se
presentan como exactitud independiente cuando procedan de anotaciones heredadas
del pipeline.

**REQ-040:** El motor combinado OMR/QR mantiene una versión SemVer y un canal
de release propios, independientes del SemVer de EvaluaPro y de la versión de
plantilla/contrato `TV4`. Cada resultado público de análisis y cada reporte
del evaluador identifica el motor mediante `engineRelease` (`id`, `version`,
`channel`); `engineVersion: 'omr-cv'` se conserva como identificador legado.
Un prerelease de desarrollo no se presenta como estable ni apto para
producción: la promoción a estable requiere artefactos con huellas, evaluación
reproducible del corpus etiquetado disponible, guardas de regresión y evidencia
de impresión/captura física con verdad terreno adjudicada.

**REQ-041:** Cuando capturas resuelvan al mismo payload QR exacto y página, el
evaluador agrupa la identidad y compara los vectores OMR por pregunta entre
capturas, reportando por separado conflictos de letras emitidas, emisión frente
a abstención, calidad y geometría. Esta comparación mide repetibilidad, no
exactitud. Las posiciones conflictivas requieren adjudicación visual antes de
promover una release estable; la división de entrenamiento/validación/prueba se
hace por hoja física para evitar fuga entre capturas de una misma hoja.

**REQ-042:** Si fallan las rutas QR focalizadas y la lectura en la reserva nativa,
el motor puede ejecutar una pasada ZXing de escala de grises sobre la imagen fuente
sin redimensionar. Esta ruta solo publica identidad si pasa el filtro geométrico
existente y el payload coincide byte a byte con el QR esperado; registra
`fuenteDeteccionQr='resolucion_fuente'`. No rota la imagen OMR ni permite que un QR
ajeno a la geometría de la página determine la identidad. La evaluación compara
lectura QR, exactitud OMR, tiempo y memoria con la versión base en capturas
fotográficas etiquetadas.

**REQ-043:** Si el QR esperado sigue sin leerse a resolución fuente, el motor
puede ensayar giros ortogonales de 90°, 180° y 270° sobre el buffer original en
escala de grises. Solo acepta el payload esperado byte a byte después de repetir
la validación geométrica con el tamaño y módulos persistidos. Marca la fuente
como `rotacion_pagina`; el resultado aporta identidad y no reutiliza sus
coordenadas giradas para leer respuestas OMR. Sin payload esperado no ejecuta ni
publica este rescate. Reporta cobertura incremental, payloads erróneos, tiempo y
memoria por corpus y condición.

## Investigación de vertientes de mejora (2026-09-29)

1. **Alineación y control de calidad geométrico:** conservar detección de
   fiduciales y homografía cuando la evidencia sea suficiente, pero separar la
   orientación de la lectura QR y del score de burbujas. Añadir deformación
   local solo si el error residual de fiduciales demuestra curvatura; una
   homografía corrige perspectiva plana, no papel curvado. Wild-OMR separa
   inclinación, iluminación y curvatura por condiciones, así que permite medir
   esos efectos por separado, aunque no sus interacciones. El README del
   benchmark señala que el reajuste de cuadrícula aportó más que dos refinamientos
   finos combinados en su configuración; por ello, comparar geometría/reajuste
   antes de sumar complejidad al clasificador de marcas.
2. **Normalización fotométrica y umbral:** medir intensidad/color, contraste
   local y sombra por reactivo; comparar score continuo actual con Otsu y
   umbral adaptativo por ROI. Otsu asume separación útil en el histograma; el
   adaptativo calcula un umbral por vecindad y puede tolerar luz no uniforme,
   pero el tamaño de vecindad y marcas tenues pueden cambiar el resultado.
   La ruta clásica del estudio de Tamaulipas combina corrección de iluminación
   no uniforme, homografía, umbrales HSV y adaptativos, y control del ruido de
   fondo por ROI; en sus 6,029 hojas escaneadas reporta 99.95% de respuestas
   concordantes con captura humana. Es evidencia de escala para escáneres y esa
   plantilla; no demuestra rendimiento en fotos Wild-OMR. Sus revisores señalan
   que no cuantifica sensibilidad de umbrales ante cambios de calidad/luz/ruido.
   Ningún umbral debe autoseleccionar respuestas sin margen y evidencia
   suficiente.
3. **Clasificador visual por reactivo/opción:** evaluar un clasificador de
   características con clases vacía, marcada y anulada, junto con una
   estrategia de dos etapas (vacía frente a marcada; luego anulada frente a
   confirmada). La literatura reporta mejor transferencia entre formas y
   dispositivos para algunas variantes de dos etapas, mientras su CNN end-to-end
   pierde rendimiento fuera de distribución. Es hipótesis para EvaluaPro, no
   resultado transferible: comparar primero con el CV actual y validar por hoja
   física, cámara y condición. Las 769 capturas Wild-OMR representan 30 hojas,
   no 769 patrones independientes de respuestas.
   En los artefactos publicados de Wild-OMR, el baseline `D1` (CNN pequeña por
   recorte de burbuja 48×48, entrenada solo con datos sintéticos) informa
   exactitud de recorte 93.37% y F1 de marca 86.29%; `D5` informa F1 87.61% con
   2 hojas reales y 89.17% con 20, siempre con 10 hojas de prueba fijas y cinco
   semillas para N>0. La mejora es medible pero moderada y es métrica de recorte,
   no exactitud de página; favorece probar primero aprendizaje híbrido sobre
   geometría estable, con abstención, antes de reemplazar el pipeline entero.
   Son cifras del paquete de autores, inspeccionadas pero no reentrenadas aquí.
4. **Clasificador de página de extremo a extremo:** mantener como alternativa
   exploratoria de costo alto y trazabilidad menor. No sustituirá la geometría
   ni decidirá automáticamente hasta mostrar mejora en hojas físicas retenidas,
   nulos/ambigüedades y marcas tachadas, además de tiempo y RSS compatibles con
   el flujo de producción.
5. **Plantilla física:** priorizar fiduciales de alto contraste próximos a
   esquinas, separación visual entre burbujas y texto, reserva de captura para
   curvatura y un QR con zona silenciosa despejada de cuatro módulos. DENSO
   especifica ese margen QR; la efectividad de cambios concretos requiere
   imprimir, fotografiar y escanear la plantilla con equipos reales antes de
   fijar `TV`.

**Orden experimental:** (a) reproducir baseline y huellas de motor/mapa; (b)
   segmentar los 769 captures por condición y dispositivo y agrupar por `sheet_id`;
   (c) calibrar geometría/normalización sobre entrenamiento y validación, nunca
   sobre prueba; (d) comparar CV y clasificadores en hojas retenidas, reportando
   precisión de emisiones, cobertura, abstención, error en marcadas, falsos
   positivos en vacías, exactitud por hoja, QR exacto/falso, latencia y RSS;
   (e) revisar desacuerdos con etiquetas visuales independientes y repetir la
   prueba en una plantilla impresa. El split aleatorio por captura filtraría
   imágenes casi duplicadas de una misma hoja y sobrestimaría generalización.

**Perfil verificado del corpus y baseline publicado:** el notebook
`docs/qa/wild-omr-dataset-profile-2026-09-29.ipynb` comprobó 769/769 imágenes,
30 hojas físicas, etiquetas completas para 40 preguntas por hoja, coincidencia
de los 769 SHA-256 declarados, cero nombres/hashes duplicados, 27 capturas con
estado `FAIL` y cero renglones duplicados/huérfanos en las salidas válidas.
El baseline del autor `REAL_dwsnap` produjo 29,680 slots en 742 capturas
procesadas: cobertura de respuestas únicas 89.32%, precisión condicionada a
emisión 95.10%, exactitud por slot 84.94% y 541/742 páginas exactas (72.91%).
Incluyendo las 27 fallidas como cero salida, cobertura sobre el total publicado
es 86.18%. El perfil por condición localiza el mayor riesgo en `elde` (captura
en mano: cobertura 61.72%, precisión 69.93%, 24 fallos y 36.80% de páginas
exactas), seguido de `egik` (inclinación: 82.62%/92.71%, dos fallos); `losuk`
(luz tenue) queda en 99.47%/99.88% y `parlama` (reflejo) en 96.04%/99.62%.
El escaneo es 99.75%/100%. Estas son predicciones del baseline publicado, no
mediciones de EvaluaPro. El conjunto libera 769 de 780 capturas intentadas;
11 se excluyeron porque el QR no proporcionó identidad verificable. Su diseño
de un factor a la vez no estima interacciones entre luz, geometría y cámara.

**Replay diagnóstico EvaluaPro del corpus completo (2026-09-29):** el reporte
`docs/qa/wild-omr-engine-1.0.0-dev.1-single-pass-2026-09-29.md` registra una
pasada `single_pass` (`noRetry=true`) del motor `evaluapro-omr-qr@1.0.0-dev.1`
sobre 769/769 imágenes etiquetadas, sin excepciones y sin payload QR incorrecto.
El QR coincide exactamente en 686/769 capturas (89.21%); 83 no produjeron
payload. El OMR emitió 3,764/30,760 respuestas (cobertura 12.24%), con 2,144
aciertos entre todos los slots (exactitud 6.97%) y 2,144/3,764 respuestas
emitidas concordantes (precisión condicional 56.96%); solo 1/769 páginas quedó
exacta. En las 739 fotos, cobertura 9.12%, precisión condicional 39.93% y
exactitud por slot 3.64%; las 30 capturas de escáner tuvieron 88.92% de
cobertura y 100% de precisión condicional. Es una señal de que la ruta única
actual no es suficiente para fotos; no mide el flujo productivo con reintentos
ni autoriza una promoción estable. Las métricas se calculan contra las
etiquetas del benchmark, que su README define como verdad terreno por burbuja.
Las 30 hojas físicas se repiten entre capturas, por lo que todo experimento
aprendido se valida por `sheet_id`. En cinco folds, un clasificador logístico
por burbuja sube el ranking top-1 de 26.74% a 28.51% (+1.78 pp; intervalo
bootstrap pareado por hoja 95%: +1.11 a +2.44 pp), pero queda en AUC 0.560 y el
ranking top-1 fotográfico sigue en 25.63%. Un umbral de probabilidad 0.8 alcanza
98.52% de precisión solo con 2.41% de cobertura de preguntas. No se integra el
clasificador al motor: la mejora no es suficiente para uso real y no evalúa
folios verdaderamente vacíos. Las puntuaciones y el entrenamiento reproducible
están descritos en `docs/qa/wild-omr-engine-1.0.0-dev.1-single-pass-2026-09-29.md`.
La fuente ZXing en escala de grises a resolución completa leyó exactamente
566/566 capturas; el rescate QR geométrico, 7/7. Los 83 payloads faltantes se
concentran sobre todo en la inclinación de S24U (29/30) y S26U (13/24), que pasa
a ser objetivo de una siguiente iteración QR. El payload errado permaneció en
cero. `1.0.0-dev.1` sigue en desarrollo; la pasada completa fue `single_pass`,
no el flujo de producción con reintentos.

**Fuentes primarias consultadas:** [Wild-OMR, v1, protocolo y datos](https://zenodo.org/records/21710005);
[Afifi y Hussain, clasificación de cajas MCQ y evaluación fuera de dominio](https://arxiv.org/abs/1711.00972);
[Hernández-Mier et al., evaluación OMR a escala en Tamaulipas](https://www.mdpi.com/2313-433X/11/9/308);
[comentarios de revisión que delimitan sensibilidad de umbral no medida](https://www.mdpi.com/2313-433X/11/9/308/review_report);
[documentación OpenCV de umbrales adaptativos y Otsu](https://docs.opencv.org/5.0/main_modules/imgproc_misc.html);
[DENSO WAVE, zona silenciosa QR](https://www.qrcode.com/en/howto/code.html/index.html);
[ZXing, detector de patrones QR](https://zxing.github.io/zxing/apidocs/com/google/zxing/qrcode/detector/FinderPatternFinder.html).

## Cierre de alcance de la versión candidata (2026-09-24)

La versión candidata cierra el flujo OMR docente dentro del alcance de las
plantillas y capturas ensayadas, pero no se declara release estable:

- **Validado para uso asistido:** representación por reactivo de respuesta,
  blanco/ambigüedad, cotejo editable alumno-vs-clave, filtro de pendientes,
  zoom de imagen y aviso accesible cuando hay rescate o QR no validado. El aviso
  usa clases CSS propias: contenedor ámbar con borde discontinuo y badge
  “Experimental”; la prueba verifica esas clases y que una advertencia ordinaria
  no las active. Tests focalizados: 9/9; cobertura de `SeccionEscaneo.tsx`:
  60% sentencias, 61.78% líneas, 57.53% ramas y 65.04% funciones. Esto valida
  los comportamientos cubiertos, no todos los estados visuales ni el flujo real
  instalado.
- **Validado en dataset, no generalizado:** clasificación OMR de 499/499
  reactivos en el benchmark integral anterior; en el reporte actual, 424
  reactivos únicos contienen 397 respuestas con etiqueta marcada, de las
  cuales 396 concuerdan con OMR (99.75%), y 27 espacios sin marca. Persiste un
  desacuerdo de detección/anotación. La evidencia está condicionada a este
  dataset y sus etiquetas, no acredita exactitud poblacional ni 100%.
- **Experimental y con cotejo obligatorio:** rescates/refinamientos OMR,
  lectura QR en fotografías y uso fuera de los formatos, cámaras y condiciones
  representados. La repetición del validador preimpresión vigente a 300 DPI
  leyó exactamente 32/32 páginas de los PDF de referencia mediante recorte de
  la ROI QR y umbralización. En fotos, 2/39 capturas dieron payload exacto,
  ambas para C5051CA1/P2; tras deduplicar identidad, solo 1/32 páginas únicas
  quedó identificada. Una auditoría anterior dio 0/32 en los PDF; se conserva
  como resultado histórico de otra corrida/configuración, no como conclusión
  vigente. El gate fotográfico sigue fallando y la identidad no debe inferirse
  de un QR ausente/no coincidente.
- **Fuera de alcance de esta promoción:** sincronización real de Classroom,
  verificación de bundle GUI instalado y evidencia física de impresión/captura.

Cobertura focalizada de `metricasDatasetOmr.ts`: 96.39% sentencias, 98% líneas,
86.31% ramas y 94.73% funciones; 8/8 pruebas del módulo de métricas. Esto cubre
esa utilidad, no el motor CV completo. No se calculó cobertura global del
repositorio en esta verificación.

La implementacion conserva la pasada de alta resolucion existente y agrega
una pasada homografica fija solo como evidencia independiente; el consenso
solo puede completar reactivos nulos. En la corrida integral de 2026-09-23
recupero 3 respuestas frente al baseline, sin cambiar opciones previamente
determinadas; 464/472 etiquetas observables quedaron determinadas y 463/464
coincidieron con la observacion. Las paginas observables completamente
correctas aumentaron de 29/36 a 30/36. Se conservaron 499/499 estados, 28
blancos, ambos examenes vacios y cero errores; la compuerta ejecuta el pase
solo cuando la ruta existente eligio escala y redujo el costo incremental a
4.37% (67.4 s en 38 paginas, 1.77 s por pagina en promedio). QR: 0/38 detectados,
por lo que la identidad sigue dependiendo del mapeo de contingencia. Persiste
un desacuerdo de anotacion en D6930C3E, P2, Q18 (motor E, etiqueta del conjunto
D, clave E). Una inspeccion visual independiente previa favorece E y sugiere
error en la etiqueta D; no se modifico la etiqueta ni se uso la clave para elegir.

La pasada adicional de alta resolucion que conserva geometria local se evaluo
en las mismas 38 paginas el 2026-09-24. Frente al baseline inmediato, solo
cambio C24 de la pagina 2 del folio 1458887E: doble marca a B; las otras 498
decisiones de reactivo quedaron identicas. Resultado: 465 letras determinadas
de 472 etiquetas visuales observables, 464/465 concordantes (99.78% condicional),
6 ambiguas, 28 sin marca y cero errores de procesamiento. Los dos examenes
vacios permanecieron con 10/10 y 15/15 sin marca. El tiempo agregado subio de
1610.2 s a 1744.3 s (+8.33%, +3.53 s/pagina). La concordancia de una letra
emitida con la clave mide si el alumno acerto, no si el OMR leyo la marca; no se
usa como exactitud del detector. QR sigue en 0/38. El desacuerdo de anotacion
en D6930C3E, P2, Q18 (OMR E, etiqueta D, clave E) ya fue revisado visualmente:
la marca visible favorece E y apunta a una etiqueta errada; se conserva la
anotacion original para trazabilidad. La evidencia no acredita 100%.

La auditoría del mismo reporte por grano físico corrigió el denominador: 39
capturas contienen 38 contenidos binarios únicos, pero corresponden a 32
folios/páginas; 7 páginas tienen una segunda captura. El conjunto representa
424 espacios de pregunta únicos, 397 con etiqueta observada de marca, y el OMR
concuerda en 396/397 (99.75%) de esos espacios. Se asignó estado a los 424:
397 respondidos y 27 sin marca. No hay conflictos entre recapturas, claves ni
etiquetas entre sí, pero existe una detección que difiere de su etiqueta
observada. La lectura QR exacta baja de 2/39 capturas a 1/32
páginas únicas. Las 349/424 coincidencias con clave (82.31%) describen el
desempeño de estudiantes, no exactitud del detector. Estas etiquetas siguen
siendo anotaciones existentes, no verdad terreno ciega e independiente.

## Criterios de Aceptación

1. Una pagina en escala simple sin QR puede ejecutar ajuste local cuando hay
   fiduciales en el mapa, y una pagina con coordenadas estrictas no lo hace.
2. Los limites de ajuste y los invariantes de invalidez existentes permanecen
   vigentes.
3. El resultado incluye `geometryMode`, cantidad de puntos y calidad de la
   referencia sin cambiar el contrato de calificacion existente.
4. El renderer genera el mismo perfil que el dominio y el perfil reforzado
   pasa las validaciones de ancho y desborde disponibles.
5. Los tests OMR focalizados y el typecheck pasan. La ejecucion sobre el
   dataset real se conserva como evidencia operacional, sin declararla como
   exactitud poblacional hasta contar con verdad terreno independiente.
7. Un QR canonico conserva nivel H en la version historica y mientras el
   payload corto no supere 49 módulos. La generacion debe omitir en el QR los
   hashes y la clave visible, conservados en el manifiesto/mapa local; la firma
   HMAC debe validarse con una llave del anillo local y el payload exacto debe
   coincidir con la pagina esperada. Sin manifiesto, con QR de otra pagina o con
   firma invalida, la calificacion automatica se rechaza. Los QR historicos
   autocontenidos siguen aceptandose con su validacion anterior. Si una carga
   futura excede 49 módulos, el renderer reduce de forma explícita la
   redundancia solo hasta recuperar una matriz de 49 módulos o menos y persiste
   el nivel efectivo en el mapa. El benchmark fotografico reporta por separado
   lectura directa, rescate por geometria conocida y mapeo de contingencia.
8. Las marcas tenues recuperadas no reducen el acuerdo de las respuestas
   determinadas en el dataset fotografico etiquetado; los examenes vacios
   permanecen vacios y las señales distribuidas conservan revision manual.
   Las señales aisladas por debajo del umbral de letra se publican como
   ambiguas, nunca como una respuesta automática.
9. Una señal secundaria no compacta del dataset fotográfico no bloquea una
   marca dominante cuando carece de evidencia de anillo; las dobles reales del
   mismo dataset siguen en revisión manual.
10. Una señal pequeña/no circular, localizada y tonalmente distinguible frente
    a sus cuatro competidoras se conserva como intento ambiguo; señales de tono
    similar entre las cinco opciones no se interpretan como marca.
11. Una sola opción con tinta no se informa como doble: una marca claramente
   dominante o tonalmente aislada con núcleo centrado se recupera; una señal
   incompleta sin contraste suficiente queda ambigua; dos opciones con núcleos
   compatibles con tinta mantienen revisión por doble marca.
12. Una marca irregular localizada que supere conjuntamente los umbrales de
   confianza, contraste, margen, centro y forma de alta resolución puede
   rescatarse; las marcas desplazadas, rayones débiles y conflictos conservan
   la abstención. Un reactivo `parcial_detectada` y pendiente activa la pasada
   focalizada aunque la página tenga alta cobertura; una página sin evidencia
   de intento conserva su ruta rápida.
13. Los recortes focalizados tienen tamaño/cantidad acotados y preceden al
    rescate ZXing de una pasada en escala de grises a resolución fuente. Ese
    rescate no redimensiona la imagen ni repite el procesamiento OMR completo.
    Cualquier identidad aceptada coincide exactamente con la referencia. La
    evaluación por página distingue PDF rasterizado, foto, coincidencia QR y
    mapeo de contingencia.
14. El preflight de impresion recorre todas las paginas rasterizadas del PDF,
    rechaza paginas con QR ausente, mezclado o distinto al manifiesto y nunca
    aprueba solo porque un objeto QR incrustado decodifica. La comparacion
    experimental por similitud en fotos se abstiene si no supera un umbral y un
    margen calibrados con el conjunto completo.
15. La señal cromática se mide sobre la imagen RGBA alineada con las
    coordenadas de la burbuja; cualquier rescate debe superar umbrales
    espaciales y márgenes multiburbuja, conservar los rechazos de doble/tachado
    y no producir respuestas en las páginas vacías del dataset.
16. Un punto oscuro pequeño se acepta únicamente si forma un componente
    compacto, centrado y dominante frente a las otras cuatro opciones. El
    umbral se normaliza por tamaño de burbuja; ruido aislado, trazos elongados,
    segundas marcas y puntos de las páginas vacías no generan respuesta.
17. Una homografía con cuatro fiduciales de esquina y calidad >= 0.90 se
    conserva frente a una escala que solo obtiene más score de tinta. El
    benchmark debe mejorar o conservar las letras concordantes y mantener los
    controles vacíos sin respuestas.
18. Un PDF real producido por el renderer se rasteriza y su QR de pagina
    completa coincide byte a byte con el manifiesto; un control de pagina
    historica con dos QR distintos en la misma caja falla, aunque ambos objetos
    extraidos se decodifiquen individualmente.
19. Una candidata única con dominancia multirasgo probada puede recuperarse de
    una doble espuria; cualquier competidora con evidencia comparable conserva
    la abstención, aunque su score no sea el segundo mayor. Las páginas vacías
    no ganan marcas.
20. El pase homográfico comparativo solo puede añadir letras pendientes con
    consenso de candidata entre transformaciones y aceptación de alta
    resolución; las respuestas emitidas por la ruta OMR original permanecen
    intactas. La corrida integral aumenta cobertura sin bajar el acuerdo
    observado ni alterar las dos páginas vacías; el reporte compara cobertura,
    precisión condicional, desacuerdos y costo frente al baseline completo.
21. El pase local de alta resolución solo añade candidatas pendientes que
    satisfacen el filtro estricto existente, mantiene intactas las letras ya
    emitidas y no crea marcas en los dos controles vacíos.
22. El reporte de benchmark diferencia archivos, contenidos, folios/páginas y
    reactivos únicos; recapturas no inflan la concordancia, conflictos se
    exponen y el desempeño contra clave no se etiqueta como exactitud OMR.
23. Ante un rescate OMR aplicado o QR ausente/no coincidente, la revisión
    docente muestra una etiqueta accesible “Experimental” con estilo distinto,
    advierte la validación limitada y exige cotejar imagen e identidad; con
    advertencias ordinarias no aparece la etiqueta.
24. La huella de engrapado conserva 8 × 20 mm en la zona superior izquierda de
    cada hoja física, está protegida en ambas caras y no intersecta burbujas
    OMR: las páginas pares reflejan la reserva horizontalmente. La guía y el
    texto “GRAPA” aparecen solo en la primera página, dentro de la huella, con
    Ecofont; el centro vertical del símbolo queda contenido en la reserva.
25. Con la configuración por defecto, el fondo del papel queda blanco, las
    áreas decorativas usan solo líneas/patrones tenues y la cabecera no genera
    bandas de relleno continuo; la legibilidad OMR y el QR rasterizado exacto
    permanecen intactos.
26. Las corridas previas de preview no se reutilizan tras el cambio de plantilla
    y las variantes de texto registradas en el mapa indican Ecofont Vera Sans.
27. Cinco opciones cortas que caben en una celda se dibujan en un solo renglón,
    manteniendo las fuentes y la geometría OMR; si cualquiera no cabe, se usa
    el fallback 3+2. Un PDF generado con margen de 8 mm conserva la zona de
    engrapado segura, rasteriza sin colisiones y decodifica el QR exacto por
    página.
28. Toda primera página muestra `Docente:` con el nombre provisto o como campo
    manuscrito vacío. El texto y la línea se incluyen en la geometría auditada
    y no se superponen con otros elementos.
29. Para cada reactivo, el alto efectivamente dibujado no supera el alto
    planificado por más de un paso de retícula. La salida incluye ambas alturas;
    los reactivos planeados y dibujados se corresponden uno a uno antes de
    guardar el PDF.
30. El runner backend ejecuta hasta dos lotes independientes a la vez por
    defecto, permite ajustar explícitamente el límite hasta cuatro, mantiene
    aislamiento de datos por proceso y no agenda lotes adicionales tras un
    fallo. El evaluador OMR valida `OMR_EVAL_CONCURRENCY` en 1–8, informa el
    avance por archivo y registra concurrencia, rendimiento, RSS máximo y
    duración sin omitir ni reordenar resultados.
31. El runner de cobertura despacha dinámicamente hasta el límite explícito
    `BACKEND_COVERAGE_BATCH_CONCURRENCY` (predeterminado 2, máximo 4), evita
    esperar a que termine una ola para asignar el siguiente lote y escribe
    `run-summary.json` con duración/código de salida por lote y estado del merge.
32. Una evaluación con ejemplos visuales etiquetados verifica X y palomita como
    posibles marcas dentro de una sola opción, y los distingue de tachaduras,
    trazos que cruzan opciones, dobles marcas y blancos. El motor debe abstenerse
    cuando la intención no sea inequívoca; la GUI presenta imagen/estado y la
    API acepta una corrección manual auditada. El reporte separa exactitud de
    lectura, cobertura y abstenciones; pruebas sintéticas no bastan para afirmar
    soporte sobre capturas reales.
33. El rescate por núcleo aislado cumple todos los umbrales de REQ-039, conserva
    las abstenciones para señales competidoras y no aumenta discrepancias contra
    etiquetas observadas. La matriz fotográfica se reporta con su grano,
    cobertura, abstenciones, memoria y tiempo; los datos heredados no se tratan
    como verdad terreno independiente. Las etiquetas manuales X/trazo cruzado
    siguen sujetas a adjudicación cuando su intención no es inequívoca.
34. El rescate ZXing a resolución fuente conserva la identidad exacta, rechaza
    payloads distintos y no modifica los píxeles/geometría que gobiernan OMR;
    su ganancia y costo se reportan frente a la ruta base.
35. El rescate QR por giros de página se ejecuta solo tras fallar la lectura de
    fuente, requiere payload esperado y geometría válida, informa
    `rotacion_pagina` y no alimenta la geometría de burbujas; la regresión por
    corpus no introduce payloads erróneos.

## Matriz de Trazabilidad

| ID | Evidencia | Archivo de test | Estado |
| --- | --- | --- | --- |
| REQ-001 | Escala simple con rescate fiducial local | `apps/backend/tests/omr.consenso.robusto.test.ts` | Implementado |
| REQ-002 | Limites y marcas invalidas conservadoras | `apps/backend/tests/omr.consenso.robusto.test.ts` | Implementado |
| REQ-003 | Telemetria de transformacion y referencia | `apps/backend/tests/omr.consenso.robusto.test.ts` | Implementado |
| REQ-004 | Perfil reforzado y consistencia renderer/dominio | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Implementado |
| REQ-005 | Invalidacion de fingerprint de layout | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Implementado |
| REQ-006 | Regresion OMR, lint, integracion y compilacion | `apps/backend/tests/omr.consenso.robusto.test.ts`, `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts`, `npm -C apps/backend run lint`, `npm -C apps/backend run typecheck` | Verificado localmente |
| REQ-007 | QR vectorial y prueba de rasterizacion completa | `apps/backend/tests/pdf.canonico.test.ts` y auditoria Poppler/jsQR del PDF generado | Verificado localmente |
| REQ-008 | QR corto firmado y ligado byte a byte al manifiesto local; compatibilidad con QR TV4 autocontenidos y nivel de corrección/geometría persistidos | `apps/backend/tests/qr.examen.test.ts`, `apps/backend/tests/calificacion.omr.payload.test.ts`, `apps/backend/tests/pdf.canonico.test.ts`, `apps/backend/tests/pdf.layout.visual.guard.test.ts`, `apps/backend/tests/omr.geometry.reference.test.ts`, `apps/backend/tests/integracion/qrEscaneoOmr.test.ts`, `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Verificado en PDF sintético: QR corto, matriz ≤49, 32 mm físicos (≥0.56 mm/módulo con 49 módulos), geometría persistida y rasterización de página decodificada exactamente; se conserva capacidad de 13 breves en una página y 27 en dos. Las fotos CamScanner contienen QR previos y no validan todavía la legibilidad del nuevo tamaño/payload. |
| REQ-009 | Canal continuo, clasificación de intentos débiles y rechazo de señales distribuidas | `apps/backend/tests/omr.consenso.robusto.test.ts`, `apps/backend/tests/omr.estado-respuesta.test.ts` y benchmark fotográfico completo | Evidencia histórica de corrida previa: 499/499 estados; 454/454 letras emitidas concordantes; 6 ambiguas, 5 dobles, 34 sin marca y 2 páginas vacías. Ver resultado final en REQ-011/012 |
| REQ-010 | Filtro de forma y rescate aislado para alternativa secundaria dispersa sin anillo de tinta | `apps/backend/tests/omr.core.decision.test.ts`, `apps/backend/tests/omr.consenso.robusto.test.ts` y benchmark completo `C:\\Users\\evega\\AppData\\Local\\Temp\\omr-full-after-shape-rescue-20260923.json` | Verificado: +5 respuestas determinadas frente a la corrida anterior, acuerdo observado 454/454, 5 dobles y 2 páginas vacías; las transiciones cambiadas concuerdan con las etiquetas visuales |
| REQ-011 | Clasificación de intento pequeño/no circular usando contraste relativo y evidencia localizada, sin autoseleccionar opción | `apps/backend/tests/omr.estado-respuesta.test.ts` y benchmark fotográfico completo `C:\Users\evega\AppData\Local\Temp\omr-full-final-tonal-singlemark-20260923.json` | Verificado: estados asignados a 499/499; de 472 etiquetas visuales disponibles, se emitieron 454 letras y las 454 concordaron (96.2% cobertura de letras sobre etiquetas observables; 100% concordancia condicionada); 9 ambiguas, 31 sin marca; 2 páginas vacías confirmadas |
| REQ-012 | Corrección postfusión de dobles espurias con evidencia en una sola opción; marca dominante restaurada o señal tenue ambigua | `apps/backend/tests/omr.estado-respuesta.test.ts` y benchmark fotográfico completo `C:\Users\evega\AppData\Local\Temp\omr-full-final-tonal-singlemark-20260923.json` | Verificado: 5 reactivos conservan estado doble, 9 quedan ambiguos, 454 respondidos y 31 sin marca; las dos páginas vacías permanecen vacías. QR: 0/38 leídos y 0/38 coincidencias, mapeo por contingencia para las 38 páginas procesadas |
| REQ-013 | Rescate focalizado de intento parcial pendiente y marca irregular con restricciones de centro, contraste y competencia | `apps/backend/tests/omr.consenso.robusto.test.ts` y benchmark fotográfico completo | Implementado; umbrales y activación unitaria cubiertos. Pendiente de validar ganancia/costo en las 38 fotos después del cambio de activación |
| REQ-014 | Escaneo focalizado acotado; identidad solo con payload QR exacto | `apps/backend/tests/omr.geometry.reference.test.ts`, `apps/backend/tests/omr.qr.preimpresion.test.ts`, benchmarks r2/r3 | r3 (39 capturas, 32 páginas, 424 slots) no mejora frente a r2: 3/32 páginas con QR exacto (2 directas), cero payloads erróneos, métricas OMR idénticas. El rescate binarizado/rotado pasa la prueba sintética focal, pero queda opt-in por no demostrar ganancia fotográfica y presentar más costo observado; no promover como estable. |
| REQ-024 | Regresión automatizada de validación QR rasterizada | `apps/backend/tests/omr.qr.preimpresion.test.ts` | Cubierto por prueba automatizada; el reporte de auditoría manual queda separado. |
| REQ-015 | Auditoría QR por página, separando lectura directa, rescate geométrico e igualdad exacta contra manifiesto/PDF | `apps/backend/tests/omr.qr.preimpresion.test.ts`, `apps/backend/scripts/omr-eval-real-dataset.mjs`, `apps/backend/scripts/omr-qr-preprint-check.ts` | PDF de referencia: 32/32 páginas decodifican exactamente a 240 DPI. Benchmark fotográfico integral 2026-09-27: 3/39 capturas y 2/32 páginas únicas exactas, 30 páginas únicas sin lectura, cero payloads erróneos. Gate: `aprobadoPreimpresion=true`, `datasetQrCompleto=false`; la legibilidad en foto continúa abierta. |
| REQ-016 | Tinta cromática localizada, relativa a fondo y competidoras; rechazo de doble/tachado | `apps/backend/tests/omr.estado-respuesta.test.ts` y benchmark fotográfico completo `C:\Users\evega\AppData\Local\Temp\omr-full-color-rescue-20260923.json` | Verificado en el conjunto: 499/499 estados; 458/472 etiquetas visuales con letra automática (97.03% cobertura), 458/458 concordantes (100% condicionada); 11 ambiguos, 30 sin marca y 5 dobles. Ganancia de 4 letras frente al reporte previo, sin desacuerdo observado; dos controles vacíos siguen con 25/25 reactivos sin marca. No equivale a verdad terreno independiente. |
| REQ-017 | Rescate de marcas tenues por evidencia localizada de núcleo, tono y componente compacta, sin resolver dobles ni crear marcas en páginas vacías | `apps/backend/tests/omr.estado-respuesta.test.ts` y benchmark integral `C:\Users\evega\AppData\Local\Temp\omr-full-nucleus-rescue-20260924.json` | Se amplió el rescate con umbrales conjuntos: score <=0.12, oscuridad del núcleo >=0.20 y margen >=0.05 frente a la segunda opción, núcleo >=0.30, centro <=0.30, componente >=50 px con fill de 0.18–0.40, compacta/densa y centrada; requiere 5 opciones, no tener respuesta previa y excluir doble/tachadura. En 38 capturas mapeadas (499 reactivos) la cobertura de estados quedó 499/499: 472 letras, 0 ambiguas y 27 sin marca; 471/472 coincidieron con etiquetas visuales (99.79% condicionada). El único cambio frente al baseline fue C5051CA1 P1 Q7: ambigua -> E, coincidente con etiqueta visual y clave; los otros 498 reactivos conservaron opción, confianza, estado y flags. El único desacuerdo con la etiqueta guardada es D6930C3E P2 Q18: la imagen muestra E, la clave es E y el OMR emite E; la etiqueta D se conserva como discrepancia de referencia, no como fallo del detector. Las páginas vacías D286FD63 siguen 10/10 y 15/15 sin marca; errores 0. QR 0/38 en producción. La captura CamScanner 17-09-2026 04.48_1.jpg se omite por identidad, pero su SHA-256 coincide exactamente con la imagen adjunta ya mapeada a C5051CA1 P2; es una copia byte a byte, no una página única faltante. Estas métricas no certifican exactitud poblacional ni generalización. |
| REQ-018 | Fiduciales geométricos fiables prevalecen sobre el score de tinta al elegir transformación sin elevar falsos positivos en páginas vacías | `apps/backend/tests/omr.consenso.robusto.test.ts` y benchmark fotográfico | Propuesta experimental rechazada: una corrida focalizada mantuvo 11/11 respuestas observadas en una página marcada, pero produjo una respuesta espuria en el reactivo 19 de una página vacía (antes 15/15 sin marca). No implementar hasta resolver la regresión y validar el conjunto completo. |
| REQ-019 | Regresión de un PDF real generado frente al manifiesto y su rasterización de página completa | `apps/backend/tests/pdf.canonico.test.ts` | Verificado localmente con PDF.js a 2550 px de ancho: payload rasterizado de página generado coincide exactamente con el manifiesto. Auditoría independiente Poppler/jsQR a 300 DPI: PDFs históricos 32/32 payloads exactos al umbralizar la ROI; control TV4 generado 1/1. |
| REQ-020 | Recuperación de doble espuria mediante contraste y oscuridad local dominantes, con rechazo de competidores cromáticos o de tinta comparable | `apps/backend/tests/omr.estado-respuesta.test.ts` y benchmark fotográfico completo `C:\Users\evega\AppData\Local\Temp\omr-dominance-all-competitors-20260923.json` | Regresión unitaria añadida para CamScanner DE6B2F6D, folio 65E2471B, P2-Q10: C domina la señal difusa de A; pruebas negativas retienen dobles con segunda marca contrastada o cromática. El benchmark citado precede esta nueva ruta: pendiente repetirlo antes de afirmar mejora global. |
| REQ-021 | Rescate aditivo por consenso entre pasada OMR existente y homografía fija de alta resolución, solo si la ruta existente eligió escala; protege QR, fiduciales, respuestas previas y hojas vacías | `apps/backend/tests/omr.consenso.robusto.test.ts`, `apps/backend/tests/omr.estado-respuesta.test.ts` y `C:\Users\evega\AppData\Local\Temp\omr-full-homography-scale-gated-20260923.json` | Verificado en 38 fotos (1 omitida): 464/472 etiquetas observables determinadas, 463/464 concordantes; +3 respuestas correctas sin cambiar opciones previas; páginas completamente correctas 29/36→30/36. Estados 499/499, 28 blancos, 2/2 exámenes vacíos intactos, errores 0. Costo +4.37% (67.4 s total; 1.77 s/página). QR 0/38; un desacuerdo visual previo permanece. Evidencia condicionada a etiquetas del dataset, no certifica 100% ni exactitud poblacional. |
| REQ-022 | Pase aditivo de alta resolución conservando geometría local, con fiduciales confiables y solo para páginas pendientes no vacías; candidatas aprobadas por el filtro existente | `apps/backend/tests/omr.consenso.robusto.test.ts` y `C:\Users\evega\AppData\Local\Temp\omr-full-local-highres-gated-20260924.json` (comparado con baseline integral) | Verificado: el único cambio de 499 reactivos fue rescatar Q24, página 2, folio 1458887E, de doble marca a B; sin cambios en las otras 498 respuestas/estados. 465/472 etiquetas observables determinadas, 464/465 concordantes; 6 ambiguas, 28 sin marca, 499/499 estados, 0 errores. 2/2 exámenes vacíos conservados (10/10 y 15/15 sin marca). Costo agregado +8.33% (134.1 s; 3.53 s/página). QR 0/38. La discrepancia de anotación en D6930C3E, P2, Q18 (OMR E, etiqueta D) fue revisada visualmente y la marca favorece E; se conserva la etiqueta existente. No equivale a exactitud 100%. |
| REQ-023 | Métricas por contenido, folio/página y reactivo únicos; conflictos visibles; coincidencia con clave separada de lectura; QR directo separado de rescate; referencias faltantes separadas de errores estructurales | `apps/backend/tests/omr.dataset-grain.test.ts`, `apps/backend/scripts/omr-eval-real-dataset.mjs`, `C:\Users\evega\AppData\Local\Temp\omr-current-eval-20260926-followup.json` | Corrida integral 2026-09-27: 39 capturas (38 contenidos), 32 páginas y 424 reactivos únicos; estado asignado a 514/514 instancias incluyendo recapturas. 393/397 etiquetas observables emitidas como respuesta y 392/397 concordantes (98.74% sobre etiquetas observables); un conflicto entre recapturas. El acuerdo con clave entre instancias determinadas fue 402/483 y no mide lectura contra marcas. QR exacto: 3/39 capturas, 2/32 páginas únicas; 30 páginas únicas sin lectura y cero payloads erróneos. La geometría dúplex predice 0 pares conflictivos para borde largo y 156 para borde corto; no sustituye impresión física. La revisión docente y la lectura QR fotográfica siguen siendo brechas abiertas. Prueba focal agregada: claves/etiquetas ausentes se cuentan aparte y un vector presente de longitud incorrecta continúa detectándose. Recontando las 48 filas del informe Global r2 guardado, sin ejecutar de nuevo el benchmark: 48 filas sin clave y sin etiqueta observada, y cero vectores no vacíos con longitud inconsistente; el JSON original no se modificó. |
| REQ-025 | Señal visual de rescates OMR y QR no validado, localizada solo cuando aplica | `apps/frontend/tests/escaneo.refactor.test.tsx` | Verificado: la vista muestra la etiqueta y las clases CSS experimentales dedicadas ante rescate/QR no validado, y no las muestra ante advertencias ordinarias; 9/9 pruebas focalizadas pasan. El alcance del detector sigue siendo experimental fuera del dataset actual. |
| REQ-026 | Huella física 8 × 20 mm para grapa vertical 24/6 en ambas caras; reserva espejada en páginas pares y libre de burbujas OMR | `apps/backend/tests/pdf.ink-sparing-staple.test.ts` | Verificado localmente: 2/2 pruebas de grapa y 52/52 regresiones PDF canónico/paridad/layout; raster comprueba tinta <10% al frente y <1% en reserva del reverso. Sin impresión física. |
| REQ-027 | Fondo blanco, eliminacion de rellenos decorativos y conservacion del preflight QR | `apps/backend/tests/pdf.canonico.test.ts` | Verificado: los rellenos decorativos se desactivan por defecto y pasan 27/27 pruebas PDF focalizadas |
| REQ-028 | Texto de examen vectorial con Ecofont Vera Sans | `apps/backend/tests/pdf.ink-sparing-staple.test.ts` | Verificado: el texto de reactivos y la etiqueta GRAPA usan Ecofont Vera Sans; 27/27 pruebas PDF focalizadas pasan |
| REQ-029 | Una fila cuando caben cinco opciones; fallback 3+2 y preservación de tipografía/geometría OMR, grapa y QR | `apps/backend/tests/pdf.canonico.test.ts` + PDF de control rasterizado de 25 reactivos | Verificado localmente: 25 reactivos en 2 páginas (11/14), fuentes 10.4/8.8 pt y geometría de burbuja 6.4 mm / paso 9.17 mm conservadas; cero colisiones por página, QR exacto 2/2 y zona de grapa 8 × 20 mm despejada en primera página. Revisión visual rasterizada a 1530 × 1980 px; no es impresión física. |
| REQ-030 | Campo docente impreso o valor docente provisto, auditado dentro de la cabecera | `apps/backend/tests/pdf.canonico.test.ts`, `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Pendiente de implementación y validación del campo manuscrito y el metadato docente. |
| REQ-031 | Paridad de cálculo previo y bloque renderizado por reactivo | `apps/backend/tests/pdf.canonico.test.ts`, `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Pendiente de guardia runtime y pruebas de desbordamiento del plan. |
| REQ-032 | Capacidad dinámica por contenido con geometría OMR/QR íntegra y guardas de legibilidad | `apps/backend/tests/pdf.layout.visual.guard.test.ts`, `apps/backend/tests/pdf.paridad.test.ts` | Prueba permanente 38–43 reactivos breves en 2 páginas (21+resto) y 44 en 3 (21+22+1): cero omisiones/colisiones; QR exacto a 800 px. Raster sintético marcado en C: 43/43 tras muestreo geométrico distribuido en páginas con 20+ reactivos. Benchmark fotográfico 48/48 (360 espacios) comparado con r3: QR idéntico, 34/48 exactos tras rescates y cero payloads erróneos; al aplicar el cambio geométrico global bajó 1 respuesta emitida y subieron 7 ambiguas. Por ello el cambio se limita a páginas densas (20+); el dataset tiene máximo 9 por página y conserva la ruta anterior. Regresiones OMR/QR 49/49; guardia visual 32/32. Burbujas 6.4 mm/9.17 mm; reservas 2.4/1.8 pt desde 38. Sin validación fotográfica de páginas densas ni de impresión física; los 43/43 son raster sintético, no evidencia física. |

| REQ-037 | Abstenerse de autocalificar candidatas de baja evidencia central después de todas las pasadas, preservando evidencia tonal localizada y señalando vacíos probables | `apps/backend/tests/omr.consenso.robusto.test.ts`, `apps/backend/tests/omr.estado-respuesta.test.ts`, `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Diagnóstico raster limpio: falsos positivos tuvieron `centerDarknessDelta` 0.029–0.153, aunque algunos se etiquetaban internamente como `marcada`; las marcas sintéticas correctas tuvieron 0.274–0.296 y contraste 0.545–0.600. Se implementó abstención final bajo 0.16 con excepción cromática, y `vacio_probable` cuando no hay letras emitidas, predominan blancos/ambiguas y la página conserva calidad suficiente. Pruebas focales en curso. Pendiente validar dataset fotográfico y grafito tenue; no se confirma el vacío ante ambigüedad. |
| REQ-038 | X/palomita como posibles selecciones, separadas de tachadura/doble/blanco; visualización GUI y corrección manual API auditable | `output/qa/omr-mark-shapes-20260928/manifest.json`; `apps/backend/tests/omr.estado-respuesta.test.ts`; `apps/backend/tests/omr.respuestaRevision.test.ts`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `apps/backend/tests/integracion/omrJobsWorkflow.test.ts`; `page-03.jpg` del benchmark completo | Paridad de revisión parcial implementada: API conserva estado, flags, opción detectada y tres candidatas; GUI las muestra y corrección manual mantiene la evidencia original en jobs y PDF. En la página fuente exacta, con ocho etiquetas visuales no adjudicadas, el motor emitió una de seis X en la opción etiquetada, dejó una X ambigua y clasificó cuatro X como doble marca; de los dos trazos cruzados, uno fue emitido y el otro quedó como doble marca. La regla de confianza no cambió estos ocho estados. No se habilita auto-reconocimiento de formas: falta adjudicar las etiquetas, corregir la falsa emisión del trazo cruzado y agregar ejemplos de palomita. |
| REQ-033 | Decodificación focalizada/independiente, payload exacto y margen QR resistente a pliegue exterior | `apps/backend/tests/pdf.layout.visual.guard.test.ts`, `apps/backend/tests/qr.examen.test.ts`, `apps/backend/tests/omr.qr.preimpresion.test.ts`, benchmark fotográfico integral | Global r3: el PDF fuente pasa 48/48 QR exactos a 240 DPI; en fotos, 31/48 lecturas directas y 34/48 exactas incluyendo rescates, sin payload incorrecto. Catorce páginas quedan sin lectura; `datasetQrCompleto=false` y aprobación integral falsa. El QR bajo pliegue físico sigue siendo un límite del conjunto. |
| REQ-034 | Concurrencia acotada, despacho dinámico, progreso, duración/RSS y conservación determinista de resultados/fallos | `scripts/tests/backend-test-batches.test.mjs`, runner de cobertura, `apps/backend/scripts/omr-eval-real-dataset.mjs` y benchmark fotográfico integral | OMR: verificado previamente en 39/39 fotos; concurrencia 4 tardó 25:16 (RSS 1.51 GiB) frente a 23:10 con concurrencia 2, por lo que se conserva 2 como predeterminado. Cobertura: pruebas unitarias del harness 7/7; corrida integral parcial (27/44 lotes, 5:45) detenida por fallos de plantilla en `pdf.ink-sparing-staple.test.ts` y `pdf.layout.visual.guard.test.ts`; el reporte no demuestra una mejora integral de duración. |
| REQ-035 | Fallback OCR si QR está ausente o el backend advierte mismatch: leer folio+página del pie, confianza ≥75/100, cotejar entradas manuales y resolver contra mapa del backend sin suplantar QR firmado; loader Vite diferido | `apps/frontend/tests/ocrTexto.test.ts`, `apps/frontend/tests/escaneo.refactor.test.tsx`, build Vite frontend | 25/25 pruebas frontend focales, typecheck, ESLint, `build:docente`, guard de bundle y WCAG (20/20) aprobados; se añadió regresión QR-mismatch→OCR. La integración QR del backend pasa 3/3 y conserva rechazo de firma inválida. `vendor-ocr` se mantiene diferido como chunk de 10.64 kB (5.00 kB gzip); worker, WASM y modelos siguen con rutas/caché del proveedor. Disponibilidad offline y precisión OCR en fotos reales continúan pendientes. Se admite `I`, `L` o `|` como `1` solo en página; falta repetir dataset real para cuantificar beneficio. |
| REQ-036 | Rescate final QR por giro de página y ventanas focales desplazadas; métricas separadas de lectura directa, rotacional y geométrica; identidad exacta y separación estricta respecto a geometría OMR | `apps/backend/tests/omr.test.ts`, `apps/backend/tests/omr.dataset-grain.test.ts`, `apps/backend/scripts/omr-eval-real-dataset.mjs`; comparación con PDF referencia | Prueba sintética para 90°/180°/270° y rechazo de payload ajeno; benchmark global r3: 48/48 procesadas, 31 QR directos, 1 rescate geométrico y 1 rotacional exacto (`scan-16.png`), 34 coincidencias totales, cero payloads erróneos y 14 sin lectura. Los 360 vectores OMR son idénticos a r2; no hay claves ni etiquetas independientes, por lo que no mide exactitud de respuestas. Tiempo 18:04.737, concurrencia 2, pico RSS 1.20 GB. PDF de referencia exacto 48/48. |

| REQ-039 | Conservar parciales por confianza/forma o por núcleo fotométrico aislado, con consenso de pasadas y rechazo de señales invalidantes | `apps/backend/tests/omr.consenso.robusto.test.ts`, `apps/backend/tests/omr.estado-respuesta.test.ts`; replay detallado de 39 capturas, Global48 y CamScanner 16; etiquetas manuales de formas | El replay fotográfico procesó 39/39 capturas (38 contenidos, 32 páginas, 424 reactivos únicos): 443/487 detecciones observadas concordantes, frente a 338/487 en la referencia; las detecciones únicas concordantes suben de 283/397 (71.3%) a 356/397 (89.7%). No hubo letra emitida que contradijera las etiquetas observadas; 2 páginas vacías y 1 doble marca permanecen. Global48: 48/48, 295 respondidas frente a 283, 63 ambiguas frente a 74, 25 dobles frente a 27; dos dobles se resuelven por consenso y no aparecen dobles nuevas, sin etiquetas de respuesta. CamScanner rasterizado: 16/16, 49 respondidas frente a 47, 46 ambiguas frente a 48, 2 inválidas sin cambio; QR 0/16. En la página con etiquetas manuales, 3/6 X se leen en la opción observada y 3 quedan dobles; no se emite otra opción. De dos trazos cruzados, uno se emite y uno se abstiene; la intención de la muestra emitida requiere adjudicación. Las etiquetas heredadas/manuales no son adjudicación independiente. La primera corrida tardó 24.54 min y registró 2,209 MiB RSS; una repetición idéntica tardó 24.16 min, registró 1,580 MiB y tuvo cero diferencias de respuesta, score u QR respecto de la primera. La referencia tardó 25.18 min y registró 1,598 MiB, por lo que el pico de 2,209 MiB no se reprodujo. QR fotográfico: 2/39 directos y 34/48 coincidencias Global48, sin payload incorrecto; el conjunto CamScanner sigue en 0/16. | Iteración sintética TV4 (120 reactivos/12 páginas): precisión 98.17%, F1 99.07%, rechazo de inválidas 88.89%, falsos positivos 1.67% y aprobación de páginas 83.33%; las cuatro guardas pasan. Se ensayó abstener ante parciales bajo 0.58 y de bajo contraste; el replay con esa variante y la repetición tras retirarla tuvieron 0 diferencias de respuesta, estado, score y QR, por lo que no hubo efecto medible y la regla se retiró. El replay fotográfico repetido procesó 39/39: 376/487 respuestas emitidas concordantes con etiquetas heredadas, 311/397 concordancias únicas y QR 2/39; 27:20 min, RSS pico 2,169 MiB, cero errores. Su resultado coincide con el replay restaurado anterior en respuestas, estados y scores. La diferencia frente al replay antiguo persiste en 67 respuestas/25 capturas, cuyos scores también cambian; de 67 candidatas, 64 conservan la letra antigua como máximo score actual, 64 se clasifican parcial y 59 tienen markConfidence menor a 0.58. Estas etiquetas son heredadas, no verdad terreno independiente. El reporte v1 ahora almacena SHA-256 de la geometría de 39/39 capturas (32 hashes únicos) y huellas del código fuente OMR de 27 archivos, del evaluador y del módulo de huella geométrica; el hash del módulo se calculó después del replay, sin cambios al módulo. La ejecución anterior sin huellas y el replay antiguo no permiten reconstruir qué produjo la diferencia; tiempo y RSS tampoco son estables (23:57/1,570 MiB frente a 27:20/2,169 MiB). QR geométrico y rotacional siguen en cero; la causa de baja lectura fotográfica sigue pendiente.
| REQ-040 | Release SemVer y canal propios del motor combinado OMR/QR, separados de app y plantilla | `apps/backend/src/modulos/modulo_escaneo_omr/omr/engineRelease.ts`, `apps/backend/tests/omr.test.ts`, `scripts/tests/omr-version-policy.test.mjs` | `1.0.0-dev.3` en canal `development`, independiente de app/TV4; incorpora precompilación/cotejo empaquetado de QR y raster PDF a 144 dpi por bloques de 8, validado sobre 414 páginas en 10 lotes. Sin promoción estable: faltan verdad terreno adjudicada y evidencia física reproducible de OMR, QR y plantilla. |
| REQ-041 | Repetibilidad OMR agrupada por QR exacto y página, separada de exactitud y adjudicada antes del release | `apps/backend/src/modulos/modulo_escaneo_omr/infra/metricasDatasetOmr.ts`, `apps/backend/tests/omr.dataset-grain.test.ts`, evaluador integral sobre capturas adicionales | 10 páginas QR únicas en las 24 capturas individuales; 7 de 36 recortes de contacto decodificaron QR y corresponden a 6 páginas ya presentes. Agrupadas, las 6 páginas comparan 41 reactivos: 31 tienen algún desacuerdo OMR, 4 incluyen emisiones incompatibles y 27 incluyen emisión frente a abstención (las categorías pueden solaparse). Los 17 renglones carecen de clave y etiqueta observada independientes; resultado diagnóstico de repetibilidad, no exactitud. |
| REQ-042 | Última pasada QR ZXing a escala de grises fuente, geométricamente validada y ligada por igualdad exacta al payload esperado | `apps/backend/tests/omr.qr.preimpresion.test.ts`, replay integral de seis condiciones Wild-OMR | Integración y prueba unitaria aprobadas (12/12 QR). El flujo completo devuelve identidad esperada 6/6; las seis son recapturas de una misma hoja con cinco condiciones y un escáner, diagnóstico sin generalización. OMR emitió 40/40 concordantes en el escaneo y 30/30 en una condición fotográfica, pero solo 0–1 aciertos de 5–13 emisiones en las otras cuatro; todas requieren revisión. No se aisló la diferencia de duración/RSS contra la versión base. Release estable sigue No-Go. |
| REQ-043 | Rescate QR a resolución fuente con giros ortogonales, payload esperado y validación geométrica; identidad separada de geometría OMR | `apps/backend/tests/omr.test.ts`, `apps/backend/scripts/omr-eval-wild-dataset.mjs`, `apps/backend/scripts/omr-eval-real-dataset.mjs` | `1.0.0-dev.2`: Wild-OMR 769/769; QR exacto 686→722 (+36; 93.89%), 36 fuentes `rotacion_pagina`, cero payloads erróneos; OMR idéntico por imagen entre baseline y candidato. CamScanner 39 filas/38 contenidos únicos: 2/39 QR exactos directos, 0 por giro y 0 incorrectos; 32 páginas únicas con 1 QR exacto. 311/397 marcas únicas coinciden con etiquetas heredadas, no independientes; 18/90 slots recapturados difieren solo por emisión/abstención. No estable; faltan adjudicación independiente, flujo productivo y prueba física. |
