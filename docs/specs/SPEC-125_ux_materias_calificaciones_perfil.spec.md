---
id: SPEC-125
titulo: Mejora UX de Materias, Calificaciones y Perfil Docente
version: 1.1.200
fecha: 2026-11-05
autor: Codex
modulo: frontend_docente_ux
estado: approved
---

## Contexto

Se abordará la GUI docente sección por sección, iniciando por Materias, Calificaciones y Cuenta (perfil docente). La fase debe reutilizar la dirección visual y los contratos ya aprobados en `SPEC-054` (identidad frontend), `SPEC-057` (Materias) y `SPEC-097` (Calificaciones), junto con el contrato funcional de Cuenta en `SPEC-049`; no crea otra identidad visual. Esta especificación coordina y acota la primera oleada a claridad, jerarquía, legibilidad, navegación, formularios, listas y estados de interfaz. No autoriza cambios de API, persistencia, permisos, cálculos de calificación ni reglas académicas.

La inspección visual de referencia se realizó en la instalación docente local y en el navegador integrado el 2026-10-25. Durante la primera implementación, el runtime dejó de responder; después se diagnosticó un rechazo del guard CSS, se corrigió el contrato de selectores, se ejecutó el procedimiento no destructivo documentado y API/UI volvieron a responder HTTP 200. Los builds experimentales se sincronizan con respaldo y verificación SHA-256.

La navegación repetida del shell docente incorpora un enlace para omitir la cabecera y las
pestañas y llegar a la vista activa. Esta técnica sigue WCAG 2.2 SC 2.4.1 para saltar bloques
repetidos; W3C documenta tanto el enlace al contenido principal (G1) como los landmarks:
[Understanding Bypass Blocks](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks).
El foco del enlace y su destino conserva un indicador contrastante, conforme a [SC 1.4.11,
Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).

El 2026-10-26, la vista Cuenta a 320 CSS px mostró contenido recortado: `cuenta-panel` tenía 237 px disponibles, pero su cabecera requería 285 px y el contenedor ocultaba el excedente. El ancho del documento no se desbordaba, por lo que el fallo no era detectable mirando solo la barra horizontal.

La reanudación de la auditoría capturó el runtime real en el navegador integrado el 2026-10-25 a 571 × 764 CSS px, en tema oscuro automático. Las capturas baseline de Materias, Calificaciones, Cuenta y Alumnos están en `reports/qa/gui-ux/2026-10-25/`. La navegación inicial mostraba solo parte de las secciones y exigía desplazamiento horizontal; REQ-005A sustituye esa tira por un selector accesible en pantallas estrechas.

La revisión detallada de Resultados por alumno encontró que la tabla de nueve columnas se comprimía y solapaba contenido a 571 px porque su presentación como fichas solo se activaba hasta 480 px. Se amplió el patrón a 700 px y el runtime mostró después una ficha por alumno con etiquetas de datos y acción en fila completa. La cuadrícula de las cinco vistas internas se conserva en dos columnas a 571 px; su regla de una columna solo aplica hasta 480 px. Evidencia antes/después y límites pendientes: `reports/qa/gui-ux/2026-10-25/review-notes.md`.

La captura sintética vigente del detalle de calificaciones encontró que las columnas de la lista física se comprimían a dos celdas en móvil y partían sus etiquetas/notas. El detalle ahora las apila en una sola columna hasta 480 CSS px; el E2E verifica 320/390 px y el recorte horizontal. Evidencia inspeccionada: `reports/qa/ux-calificaciones-current-goal-20261031/ux-audit-calificaciones-detalle-320-light.png`.

La reauditoría del detalle a 320 CSS px detectó que los nombres de las cinco secciones internas podían exceder el ancho de sus botones en la cuadrícula móvil. Hasta 430 CSS px la navegación ahora usa una sola columna, conservando orden, etiquetas, estado seleccionado y controles. El E2E mide que cada etiqueta quede dentro de su botón y que los botones no se solapen a 320/390 CSS px.

La misma reauditoría visual mostró en «Solicitudes de revisión» que los números de los conteos podían separarse de sus etiquetas y que el placeholder de búsqueda se recortaba en móvil. Los conteos ahora fluyen como fichas indivisibles; el placeholder es breve y la ayuda visible conserva los criterios efectivos. La búsqueda y sus datos no cambian.

La captura sintética del formulario de alta de Materias a 320 CSS px mostró que el control nativo de portada truncaba el texto del estado del archivo. El selector conserva la semántica y operación del control de archivo, pero presenta una acción y el estado/nombre elegido dentro de un diseño que refluye.

La auditoría visual del flujo de edición en Materias mostró que el aviso de éxito quedaba dentro de la tarjeta «Nueva materia», aunque informaba una modificación de un registro existente; además, su texto no identificaba el registro editado y persistía al abrir el diálogo de archivo. El resultado permanece anunciado como estado accesible, identifica la materia por nombre, se coloca fuera de la tarjeta de alta y se limpia al iniciar otra operación, sin duplicarse en un toast.

En la continuación del 2026-10-27, el runtime reveló que el selector móvil de secciones estaba dentro del contenedor desplazable de pestañas: al recorrerlo hasta Cuenta, el selector podía salir del viewport. Se fijó como bloque visible de ancho completo hasta 1023 px y se ocultaron las pestañas duplicadas en ese breakpoint. Además, las cinco métricas de Calificaciones ahora refluyen en columnas de al menos 8 rem. Revisión en runtime integrado: navegación a Calificaciones correcta a 583 px, cinco métricas en tres columnas y ancho del documento de 571 px; las mediciones previas verifican el selector a 320, 390, 571 y 1023 px, y la navegación agrupada de escritorio a 1024 px. Evidencia protegida y límites: `reports/qa/ux-wave1/review-notes.md`.

## Referencias de accesibilidad

- [WCAG 2.2 SC 2.5.3: Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name): el nombre accesible debe incluir el texto de la etiqueta visible para que la navegación por voz use las mismas palabras.
- [WAI-ARIA APG: Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) y [HTML Standard: details](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element): la información secundaria se agrupa con una divulgación operable, cuyo nombre resume el contenido.
- [WCAG 2.2 SC 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): limita el scroll bidimensional al componente que realmente lo requiere y permite presentar tablas de datos en un contenedor desplazable.
- [WCAG 2.2 SC 1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html) y [WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/): las relaciones entre encabezados y celdas deben mantenerse programáticamente disponibles aunque cambie la presentación visual.
- [WAI-ARIA APG: Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/): los indicadores `progressbar` requieren un nombre accesible que comunique qué mide; las etiquetas visibles también ayudan a quien no usa lector de pantalla.
- [WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): los cambios de estado que no mueven el foco deben poder anunciarse sin interrumpir la tarea.
- [WCAG 2.2 SC 3.3.1: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification): los errores detectados se describen en texto e identifican el campo afectado; [WAI Forms: User Notification](https://www.w3.org/WAI/tutorials/forms/notifications/) describe la asociación del error con el control mediante `aria-describedby`.
- [WCAG 2.2 SC 3.3.3: Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html): cuando se conoce cómo corregir un error, se proporciona una sugerencia; el mínimo de ocho caracteres se comunica sin exponer el contenido de la contraseña.
- [WCAG 2.2 SC 3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) y [WAI Forms: Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/): las etiquetas identifican el propósito del control y deben asociarse con el campo correspondiente.
- [USWDS Forms: Disabled states for components](https://designsystem.digital.gov/components/form/#disabled-states-for-components-in-forms): cuando una acción debe permanecer deshabilitada, recomienda explicar el motivo con ayuda contextual. Esta spec conserva el `disabled` nativo que ya gobierna la captura OMR y expone la explicación junto al botón, también asociada mediante `aria-describedby`.
- [WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): el resultado de copiar y los fallos que requieren una alternativa se distinguen mediante roles accesibles acordes al mensaje.

## Requisitos Funcionales

- **REQ-001 (Materias):** Revisar portada, catálogo activo/archivado, altas, edición, selectores, estados, ayudas y acciones de grupos. Ordenar visualmente el contenido para que el nombre de materia, grupo/contexto y acción principal se identifiquen con facilidad. Explicar los campos obligatorios/opcionales y exponer su semántica en alta y edición. El catálogo archivado prioriza materia y fechas legibles; no muestra IDs técnicos como referencia principal. Las cargas, errores recuperables y estados vacíos deben ser distinguibles; una falla de red nunca se presenta como catálogo vacío y ofrece reintento. Conservar contratos CRUD, portadas y navegación vigentes.
- **REQ-001C (Edición por teclado):** la edición de materia usa un formulario semántico y se puede enviar con Enter desde sus campos cuando los datos son válidos. La validación, el endpoint y el payload vigentes se conservan.
- **REQ-001F (Progreso de periodo):** el porcentaje calculado a partir de las fechas se identifica como tiempo transcurrido del periodo, no como avance de aprendizaje o calificaciones. El indicador conserva el cálculo; su nombre y valor accesibles explican la medida.
- **REQ-001G (Confirmación accesible de archivo):** el diálogo de confirmación para archivar Materias mueve el foco dentro del diálogo al abrirse, mantiene Tab y Shift+Tab dentro de él, permite cancelar con Escape y devuelve el foco al control que lo abrió cuando sigue disponible. Para reducir activaciones accidentales, el foco inicial va a la acción menos destructiva. Se conservan contenido, confirmación explícita y mutación existentes.
- **REQ-001H (Acciones identificables por materia):** en el catálogo de Materias, cada control que despliega acciones de una tarjeta incorpora el nombre legible de esa materia en su nombre accesible, conserva las palabras visibles del control y mantiene la relación con el panel de acciones de esa misma tarjeta.
- **REQ-001J (Acción explícita en catálogo vacío):** cuando no hay materias y el formulario de alta está plegado, el estado vacío identifica el control «Registrar materia» que abre el formulario. No añade una acción distinta ni altera el flujo de alta.
- **REQ-001K (Selector de portada legible):** el selector de portada del alta de Materias muestra una acción clara y un estado/nombre de archivo íntegro a 320 y 390 CSS px, en ambos temas. El control conserva etiqueta y descripción accesibles, foco visible, operación por teclado y selector de archivos nativo; selección, validación, vista previa y carga mantienen su comportamiento actual.
- **REQ-001L (Resultado contextual de edición de Materias):** el resultado de modificar una materia existente se muestra fuera de la tarjeta de alta «Nueva materia», identifica la materia por nombre, conserva su semántica `status`/`alert` y no se duplica mediante un toast. Al iniciar otra operación, el resultado anterior se limpia. No se cambia el flujo ni el contrato de la operación.
- **REQ-001M (Alta de Materias deshabilitada con orientación):** mientras no se cumplan los requisitos de alta, «Crear materia» mantiene el estado nativo deshabilitado, muestra junto al control cómo habilitarlo y asocia la explicación mediante `aria-describedby`. La acción sigue bloqueada y conserva validaciones, endpoint y payload.
- **REQ-001N (Placeholder completo en nombre de Materias):** el ejemplo del campo «Nombre de la materia» debe caber completo en el input a 320 y 390 CSS px. La etiqueta visible sigue identificando el campo y el placeholder no sustituye instrucciones ni validación.
- **REQ-001O (Opcionalidad de grupos visible):** las etiquetas de grupos en alta y edición indican «opcional». La instrucción visible explica cómo separar varios grupos con comas, se asocia al campo mediante `aria-describedby` y permite dejarlo vacío. No cambia validación, semántica del payload ni contratos.
- **REQ-001P (Contraste de estados de periodo):** las etiquetas «En curso», «Por finalizar», «Concluido» e «Inicia en…» conservan contraste de texto mínimo 4.5:1 en tema claro y oscuro. Usar los tokens semánticos existentes; no alterar el cálculo, la etiqueta ni el significado del estado.
- **REQ-001Q (Rango de fechas de Materias):** explicar antes del envío que la fecha de término debe ser igual o posterior a la fecha de inicio. El campo de término aplica el límite nativo `min` según la fecha de inicio; si el rango es inválido, el campo se identifica y el error visible se asocia al control. Se conservan la validación existente, los valores, cálculos, endpoint y payload.
- **REQ-001R (Selector de portada en edición):** al cambiar la portada de una materia existente, mostrar una acción clara y el nombre completo del archivo seleccionado dentro de un control que refluya a 320 y 390 CSS px, en ambos temas. Si ya existe una portada, comunicar ese estado antes de elegir un reemplazo. Mantener el selector nativo accesible, foco visible, formatos/tamaño permitidos, validación, vista previa, guardado explícito y contratos actuales.
- **REQ-001S (Pasos del estado vacío de Materias):** los tres pasos decorativos del catálogo vacío conservan texto legible y flechas distinguibles en claro y oscuro. Las superficies se adaptan al tema sin tarjetas claras anidadas sobre una cápsula oscura; el texto alcanza 4.5:1, no se pierde contenido a 320/390 CSS px y no cambian el contenido ni la acción existente.
- **REQ-002 (Calificaciones):** Revisar vistas de resultados, extraordinarios, actas, operación OMR y Classroom, incluidos filtros, selectores, listas/tablas, estados y exportación. Hacer explícitos materia/periodo, estado de resultados y siguiente acción sin alterar cálculos, origen de datos, sincronización ni criterios de calificación. Cuando no exista materia seleccionada o la consulta de una materia siga cargando/falle, no presentar conteos de alumnos como si fueran ceros confirmados; mostrar conteos solo para la materia cuyos resultados ya se cargaron correctamente. Cuando una búsqueda deje cero filas, explicar el estado y permitir limpiar esa búsqueda sin reiniciar filtros independientes. En captura OMR, explicar junto al campo Página que `0` intenta detectar el número con el QR y que la entrada manual usa el número impreso desde 1. Mantener ortografía correcta en etiquetas y errores visibles, conservando intactos los identificadores históricos de componentes en escrituras e historial.
- **REQ-002A (Encuadre y firmas):** exponer la consulta del estado del encuadre con mensajes `status` durante la carga y `alert` al fallar, ofrecer reintento de la consulta fallida y descartar respuestas tardías de una materia anterior después de cambiar el selector. No mostrar resultados de firmas de una materia mientras se consulta otra.
- **REQ-002X (Lectura de logotipos del Encuadre):** si el navegador no puede leer el archivo de logotipo seleccionado, mostrar el error junto al selector afectado, anunciarlo como `alert`, relacionarlo mediante `aria-describedby` y marcar el control con `aria-invalid`. Una nueva selección limpia solo el error de ese selector. No borrar un logotipo previamente leído ni cambiar los tipos admitidos, el payload o el flujo de guardado.
- **REQ-002Y (Identidad de filas en resultados):** las filas de la tabla de resultados usan el ID canónico del alumno como identidad de renderizado cuando está disponible; matrícula, nombre y grupo son datos visibles, no claves únicas garantizadas. La clave interna nunca se presenta en la interfaz y no altera la selección ni los datos del alumno.
- **REQ-002Z (Error al cargar cursos de Classroom):** si falla la consulta de cursos, distinguir el error del estado vacío confirmado y ofrecer un control explícito para reintentar solo el GET de cursos. Al iniciar el reintento, comunicar la carga y limpiar el error previo; si la conexión con EvaluaPro falla, dar contexto sobre la consulta y el siguiente paso en vez de mostrar el texto genérico «Sin conexion». Conservar los permisos y el endpoint.
- **REQ-002AA (Error al cargar roster y actividades de Classroom):** fallos al consultar estudiantes o actividades no deben presentarse como listas vacías confirmadas ni como consulta completada; mostrar el error junto al bloque afectado y ofrecer reintentar únicamente su GET. En fallos de conexión, explicar qué consulta falló y cómo recuperarla. La carga y el resultado del reintento son visibles; no se repiten escrituras, preview ni sincronización.
- **REQ-002AB (Carga y vacío de evidencias Classroom):** mientras la lista principal de evidencias está cargando o su consulta falla, no mostrar conteos en cero ni el estado vacío confirmado; ofrecer un reintento que repita solo el GET de evidencias. El estado vacío se presenta únicamente tras una respuesta exitosa sin filas. Sin materia seleccionada o sin permiso de lectura, no mostrar una tabla vacía: explicar que debe seleccionarse una materia o conservar la advertencia de permiso. Al cambiar de materia, descartar respuestas tardías de la anterior. No alterar la consulta, los filtros, las calificaciones ni las mutaciones de otras tareas Classroom.
- **REQ-002B (Detalle de resultados):** el botón «Ver detalle» comunica si el panel de ese alumno está abierto mediante `aria-expanded`; mientras esté abierto, `aria-controls` identifica el panel correspondiente. Su nombre accesible conserva «Ver detalle» al inicio e incorpora matrícula y grupo legibles para distinguir alumnos homónimos. Al cerrar el detalle, el botón vuelve a estado contraído y deja de apuntar a un panel desmontado.
- **REQ-002C (Foco del detalle):** al abrir el detalle por alumno, llevar el foco al panel para que el usuario de teclado no tenga que recorrer de nuevo el resto de la tabla. Al cerrarlo, devolver el foco al botón que lo abrió si continúa en el documento.
- **REQ-002D (Columnas del libro sin dato):** en «Libro completo», mostrar primero los valores disponibles y agrupar las columnas sin fuente en una divulgación nativa que comunique su cantidad. Mantener acceso a todos los nombres y escalas, distinguir «Sin dato» de cero y conservar los valores recibidos sin modificar cálculos ni contratos.
- **REQ-002BJ (Foco visible en ayuda de calificación manual):** el resumen nativo «Ayuda para calificar» muestra un indicador de foco visible y consistente con el acento compartido al navegar con teclado. Enter/Espacio conservan la acción nativa de abrir/cerrar y el contenido de ayuda no desplaza ni altera la captura de aciertos.
- **REQ-002E (Evidencias Classroom en móvil):** la lista semántica de evidencias conserva nombres de columna y relaciones de tabla en escritorio; en anchos de hasta 700 CSS px, presenta cada evidencia como una ficha de una sola columna con las etiquetas de dato completas y sus valores sin solapamiento, incluido el acceso a actividad e historial de entrega. No cambia el orden de lectura, los valores ni las acciones.
- **REQ-002F (Selección de extraordinarios):** el contador comunica de forma explícita cuántos alumnos están seleccionados y anuncia sus cambios sin mover el foco. El nombre de cada casilla de selección identifica a la persona y añade matrícula y grupo legibles para distinguir homónimos. En móvil, se apila bajo el título de elegibilidad para evitar que el encabezado y el número compitan por ancho. No cambia la elegibilidad, selección ni generación del lote.
- **REQ-002AC (Identificación de alumnos en Extraordinarios):** los controles y opciones asociados a cada alumno —selección para el lote, solicitud docente, revisión OMR, historial y selector de resultado externo— conservan su etiqueta o acción visible e incluyen nombre, matrícula y grupo legibles para distinguir homónimos. La casilla del lote presenta la acción «Incluir en el lote» junto al control, permite activar la casilla al pulsar esa etiqueta y mantiene un área interactiva de al menos 44 CSS px de alto; su nombre accesible comienza por la etiqueta visible y añade la identidad completa. Los controles de revisión asociados a un examen histórico incluyen también su folio. No muestran identificadores internos ni alteran elegibilidad, selección, generación, asignación o resultados.
- **REQ-002G (Confirmación de exportación):** tras generar y descargar el HTML, la confirmación identifica el resultado sin repetir las instrucciones persistentes de reemplazo y distribución visibles junto al formulario. El mensaje de actualización en una ubicación seleccionada conserva la instrucción de verificar sincronización.
- **REQ-002H (Calidad de captura OMR):** las instrucciones de calidad identifican el problema visible y sugieren una acción válida tanto para una imagen cargada como para una foto; no deben presuponer una cámara cuando el flujo acepta archivos.
- **REQ-002J (Classroom en móvil):** en anchos estrechos, los bloques de vinculación de actividades y revisión por tema no acumulan tarjetas decorativas anidadas que reduzcan el área legible. Se conserva la agrupación con encabezados y separación visual sencilla; los resúmenes de actividad mantienen un ancho útil sin overflow. No cambian permisos, consultas, calificaciones ni acciones.
- **REQ-002M (Selector manual de alumnos):** cuando varias opciones compartan matrícula y nombre, añadir materia/grupo legibles para distinguirlas sin mostrar IDs técnicos; conservar el identificador canónico solo como valor interno de la opción.
- **REQ-002N (Cerrar detalle):** el control «Cerrar detalle» usa un icono vectorial del catálogo, mantiene el nombre accesible y conserva su comportamiento de cierre y retorno de foco.
- **REQ-002AD (Navegación del detalle en móvil):** a 320 y 390 CSS px, las cinco secciones del detalle del alumno conservan su nombre visible dentro de cada botón, caben en el panel y no se solapan. Se conserva el orden, el estado activo, las acciones y la navegación por teclado.
- **REQ-002AE (Búsqueda y conteos del buzón de revisión en móvil):** a 320 y 390 CSS px, el placeholder de búsqueda cabe en el campo y la ayuda visible asociada enumera los criterios vigentes (folio, estado, pregunta y comentario). Cada conteo mantiene su etiqueta y valor en una ficha indivisible dentro del contenedor, sin solaparse con las demás. No cambia el conjunto buscado ni los valores calculados.
- **REQ-002BI (Contexto accesible por solicitud):** en cada tarjeta del buzón de revisión, el nombre accesible de la respuesta y de cada acción incluye el texto visible del control y el folio/pregunta de esa solicitud. Los nombres permiten distinguir controles al navegar o dictar acciones, también durante el estado de procesamiento. No se alteran etiquetas visibles, estados, permisos ni operaciones.
- **REQ-002AF (Recuperación de capturas Classroom):** el texto alternativo de cada ficha histórica identifica alumno, parcial y fecha, además del promedio cuando esté calculado. Si falla la descarga de una captura, se conserva el snapshot y se ofrece reintentar solo la descarga binaria de esa ficha; el estado de carga/fallo se comunica sin interrumpir, y el reintento no vuelve a consultar el historial ni invalida otras capturas o respuestas de otra selección.
- **REQ-002AK (Guía OMR progresiva):** Si no existe una preferencia previa, la guía extensa de Calificaciones inicia plegada en pantallas de hasta 700 CSS px y abierta en escritorio. La misma acción de divulgación conserva el foco al expandir/plegar, comunica `aria-expanded` y mantiene accesible el contenido completo. Una preferencia explícita se conserva entre sesiones y prevalece sobre el valor inicial responsive. No altera los pasos ni las operaciones de captura/calificación.
- **REQ-002AL (Orientación de análisis OMR deshabilitado):** Si «Analizar página» o «Analizar lote» está deshabilitado por falta de permiso o de una entrada válida, explicar junto a la acción la causa y el paso para habilitarla, y asociar la ayuda al botón con `aria-describedby`. Mantener el estado nativo `disabled`, las validaciones y el flujo vigente. Los avisos de carga o calidad que ya explican el estado no se duplican.
- **REQ-002AR (Búsqueda sin coincidencias en Resultados):** cuando la búsqueda de alumnos no encuentre filas, el estado identifica el término consultado y considera los filtros actuales. «Limpiar búsqueda» borra solo el término de búsqueda y conserva los demás filtros seleccionados. El mensaje sigue expuesto como `status`; no cambia la búsqueda, sus datos ni las consultas al servidor.
- **REQ-002AG (Lenguaje claro en el historial Classroom):** los textos visibles identifican cada registro del promedio con palabras conocidas, muestran los puntos como «X de Y», usan el singular/plural gramatical correcto en el conteo y no exponen jerga técnica en el resumen de la ficha. Se conserva el formato, tamaño y fragmento del hash, accesibles desde una divulgación nativa operable con teclado.
- **REQ-002AH (Estado de contraseña sin reautenticación disponible):** si el docente no tiene contraseña ni Google vinculado, o Google está vinculado pero OAuth no está disponible, no mostrar un formulario que no se puede enviar. Explicar la causa y orientar a la administración para resolver el acceso, sin relajar ni cambiar los requisitos de reautenticación.
- **REQ-002P (Validación del resultado Extra externo):** exigir folio, PDF fuente local válido, aciertos enteros explícitos (incluido `0`), total de reactivos entero mayor que cero y criterios de revisión de al menos 12 caracteres. Identificar visiblemente en las etiquetas qué campos son obligatorios y cuál es opcional, antes del envío; mostrar junto a los campos las reglas de rango, formato y longitud que se conocen de antemano. Un campo vacío no se interpreta como cero. Al guardar datos incompletos o inválidos, identificar cada campo con texto asociado, `aria-invalid` y foco en el primer error; borrar su error al corregirlo. Agrupar ayuda/errores con su control y apilar el formulario a 700 CSS px o menos. Al seleccionar un PDF nuevo, descartar inmediatamente el nombre/hash anterior hasta validar el nuevo archivo. Si no hay alumnos solicitantes elegibles o falta permiso para registrar, explicar el motivo junto al selector y orientar al siguiente paso posible; no dejar el selector y botón desactivados sin contexto. Conservar la opción de lote vacío, lectura local del PDF, validaciones de rango, contrato/idempotencia y reglas de elegibilidad vigentes.
- **REQ-002R (Recuperación de carga académica de Extraordinarios):** si falla la consulta de elegibilidad o del historial inicial, identificar el error y ofrecer reintentar esas consultas. Mientras la carga siga fallida, no presentar contadores en cero, la lista vacía ni el formulario como si los datos hubieran cargado correctamente. El reintento no debe repetir operaciones de escritura; las respuestas tardías de otro periodo siguen descartándose.
- **REQ-002S (Resultado de copiar claves individuales):** al copiar una clave, anunciar el éxito como estado; si el portapapeles no está disponible, comunicar el fallo como error accesible y conservar la alternativa visible de seleccionar/copiar manualmente. No revelar claves en anuncios, toasts ni mensajes distintos de la lista privada ya existente.
- **REQ-002T (Carga del buzón de revisión):** distinguir carga, error y vacío confirmado para la lista inicial de solicitudes. Un fallo de lectura no debe borrar solicitudes previamente cargadas ni presentarse como cero; ofrecer un reintento de lectura separado de «Sincronizar solicitudes», ya que sincronizar ejecuta una operación distinta. Si existe una lista previa, conservarla e indicar que la actualización falló.
- **REQ-002U (Resultado de sincronizar y recargar):** si la sincronización termina correctamente, pero falla la lectura posterior del buzón, informar ambos resultados con precisión: conservar el error de lectura y la lista previa, sin presentar la sincronización como fallida ni duplicar el mismo error.
- **REQ-002V (Resolución y recarga):** tras una respuesta exitosa de resolución, reflejar el estado devuelto por el servidor aunque falle la lectura posterior del buzón. Anunciar el problema de recarga sin sugerir que falló la resolución; no ejecutar además la sincronización manual, que es una operación POST distinta.
- **REQ-002W (Campo de respuesta):** etiquetar visiblemente el texto de respuesta del docente, asociar las instrucciones de obligatoriedad y longitud mínima, y exponer la propiedad requerida al navegador y tecnologías de asistencia. No cambia el límite ni las reglas de resolución.
- **REQ-002Q (Selectores repetidos de Classroom):** los selectores de asociación alumno→materia y actividad→parcial deben identificar en su etiqueta el alumno de Classroom o título de actividad que modifican. Cada control conserva un nombre accesible específico y una etiqueta visible. Cuando el texto nativo recorte un curso o alumno seleccionado, mostrar debajo su identidad completa y asociarla como descripción del control; si falta una selección o vínculo, explicar el estado y la acción siguiente. No se cambian opciones, valores, asignaciones ni payloads.
- **REQ-002AI (Materia seleccionada legible en Resultados):** cuando el nombre completo de una materia puede recortarse en el selector móvil de Resultados, mostrar el nombre seleccionado completo debajo y asociarlo como descripción. Los estados sin selección o con materia ya no disponible deben orientar al docente. No cambiar el valor, la consulta ni los filtros.
- **REQ-002BD (Error de conexión recuperable en Resultados):** si falla la carga inicial de calificaciones, el mensaje se normaliza con el helper de errores de usuario existente, incluye la sugerencia de recuperación cuando corresponda y no expone detalles de bajo nivel como `ECONNREFUSED` ni direcciones internas. El reintento sigue disponible y repite solo la consulta; no muestra conteos como cero confirmado ni altera datos, cálculos o contratos.
- **REQ-002BE (Error del historial de captura comprensible):** si falla la consulta de solo lectura del historial de captura, la interfaz presenta el error normalizado con la sugerencia correspondiente sin revelar detalles de bajo nivel o direcciones internas. El control permite volver a consultar; no cambia el endpoint ni genera escrituras.
- **REQ-002BF (Tarjeta de calificaciones legible en móvil estrecho):** a 320 CSS px, los pares de etiquetas y valores de la tarjeta de resultados se presentan en una sola columna para evitar que nombres de corte se partan o compitan con las calificaciones. A 390 CSS px se conserva el diseño de dos columnas; no se alteran orden, contenido ni semántica de tabla.
- **REQ-002BG (Navegación interna compacta en Calificaciones):** entre 361 y 480 CSS px, los cinco accesos internos se muestran en dos columnas y el quinto ocupa la última fila completa. Hasta 360 CSS px, la lista de cinco tarjetas se reemplaza por una etiqueta y un selector nativo compacto de al menos 44 px de alto; el selector conserva los cinco destinos, refleja la vista actual y permite navegar con teclado. La lista de botones continúa disponible en escritorio y en viewports mayores de 360 px. No cambian los destinos, permisos ni el estado de las vistas.
- **REQ-002BH (Contraste del encabezado de reportes):** el rótulo «Exportación de calificaciones» usa un par de color/fondo que cumple contraste de texto normal 4.5:1 en claro y oscuro. La corrección se limita a presentación y no altera datos ni navegación.
- **REQ-002BJ (Nombres veraces de la exportación):** la navegación y el encabezado describen la función existente como «Reportes y exportación» y «Exportación de calificaciones». No presentan los archivos descargables como actas ni documentos oficiales/certificados. HTML, CSV, XLSX y sus datos permanecen sin cambios.
- **REQ-002AM (Error del selector manual de exámenes):** si falla la consulta de exámenes entregados/calificados para el alumno seleccionado, no presentar conteos en cero ni opciones vacías como resultado confirmado. Mostrar un error comprensible y una acción de reintento; mientras la lectura falla, deshabilitar la búsqueda y el selector de examen. Reintentar solo la consulta GET existente. Al recuperarse, mostrar los conteos y opciones reales. No cambiar IDs, filtros, permisos, escrituras ni contratos.
- **REQ-002AT (Paginación del selector manual de exámenes):** consumir el `nextCursor` existente para que el docente pueda cargar páginas adicionales de exámenes entregados/calificados del alumno. Indicar cuándo quedan más páginas y cuántos registros se han cargado; ampliar la búsqueda local con cada página. Si falla una página posterior, conservar los resultados ya cargados y ofrecer reintentar solo esa consulta GET. No cambiar endpoints, permisos, escrituras ni contratos.
- **REQ-002AU (Errores parciales de consulta de actividades Classroom):** si falla parcialmente la consulta del curso, actividades o temas, identificar el recurso con una explicación comprensible y un siguiente paso; conservar los datos recibidos y permitir la recarga existente. Los códigos técnicos quedan disponibles en una divulgación cerrada para soporte. No cambiar endpoint, datos, permisos ni acciones.
- **REQ-002AV (Conteos de Resultados sin duplicación):** la consulta «Resultados por alumno» no repite los conteos de calificados/pendientes/total que ya presenta el resumen de Calificaciones para la misma materia. Conserva el estado textual de resultados filtrados y todos los filtros, filas, datos y cálculos; no altera la consulta ni el resumen superior.
- **REQ-002AW (Ayuda contextual de calificación OMR/manual):** la tarjeta de «Calificar examen» usa texto coherente con la fuente de respuestas. Si existe resultado OMR, explica con lenguaje docente qué confirmar antes de guardar y no muestra enums internos; si no existe resultado OMR, el subtítulo, la orientación de cálculo y la ayuda no afirman que haya resultado OMR confirmado ni respuestas detectadas por OMR. La ayuda general sigue disponible y no cambian los cálculos ni payloads.
- **REQ-002AZ (Confirmación de calificación sin respuestas OMR):** si no existe resultado OMR y ningún reactivo tiene respuesta cargada, la tarjeta informa la calificación que resultará y exige una confirmación explícita antes de habilitar el guardado. La confirmación corresponde al examen, alumno, respuestas y nota calculada vigentes; si cambia alguno, debe confirmarse de nuevo. Se conservan fórmula, permisos y payload.
- **REQ-002BA (Captura de aciertos en calificación manual):** en el modo manual sin análisis OMR, permitir que el docente introduzca el número entero de aciertos de la revisión física, dentro del rango 0..total de reactivos. El campo inicia vacío, presenta etiqueta e instrucción visibles y comunica error textual para valores inválidos. La nota se calcula con la fórmula existente `aciertos / totalReactivos × 5`, redondeada a dos decimales, y el bono existente permanece limitado por el máximo. El botón Guardar queda bloqueado hasta capturar un valor válido; con cero aciertos requiere además confirmación explícita. Se envían únicamente los campos ya soportados `aciertos`, `totalReactivos` y `bonoSolicitado`, sin fabricar respuestas OMR ni modificar permisos, persistencia o contrato API. La ruta OMR conserva su cálculo y revisión actuales.
- **REQ-002BJ (Accesos directos de Revisión y captura):** al entrar a ese espacio de Calificaciones, mostrar enlaces nativos para saltar a Escaneo y revisión OMR, Selección manual de examen, Encuadre académico y Solicitudes de revisión. Cada enlace lleva el foco al encabezado único de su destino, mantiene visible el indicador de foco y se reacomoda sin desbordamiento en 320 CSS px. No oculta ni desmonta paneles, no mueve los datos ni altera consultas, permisos, cálculos o acciones.
- **REQ-002BK (Conservar la lista al consultar códigos de acceso):** durante la actualización de los códigos de una materia, mantener visible la última lista cargada correctamente y anunciar que se muestra la consulta anterior. Si la actualización falla, conservar esa lista e identificarla como la última consulta correcta junto con el error recuperable. Aplicar el mismo comportamiento si la generación o expiración de un código inicia la actualización de la lista. Al cambiar de materia, limpiar los códigos de la materia previa. No cambiar códigos, vencimientos, publicación, consultas API ni permisos.
- **REQ-002AX (Motivo visible cuando falta permiso para calificar):** si el perfil no tiene permiso para calificar, explicar junto a «Guardar calificación» por qué la acción está deshabilitada y relacionar la explicación con el botón mediante `aria-describedby`. Se conserva el estado nativo `disabled`, los permisos y el flujo de guardado.
- **REQ-002AY (Motivo visible al activar la calificación manual):** cuando hay alumno y examen seleccionados pero el perfil no tiene permiso, explicar junto a «Usar examen para calificación manual» por qué sigue deshabilitado y asociar el motivo al botón mediante `aria-describedby`. Se mantienen permisos, selección, carga y activación vigentes.
- **REQ-002BB (Contraste del estado de calificación):** el texto visible «Con calificación» en los resultados por alumno mantiene al menos 4.5:1 en temas claro y oscuro sobre su fondo efectivo. Se reutiliza el token semántico de éxito por tema, conservando fondo, indicador, etiqueta y cálculo.
- **REQ-002BC (Alcance del KPI de páginas):** el KPI que cuenta páginas procesadas identifica visiblemente que son páginas OMR, para distinguirlas de alumnos con una calificación registrada. Se conservan el valor, su fuente de datos y los cálculos.
- **REQ-002AN (Búsqueda tolerante a tildes en Resultados):** la búsqueda de alumnos en Resultados debe ignorar diferencias de acentuación y mayúsculas en nombre, matrícula y grupo, como la búsqueda de la sección Alumnos. Se conservan las etiquetas, filas y datos; la normalización solo se aplica al texto de consulta.
- **REQ-002AO (Ordenamiento de calificaciones incompletas):** al ordenar por calificación final de mayor a menor o de menor a mayor, las filas sin calificación final permanecen al final. Las calificaciones presentes mantienen el orden numérico indicado; no se interpreta un valor vacío como cero ni como nota negativa.
- **REQ-002AP (Estado descriptivo del registro de calificaciones):** el estado de la tabla clasifica como «Con calificación» a un alumno si al menos uno de los campos de calificación resumidos tiene valor, y como «Sin calificación» si todos están vacíos. Los resúmenes, filtros, ordenamiento y filas visibles usan esos términos, para no implicar que el curso o acta completos ya están calificados. Se conserva la regla de clasificación y el contrato interno de los conteos.
- **REQ-002AQ (Explicación del umbral de elegibilidad para Extra):** en Extraordinarios, explicar con palabras que la elegibilidad usa la calificación final con decimales menor que 6 y que la nota para el acta se calcula aparte. Identificar esos valores como «Final del curso» y «Final para acta»; usar estados «Elegible»/«No elegible» sin operador aislado. Conservar las reglas, valores, cálculos, permisos y payloads actuales.
- **REQ-002AS (Estado de consulta del historial Classroom):** distinguir el historial del promedio aún no consultado, su carga, un vacío confirmado tras una respuesta válida y un error de consulta. No presentar un vacío antes de consultar ni junto a un error; al cambiar materia, alumno o parcial, limpiar el resultado/error anterior. Mantener los mismos filtros, endpoints, datos y permisos.
- **REQ-003 (Perfil/Cuenta):** Revisar datos del docente, institución/logos, preferencias y seguridad de cuenta. Agrupar campos por propósito, usar etiquetas e instrucciones claras y comunicar validación, guardado y errores sin modificar autenticación, seguridad ni persistencia. En anchos estrechos, todos los indicadores y el contenido de cada panel deben replegarse dentro del ancho disponible sin recorte horizontal.
- **REQ-003A (Nombre y descripción de campos de Cuenta):** En los campos de páginas y retención, el nombre accesible debe conservar el texto de la etiqueta visible y las instrucciones sobre formato/efectos deben asociarse como descripción. Mantener las opciones, valores y payloads.
- **REQ-003B (Envío por teclado del cambio de contraseña):** Los campos de cambio de contraseña deben pertenecer a un formulario semántico que permita enviar con Enter, además del botón visible. El envío mantiene las validaciones actuales, evita solicitudes duplicadas mientras se guarda y no cambia el endpoint ni el payload.
- **REQ-003C (Reautenticación explícita):** Cuando una contraseña actual sea necesaria para cambiar credenciales, indicarla como obligatoria en su etiqueta visible y en el estado programático del campo; asociar una explicación breve con el control. Mantener la política de autenticación y el payload.
- **REQ-003V (Visibilidad de campos de contraseña):** Los campos actual, nueva y confirmación de contraseña permiten alternar su visibilidad de forma independiente. Cada botón usa nombre accesible estable y distinto, estado `aria-pressed`, relación `aria-controls`, operación por teclado y no envía el formulario. El valor, las ayudas, la validación, el autocomplete y la política de autenticación permanecen intactos.
- **REQ-003AD (Control único de visibilidad de contraseña):** En los campos de cambio de contraseña de Cuenta, el navegador no debe mostrar un segundo control de revelado superpuesto al botón propio de EvaluaPro. El botón propio comunica «Mostrar»/«Ocultar» en nombre accesible y alterna el icono según el estado; al mover el foco fuera del grupo campo-botón, la contraseña vuelve a ocultarse. Se conservan la alternancia independiente, el valor, `aria-controls`, `aria-pressed`, el acceso por teclado y el envío explícito del formulario.
- **REQ-003F (Navegación interna de Cuenta):** La página Cuenta ofrece enlaces de salto a sus bloques visibles de perfil, sincronización, seguridad y preferencias del sistema. La navegación usa un nombre accesible que la identifica como agrupamiento de secciones; el destino que reconstruye iconos en Escritorio y Menú Inicio se nombra «Accesos del escritorio» para distinguirlo de la navegación interna. Cada enlace apunta a un encabezado único, opera con teclado y lleva el foco al destino; los paneles y formularios permanecen montados y conservan valores al navegar. En pantallas estrechas los enlaces se reacomodan sin desbordamiento. La Papelera solo se incluye cuando el panel está visible para administración en desarrollo.
- **REQ-003G (Errores de carga de imágenes de Cuenta):** Los errores al seleccionar, validar, leer o guardar una foto de perfil o un logo PDF aparecen junto al selector afectado, se anuncian al producirse y quedan asociados programáticamente al control mediante `aria-describedby`; el control comunica el estado inválido con `aria-invalid`. Una nueva selección limpia el error previo de ese control, sin borrar errores del otro selector. Se conservan tipos, tamaños máximos, almacenamiento local, valores y flujo de guardado existentes.
- **REQ-003U (Recuperación y aislamiento de foto de perfil):** Si la foto vinculada a la cuenta no carga, Cuenta explica el fallo y permite elegir o cambiar una foto local de respaldo. La interfaz indica que esa imagen solo se guarda en el equipo y no se envía al servidor. Si cambia la cuenta docente, la vista actualiza su foto local desde el almacenamiento de esa identidad y no muestra la foto de otra cuenta. Se conserva la preferencia por la foto vinculada cuando está disponible; no se cambian contratos ni persistencia de cuenta.
- **REQ-003H (Enlaces externos de actualizaciones):** Los enlaces externos que abren una pestaña o ventana nueva deben anticipar ese cambio de contexto con una indicación visible y una descripción en el nombre accesible del enlace. Se conservan las URL y el destino de navegación existentes.
- **REQ-003J (Estado accesible de consulta de actualizaciones):** Al iniciar la consulta de GitHub Releases, Cuenta anuncia de forma no intrusiva que está consultando y, al terminar, retira el mensaje de espera. El estado se puede determinar programáticamente sin mover el foco; se conservan el botón ocupado, las solicitudes y los resultados vigentes.
- **REQ-003K (Instrucción de confirmación de contraseña):** El campo para confirmar una contraseña mantiene visible y asociada la instrucción de repetir la nueva contraseña; si los valores no coinciden, agrega el error asociado sin sustituir la instrucción. Al corregirlo, el error y `aria-invalid` desaparecen, pero la instrucción permanece. No cambia la política, el endpoint ni el payload.
- **REQ-003Z (Error de longitud de contraseña nueva):** Cuando la contraseña nueva ingresada no alcanza el mínimo vigente de ocho caracteres, el campo identifica el error en texto visible junto al control y lo incluye en `aria-describedby` junto a la instrucción. Al corregirlo, el error y `aria-invalid` desaparecen. No se anuncia el valor ingresado ni cambian el mínimo, validación, habilitación, endpoint o payload.
- **REQ-003AA (Guía de Cuenta sin tooltip redundante):** El botón de la guía rápida usa una etiqueta visible que describe la acción; no agrega una descripción emergente duplicada que pueda superponerse a otros bloques en móvil. El control mantiene su nombre accesible y comportamiento de alternancia.
- **REQ-003L (Valor seleccionado de retención legible):** A 320 CSS px, el valor seleccionado de retención de parciales debe verse completo. Puede abreviarse su etiqueta visible si la ayuda asociada conserva el significado. Los valores de opción, selección persistida y payload no cambian.
- **REQ-003M (Ruta de sincronización legible):** El estado vacío del campo de carpeta no debe mostrar una ruta con usuario ficticio ni un ejemplo extenso susceptible de truncarse. A 320 CSS px, la indicación breve queda completa; la etiqueta visible y la ayuda siguen explicando que se requiere la carpeta local sincronizada por OneDrive y que se elige en cada equipo. No cambiar el valor guardado, el selector nativo ni el payload.
- **REQ-003N (Validación asociada de la ruta de sincronización):** Si se intenta guardar la carpeta local sin valor, el control muestra un error junto al campo, comunica `aria-invalid` y asocia la instrucción de error mediante `aria-describedby`; el error se anuncia sin enviar la mutación. Al ingresar una ruta no vacía, el error de campo se retira. Se conservan el selector, la ruta guardada y el payload existentes.
- **REQ-003P (Feedback dentro del flujo de Cuenta):** Los resultados de foto de perfil, seguridad, carpeta de sincronización, preferencias de PDF, retención, accesos directos y papelera se presentan dentro del panel que originó la acción. Los errores usan `alert` y los éxitos o estados neutrales usan `status`; no duplican anuncios ni toasts, y no desplazan el foco.
- **REQ-003W (Carga fiable de Papelera):** La consulta de Papelera distingue carga, error recuperable, vacío confirmado y datos previos conservados. Un fallo inicial no puede presentarse como lista vacía ni como conteo cero; si falla una actualización posterior, se identifica que el contenido visible proviene de la última consulta correcta. Conservar endpoint, paginación y acciones de restauración.
- **REQ-003S (Destino completo en accesos directos de Cuenta):** Al navegar con teclado a un bloque de Cuenta, el encabezado enfocado y su etiqueta de sección inmediata quedan enteros dentro del viewport, también cuando el documento se desplaza. El foco permanece en el encabezado y no se cambian destinos ni contenido.
- **REQ-003Q (Resumen compacto en móvil estrecho):** a 320 CSS px, los cinco indicadores del encabezado de Cuenta se presentan en dos columnas; el último ocupa la fila completa. Los valores y etiquetas permanecen íntegros, legibles y dentro de sus tarjetas, sin alterar el orden ni el contenido.
- **REQ-003AB (Encabezados de Cuenta según ancho disponible):** Los encabezados de Seguridad, PDF institucional y Actualizaciones adaptan su distribución al ancho real de cada panel, incluso cuando la ventana es amplia pero la navegación reduce la columna de contenido. Las etiquetas de estado pueden saltar de línea y permanecen dentro del panel sin recorte ni solapamiento, conservando texto, estado y orden de lectura.
- **REQ-003AC (Selector de imagen accesible sin invadir la interfaz):** Los controles nativos de archivo de logotipo institucional conservan su nombre, asociación con la etiqueta y acceso por teclado, pero su superficie visualmente oculta no se superpone con otros controles ni extiende el panel.
- **REQ-003R (Estado de carpeta frente a borrador):** Cuenta distingue la ruta persistida de un valor editado sin guardar. Para una cuenta sin carpeta persistida, una ruta escrita aparece como «Ruta sin guardar»; al cambiar una carpeta persistida aparece «Cambios sin guardar» y al volver al valor activo el estado indica «Configurada». El estado se comunica como `status`; el guardado, la ruta activa, las consultas y los payloads no cambian.
- **REQ-004 (Sistema visual):** Reutilizar tokens, componentes e iconografía existentes. Mejorar jerarquía tipográfica, espaciado, contraste y densidad donde la captura lo justifique; mantener los temas claro/oscuro y evitar colores crudos, texto ambiguo y señales que dependan solo del color.
- **REQ-004C (Iconografía compartida en toda la GUI):** Los iconos funcionales de interfaz se renderizan mediante `Icono` o `IconoLucide`, también en el selector de tema, guías, formularios, estados y vistas de información. `Icono` es un adaptador semántico del catálogo Lucide, no una segunda familia de dibujos; ambos adaptadores usan trazo de 2 CSS px con extremos y uniones redondeados, `currentColor` y la escala común. El tamaño predeterminado es 20 px; las solicitudes de 12 a 32 px se normalizan al nivel aprobado más cercano con ajuste máximo de 2 px, y por encima de 32 px al múltiplo de 4 más cercano. La clase base `icono` se conserva al agregar clases específicas. Los encabezados no repiten el mismo icono dentro de una sola jerarquía; en Materias, el emblema de biblioteca se distingue del icono de conteo del KPI contiguo. Se preservan nombres accesibles, semántica decorativa y colores por contexto. Gráficas, ilustraciones, documentos y QR quedan fuera del estándar; en la lista de tecnologías, usar símbolos Lucide genéricos en lugar de recrear logotipos con SVG propio. Las marcas no funcionales oficiales pueden conservar sus recursos de marca.
- **REQ-004D (Emblema de sección uniforme):** Cuando una cabecera de sección usa un emblema, el contenedor común `icono-seccion-orb` fija una caja circular de 52 × 52 px y un glifo centrado de 24 px en ambos temas. El fondo y el borde usan superficies/tokens compartidos; cada dominio puede conservar su acento semántico. Los resets genéricos de superficies BEM no pueden borrar su geometría. No aplica a controles de acción pequeños ni a QR, gráficas, ilustraciones, documentos o marcas.
- **REQ-004E (Iconografía semántica de KPI):** Los indicadores de Calificaciones usan glifos distintos cuando representan conceptos distintos: «Con calificación» conserva el check de resultado, y «Aclaraciones» usa un símbolo de conversación/pregunta con acento secundario. Ambos iconos son decorativos para tecnologías de asistencia porque las etiquetas visibles comunican el significado; no cambian conteos ni cálculos.
- **REQ-004F (Selector de fecha sin glifos duplicados):** En alta y edición de Materias, los campos de fecha conservan el selector nativo `type="date"` como único icono de calendario. No agregan un segundo icono decorativo que repita esa función; ambos formularios conservan la misma presentación, etiquetas, ayudas, validaciones, teclado y valores.
- **REQ-004A (Controles deshabilitados legibles):** En la GUI docente, los botones HTML deshabilitados permanecen claramente inactivos, pero sus etiquetas conservan legibilidad en claro y oscuro; no depender de reducir la opacidad global del control. Usar los tokens de interfaz existentes y no alterar su estado ni activación.
- **REQ-004B (Contraste del CTA de carpeta):** «Guardar carpeta» usa el color primario opaco del sistema y el color de texto asociado, en estado normal y hover, en tema claro y oscuro; el contraste de texto cumple al menos 4.5:1. Conservar el estado nativo deshabilitado durante el guardado, el foco visible y la acción existente.
- **REQ-005 (Accesibilidad y estados):** Mantener operación por teclado, orden de foco, foco visible, nombres y etiquetas accesibles; revisar carga, vacío, error y éxito disponibles. Mantener composición responsive y `prefers-reduced-motion`.
- **REQ-005A (Navegación estrecha):** Hasta 1023 CSS px, exponer todas las secciones permitidas mediante un selector nativo con nombre accesible y valor sincronizado con la sección activa. Evitar que el docente deba desplazar horizontalmente la navegación para descubrir otras secciones. En escritorio se conserva la navegación agrupada actual y su teclado.
- **REQ-005B (Ayuda contextual precisa en la navegación):** Las descripciones emergentes de las secciones nombran tareas disponibles con lenguaje concreto y no atribuyen velocidad, rendimiento u otras capacidades no medidas. No alteran etiquetas, permisos ni rutas.
- **REQ-005D (Omitir bloques repetidos del portal docente):** El primer control de teclado del shell ofrece «Saltar al contenido principal»; su destino es el contenedor enfocable de la vista activa, ubicado después de la navegación de secciones, y el enlace solo se hace visible al recibir foco. Mientras está oculto no intercepta puntero y conserva su orden como primer control de teclado. Cuando aparece, debe ajustarse al ancho disponible y mantenerse visible sin recorte en viewport móvil. Se reutiliza el landmark `<main>` exterior existente, sin anidarlo. No cambia la selección de sección ni desmonta vistas.
- **REQ-005E (Etiqueta de Ciclo Académico):** La etiqueta de Materias muestra «Ciclo Académico» sin glifos decorativos redundantes que puedan aparecer como cuadros vacíos; el texto conserva por sí mismo su significado.
- **REQ-005F (Navegación responsive con teclado):** En el selector nativo de secciones, una persona que usa teclado puede recorrer en orden las opciones permitidas y cada cambio sincroniza la vista y el indicador de sección activa sin recargar. En escritorio, la navegación agrupada conserva las teclas de flecha, Inicio y Fin.
- **REQ-005G (Ortografía de nombres de sección):** Los rótulos visibles de navegación usan ortografía española correcta; «Rehidratación» conserva el ID interno, ruta, permisos y destino existentes.
- **REQ-006 (Compatibilidad):** Mantener en español el contenido docente y preservar acciones, permisos, rutas, datos históricos, exportaciones y nombres accesibles existentes, salvo corrección expresamente documentada y aprobada.

## Criterios de Aceptación

1. Se inspecciona y documenta cada pantalla de las tres secciones en ejecución, con capturas de referencia y verificación posterior. Una pantalla no disponible en el runtime se registra como pendiente; un error de arranque no cuenta como evidencia de esa pantalla.
2. Cada cambio visual queda vinculado a un hallazgo concreto de captura o a un riesgo comprobable de interacción/accesibilidad.
3. Materias conserva alta, edición, apertura de grupo, gestión de portadas, descarga y archivo/restauración que existan en la versión objetivo; nombre y fechas se identifican como obligatorios y grupos/portada como opcionales. La carga fallida del catálogo activo o del archivo no aparece como un vacío legítimo y ofrece reintento.
4. Calificaciones conserva sus filtros, navegación interna, consulta/exportación y estados Classroom/OMR; no cambia fórmulas, registros, publicación ni sincronización. Sin materia seleccionada, durante carga o ante error, los conteos no simulan un resultado válido con ceros; tras una consulta exitosa, cero alumnos se comunica explícitamente. En Extraordinarios, el error de la carga inicial muestra recuperación y oculta conteos/lista vacía hasta que las consultas tengan éxito; el reintento no repite escrituras. Una búsqueda sin coincidencias comunica el vacío y ofrece limpiar únicamente la búsqueda. La captura OMR mantiene el valor predeterminado `0`, lo explica como detección por QR y comunica que el número manual empieza en 1. Los rótulos y errores usan «Examen» y «Práctica»; los valores de componentes enviados al backend e historial no se renombrarán.
5. Cuenta conserva perfil, configuración institucional, seguridad de sesión y preferencias; no cambia credenciales ni semántica de guardado. A 320 CSS px el resumen y los paneles se ajustan al ancho disponible sin ocultar texto o controles. Los encabezados de estado se reacomodan según el ancho del panel (incluido 1024 CSS px con navegación de escritorio) y no recortan ni superponen etiquetas.
6. Los selectores de archivo ocultos de logotipos mantienen etiqueta y foco accesibles sin cubrir campos vecinos ni desbordar el panel.
6. Los cambios mantienen contraste registrado en claro/oscuro, foco y teclado, nombres accesibles, y comportamiento responsive/movimiento reducido conforme a la política UI del repositorio.
7. Las pruebas focales y gates exigidos por `AGENTS.md` se ejecutan tras la aprobación de esta especificación y cualquier limitación queda reportada con su resultado exacto.
8. En el resultado de una actualización disponible, la nota visible y los nombres accesibles de descarga, novedades y checksum indican que el enlace abre una pestaña o ventana nueva; URL y destino siguen intactos.
8. A 320, 390, 571 y 1023 CSS px, cada sección permitida se puede alcanzar desde el selector visible; cambiar la opción cambia la vista actual sin recargar ni alterar permisos.
9. En «Libro completo», las columnas disponibles se identifican primero; las columnas sin dato se pueden abrir con teclado, muestran su nombre y escala, y no ocultan ceros registrados.
10. La tabla de evidencias Classroom se puede leer en escritorio como tabla y hasta 700 CSS px como fichas de una columna. A 320 y 390 CSS px, etiquetas, valores y acciones de cada ficha permanecen legibles, no se solapan y conservan el orden lógico.
11. A 320 y 390 CSS px, el mapeo de actividades a evaluación continua y la revisión por tema no anidan tarjetas decorativas que reduzcan el ancho útil; la ficha de actividad conserva más de 180 CSS px y el resumen no desborda.
12. En Publicación y acceso al Portal Alumno, cada resultado se presenta una sola vez en su mensaje contextual; el toast solo acompaña el resultado si ofrece una acción distinta de recuperación de sesión.
13. La vista previa de Classroom anuncia solo su resumen y mantiene proyecciones, avisos y controles interactivos fuera de la región viva.
14. El diálogo de archivo recibe foco inicial en «Cancelar», contiene el ciclo de Tab en ambas direcciones, Escape lo cancela sin mutar datos y al cerrarse devuelve el foco al botón «Archivar» cuando existe. La confirmación explícita mantiene su resultado actual.
15. La navegación interna de Cuenta contiene un enlace por cada bloque visible; al activarlo, el encabezado correspondiente recibe el foco y queda en el viewport. La lista se reacomoda a 320 CSS px y no desmonta ni reinicia formularios.
16. Cuando el selector manual de alumno de Calificaciones necesita desambiguar matrículas/nombres repetidos, muestra el nombre de materia y grupo, sin exponer IDs internos; seleccionar la opción conserva el ID canónico correspondiente.
25. Si falla la lectura local de cualquiera de los dos logotipos de Encuadre, el error se anuncia junto a ese campo, queda asociado al control y no borra el otro logotipo; seleccionar nuevamente el archivo permite reintentar sin modificar el payload ni el guardado.
26. Dos alumnos con matrícula repetida se renderizan como filas independientes sin advertencias de clave duplicada cuando tienen IDs canónicos distintos; estos IDs no aparecen como texto visible.
27. En el catálogo vacío de Materias, el mensaje identifica por nombre visible el control existente «Registrar materia» como paso para abrir el formulario plegado; la acción conserva el flujo y el contrato de alta actuales.
27A. En la edición de portada, el selector presenta «Elegir imagen» y el estado/nombre completo sin truncarse a 320/390 CSS px en claro/oscuro. Comunica si la materia ya tiene portada; conserva etiqueta, descripción, foco visible, selección por teclado, validación, vista previa y guardado explícito.
28. El tooltip de Calificaciones describe consulta de resultados, captura de notas y revisión de exámenes OMR sin afirmaciones de velocidad no verificadas; la etiqueta visible y la navegación permanecen iguales.
29. A 320 CSS px, el valor «Conservar siempre» del selector de retención se muestra completo; la ayuda visible mantiene que esa opción es la predeterminada y conserva los archivos sin plazo.
30. A 320/360 CSS px, Calificaciones presenta un solo selector etiquetado para sus cinco espacios, sin la lista vertical de tarjetas; el selector conserva foco visible, contraste, navegación con teclado y vista activa. Desde 361 px se muestran las tarjetas existentes, incluida la navegación por Tab a 390 px.
30. En el detalle de calificaciones, a 320 y 390 CSS px, las cinco etiquetas de navegación caben en sus botones sin solaparse; el foco, estado activo y orden de lectura se mantienen.
31. El primer Tab del portal docente enfoca «Saltar al contenido principal»; activarlo lleva al contenedor enfocable después de la navegación, el destino recibe foco y el enlace tiene contraste suficiente en ambos temas. Mientras está oculto conserva el orden de teclado sin interceptar puntero. A 320 CSS px, cuando recibe foco el texto se ajusta y el enlace cabe dentro del viewport.
32. Con resultado OMR, la ayuda de «Calificar examen» indica que se confirmen las respuestas detectadas cuando se requiere revisión, sin presentar `requiere_revision`. Sin resultado OMR, el subtítulo y el mensaje de cálculo describen las respuestas cargadas y la clave del examen, y ni la ayuda ni esos mensajes afirman que haya un resultado OMR confirmado.
33. Sin resultado OMR y sin respuestas cargadas, la tarjeta comunica la nota calculada, mantiene deshabilitado «Guardar calificación» hasta que el docente confirme el resultado sin respuestas y vincula el motivo al botón. La fórmula, los permisos y el payload permanecen iguales; al cambiar examen/alumno/respuestas/nota se invalida la confirmación.
34. En modo manual explícito, el conteo de aciertos inicia vacío; el docente puede registrar un entero de 0 al total inclusivo, ve la nota derivada de la fórmula vigente y no puede guardar mientras falte o sea inválido el conteo. Cero requiere confirmación; cambiar examen, alumno, total o conteo invalida la confirmación. El payload reutiliza `aciertos`, `totalReactivos` y `bonoSolicitado`; no incluye respuestas ni metadatos OMR. Los recorridos con resultado OMR siguen mostrando los resultados calculados por respuestas sin edición manual del conteo.
31. En Solicitudes de revisión, a 320 y 390 CSS px, la búsqueda expone un nombre y descripción accesibles claros, el placeholder breve cabe y los tres conteos permanecen unidos y visibles en claro/oscuro.
57. En cada solicitud del buzón, el campo de respuesta, «Marcar atendida» y «Rechazar» tienen nombres accesibles únicos que incluyen texto visible, folio y pregunta; la navegación por Tab sigue el orden campo → atender → rechazar → siguiente solicitud en móvil.
32. El feedback de operaciones de Cuenta se muestra en el panel correspondiente a la acción, tanto en éxito como en error; el mensaje es anunciado sin mover el foco y no aparece una segunda vez en otra región.
32. En el alta de Materias, el selector de portada muestra completa su acción y el estado/nombre elegido a 320/390 CSS px y ambos temas; conserva nombre/ayuda accesibles y puede operarse por teclado.
33. En el historial del promedio Classroom, las fichas de alumno/parcial/fecha tienen nombres alternativos distinguibles; si una imagen falla, su tarjeta ofrece reintento local con estado accesible. El reintento vuelve a pedir solo esa imagen y conserva el historial paginado y las demás capturas.
34. El historial Classroom no usa «snapshot» en los mensajes visibles; el puntaje de puntos expresa claramente obtenidos «de» posibles, y los metadatos WebP/tamaño/hash quedan en una divulgación con nombre claro, disponible por teclado.
35. El conteo del historial escribe «1 registro» y «N registros» para N mayor que uno; la prueba focal de GUI verifica ambos casos y que la divulgación técnica abra y cierre mediante teclado.
36. En Cuenta, una persona sin contraseña ni Google vinculado recibe una explicación accesible y el formulario de cambio de contraseña no aparece en un estado imposible de completar; los casos con credencial válida mantienen el formulario y la reautenticación actual.
37. Al editar una materia existente, el mensaje `status` identifica la materia por nombre y queda fuera de la tarjeta «Nueva materia»; al iniciar otra operación, el mensaje anterior se limpia. No se duplica en un toast y se conservan el foco, endpoint y payload.
38. Cuando no hay carpeta guardada, el campo de Cuenta no muestra un usuario ficticio ni una ruta larga que se recorte; su placeholder se lee completo a 320 CSS px y la ayuda mantiene la instrucción para usar la misma carpeta sincronizada en cada equipo.
39. En Classroom dentro de Calificaciones, aunque los selectores nativos recorten curso o alumno en móvil, se muestra y asocia como descripción la identidad completa seleccionada (nombre, sección o matrícula); los estados sin selección/vínculo indican cómo continuar. El historial identifica al alumno de consulta. Cambiar los controles conserva los mismos IDs y payloads.
40. En Resultados, el nombre completo de la materia seleccionada queda visible y asociado al selector aunque el valor nativo se recorte a 320 CSS px; el texto se actualiza al cambiar de materia y no altera la selección ni la consulta.
41. En Cuenta, intentar guardar una carpeta vacía presenta un error visible y anunciado asociado al campo, lo marca inválido y no llama a la configuración; al escribir una ruta, el error desaparece y el guardado válido conserva su comportamiento.
42. En el alta de Materias, cuando «Crear materia» está deshabilitado, se muestra una explicación cercana, enlazada al botón. Su estado nativo permanece disabled; la etiqueta mantiene contraste legible en ambos temas y los botones docentes deshabilitados conservan contraste sin alterar su comportamiento.
43. En el historial del promedio Classroom, elegir alumno o parcial no muestra «No hay registros» antes de consultar; un fallo se anuncia como error sin estado vacío simultáneo. Cambiar materia, alumno o parcial limpia la selección y el resultado anterior. Una respuesta exitosa con cero eventos sí muestra el estado vacío accesible.
43. En el selector manual de exámenes de Calificaciones, si la carga falla, se ocultan los conteos y la lista no se presenta como vacía confirmada; un mensaje de alerta explica que la lectura falló y el control permite reintentar. Búsqueda y selector permanecen deshabilitados hasta una lectura exitosa. El reintento solo repite la consulta GET.
44. La búsqueda de alumnos en Resultados encuentra «Pérez» aunque se escriba «perez» y mantiene la búsqueda por matrícula y grupo; los acentos y mayúsculas se conservan en los valores mostrados y datos originales.
45. En el alta de Materias, el placeholder de «Nombre de la materia» cabe íntegro a 320/390 CSS px en tema claro y oscuro; la etiqueta visible conserva el propósito del control.
45. Las opciones «Final: mayor a menor» y «Final: menor a mayor» ordenan numéricamente las notas disponibles y mantienen al final los registros sin calificación, sin convertir su ausencia en un valor numérico.
46. Los resúmenes, filtros, ordenamiento por estado y distintivos de Resultados indican «Con calificación» o «Sin calificación» según el criterio vigente de al menos una nota; no comunican que el curso esté completo cuando solo existen calificaciones parciales.
47. Extraordinarios explica que la nota final con decimales debe ser menor que 6 y separa ese valor de la nota para el acta. La pantalla identifica ambas notas con palabras y expresa elegibilidad sin un símbolo matemático aislado; la regla y los valores recibidos se mantienen intactos.
48. En la lista de Extraordinarios, cada alumno elegible con solicitud muestra la acción «Incluir en el lote» asociada a su casilla; activar la etiqueta cambia el contador sin mover el foco ni enviar una mutación. El objetivo interactivo mide al menos 44 CSS px de alto y su nombre accesible empieza con el texto visible, seguido de nombre, matrícula y grupo. No cambia quién es elegible ni qué alumnos se envían a generar.
49. En Resultados, el estado sin coincidencias nombra la consulta actual y mantiene el rol `status`. Al limpiarla, se conserva cualquier filtro independiente y aparecen las filas que coinciden con ese filtro.
50. A 320 CSS px, los indicadores de Cuenta forman dos columnas y el último ocupa todo el ancho; el resumen tiene como máximo 270 CSS px de alto. Cada valor y etiqueta cabe dentro de su tarjeta en ambos temas, sin dividir palabras arbitrariamente ni crear overflow horizontal.
51. Al escribir una ruta de OneDrive sin guardar, el estado señala el borrador; si ya existe una ruta activa, conserva esa ruta en su resumen hasta que la nueva se guarde. Revertir el campo al valor activo devuelve el estado «Configurada». Las transiciones se exponen como `status` sin cambiar la configuración del servidor.
52. En alta y edición de Materias, los controles de grupos se identifican como opcionales y su instrucción asociada explica la separación por comas sin repetir el mismo ejemplo en etiqueta, placeholder y ayuda. Se conservan el valor vacío permitido, los grupos enviados y los contratos.
53. En consultas parciales de Classroom, cada recurso fallido muestra su nombre y orientación en español; los códigos técnicos solo aparecen dentro de «Ver detalles técnicos para soporte», cerrado inicialmente. Los datos parciales se conservan y la recarga sigue siendo de lectura.
53. En calificación manual, si la API indica `nextCursor`, el docente puede cargar la página siguiente y buscar sus folios; el conteo dice cuántos exámenes están cargados. Si falla una página adicional, conserva los resultados anteriores y permite reintentar. Al cambiar de alumno, el cursor y el estado de carga anterior se descartan.
54. La etiqueta «Ciclo Académico» en Materias conserva su texto visible en temas claro y oscuro, sin un glifo decorativo redundante que pueda parecer un cuadro roto.
55. Los emblemas principales de Materias, Alumnos, Asistencias, Temarios, Banco, Cuenta, Entrega, Evaluaciones, Plantillas y Sincronización usan caja circular de 52 × 52 px y glifo de 24 px, con la misma superficie base; se conservan los acentos de dominio y las jerarquías textuales.
54. Cuando `puedeCalificar` sea falso, «Guardar calificación» permanece deshabilitado y se muestra junto a él el motivo; el botón referencia esa explicación con `aria-describedby`. Con permiso, no se muestra el aviso. No se altera la autorización ni el guardado.
55. En Selección manual de examen, después de elegir alumno y examen, la ausencia de permiso para calificar se explica junto a «Usar examen para calificación manual» y queda asociada con `aria-describedby`; el botón conserva `disabled` y no se activa. El aviso no aparece antes de completar esas selecciones ni cuando sí existe permiso.
56. En «Revisión y captura», cuando no hay exámenes revisados/calificados, el texto del selector deshabilitado es breve y comprensible en móvil; no duplica la categoría visible en su etiqueta ni queda truncado a 320 CSS px.
57. En «Revisión y captura», la identidad completa del alumno elegido permanece visible bajo el selector aunque su valor nativo se recorte en móvil. El selector referencia esa descripción con `aria-describedby`; se conservan la etiqueta de opción, el ID seleccionado y las consultas existentes.
58. En la navegación interna de Calificaciones a 361–480 CSS px, las etiquetas de cada acceso permanecen completas en claro y oscuro; el índice numérico decorativo se oculta para liberar ancho. Se conservan el orden, los destinos y los nombres funcionales accesibles.
59. El rótulo «Exportación de calificaciones» de Reportes y exportación mantiene contraste de texto de al menos 4.5:1 sobre su fondo real en tema claro y oscuro, en móvil y escritorio.
71. La navegación, el título y la descripción nombran la vista «Reportes y exportación» y no afirman emitir actas o documentos oficiales; HTML, CSV, XLSX, datos y acciones existentes siguen disponibles.
72. En el estado vacío de Materias, los tres pasos y las flechas conservan contraste de al menos 4.5:1 sobre la superficie renderizada en ambos temas a 320 CSS px; el diseño no anida tarjetas claras sobre un contenedor oscuro.
60. En Cuenta a 320 CSS px, pasar el puntero por «Ver guía rápida de cuenta y seguridad» no muestra un tooltip que cubra la tarjeta de perfil; el texto visible, nombre accesible y acción de alternancia permanecen disponibles.
17. El control «Cerrar detalle» en Calificaciones usa un icono vectorial compartido, no un glifo de texto, mantiene el nombre accesible y devuelve el foco al botón que abrió el panel.
18. El formulario de resultado Extra externo no permite registrar aciertos vacíos como cero; acepta cero explícito y asocia mensajes textuales con cada campo inválido. La validación conserva límites enteros/rango, PDF local, lote opcional y payload actual; enfoca el primer campo inválido y elimina el error de campo al corregirlo. Ayuda y errores permanecen junto a su campo; el orden es una columna en pantallas de hasta 700 CSS px. Un PDF nuevo o inválido no conserva la evidencia/hash del archivo anterior.
19. En el reporte HTML individual, copiar una clave produce un anuncio de éxito; si falla la API del portapapeles, el mensaje usa semántica de alerta y ofrece la copia manual, sin incluir la clave dentro del mensaje.
20. El buzón de solicitudes distingue carga inicial, error de lectura y vacío confirmado. El reintento vuelve a ejecutar solo la lectura GET; no llama la sincronización POST. Si ya existía una lista cargada y falla una actualización, conserva la lista anterior y anuncia el error.
21. Si el POST de sincronización tiene éxito y falla la lectura GET posterior, la interfaz indica que la sincronización se completó y que la lista no se actualizó; no muestra un falso fallo de sincronización ni repite el mismo error en dos mensajes.
22. Tras resolver una solicitud correctamente, el panel refleja el estado que devolvió el POST; si la consulta GET falla, conserva ese estado y comunica solo el error de actualización, sin acusar fallo en la resolución ni llamar al POST de sincronización.
23. Cada textarea de respuesta tiene una etiqueta visible asociada, instrucciones visibles de que es obligatoria y requiere al menos 8 caracteres, y atributo `required`; la instrucción está enlazada por `aria-describedby`.
24. Al pulsar «Buscar actualizaciones ahora», una región `status` persistente anuncia «Consultando actualizaciones en GitHub Releases» mientras la solicitud está pendiente y queda vacía al terminar; el foco no se mueve, el botón ocupado sigue identificable y los mensajes/resultados finales actuales se conservan.
19. En vinculación Classroom, cada selector de alumno incluye en su nombre el nombre y una clave de contexto de la cuenta Classroom; cada selector de parcial incluye el título de la actividad. Con dos o más filas, sus nombres accesibles permiten distinguir el control sin depender del orden o de contenido fuera de la etiqueta.
20. Si se rechaza o no se puede leer/guardar un archivo de foto o logo, el mensaje identifica el control afectado, está visible junto a él y se asocia al selector; el selector expone `aria-invalid="true"`. Al volver a elegir un archivo, solo se limpia el error de ese selector y puede volver a seleccionarse el mismo archivo después de un fallo de lectura. No se persiste ni aplica un archivo que incumple tipo o tamaño.
21. Si hay dos o más materias visibles, los controles que muestran/ocultan acciones tienen nombres accesibles distintos que incluyen «Mostrar acciones» u «Ocultar acciones» y el nombre de su materia. Activar uno solo abre/cierra el panel de esa materia y conserva sus estados `aria-expanded` y `aria-controls`.
54. En «Resultados por alumno», los conteos de calificados, pendientes y total aparecen una sola vez en el resumen superior de Calificaciones; la vista conserva el estado textual del conjunto filtrado. Materia, filtros, filas, datos y cálculos permanecen sin cambios.
55. Al seguir «Actualizaciones» desde los accesos directos de Cuenta con teclado, el encabezado recibe el foco y tanto el encabezado como la etiqueta «Mantenimiento y actualizaciones» quedan íntegros dentro del viewport. Los otros destinos conservan sus enlaces, foco y contenido actuales.
56. El botón «Guardar carpeta» alcanza contraste de texto de al menos 4.5:1 en estado normal y hover, en claro y oscuro, con fondo sólido del token primario; la selección, guardado y estado deshabilitado conservan sus contratos.
61. La etiqueta visible del estado de periodo en la tarjeta de Materias conserva contraste de al menos 4.5:1 en claro y oscuro. Las demás variantes de estado usan combinaciones de tokens semánticos equivalentes y verificables; se mantienen las fechas, cálculos y textos actuales.
62. El estado «Con calificación» de cada ficha de resultados usa un color de texto que conserva contraste mínimo de 4.5:1 en claro y oscuro sobre el fondo renderizado, sin alterar el indicador, los datos ni los filtros.
64. Los fallos de conexión al consultar cursos, estudiantes o actividades de Classroom conservan el contexto del recurso y un siguiente paso entendible; no presentan «Sin conexion» como diagnóstico suficiente. Se mantienen la alerta contextual, el reintento GET-only y la ausencia de falsos estados vacíos.
65. En «Revisión y captura» hay enlaces directos a OMR, Selección manual de examen, Encuadre y Solicitudes de revisión. Con teclado, Enter navega al encabezado correspondiente y le entrega el foco; el destino queda visible con separación del borde superior suficiente para conservar su categoría contextual. Los enlaces y encabezados no se recortan ni desbordan a 320 CSS px en ambos temas. Los paneles permanecen montados y su comportamiento existente se conserva.
66. Los iconos compartidos `Icono` e `IconoLucide` usan una sola familia, trazo de 2 px y extremos/uniones redondeados; su tamaño predeterminado es 20 px. La navegación identifica Calificaciones con su icono y el encabezado de página no lo repite junto al título. A 320, 390 y 504 CSS px, en claro y oscuro, el contador y las etiquetas permanecen dentro de la cabecera sin recorte ni overflow.
67. En Publicación, al actualizar la lista de códigos, la última lista correcta permanece visible durante la consulta y si esta falla; la interfaz señala que esos datos proceden de la consulta previa. Cambiar de materia sí elimina la lista anterior. Generación, expiración, publicación, permisos y operaciones API conservan su comportamiento.
68. En Calificaciones, el KPI de páginas identifica visiblemente «Páginas OMR procesadas», incluso cuando existe una calificación manual pero no hay páginas OMR. El conteo y su fuente no cambian.
69. En el resumen de Calificaciones, «Aclaraciones» no reutiliza el check verde de «Con calificación»; emplea un icono compartido de conversación/pregunta y acento secundario legible en claro y oscuro. Los conteos y su fuente no cambian.
70. En Cuenta, la navegación interna se identifica como «Secciones de Cuenta» y el vínculo a la función que regenera accesos de Windows se denomina «Accesos del escritorio»; el encabezado de destino usa el mismo nombre y mantiene el foco por teclado.
71. A 320 CSS px, con perfil ficticio y permisos para las secciones disponibles, el selector permite recorrer con teclado todas las opciones visibles; cada opción actualiza la vista y `aria-current` sin recargar ni cambiar permisos. En escritorio, flechas, Inicio y Fin siguen moviendo foco y selección entre pestañas agrupadas.
72. El nombre visible de la sección se muestra como «Rehidratación»; el valor interno `rehidratacion`, ruta y reglas de autorización permanecen idénticos.
73. En alta y edición de Materias, cada fecha se presenta como un control nativo `type="date"`, sin icono Lucide de calendario duplicado; se mantienen las etiquetas, restricciones y acciones de calendario del navegador.
74. Al enfocar con teclado «Ayuda para calificar», el `summary` muestra contorno sólido de 3 CSS px con desplazamiento visible; Enter lo expande conservando el contenido y el foco permanece en el resumen.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Edición, portada, catálogo y semántica de campos requeridos de materias | `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `apps/frontend/tests/seccionPeriodos.portada.test.tsx`; `apps/frontend/tests/seccionPeriodos.listasInstitucionales.test.tsx`; `apps/frontend/tests/seccionPeriodosArchivados.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Parcial: alta y edición anuncian campos obligatorios/opcionales y exponen `required`; alta y edición se envían con Enter en E2E a 320/390 CSS px; errores de nombre, fechas y grupos marcan el campo inválido y enlazan el mensaje con `aria-describedby`; la tarjeta resume hasta tres alumnos y comunica el total en su nombre accesible, manteniendo la acción para abrir la lista completa (prueba de edición: 13/13); el panel activo y archivado refluye a 320/390/571 px; los iconos de cabecera, KPI, guía y acciones reutilizan los catálogos compartidos, manteniendo SVG solo para el gráfico de datos; el archivo presenta conteos etiquetados y omite IDs opacos, usando materia y fechas para reconocer registros; nombres visibles y etiquetas accesibles de grupo/portada omiten el ID técnico; los selectores de portada asocian ayuda y error de formato/tamaño, sin confundirlo con fallos de guardado (portadas: 6/6); errores con severidad explícita; resumen de KPI con grupo nombrado y sin anuncio vivo del bloque completo; indicador porcentual rotulado como tiempo del periodo y expresado en su valor accesible (REQ-001F); E2E dummy de catálogos activos/archivados en claro/oscuro a 320/390 CSS px, sin overflow ni encabezados/fechas/conteos internos recortados; faltan recorridos de teclado de acciones restantes y verificación runtime de los demás estados |
| REQ-002 | Rutas, resumen, selector manual, captura OMR y aclaración de página automática | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx`; `apps/frontend/tests/escaneo.refactor.test.tsx`; `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Parcial: búsqueda tipada como `search` y estados sin coincidencias con acción para limpiar solo la búsqueda en la consulta de alumnos y en el selector manual de folios; en este último, `type="search"` habilita semántica nativa y affordance de borrado del navegador cuando está disponible; los errores de carga de Resultados y del selector manual ofrecen reintentar en el mismo contexto; el selector explica que admite exámenes entregados o calificados sin alterar su comportamiento; sin materia, durante carga o error, los indicadores de alumnos no se presentan como cero; los conteos del encabezado se vinculan a la materia cargada; el estado breve de contexto y el conteo de alumnos filtrados usan anuncios concisos, sin regiones vivas para bloques KPI/leyendas; los filtros de estado se anuncian como no disponibles mientras la consulta no está lista, permanecen localizables por teclado, explican el motivo y no cambian el filtro (resumen: 25/25 PASS; E2E móvil con fixture sintético: 1/1 PASS); el quinto KPI pasa a franja horizontal de ancho completo en 720 px o menos, manteniendo las cinco métricas (E2E comprueba móvil a 390 px y ausencia de desbordamiento a 320 px); prueba sintética comprueba recuperación de filas; selectores, búsqueda y filtros forman un grupo nombrado; OMR explica detección QR y numeración manual desde 1, comunica accesiblemente la preparación secuencial de lotes y su progreso, e identifica cada botón de página por folio/estado/selección; elimina la promesa de captura con cámara cuando solo se admite cargar archivos y corrige el texto alternativo de las vistas previas; el formulario individual mantiene el nombre Folio y usa un placeholder legible a 320 px; los textos de la zona de carga usan colores de tema que se distinguen en claro; recorrido sintético confirma reflow, títulos y ausencia de overflow a 320/390 px en ambos temas; etiquetas visibles preservan IDs de contrato; Actas y Revisión OMR refluyen a 320 px; Extraordinarios limpia la selección de plantilla al cambiar de materia, recupera fallos parciales/totales de carga y descarta respuestas tardías de elegibilidad o historial; faltan recorridos de otras acciones, exportaciones, tema/teclado en toda la sección y validación final runtime |
| REQ-002A | Carga, error recuperable y respuestas fuera de orden del estado de encuadre/firmas | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | Implementado: carga anunciada, fallo como alerta con reintento y respuesta de materia previa descartada; 13/13 pruebas del archivo focal pasan |
| REQ-002M | Identidad legible de alumnos duplicados en el selector manual, sin IDs internos visibles | `apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx` | PASS: opción accesible usa matrícula, nombre, materia y grupo; `value` conserva el ID del alumno; 5/5 pruebas del archivo focal pasan |
| REQ-002N | Icono de cierre consistente, nombre accesible y retorno de foco del detalle | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | PASS: el control conserva «Cerrar detalle», renderiza el SVG decorativo del catálogo y cierra devolviendo el foco al botón invocador; suite focal actualizada 28/28 |
| REQ-002AD | Nombres visibles dentro de los botones de navegación del detalle y ausencia de solapamiento móvil | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E geométrico en 320/390 CSS px; cinco etiquetas contenidas y botones sin intersección |
| REQ-002AE | Instrucción asociada a búsqueda y fichas de conteo legibles en móvil | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E verifica placeholder/description y contención/sin solapamiento de los tres conteos en claro/oscuro a 320/390 CSS px |
| REQ-002BI | Campo de respuesta y acciones distinguen folio/pregunta conservando rótulos visibles y orden de teclado | `apps/frontend/tests/appDocente.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado y validado: componente focal 1/1; E2E Edge 1/1 a 320/390 CSS px, claro/oscuro, con cuatro capturas, nombres únicos y recorrido Tab. ESLint focal, typecheck frontend, guard WCAG (81/81), auditoría SDD y diff-check PASS. No se ejecutaron acciones de atender/rechazar. Evidencia: `reports/qa/ux-review-inbox-context-20261104.md`. |
| REQ-002P | Validación asociada del formulario Extra externo; obligatoriedad/opcionalidad y reglas visibles antes del envío; orientación cuando no hay alumno registrable | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS focal: Extraordinarios 19/19; E2E sintético 1/1 en móvil y temas claro/oscuro verifica campos requeridos, lote opcional, ayuda de rango/entero/mínimo de 12 caracteres y nombres/descripciones accesibles. Capturas inspeccionadas en `reports/qa/ux-extraordinarios-required-fields-20261105/`. Estado vacío y motivos de elegibilidad/permisos conservados. |
| REQ-002R | Error recuperable en la carga inicial de elegibilidad e historial de Extraordinarios, sin falso estado vacío ni escritura en el reintento | `apps/frontend/tests/extraordinariosCalificaciones.test.tsx` | Implementado: fallos simulados de cada consulta muestran la alerta y ocultan conteos/lista; el reintento recupera datos y solo repite consultas, sin mutaciones. Prueba focal 15/15 PASS; TypeScript, ESLint focal, auditoría SDD y diff-check PASS. No se modifican estilos ni cálculos. |
| REQ-002S | Semántica de éxito/error al copiar claves personales del reporte individual | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | Implementado: el portapapeles bloqueado anuncia alerta con alternativa manual; la copia correcta anuncia estado; ninguna notificación expone el secreto. Prueba focal 21/21 PASS; TypeScript, ESLint focal, auditoría SDD y diff-check PASS. Sin cambios de estilo ni de generación/distribución. |
| REQ-002Q | Nombre específico por fila para los selectores de alumno y actividad Classroom | `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: la etiqueta identifica a la persona Classroom; la ayuda asociada muestra completos curso/sección, alumno/matrícula e historial/alumno aunque los selectores nativos recorten el valor. Los estados sin selección o vínculo orientan el siguiente paso. Los tests ejercitan selección, cambio y estados vacíos; se conservan los IDs/payloads. Suite de componente 24/24 y E2E sintético 1/1 PASS a 320/390/700 px en claro/oscuro y escritorio. Capturas inspeccionadas en `reports/qa/ux-calificaciones-classroom-destino-20261103/`. Sin cambio en permisos ni operación de sincronización. |
| REQ-002AI | Identidad completa de la materia elegida en el selector de Resultados | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado y validado: la descripción visible y accesible repite el nombre/fecha de la materia seleccionada; el estado vacío o no disponible explica el siguiente paso. Test focal de Calificaciones y E2E sintético a 320/390 CSS px, claro/oscuro y escritorio; sin cambios en la consulta ni filtros. |
| REQ-002AJ | Etiqueta y error del secreto individual con relaciones HTML válidas | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente 25/25; E2E visual sintético 1/1 a 320/390 CSS px y escritorio, con grupo/individual, validación, claro/oscuro y descarga simulada. Capturas actuales en `reports/qa/ux-calificaciones-reportes-20261103/`. La etiqueta se asocia explícitamente al campo; ayuda y error son hermanos y se vinculan por `aria-describedby`. Sin cambios de validación ni generación de claves. |
| REQ-002AM | Error de carga recuperable en selector manual sin conteos falsos ni acciones sobre lista incompleta | `apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: componente 7/7; E2E Edge 1/1 en 320/390 CSS px y claro/oscuro comprueba error, controles bloqueados, ausencia de falso vacío y recuperación GET. Capturas en `reports/qa/ux-calificaciones-manual-error-20261103/`. |
| REQ-002BB | Texto breve y legible del selector vacío de exámenes revisados/calificados | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: a 320/390 CSS px el selector conserva la etiqueta completa «Exámenes revisados/calificados» y muestra «No hay exámenes» como valor vacío; capturas inspeccionadas en tema claro/oscuro en `reports/qa/ux-calificaciones-manual-error-20261103/`. |
| REQ-002BC | Identidad completa del alumno manual visible y vinculada al selector | `apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: componente verifica identidad y `aria-describedby`; E2E verifica el nombre completo del alumno dummy a 320/390 CSS px en ambos temas dentro del flujo de error recuperable. |
| REQ-002AT | Carga progresiva del selector manual mediante el cursor y recuperación de errores de página | `apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx` | PASS: cubre cursor siguiente, búsqueda ampliada, conservación de la primera página al fallar y reintento solo GET; suite focal 6/6. |
| REQ-002AN | Búsqueda de alumnos en Resultados insensible a diacríticos y mayúsculas, sin alterar el texto visible | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | Implementado: 29/29 pruebas focales PASS, incluyendo «perez» que encuentra «Pérez». TypeScript, ESLint focal, auditoría SDD y `git diff --check` PASS. |
| REQ-002AO | Orden numérico de resultados con calificaciones ausentes al final en ambos sentidos | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | Implementado: 29/29 pruebas focales PASS; los alumnos sin nota aparecen al final en orden ascendente y descendente. TypeScript, ESLint focal, auditoría SDD y `git diff --check` PASS. |
| REQ-002AP | Lenguaje de estado que distingue presencia de calificación de curso completo en KPI, filtros, tabla y detalle | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: estado resumido, filtros, ordenamiento, tabla, detalle y KPI del encabezado usan «Con calificación»/«Sin calificación»; pruebas focales combinadas 55/55 PASS; E2E Edge 1/1 a 320/390 CSS px en claro/oscuro; capturas inspeccionadas en `reports/qa/ux-calificaciones-labels-20261103/`. |
| REQ-002AQ | Umbral de Extra y valor de acta explicados con etiquetas y lenguaje claros | `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: 48 pruebas focales y E2E Edge 1/1 en 320/390 CSS px, temas claro/oscuro. |
| REQ-002BD | Mensaje de conexión normalizado y recuperable sin detalle técnico en la carga de Resultados | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | PASS: archivo focal 31/31; incluye sugerencia de recuperación, ausencia de `ECONNREFUSED`/dirección local y botón de reintento. Typecheck, ESLint focal, guardia WCAG (73/73), auditoría SDD y diff-check PASS. |
| REQ-002BE | Mensaje normalizado y reintento disponible en la consulta del historial de captura | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | PASS: el test focal verifica la sugerencia, la ausencia de datos técnicos y que el botón de consulta vuelva a estar habilitado. |
| REQ-002BF | Reflujo de tarjetas de resultados a 320 px y conservación de dos columnas a 390 px | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge 1/1 comprueba una columna a 320 px y dos a 390 px, en claro/oscuro, más ausencia de desbordamiento horizontal; capturas postcambio inspeccionadas en `reports/qa/ux-calificaciones-current-audit-20261103/`. |
| REQ-002BG | Navegación de Calificaciones compacta: tarjetas en dos columnas de 361–480 px; selector etiquetado y teclado hasta 360 px | `tests/gui-responsive/responsive-docente.spec.ts`; `apps/frontend/tests/gui.responsive.contract.test.tsx` | E2E Edge comprueba tarjetas en dos columnas y Tab a 390 px; selector único, cinco destinos, tamaño táctil y cambio de vista por flechas a 320 px, ambos temas y sin overflow. Contrato responsive verifica los breakpoints y la presencia del selector móvil. Capturas actuales en `reports/qa/ux-calificaciones-mobile-nav-20261104/`. |
| REQ-002BH | Contraste WCAG AA del rótulo «Exportación de calificaciones» en fondos compuestos de ambos temas y viewports | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge focal mide el contraste renderizado a 320/390 CSS px en claro/oscuro y a 1440 px en ambos temas. |
| REQ-002BJ | La navegación y el encabezado describen los reportes reales sin afirmar que emiten actas oficiales | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Pruebas focales verifican nombre y descripción del destino, encabezado nuevo y ausencia del copy anterior; formatos y CTA existentes conservados. |
| REQ-002B | Estado del detalle, relación con el panel y nombre accesible que distingue alumnos homónimos | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | PASS: suite focal 28/28; verifica estado expandido/contraído, asociación del panel, ausencia de referencia al cerrar y nombres únicos basados en matrícula/grupo; el nombre comienza con el texto visible «Ver detalle», según [WCAG 2.2 SC 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html) |
| REQ-002C | Foco al abrir el detalle y retorno al botón invocador al cerrar | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | PASS: Enter abre y enfoca el panel; cerrar devuelve el foco al botón de origen; cubierto en la prueba focal |
| REQ-002D | Lectura priorizada de columnas del libro y divulgación operable de columnas sin dato | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: valores disponibles primero; columnas sin dato agrupadas por cantidad en `<details>/<summary>` nativos, sin convertir 0 en ausencia; prueba unitaria y E2E de teclado cubren apertura y contenido; capturas sintéticas colapsada/expandida a 390 px |
| REQ-002BJ | Foco visible y operación por teclado en la divulgación de ayuda para calificación manual | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge focal comprueba foco sólido de 3 px con offset visible y expansión por Enter en el flujo manual con fixture; captura actual en `reports/qa/ux-calificaciones-current-audit-20261105/`. |
| REQ-003, REQ-003A | Perfil, preferencias e institución, incluido reflow a 320 CSS px y nombres accesibles que coinciden con etiquetas visibles | `apps/frontend/tests/seccionCuenta.test.tsx`; `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Cuenta: prueba focal 27/27 PASS; panel refluye a 320/390/571/1023 px; indicadores con mínimo de 8 rem verificados visualmente a 571 px; campos de logos conservan etiquetas visibles; iconos de cabecera y los cinco KPI migrados al catálogo compartido; la nueva contraseña comunica `required`, marca los valores no vacíos menores a 8 caracteres como inválidos y asocia la regla con `aria-describedby`; el error de confirmación de contraseña marca el campo inválido y asocia su texto con `aria-describedby`, desapareciendo la relación al corregirse; los selectores de páginas/retención mantienen nombres alineados con su texto visible y describen la consecuencia de eliminar archivos; resumen de cuenta sin anuncio vivo amplio y errores de actualización con reintento; la sección de actualizaciones delimita que solo consulta/enlaza, expone el checksum si la release lo publica y avisa cuando falta; E2E con perfil ficticio a 320/390 px, ambos temas y sin overflow/encabezados recortados; zoom 200 %, recorrido completo de teclado y estados runtime aún pendientes |
| REQ-003L | Texto seleccionado del selector de retención completo a 320 CSS px | `apps/frontend/tests/seccionCuenta.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; prueba de componente confirma la opción visible «Conservar siempre» y el E2E mide que cabe a 320 CSS px. La ayuda asociada conserva la explicación de que la opción es predeterminada y sin plazo. |
| REQ-003M | Placeholder de OneDrive breve, no personalizado y legible a 320 CSS px | `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado y validado: test de componente confirma el placeholder neutral; E2E con Cuenta ficticia 1/1 PASS a 320/360/390/640 px en ambos temas y escritorio 1024 px; mide que el texto cabe en el ancho útil a 320 px. Capturas inspeccionadas en `reports/qa/ux-cuenta-onedrive-20261103/`. No cambia el valor guardado, el selector ni el payload. |
| REQ-003N | Error de carpeta vacía asociado al campo y validación sin mutación | `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Validación local: componente 10/10 PASS; E2E Cuenta 1/1 en 320/360/390/640 CSS px, ambos temas, con captura 320 px del estado vacío. Verifica que no se solicita configurar al enviar vacío y que el error se limpia al corregir. Build docente PASS (TypeScript, ESLint, bundle y WCAG 69/69); SDD audit PASS; `git diff --check` exit 0 con avisos de normalización CRLF. |
| REQ-003P | Mensajes de resultado locales al flujo que originó cada acción de Cuenta | `apps/frontend/tests/seccionCuenta.test.tsx`; `apps/frontend/tests/sincronizacion.behavior.test.tsx` | Mensajes dentro de su panel; errores de guardado de carpeta usan `alert`, éxitos usan `status`, sin toast redundante. Prueba focal de sincronización 12/12 PASS; typecheck, ESLint focal, WCAG guard y auditoría SDD PASS. |
| REQ-003S | Accesos directos enfocan el encabezado y dejan visible su etiqueta de sección | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge focal 1/1, teclado a 320 CSS px; el encabezado mantiene el foco y la etiqueta «Mantenimiento y actualizaciones» queda completa dentro del viewport. Capturas de antes/después archivadas en `reports/qa/ux-cuenta-auditoria-20261103/`. |
| REQ-003Q | Resumen de estado de Cuenta compacto, íntegro y sin overflow a 320 CSS px | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge sintético 1/1 a 320/360/390/640 CSS px y 1024 px; a 320 verifica dos columnas, último indicador a ancho completo, altura ≤270 px, palabras íntegras, textos dentro de tarjetas y ausencia de overflow. Capturas claro/oscuro inspeccionadas en `reports/qa/ux-cuenta-summary-compact-20261103/`. |
| REQ-003R | Indicador distingue estado persistido de ruta borrador y se anuncia sin mover foco | `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente 11/11; E2E Edge 1/1 a 320/360/390/640 CSS px y escritorio 1024 px, en ambos temas. Verifica la ruta borrador y conserva la activa hasta guardar; capturas 320 px inspeccionadas en `reports/qa/ux-cuenta-unsaved-path-20261103/`. Typecheck, ESLint focal, auditoría SDD y `git diff --check` PASS. |
| REQ-003C | Contraseña actual requerida cuando existe credencial local, con instrucción asociada | `apps/frontend/tests/seccionCuenta.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Prueba focal confirma `required` y la explicación accesible «Se necesita para confirmar el cambio»; E2E captura el estado del formulario en Edge con perfil ficticio; sin cambio de autenticación ni payload |
| REQ-003V | Alternancia de visibilidad independiente, accesible y sin envío del formulario para las tres contraseñas | `apps/frontend/tests/seccionCuenta.test.tsx` | Prueba focal cubre estado oculto/visible, valor conservado, nombre/relación/estado accesibles y ausencia de mutación al activar los controles. Verificación visual de runtime pendiente. |
| REQ-003AD | Un solo control visible para revelar/ocultar contraseña; el campo se enmascara al salir del grupo | `apps/frontend/tests/seccionCuenta.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: pruebas focales cubren nombre/icono/estado, alternancia, ocultación al perder el foco; Edge E2E 1/1 con fixture y captura inspeccionada sin duplicación del ojo. |
| REQ-003F, criterio 70 | Enlaces internos de Cuenta son distinguibles de la función de accesos del Escritorio y Menú Inicio | `apps/frontend/tests/seccionCuenta.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: test de componente 1/1 y E2E Edge 1/1 con perfil ficticio, 320/360/390/640 CSS px, temas claro/oscuro y navegación de escritorio 1024 px. El vínculo y encabezado coinciden en «Accesos del escritorio»; sin cambios de endpoints ni operaciones reales. Capturas post-cambio en `reports/qa/ux-cuenta-desktop-copy-20261105/`. |
| REQ-003G | Errores de tipo, tamaño, lectura y almacenamiento de imagen asociados al selector afectado | `apps/frontend/tests/seccionCuenta.test.tsx` | Implementado y validado: errores de tipo/tamaño de foto y logos, errores simulados de lectura de foto y logo, error de almacenamiento local de foto, limpieza independiente y reintento del mismo archivo para logo; texto visible en alerta, `aria-invalid` y relación `aria-describedby`; no se llama al API para archivos rechazados. Prueba focal 27/27, typecheck, ESLint focal, guard WCAG 65/65, auditoría SDD y diff-check PASS. |
| REQ-003U | Recuperación de la foto local cuando falla la imagen vinculada y separación por identidad docente | `apps/frontend/tests/seccionCuenta.test.tsx` | Pruebas focales confirman mensaje de fallo, selector local disponible, respaldo visible, cero llamadas a la API y actualización al cambiar de identidad; verificación visual de runtime pendiente. |
| REQ-003H | Advertencia visual y accesible en links externos que abren un contexto nuevo | `apps/frontend/tests/seccionCuenta.test.tsx` | En resultado de actualización disponible, la nota y el nombre accesible de cada link indican que abre una pestaña o ventana nueva; las URLs, `target="_blank"` y `rel="noopener noreferrer"` se conservan. Prueba focal 27/27 PASS. |
| REQ-003J | Anuncio no intrusivo durante la consulta de actualizaciones de Cuenta | `apps/frontend/tests/seccionCuenta.test.tsx` | Implementado: prueba con fetch diferido confirma región `status` vacía al inicio, anuncio durante la espera, botón `aria-busy` y retirada del mensaje al finalizar. Prueba focal 1/1 PASS; TypeScript, ESLint focal, guard WCAG 65/65, auditoría SDD y diff-check PASS. Sin auditoría runtime/lector de pantalla. |
| REQ-003W | Papelera diferencia carga/error inicial/vacío y conserva datos identificados ante fallo de actualización | `apps/frontend/tests/seccionCuenta.test.tsx` | 33/33 pruebas focales PASS, incluidos ambos fallos; typecheck, ESLint focal, WCAG 73/73, SDD audit y diff-check PASS. La primera falla muestra «No disponible» y no vacío/cero; una actualización fallida identifica que conserva la última carga. |
| REQ-003X | La carga local de foto tiene nombre accesible, foco visible en claro/oscuro y no retiene el foco | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge de Cuenta 1/1 PASS: desde el último acceso directo, Tab llega al selector de foto; el contenedor muestra un anillo sólido de 3 px en ambos temas y Tab continúa al control siguiente. Capturas actuales en `reports/qa/ux-cuenta-followup-20261103/`. |
| REQ-003Y | La guía rápida describe solo opciones reales de Cuenta en el flavor docente | `apps/frontend/tests/seccionCuenta.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: prueba focal verifica perfil local, PDF institucional, OneDrive y acceso; prohíbe afirmar licenciamiento, multisede o firma RSA. E2E Edge con datos ficticios verifica la guía expandida a 320 CSS px, texto sin recorte/overflow en claro y oscuro y ausencia de promesas fuera del producto. |
| REQ-003K | Instrucción persistente para confirmar la contraseña, conservada junto al error de discrepancia | `apps/frontend/tests/seccionCuenta.test.tsx` | Implementado: la ayuda se mantiene visible y en `aria-describedby` antes y después de corregir; el error se suma a la relación cuando hay discrepancia. Prueba focal «permite cambiar contraseña tras validar contraseña actual y coincidencia de 8+ caracteres». |
| REQ-003Z | Error de longitud de contraseña nueva visible y asociado al campo | `apps/frontend/tests/seccionCuenta.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | `seccionCuenta.test.tsx` 33/33 PASS; E2E Edge valida el mensaje en claro a 320 px, `aria-invalid`, asociación accesible, CTA bloqueado, limpieza al corregir y ausencia de overflow. Build, ESLint focal, WCAG 81/81, SDD y diff-check PASS. |
| REQ-003AA | Guía de Cuenta conserva etiqueta y acción sin tooltip redundante sobre el contenido vecino | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge de Cuenta ficticia a 320 px comprueba que el hover del botón no renderiza tooltip superpuesto; se conservan texto, nombre accesible y acción. |
| REQ-003AB | Estados de Seguridad, PDF y Actualizaciones se reacomodan por ancho real del panel | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge verifica que los estados quedan dentro del panel, debajo del título y sin recorte/solapamiento a 1024 CSS px en claro/oscuro; captura inspeccionada en `test-results/nav-escritorio-13-cuenta-1024-dark.png`. |
| REQ-003AC | Controles nativos ocultos para logos conservan acceso sin solapar controles visibles | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E confirma nombre asociado y caja visual ≤1×1 px para ambos inputs de logo; auditoría general no detecta solapamientos en Cuenta a 1024 px. |
| REQ-004 | Contrato visual y calidad UX | `apps/frontend/tests/ux.visual.test.tsx`; `apps/frontend/tests/ux.quality.test.tsx`; `apps/frontend/tests/guiaCalificacionesVisual.test.tsx`; `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `apps/frontend/tests/seccionCuenta.test.tsx` | Parcial: la guía de Calificaciones ahora usa iconos compartidos y copy que describe los atajos y exportaciones existentes; los estados de OMR y firmas de encuadre usan iconos Lucide decorativos y mantienen su texto explícito. Se retiraron afirmaciones de confianza/rapidez sin garantía y la etiqueta «Acta Oficial». La consistencia visual global y los recorridos completos siguen pendientes |
| REQ-004C | Todo icono funcional, incluido cada nombre de producto, usa una única familia Lucide por medio de adaptadores con escala, trazo y semántica comunes; encabezados contiguos no repiten glifos | `apps/frontend/tests/iconos.test.tsx`; `apps/frontend/tests/versionInfoPage.test.tsx`; `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `apps/frontend/tests/guiaEntregaVisual.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts`; pruebas focales de Banco, Plantillas, Entrega, Sincronización y tema | El catálogo de producto mapea cada nombre de `NOMBRES_ICONO` a Lucide; la prueba renderiza todo el catálogo y verifica viewBox, tamaño, trazo, extremos, uniones y semántica decorativa. Las comprobaciones GUI aseguran que Calificaciones no repita el símbolo de navegación y que el emblema de Materias use un glifo distinto del KPI contiguo. La lista de tecnologías usa símbolos genéricos Lucide con tamaño, trazo y `currentColor` compartidos. La revisión de fuentes recorre `apps/frontend/src` y permite SVG directo solo para ilustraciones, QR y gráfica circular. Se conserva la validación de escala, campos semánticos y ausencia de emoji/glifos de interfaz. |
| REQ-004D | Emblemas principales circulares con superficie visible y glifo normalizados, protegidos de resets BEM globales | `apps/frontend/tests/iconos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: Vitest iconografía 8/8 y E2E Edge con datos ficticios 1/1; verifica los 10 emblemas en tema claro/oscuro a 320 CSS px, geometría circular 52 × 52 px, fondo sólido o degradado y glifo de 24 px. Capturas vigentes en `reports/qa/ux-materias-icon-distinct-20261105/`. Build docente, WCAG 102/102 y SDD PASS. |
| REQ-004F | Campos de fecha de Materias sin icono de calendario duplicado y presentación consistente en alta/edición | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge sintético focal 1/1 a 320/390 CSS px y claro/oscuro; alta y edición conservan dos controles nativos sin glifo Lucide adicional, etiquetas ni restricciones. Capturas en `reports/qa/ux-materias-current-audit-final-20261105/`; build docente y guard WCAG 102/102 PASS. |
| REQ-004E | Icono semántico distinto para Aclaraciones en KPI de Calificaciones | `tests/gui-responsive/responsive-docente.spec.ts`; `apps/frontend/tests/iconos.test.tsx` | E2E Edge sintético 1/1 PASS a 320/390 CSS px en ambos temas; verifica que «Aclaraciones» use `aclaraciones`, «Con calificación» conserve `ok` y el icono cumpla contraste. Capturas antes/después en `reports/qa/ux-calificaciones-icon-aclaraciones-20261105/`. |
| Criterio 66 | Cabecera de Calificaciones sin icono duplicado ni overflow del contador y las etiquetas en móvil | `tests/gui-responsive/responsive-docente.spec.ts`; `apps/frontend/tests/iconos.test.tsx` | PASS: E2E Edge verifica 504/390/320 CSS px en claro/oscuro; un recorrido sintético adicional pasa por las 13 secciones a 320 px. La cabecera usa una sola columna, las etiquetas envuelven y no se duplica el emblema. Capturas inspeccionadas en `reports/qa/ux-calificaciones-header-320-20261104/`. |
| REQ-004B | Contraste del CTA Guardar carpeta en claro/oscuro y hover | `tests/gui-responsive/responsive-docente.spec.ts` | Validado en Edge E2E focal 1/1; texto blanco sobre el token primario sólido mantiene 5.45:1 normal, 6.96:1 hover claro y 4.82:1 hover oscuro. Capturas posteriores en `reports/qa/ux-cuenta-audit-synthetic-20261103/`; typecheck vía build del harness y pruebas focales completadas. |
| REQ-005 | Navegación responsive y controles accesibles, incluidos objetivos táctiles de al menos 24 × 24 CSS px | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `apps/frontend/tests/ux.quality.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Parcial: selector móvil y cierre del recordatorio cumplen el tamaño mínimo; el E2E ahora detecta controles de sesión fuera de los límites de la cabecera y confirma su reflow en 1920/1024/768/390 px; el recordatorio apila texto y acción hasta 480 px y el recorrido ficticio confirma que no se comprimen ni se solapan a 320/390 px; faltan recorridos completos de teclado, temas y estados |
| REQ-006 | Compatibilidad funcional de las secciones | `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `apps/frontend/tests/seccionPeriodos.portada.test.tsx`; `apps/frontend/tests/seccionPeriodosArchivados.test.tsx`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `apps/frontend/tests/escaneo.refactor.test.tsx`; `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `apps/frontend/tests/seccionCuenta.test.tsx` | Parcial: las suites cubren edición/archivo/portadas, captura e historial de calificaciones, OMR, Extra, Classroom y cuenta; no se detectaron cambios de contrato de datos en esta oleada. Falta cotejar el flujo completo de cada ruta en runtime y confirmar visualmente que sus acciones siguen disponibles |
| REQ-001B | Carga, error recuperable y catálogo vacío en Materias activas y archivadas | `apps/frontend/tests/recursosAcademicos.hooks.test.tsx`; `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `apps/frontend/tests/seccionPeriodosArchivados.test.tsx` | Implementado y validado: el hook conserva la consulta exitosa si falla la otra, diferencia carga/error del vacío y limpia el error al reintentar; ambas vistas ofrecen recuperación; 21/21 pruebas focales PASS |
| REQ-002E | Evidencias Classroom: tabla semántica en escritorio, fichas de una columna sin solapamiento hasta 700 CSS px | `tests/gui-responsive/responsive-docente.spec.ts` | Implementado y verificado: E2E con datos ficticios 1/1 PASS a 320/390/700 CSS px en claro/oscuro; roles de tabla/encabezado conservados; escritorio mantiene `display: table`; geometría detecta celdas solapadas/desbordadas; WCAG guard, ESLint, SDD audit y diff check PASS; sigue pendiente prueba humana de tecnología asistiva/runtime instalado |
| REQ-002F | Contador claro y anunciado de alumnos seleccionados para extraordinario | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E con fila ficticia verifica los textos plural y singular, la región viva `polite` y el apilado del encabezado a 320/390 CSS px en claro/oscuro; cambiar la selección local no envía mutaciones |
| REQ-002AC | Controles y opciones por alumno en Extraordinarios distinguen homónimos por matrícula/grupo y revisiones históricas por folio | `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: 19/19 pruebas de componente; E2E Edge 1/1 confirma etiqueta visible «Incluir en el lote», activación al pulsarla, nombre accesible con identidad completa y área interactiva de 44 CSS px; 320/390 CSS px, claro/oscuro. |
| REQ-002G | Confirmación de descarga breve que no duplica orientación persistente de OneDrive | `tests/gui-responsive/responsive-docente.spec.ts`; `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | E2E sintético de generación PASS: confirma «Reporte HTML generado y descargado.» y conserva la instrucción de reemplazo visible; el mensaje para guardado con selector mantiene el aviso de sincronización |
| REQ-002H | La sugerencia de baja nitidez aplica a imagen cargada y foto | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E OMR sintético 1/1 confirma la instrucción nueva con archivo de prueba, manteniendo deshabilitado «Analizar página» y sin mutar datos/calificaciones; captura actual a 320 CSS px |
| REQ-002J | Classroom reduce el anidamiento visual y conserva ancho útil para revisar actividades en 320/390 CSS px | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E con datos sintéticos 1/1; mide ficha de actividad (>180 CSS px), resumen sin desbordamiento y reflow en claro/oscuro a 320/390/700 CSS px; mantiene tabla de escritorio a 1440 px. Capturas posteriores inspeccionadas en `reports/qa/ux-calificaciones-classroom-after-20261031/`. No cubre cuenta Classroom real ni lector de pantalla/zoom manual. |
| REQ-002K | Publicación evita duplicar toast con mensaje contextual y conserva acción distinta para renovar sesión | `apps/frontend/tests/seccionPublicar.test.tsx` | 11/11 PASS: éxito y error se anuncian una vez; sesión 401 conserva toast separado con acción de cerrar sesión |
| REQ-002BK | Publicación conserva y contextualiza la última lista de códigos durante una actualización y ante su fallo | `apps/frontend/tests/seccionPublicar.test.tsx` | `seccionPublicar.test.tsx` 12/12 PASS: conserva y anuncia los datos durante carga y error recuperable; al cambiar de materia limpia los códigos previos. |
| REQ-002L | Vista previa de Classroom mantiene resumen vivo separado de tablas, avisos y controles | `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | 23/23 PASS: la región viva conserva el resumen breve y excluye tabla y controles |
| REQ-002X | Errores de lectura de logotipos de Encuadre asociados al campo y recuperables | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | 22/22 PASS: anuncia error del archivo junto al selector afectado, asocia ayuda/error por `aria-describedby`, marca `aria-invalid` y limpia el error al reintentar con lectura exitosa |
| REQ-002Y | Identidad estable de filas incluso cuando se repite una matrícula | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | Regresión con datos sintéticos: conserva ambas filas con IDs canónicos distintos, evita la advertencia de clave duplicada y no expone los IDs en el DOM |
| REQ-002Z | Error de lectura de cursos de Classroom distinto del vacío, contextual y con reintento GET-only | `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | E2E focal valida error contextual por conexión, estado distinto de vacío y reintento GET-only; sin escrituras. Componente cubre error/recuperación de cursos. |
| REQ-002AA | Errores de lectura de roster y actividades Classroom distintos del vacío, con reintento GET-only | `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: mensaje contextual por recurso, sin falsos vacíos y con reintentos GET-only. El E2E cubre cursos; los casos de roster/actividad conservan pruebas focales de componente. |
| REQ-002AU | Consulta parcial de Classroom: recursos identificados, orientación y códigos técnicos opcionales | `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | Test focal verifica mensaje localizado para temas, código dentro de `<details>` cerrado y conservación de datos recibidos. |
| REQ-002AB | Lista principal de evidencias Classroom: carga/error/vacío, permiso, materia seleccionada y descarte de respuestas tardías | `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | Pruebas focales para error con reintento GET-only, vacío solo tras éxito, supresión de la tabla sin materia o permiso y descarte de una respuesta previa. Cuando una búsqueda no coincide, el estado incluye una acción que limpia solo esa búsqueda y recupera las filas ya cargadas, sin nueva consulta; prueba focal «filtra vinculaciones y evidencias con conteos visibles para grupos grandes». |
| REQ-002AF | Capturas del historial Classroom identificables y recuperables por imagen sin repetir la consulta del historial | `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | Implementado: el test de paginación recupera la imagen fallida mediante la ruta binaria individual, conserva la primera captura y confirma nombres alternativos distintos por promedio/fecha; no repite GET de historial. |
| REQ-002AS | Historial Classroom distingue no consultado, vacío confirmado y error; filtros nuevos limpian mensajes previos | `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | Implementado: el estado vacío aparece solo tras respuesta exitosa; el fallo usa alert local sin falso vacío y desaparece al cambiar parcial/alumno; al cambiar materia se limpia la selección y el historial previo. |
| REQ-002AG | Copy claro y metadatos técnicos opcionales en el historial de promedios | `apps/frontend/tests/classroomEnCalificaciones.test.tsx`, `tests/gui-responsive/responsive-docente.spec.ts` | Pruebas focales verifican pluralización, etiquetas entendibles, puntaje «de» puntos posibles, acceso por teclado y cierre inicial de los metadatos técnicos conservados. |
| REQ-002AH | Mensaje accionable y formulario de contraseña según credenciales de reautenticación disponibles | `tests/gui-responsive/responsive-docente.spec.ts`, `apps/frontend/tests/seccionCuenta.test.tsx` | E2E sintético verifica explicación y ocultamiento del formulario sin método de reautenticación; el recorrido con contraseña definida mantiene el envío y el payload actual. |
| REQ-001C | Formulario semántico para editar Materias y envío por Enter según comportamiento HTML nativo | `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: unitarias 19/19; E2E en Edge con catálogo ficticio comprueba apertura sin guardado, avance con Tab y un único envío con Enter desde el campo en 320/390 CSS px; endpoint y payload conservados |
| REQ-001D | Activación por teclado de «Editar» no debe enviar el formulario que acaba de abrir | `tests/gui-responsive/responsive-docente.spec.ts`; `apps/frontend/tests/seccionPeriodos.edit.test.tsx` | PASS: Enter abre la edición y enfoca sus instrucciones sin mutación; Tab enfoca el campo; Enter en el campo guarda una vez en ambos anchos y la edición vuelve a acciones |
| REQ-001E | Alta de materia completa por teclado y envío con Enter desde un campo | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: alta ficticia desde Nombre con Enter; una sola solicitud `POST /api/periodos` con nombre, fechas y grupos esperados a 320/390 CSS px |
| REQ-001F | El indicador de porcentaje identifica el tiempo transcurrido del periodo y expone nombre/valor con esa semántica | `tests/gui-responsive/responsive-docente.spec.ts` | Validado en E2E sintético a 320/390 CSS px, tema claro/oscuro; conserva el cálculo de fechas. El indicador nativo `progress` tiene nombre y texto de valor coherentes; el anillo decorativo se oculta a tecnología asistiva |
| REQ-001G | Confirmación modal de archivo operable con teclado y retorno de foco | `apps/frontend/tests/confirmDialogProvider.test.tsx`; `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: 25/25 pruebas de componente; E2E sintético 1/1 en Edge a 320/390 px, claro/oscuro; Escape cancela sin mutación, Tab/Shift+Tab permanecen dentro y el foco vuelve al invocador; confirmación conserva ruta/payload |
| REQ-001H | Nombre contextual y relación del toggle de acciones por tarjeta de Materias | `apps/frontend/tests/seccionPeriodos.edit.test.tsx` | PASS: la prueba con dos materias verifica nombres accesibles únicos que incluyen el nombre visible del control y la materia, y confirma que activar una fila abre solo su panel con `aria-expanded`/`aria-controls` correctos. Prueba focal 23/23; typecheck, ESLint focal, guard WCAG, auditoría SDD y diff-check PASS. |
| REQ-001J | El catálogo vacío de Materias identifica el control existente que abre el formulario de alta | `apps/frontend/tests/seccionPeriodos.edit.test.tsx` | Implementación cubierta por una aserción de copy en el estado vacío; no añade una segunda acción ni cambia el alta. |
| REQ-001K | Selector de portada responsive con nombre/estado completo, descripción, foco visible y teclado | `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente focal 23/23; E2E Edge sintético 1/1 a 320/390 CSS px verifica geometría, nombre/ayuda, selección ficticia, foco visible por teclado y nombre de archivo completo en claro/oscuro. |
| REQ-001L | Resultado de edición identifica la materia, se ubica fuera del alta y se limpia al comenzar otra operación | `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: pruebas focales comprueban el rol `status`, el nombre, la ubicación fuera de `.materias-form` y que no se emite un toast duplicado; E2E sintético verifica la ubicación a 320/390 CSS px y la retirada del aviso al abrir archivo. |
| REQ-001M | Alta deshabilitada identifica los requisitos faltantes junto al CTA y asocia la ayuda | `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente 24/24; E2E Edge 1/1 a 320/390 CSS px verifica copia, `aria-describedby`, estado nativo disabled, contraste de etiqueta, apilado de ayuda y ausencia de overflow en claro/oscuro. Capturas inspeccionadas en `reports/qa/ux-materias-disabled-cta-20261103/`. |
| REQ-001N | Placeholder de nombre de Materias completo a 320/390 CSS px | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: el E2E mide ancho del texto y área útil del input en 320/390 CSS px; el ejemplo «Ej. Álgebra» cabe completo. Capturas de alta y selección de portada en tema claro/oscuro. |
| REQ-001O | Grupos opcionales claramente identificados y ayuda asociada en alta y edición | `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente 24/24 y E2E Edge sintético 1/1 en 320/390 CSS px, ambos temas; comprueba etiquetas opcionales, ayuda asociada sin ampliar el nombre accesible y ausencia de `required`. Typecheck y ESLint focal PASS. Capturas de alta/edición inspeccionadas en `reports/qa/ux-materias-current-20261103/`. La auditoría WCAG global reporta ocho colores crudos previos en `screens.css:7286,7293-7294,9335-9337,9346-9347`, fuera de este cambio. |
| REQ-001P | Contraste de etiquetas de estado de periodo en tema claro y oscuro | `tests/gui-responsive/responsive-docente.spec.ts`; `scripts/tests/ui-contrast-audit.mjs` | PASS: E2E Edge con catálogo ficticio mide el chip «En curso» ya renderizado a 320/390 CSS px en ambos temas y pasa ≥4.5:1; la regla específica oscura conserva tokens de primer plano/fondo para los estados «En curso», «Por iniciar» y «Por finalizar». Guard WCAG y auditoría de contraste 91/91 PASS; inspección visual de catálogo activo a 320 px claro/oscuro en `reports/qa/ux-materias-actual-20261104/`. Cálculos, etiquetas y significado del estado sin cambios. |
| REQ-002AK | Guía OMR plegada en móvil, estado accesible y preferencia/foco conservados | `apps/frontend/tests/guiaCalificacionesVisual.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente 2/2 y E2E Edge 1/1; en móvil verifica inicio plegado, apertura/cierre con teclado, `aria-expanded` y foco conservado; escritorio y preferencia explícita conservan guía abierta. Capturas inspeccionadas a 320/390 CSS px en claro/oscuro en `reports/qa/ux-calificaciones-omr-guide-20261103/`. |
| REQ-002AL | Razón y siguiente paso para habilitar los CTAs de captura OMR deshabilitados | `apps/frontend/tests/escaneo.refactor.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: Vitest 17/17 cubre entrada faltante y permisos de análisis/calificación; E2E Edge 1/1 a 320/390 CSS px, claro/oscuro, verifica ayuda visible y accesible, `disabled` nativo y contraste ≥4.5:1 en ambos CTAs. Capturas inspeccionadas en `reports/qa/ux-calificaciones-omr-disabled-action-20261103/`. |
| REQ-002AR | Estado de búsqueda sin coincidencias identifica la consulta y conserva filtros independientes al limpiarla | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: 29/29 pruebas focales; E2E Edge sintético 1/1 a 320/390 CSS px, claro/oscuro, verifica el texto `status`, ausencia de overflow, filtro independiente y recuperación; capturas inspeccionadas en `reports/qa/ux-calificaciones-empty-query-20261103/`. TypeScript, ESLint focal, SDD audit y diff-check PASS. |
| REQ-002AV | Resultados por alumno no repite los conteos ya visibles en el resumen superior; conserva estado filtrado y cálculos | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: resumen 29/29 y E2E Edge 1/1 en 320/390 px, claro/oscuro; el test confirma la ausencia del bloque repetido y mantiene visibles los KPI superiores y el estado de filas. Typecheck, ESLint focal, WCAG 71/71, SDD y diff-check PASS. Capturas en `reports/qa/ux-continuacion-20261103/`. |
| REQ-002AW | Copy de «Calificar examen» coincide con respuestas OMR o manuales disponibles | `apps/frontend/tests/seccionCalificar.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: prueba focal 9/9 verifica copy general/manual y conserva la instrucción OMR cuando hay resultado OMR. E2E Edge sintético 1/1 abre la ayuda con Enter y verifica los mensajes a 320/390 CSS px en ambos temas. Capturas inspeccionadas en `reports/qa/ux-calificar-panel-manual-20261103/`. |
| REQ-002AZ | Confirmación expresa para guardar una nota sin respuestas OMR, sin cambiar cálculo ni payload | `apps/frontend/tests/seccionCalificar.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente 9/9 verifica CTA bloqueado, confirmación requerida, invalidación al cambiar la nota y payload sin `respuestasDetectadas`/`omrAnalisis`; E2E Edge 1/1 verifica teclado, bloqueo inicial, contraste de CTA deshabilitado e invalidación tras alternar bonus. Sin escrituras reales. |
| REQ-002BA | Captura de aciertos para calificación manual usando fórmula y payload existentes | `apps/frontend/tests/seccionCalificar.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente 12/12 verifica campo vacío, límites, fórmula, payload existente sin datos OMR, confirmación para cero e invalidación al cambiar examen. E2E Edge 1/1 a 320/390 CSS px, claro/oscuro, teclado, rango, CTA, confirmación y tamaño de casillas; sin guardar. Capturas inspeccionadas en `reports/qa/ux-calificar-panel-manual-20261103/`. |
| REQ-002BJ | Enlaces rápidos de Revisión y captura con foco en el encabezado del destino y reflow móvil | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge focal; valida los cuatro destinos, activación por teclado, foco/visibilidad y 320/390 CSS px en claro y oscuro. |
| REQ-002AX | Motivo de permiso faltante visible y asociado al botón deshabilitado de calificación | `apps/frontend/tests/seccionCalificar.test.tsx` | PASS: 7/7 pruebas focales; con permiso ausente el mensaje visible está enlazado mediante `aria-describedby` y el botón mantiene `disabled`; con permiso, el aviso no aparece. Sin cambios en permisos ni guardado. |
| REQ-002AY | Explicación accesible de permiso faltante en activación manual | `apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx` | PASS: 7/7 pruebas focales; con alumno/examen y sin permiso, el motivo se muestra y queda asociado al CTA deshabilitado; sin selecciones ni con permiso, no aparece. Typecheck y ESLint focal PASS; WCAG 73/73 pares, incluidos estos colores (5.19:1 claro; 11.90:1 oscuro); SDD y diff-check PASS. No cambia autorización ni activación. |
| REQ-002BB | Contraste del estado «Con calificación» en resultados por alumno | `tests/gui-responsive/responsive-docente.spec.ts`; `scripts/tests/ui-contrast-audit.mjs` | PASS: E2E Edge mide el texto sobre fondos compuestos a 320/390 CSS px en ambos temas; la auditoría estática calcula 7.41:1 claro y 6.63:1 oscuro. Guard WCAG y auditoría de contraste 91/91 PASS; no cambia el filtro ni los datos. Capturas en `reports/qa/ux-calificaciones-current-20261104/`. |
| REQ-002BC | KPI identifica que el conteo de páginas corresponde al procesamiento OMR | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge sintético confirma simultáneamente 1 alumno con calificación, 0 páginas OMR y la etiqueta «Páginas OMR procesadas», sin modificar conteos ni cálculos. Capturas antes/después en `reports/qa/ux-calificaciones-pages-kpi-20261105/`. |
| REQ-004A | Botones docentes deshabilitados legibles con estado inactivo preservado | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: mismo E2E mide etiqueta real con superficie opaca ≥4.5:1 en ambos temas, espera el fin de la transición CSS y confirma `disabled` preservado a 320/390 CSS px. |
| REQ-005B | Descripción emergente de Calificaciones precisa y sin promesas de rendimiento | `apps/frontend/tests/appDocente.secciones.test.tsx` | La prueba de navegación verifica el tooltip con las tareas disponibles y protege la eliminación de la afirmación de velocidad no medida. |
| REQ-005C | Cierre del recordatorio de Materias conserva nombre accesible sin tooltip superpuesto al mensaje | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge sintético 1/1 PASS; con Tab conserva el nombre «Cerrar recordatorio», sin tooltip y con geometría intacta a 320/390 CSS px, ambos temas. Capturas inspeccionadas en `reports/qa/ux-materias-tooltip-20261103/`. |
| REQ-005D | Acceso de teclado para omitir cabecera/navegación repetidas y entrar al contenido principal | `apps/frontend/tests/appDocente.secciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge comprueba primer Tab, visibilidad/foco, contraste, destino y que el enlace oculto no intercepte puntero pero siga siendo el primer control de teclado; capturas en `reports/qa/ux-asistencias-keyboard-verified-20261103/`. |
| REQ-002T | Carga, error recuperable y vacío confirmado del buzón de revisión; reintento de lectura separado de sincronización | `apps/frontend/tests/appDocente.test.tsx` | Implementado: el fallo inicial no presenta cero solicitudes; el reintento vuelve a leer sin llamar al POST de sincronización; si falla una lectura posterior, conserva la lista y sus conteos. Prueba focal 1/1 PASS. |
| REQ-002U | Resultado preciso cuando la sincronización se completa pero falla la lectura posterior | `apps/frontend/tests/appDocente.test.tsx` | Implementado: un GET fallido después del POST exitoso comunica sincronización completada, conserva la lista anterior y no muestra un falso error de sincronización. Prueba focal 1/1 PASS. |
| REQ-002V | Resolución exitosa con recarga fallida; estado de servidor conservado y sin sincronización redundante | `apps/frontend/tests/appDocente.test.tsx` | Implementado: la respuesta del POST actualiza la fila; si falla el GET, la vista mantiene el estado resuelto, muestra el aviso de recarga y no llama a `/sincronizar`. Prueba focal 1/1 PASS. |
| REQ-002W | Etiqueta e instrucciones visibles y asociadas para la respuesta del docente | `apps/frontend/tests/appDocente.test.tsx` | Implementado: etiqueta vinculada al textarea, instrucción persistente de obligatoriedad/mínimo de 8 caracteres y atributo requerido; cubierto con solicitud dummy. Prueba focal 1/1 PASS; TypeScript, ESLint focal, guard WCAG 65/65, auditoría SDD y diff-check PASS. |
| REQ-005A | Navegación de todas las secciones en pantallas estrechas | `apps/frontend/tests/appDocente.secciones.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts`; recorrido runtime | Parcial: selector nativo visible en ancho completo, opciones sincronizadas y sin overflow a 320/390/571/1023 px; E2E confirma el cambio por selector a 390/768 px y por pestañas a 1024/1920 px. Runtime confirma cambio a Calificaciones. Faltan recorrido completo de teclado y revisión de todas las rutas/estados |

| REQ-001Q | Regla de rango visible antes de guardar, `min` nativo para fecha de término y error vinculado | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge con datos ficticios: regla y descripción accesible, `min`, `rangeUnderflow`, `aria-invalid`, CTA bloqueado y reflow del error a 320/390 CSS px; no cambia cálculos ni payload. |
| REQ-001R | Selector de portada en edición con estado y nombre íntegros, foco y recuperación accesibles | `apps/frontend/tests/seccionPeriodos.portada.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Componente 6/6 y Playwright Edge 1/1; 320/390 CSS px, temas claro/oscuro, nombre largo sin recorte y sin guardar la portada sintética. Capturas inspeccionadas en `reports/qa/ux-audit-materias-form-current-20261105/`. |
| REQ-001S | Pasos del estado vacío de Materias con contraste y superficies coherentes en ambos temas | `tests/gui-responsive/responsive-docente.spec.ts` | El E2E Edge verifica texto y flechas ≥4.5:1 en la superficie renderizada a 320 CSS px, claro/oscuro, con datos sintéticos; las capturas del mismo recorrido permiten inspeccionar la jerarquía visual. |
| REQ-005E | Etiqueta textual de «Ciclo Académico» sin glifo redundante | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge focal 1/1 con catálogo ficticio a 320/390 CSS px y temas claro/oscuro; comprueba texto y ausencia del glifo. Capturas revisadas en `reports/qa/ux-materias-cycle-label-20261105/`. |
| REQ-005F | Recorrido de todas las secciones permitidas con teclado en selector móvil y pestañas de escritorio | `tests/gui-responsive/responsive-docente.spec.ts`; `apps/frontend/tests/appDocente.secciones.test.tsx` | PASS: E2E Edge sintético 1/1 recorre las 13 secciones en móvil y escritorio, verifica foco/selección, reflow de Cuenta a 1024 px, ambos temas y ausencia de overflow horizontal. |
| REQ-005G | Ortografía del rótulo «Rehidratación» con identidad interna preservada | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: selector y pestaña muestran «Rehidratación»; ID `rehidratacion`, destino y permisos conservados. |

### Copy de páginas para impresión a doble cara en Cuenta (2026-10-30)

- La captura sintética de Cuenta mostraba «1 hojas dúplex» para el valor inicial de 2 páginas. Se sustituyó por «1 hoja impresa por ambas caras» y se aclaró la ayuda sin modificar el intervalo permitido, el cálculo ni el payload persistido.
- La prueba focal de Cuenta ahora verifica tanto el caso singular de 2 páginas como el plural de 6 páginas.
- Validación: `npm -C apps/frontend test -- tests/seccionCuenta.test.tsx` (22/22 PASS); E2E con perfil ficticio en Edge, 320/360/390 CSS px y ambos temas (1/1 PASS); ESLint focal, `npm run sdd:audit` y `git diff --check` PASS. Capturas del E2E actual inspeccionadas en `reports/qa/ux-cuenta-copy-20261030/`. El servicio instalado en `localhost:4173` no respondió; esto no valida el runtime instalado.

### Reflow estrecho y envío por teclado de Cuenta (2026-10-30)

- Se amplió el recorrido ficticio a 640 CSS px y se comprueban reflow, overflow y encabezados; ese ancho aproxima el viewport CSS de una ventana de 1280 px al 200 % de zoom, pero no sustituye una comprobación de zoom real del navegador.
- Se añadió un recorrido E2E en Edge: con perfil sintético que ya tiene contraseña, Tab lleva desde la confirmación al botón habilitado y Enter envía una sola solicitud con el payload esperado. El envío con teclado también conserva la cobertura unitaria focal.
- El recorrido E2E anula el envío de telemetría de uso para no depender de un backend local.
- A 640 px el quinto indicador se extiende a toda la fila (media query hasta 720 px), para evitar que quede aislado junto a espacio vacío; la captura actual confirma la composición.
- Validación: E2E focal 1/1 PASS a 320/360/390/640 CSS px; Cuenta unitarias 22/22 PASS; ESLint focal, `npm run sdd:audit`, `wcag-guard` y `git diff --check` PASS. La captura de 640 px está en `reports/qa/ux-cuenta-kpi-reflow-20261030/ux-audit-cuenta-dummy-640-light.png`.
- Aún faltan el zoom real al 200 %, lector de pantalla, teclado completo en todos los controles de Cuenta y verificación en la instalación local.

## Revalidación focal de actualizaciones de Cuenta (2026-10-28)

- Hallazgo: el texto atribuía a esta pantalla instalación, verificación criptográfica y respaldo que el código no realiza. La pantalla solo consulta GitHub Releases y enlaza al instalador y las notas; aunque detectaba un asset `.sha256`, no lo mostraba.
- Cambio: se aclaró el alcance, se agregó enlace al archivo checksum cuando está publicado y un mensaje si la release no incluye `.sha256`. La descarga/instalación y verificación permanecen separadas.
- Validación focal: `tests/seccionCuenta.test.tsx`: 22/22 PASS; ESLint focal, typecheck, build docente aislado y verificador de bundle PASS; guard WCAG (39/39 pares), auditoría SDD y `git diff --check` PASS. Se verifican las ramas con y sin checksum.

## Revalidación focal de instrucciones para imágenes de Cuenta (2026-10-28)

- Hallazgo estático: las indicaciones de formato y tamaño de la foto de perfil y los logos PDF eran visibles, pero no estaban enlazadas como descripción accesible de sus selectores de archivo.
- Cambio: los campos ahora referencian las instrucciones compartidas con `aria-describedby`, conservando etiquetas, límites, validación, almacenamiento local y payloads.
- Validación focal: `tests/seccionCuenta.test.tsx` (22/22 PASS), ESLint focal para componente y prueba, y typecheck frontend PASS. La inspección visual del runtime, el tema claro y el recorrido manual de teclado siguen pendientes.

## Auditoría visual E2E de Cuenta (2026-10-28)

- Se inspeccionó Cuenta con perfil docente ficticio y respuestas API aisladas; no se usaron ni modificaron registros reales.
- A 320 y 390 CSS px, en tema claro y oscuro, el selector de sección y los paneles de perfil, sincronización, seguridad, PDF, retención, actualizaciones y accesos quedan dentro del viewport. La jerarquía de KPI se conserva en dos columnas y las preferencias/formularios pasan a una columna estrecha. El test verifica desbordamiento horizontal y recorte de títulos/estados, y conserva capturas de página completa en `reports/qa/ux-audit-20261028-cuenta-current/`.
- Validación focal: `npx playwright test -c tests/gui-responsive/playwright.config.mjs --grep "audita Cuenta"` PASS (1/1, Edge headless, API ficticia). Zoom real del navegador al 200 %, recorrido manual de teclado y evaluación de lector de pantalla no se comprobaron en esta pasada.

## Revalidación focal de portadas de Materias (2026-10-28)

- Hallazgo estático: las indicaciones de formato, tamaño máximo y uso de la portada genérica eran visibles, pero no estaban asociadas a los selectores de archivo de alta y edición.
- Cambio: los selectores ahora exponen esas instrucciones con `aria-describedby`. En alta y edición, los errores de formato/tamaño se asocian al selector y lo marcan inválido; los errores de red al guardar o retirar permanecen como alertas sin marcar un archivo válido como inválido.
- Validación focal: `tests/seccionPeriodos.portada.test.tsx` verifica descripciones accesibles, error de formato asociado y separación respecto de errores de red; el flujo de carga, reintento y retiro conserva sus rutas y payloads.

## Auditoría runtime E2E de catálogos de Materias (2026-10-28)

- Con catálogo, perfil y metadatos de archivo ficticios, se revisaron las vistas activas y archivadas a 320 y 390 CSS px en temas claro y oscuro. El E2E comprueba título, identidad de materia, fechas, conteos, encabezados, límites de tarjetas y overflow del documento.
- Hallazgo a 320 px: el título archivado excedía su área unos píxeles y las fechas/conteos se comprimían dentro de las tarjetas aunque no hubiera overflow del documento. Se ajustó el tamaño mínimo del título móvil; las fechas envuelven por espacios y los conteos pasan a filas legibles a ese ancho.
- Evidencia: `reports/qa/ux-audit-20261028-materias-dummy-current/`. Prueba focal `npx playwright test -c tests/gui-responsive/playwright.config.mjs --grep "audita Materias activas y archivadas"`: PASS (1/1).
- Pendiente: teclado de todo el flujo y estados de error/recuperación en runtime; esta captura no verifica altas, edición ni archivo de materias.

## Revalidación focal de plantillas y respuestas de Extraordinarios (2026-10-28)

- Hallazgo: al cambiar de materia, el estado podía conservar un ID de plantilla de la materia anterior; una respuesta tardía de elegibilidad o una página de historial podía sobrescribir resultados de la materia nueva; los fallos de consulta de plantillas no tenían recuperación visible.
- Cambio: el cambio de materia limpia plantilla, preview, elegibilidad e historial; las respuestas se descartan si ya no corresponden a la materia y las consultas fallidas/parciales de plantillas permiten reintento. No cambian elegibilidad, generación ni payloads.
- Validación focal: `tests/extraordinariosCalificaciones.test.tsx` (12/12 PASS) cubre reintento de carga, limpieza de selección y respuestas fuera de orden para elegibilidad e historial.

## Revalidación focal de selección manual de exámenes (2026-10-28)

- Hallazgo estático: el selector incluye estados `entregado` y `calificado`, pero su ayuda y conteos solo describían exámenes entregados. Ante errores de carga, se mostraba el mensaje sin acción de recuperación.
- Cambio: los rótulos aclaran ambos estados, el conteo usa “Exámenes disponibles” y los errores de consulta exponen reintento local. La carga fallida y el estado sin resultados permanecen diferenciados; permisos, selección, filtros y reglas de calificación no cambian.
- Validación focal: `tests/seccionCalificaciones.manualSelector.test.tsx` (5/5 PASS), incluyendo fallo temporal seguido de recuperación y visualización de un examen calificado.

## Revalidación focal de preparación de lotes OMR (2026-10-28)

- Hallazgo estático: el lote de imágenes se lee secuencialmente y los archivos solo aparecen en la lista al terminar toda la preparación; mientras tanto, el usuario no recibía avance ni confirmación de que la selección se estaba procesando.
- Cambio: el proceso anuncia el avance en un estado accesible con barra de progreso, bloquea una segunda selección concurrente y comunica el fin de la preparación antes de continuar con el análisis del lote. No cambian el orden, la calidad, el análisis ni las decisiones OMR.
- Validación focal: `tests/escaneo.refactor.test.tsx` cubre el progreso de preparación, el estado terminal y el bloqueo del selector durante la tarea. Referencia: [W3C, Status Messages (WCAG 4.1.3)](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html), que indica exponer programáticamente mensajes de espera y progreso sin forzar el cambio de foco.

## Revalidación focal de identificación de materias archivadas (2026-10-28)

- Hallazgo estático: las tarjetas de materias archivadas mostraban un fragmento de `periodoId`
  junto a nombre y fechas; el identificador no es una referencia reconocible para el docente.
- Cambio: se retiró solo el rótulo de interfaz. Nombre, fecha de creación, fecha de archivo,
  resumen histórico e ID interno usado por los componentes permanecen intactos.
- Principio aplicado: [Nielsen Norman Group, Recognition Rather Than Recall](https://www.nngroup.com/articles/ten-usability-heuristics/), priorizar referencias comprensibles en contexto y quitar información técnica que compite con el objeto que el usuario reconoce.
- Validación focal: `tests/seccionPeriodosArchivados.test.tsx` comprueba el contenido histórico y
  que no se muestre `ID:` (2/2 PASS); `build:docente`, TypeScript, ESLint, bundle guard y
  WCAG 39/39 PASS. Auditoría SDD y diff check PASS.

## Revalidación focal de estados de carga de Materias (2026-10-28)

- Hallazgo: `SeccionPeriodos` renderizaba «Aún no hay materias» cuando el hook aún estaba
  cargando o cuando fallaba la consulta inicial; el archivo archivado tenía el mismo vacío
  engañoso y no ofrecía reintento.
- Cambio: el hook distingue carga/error del catálogo y conserva los datos anteriores si falla
  una de sus consultas; las pantallas muestran espera, error con reintento o vacío confirmado.
  No cambian endpoints, payloads, permisos ni reglas CRUD.
- Validación focal: `recursosAcademicos.hooks.test.tsx`, `seccionPeriodos.edit.test.tsx` y
  `seccionPeriodosArchivados.test.tsx` (21/21 PASS); `typecheck` PASS; `build:docente` PASS
  (TypeScript, ESLint, bundle guard y WCAG 39/39); `sdd:audit` PASS y `git diff --check` PASS.

## Revalidación de conteos durante carga/error de Materias (2026-10-29)

- Hallazgo estático: aunque las listas distinguían carga, error y vacío confirmado, las
  cabeceras de materias activas/archivadas y los tres KPI seguían mostrando `(0)` o `0`
  durante una consulta inicial fallida. El hook además comenzaba `cargandoMaterias` en
  `false`, lo que podía renderizar un vacío breve antes del efecto de consulta.
- Cambio: con permiso de lectura, el hook inicia en estado de carga; al perder el permiso
  restablece carga/error. Si no hay un catálogo previo y la consulta carga o falla, las
  cabeceras indican el estado, se ocultan conteos `(0)` y los KPI muestran `—`. Los conteos
  previamente cargados se conservan como datos conocidos mientras se actualiza o se informa
  un fallo. Los errores de materias activas y archivadas ahora se rastrean por separado para
  que una consulta fallida del archivo no marque una lista activa vacía como error (y
  viceversa). La misma regla de conteos se aplica al historial archivado. En pantallas de
  hasta 360 px, las etiquetas/valores de fechas forman columnas estables, los valores no se
  cortan dentro de la fecha y se elimina el separador vertical que atravesaba filas apiladas.
  No cambian contratos ni CRUD.
- Validación focal: `seccionPeriodos.edit.test.tsx`,
  `seccionPeriodosArchivados.test.tsx` y `recursosAcademicos.hooks.test.tsx` (24/24 PASS);
  ESLint focal PASS. El E2E `audita Materias activas y archivadas con catálogo ficticio`
  pasa 1/1 en Edge con perfil y datos sintéticos a 320/390 CSS px y temas claro/oscuro;
  captura fechas/conteos completos, ausencia de overflow, separación de metadatos en móvil y
  ausencia de saltos dentro de los valores de fecha. Capturas: `reports/qa/ux-audit-20261029-materias-dummy-current/`.
  `npm -C apps/frontend run build:docente` PASS (typecheck, compilación, bundle guard,
  ESLint y WCAG 39/39); auditoría SDD y `git diff --check` PASS.

## Contraste de KPI en Materias en tema claro (2026-10-29)

- Hallazgo: una regla visual global con `!important` sustituía los valores de KPI cyan,
  verde y ámbar por tonos claros sobre una superficie clara en Materias. También afectaba
  a iconos y etiquetas del resumen.
- Hallazgo complementario en captura: el texto de estado «Sin alumnos registrados» quedaba
  sobre la superficie translúcida de la tarjeta y perdía separación visual.
- Cambio: se limitan al panel de Materias una superficie estable y colores oscuros para
  los tres valores, iconos y etiquetas en tema claro; el estado sin alumnos tiene una
  superficie clara y texto oscuro. Tema oscuro y datos no cambian.
- Criterio: WCAG 2.2 SC 1.4.3, contraste mínimo 4.5:1 para texto normal; los cinco pares
  se registran en `scripts/tests/ui-contrast-audit.mjs`.
- Validación: el E2E `audita Materias activas y archivadas con catálogo ficticio` comprueba
  los colores computados a 320/390 CSS px; la auditoría focal de contraste verifica los
  pares de KPI y del estado de lista vacía en sus superficies; ambos temas siguen capturándose y comprobándose sin
  overflow. El runtime sigue siendo sintético; lector de pantalla, zoom 200 % e instalación
  local no se verifican en esta tanda.

## Metadatos legibles en tarjetas de Materias en tema claro (2026-10-29)

- Hallazgo: fechas, grupos y conteo de alumnos conservaban texto claro sobre la tarjeta
  translúcida en tema claro; su contraste dependía del fondo que quedara detrás.
- Cambio: las tarjetas pasan a una superficie clara opaca y las etiquetas, fechas, grupos
  y conteo usan texto oscuro. El tema oscuro mantiene su tratamiento y no cambian datos ni
  acciones.
- Criterio: WCAG 2.2 SC 1.4.3 exige 4.5:1 para texto normal ([W3C](https://www.w3.org/TR/WCAG22/#contrast-minimum)).
- Validación: auditoría de contraste con superficie `#f8fafc` y valores computados del
  E2E `audita Materias activas y archivadas con catálogo ficticio` en 320/390 CSS px;
  ambas paletas se capturan para revisión. Perfil/catálogo sintéticos; lector de pantalla,
  zoom 200 % e instalación local quedan fuera de esta tanda.

## Compactar metadatos en Materias a 320 CSS px (2026-10-29)

- Hallazgo: al apilar fechas/grupos a 320 px, una regla móvil conservaba un `flex-basis`
  de 170 px. Con la dirección vertical, cada etiqueta adquiría ese alto y dejaba grandes
  huecos dentro de la tarjeta.
- Cambio: las etiquetas recuperan altura basada en su contenido cuando el bloque cambia a
  columna; se conserva el orden, la lectura y el wrapping natural.
- Validación: el E2E de Materias comprueba altura de etiquetas ≤72 px a 320 px, separación
  y ausencia de recortes en activas/archivadas, ambos temas a 320/390 px. Capturas antes y
  después disponibles en `reports/qa/ux-materias-metadata-20261029/`.

## Nombre visible del selector de portada en el alta (2026-10-29)

- Hallazgo: `aria-label` reemplazaba «Portada (opcional)» por «Seleccionar portada para
  la nueva materia», así que el nombre accesible no contenía la etiqueta visible.
- Cambio: se retira el nombre duplicado; el `<input type="file">` conserva su etiqueta
  nativa envolvente y la descripción de formato/tamaño/error.
- Criterio: WCAG 2.2 SC 2.5.3 recomienda que el nombre accesible incluya la etiqueta visible
  para que la activación por voz use las mismas palabras ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name)).
- Validación: prueba focal del selector comprueba nombre y descripción; E2E del formulario
  de alta confirma etiquetas obligatorias/opcionales y reflujo en 320/390 CSS px, ambos temas.

## Revalidación de búsqueda de Calificaciones a 320 px (2026-10-29)

- Hallazgo visual: en el ancho de 320 CSS px el placeholder `Nombre, matrícula o grupo`
  quedaba recortado; la ayuda que indica que se puede filtrar por grupo no estaba disponible
  como descripción accesible del campo.
- Cambio: se acortó el placeholder a `Nombre o matrícula` y se agregó la instrucción visible
  `También puedes buscar por grupo.`, asociada mediante `aria-describedby`. La instrucción
  quedó fuera del `<label>` para conservar exactamente el nombre accesible `Buscar alumno`.
  No cambian filtros, búsqueda, datos ni contratos.
- Criterio: W3C WAI [Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/)
  recomienda asociar la ayuda complementaria a su control con `aria-describedby` y presentarla
  visualmente; su tutorial también explica que el placeholder no sustituye la instrucción.
- Validación: `seccionCalificaciones.resumen.test.tsx` (25/25 PASS) comprueba nombre y
  descripción; E2E con datos ficticios 1/1 PASS, capturas a 320/390 CSS px y temas claro/oscuro
  en `reports/qa/ux-audit-20261029-calificaciones-dummy-current/`.
  `npm -C apps/frontend run build:docente` PASS (typecheck, compilación, bundle guard, ESLint,
  WCAG 39/39); auditoría SDD y `git diff --check` PASS.

## Revalidación focal de filtros de Resultados (2026-10-28)

- Evidencia visual actual: recorrido móvil a 390 × 844 CSS px, tema oscuro, sin materia y con
  una fila sintética. Capturas aceptadas: `reports/qa/ux-audit-20261028-calificaciones-current/`.
- Hallazgo: antes de seleccionar materia, búsqueda y orden estaban deshabilitados, pero los
  filtros de estado conservaban apariencia de acción activa y aceptaban foco/activación sin
  cambiar resultados.
- Cambio: el grupo y sus tres botones comunican `aria-disabled`; permanecen en el orden de
  teclado para descubrimiento, describen cuándo se habilitan y rechazan activación hasta que
  la consulta se cargue correctamente. No se modifican búsqueda, orden, filtros ni datos tras
  una carga válida.
- Validación focal: `seccionCalificaciones.resumen.test.tsx` (25/25 PASS), incluyendo Tab y
  Space; E2E con API/profile/registro ficticios (1/1 PASS). Evidencia visual validada en
  móvil; tema claro, zoom/320 px, lector de pantalla y resto de vistas siguen pendientes.

## Revalidación focal de jerarquía de métricas en móvil (2026-10-28)

- Hallazgo visual: en la cuadrícula de dos columnas, cinco métricas dejaban «Páginas
  procesadas» aislada al inicio de una tercera fila.
- Cambio: a 720 px o menos, esa métrica ocupa una franja horizontal de ancho completo con
  icono, cifra y rótulo alineados; las otras cuatro conservan la cuadrícula 2 × 2 y no se
  oculta ningún dato.
- Validación visual: fixture completamente sintético a 390 px y captura adicional a 320 px;
  el E2E verifica el ancho completo de la franja y el contrato de ausencia de overflow.
- Validación del cambio completo: test focal 25/25 PASS; E2E dummy 1/1 PASS; ESLint para el
  spec E2E, build docente (TypeScript, ESLint frontend, bundle guard y WCAG 39/39), auditoría
  SDD y `git diff --check` PASS.
- Criterio de controles no disponibles: [W3C APG Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  define `aria-disabled` para acciones no disponibles y [Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
  recomienda mantenerlos enfocables cuando su descubrimiento es necesario. Por eso los
  filtros conservan foco de teclado, anuncian el motivo y bloquean activación en el manejador.

## Revalidación focal del nombre accesible de foto de Cuenta (2026-10-29)

- Hallazgo: el selector de foto tenía un `aria-label` fijo («Seleccionar foto de perfil») que
  reemplazaba el texto visible («Agregar foto»/«Cambiar foto»), creando nombres distintos para
  tecnologías de asistencia y control por voz.
- Cambio: se retiró el nombre forzado; el nombre accesible deriva del texto visible y cambia
  junto con la acción, conservando el tipo de archivo, la ayuda asociada y almacenamiento local.
- Validación focal: `seccionCuenta.test.tsx` (22/22 PASS); la prueba comprueba el nombre antes y
  después de seleccionar una foto. E2E con perfil ficticio `audita Cuenta con perfil ficticio`
  PASS (1/1) a 320/390 CSS px en ambos temas; las cuatro capturas actuales, inspeccionadas, se
  guardaron en `reports/qa/ux-audit-20261029-cuenta-dummy-current/`. No se usó la cuenta real
  abierta en el navegador lateral.
- Criterio: [W3C WCAG 2.2, 2.5.3 Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name)
  indica que el nombre accesible incluya el rótulo visible, para habilitar navegación por voz
  coherente con el texto que las personas ven.

## Foco de teclado al editar Materias (2026-10-29)

- **Hallazgo:** al activar «Editar», el botón se reemplaza por el formulario y desaparece el
  elemento enfocado. Al cancelar o guardar, el panel de acciones se cierra, sin foco de retorno.
  El E2E detectó además que el validador rechazaba una raya tipográfica presente en un nombre
  válido del catálogo, aunque el backend admite ese texto.
- **Cambio:** el foco pasa al campo «Nombre de la materia» al abrir la edición y vuelve al
  control de acciones de esa tarjeta al cancelar o guardar correctamente. La regla de nombres
  acepta los signos de puntuación Unicode de categoría `Pd`, incluidos guiones y rayas. No cambia
  el payload, los permisos ni las reglas de fechas/grupos.
- **Validación focal:** `seccionPeriodos.edit.test.tsx` y `utilidades.appDocente.test.ts`
  (27/27 PASS combinadas) y E2E `audita Materias activas y archivadas con
  catálogo ficticio` PASS (1/1) a 320/390 px, temas claro/oscuro; el E2E verifica foco al entrar
  y volver, nombre existente no inválido, guardado habilitado, ausencia de overflow y capturas.
  ESLint y `git diff --check` focales PASS.
- **Límite:** teclado se recorrió en navegador con perfil sintético; lector de pantalla y
  runtime de instalación local siguen pendientes.

## Estado accesible y consulta vigente del encuadre (2026-10-29)

- Hallazgo estático: la carga y el fallo de la consulta de firmas no tenían semántica de
  estado/error ni reintento; al elegir otra materia, una respuesta lenta podía reemplazar el
  estado de la materia actual. La selección automática inicial también disparaba dos consultas.
- Cambio: la carga se anuncia como `status`, los errores como `alert` y los fallos recuperables
  ofrecen reintento; se invalida la consulta anterior al cambiar materia y se evita duplicar la
  consulta inicial. No cambian endpoints, payloads ni cálculos.
- Validación focal: `seccionCalificaciones.routing.test.tsx` 13/13 PASS, incluida comprobación
  de error/reintento y de respuesta fuera de orden; build docente, typecheck, ESLint, WCAG y
  `sdd:audit` PASS. Runtime instalado y lector de pantalla pendientes.

## Envío por teclado del cambio de contraseña en Cuenta (2026-10-29)

- Hallazgo estático: el cambio de contraseña usaba tres campos fuera de un elemento `form` y
  un botón `type="button"`; por ello, Enter no ejecutaba la acción principal.
- Cambio: agrupar los campos en un formulario semántico y asociar el botón existente como envío,
  conservando distribución visual, validaciones, endpoint y payload. Ignorar envíos mientras la
  solicitud está en curso.
- Validación focal: `tests/seccionCuenta.test.tsx` 22/22 PASS; `build:docente` PASS
  (TypeScript, ESLint, bundle docente y WCAG contraste 54/54); se verificó que Enter envía una
  sola solicitud con el endpoint/payload existentes. Revisión visual del runtime instalado y
  evaluación manual con lector de pantalla pendientes.

## Contraste de etiquetas de sección en tema claro (2026-10-29)

- Hallazgo visual: las etiquetas `.banco-section-pill` usaban texto claro y fondos translúcidos
  en tema claro. El resultado dependía del panel detrás y no aseguraba contraste legible en
  Cuenta ni en otras secciones que reutilizan el componente.
- Cambio: asignar superficies opacas y colores de texto AA a las variantes violeta, ámbar,
  cian, esmeralda y azul cielo en tema claro. El tema oscuro y la semántica de cada etiqueta
  permanecen sin cambios.
- Criterio: [WCAG 2.2 SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) exige 4.5:1
  para texto normal.
- Validación: `node scripts/tests/ui-contrast-audit.mjs` verifica 59/59 pares, incluidos los
  cinco nuevos pares de etiquetas (6.49:1–7.39:1); E2E Edge con datos ficticios de Cuenta y
  Classroom PASS (2/2) a 320/360/390 CSS px y ambos temas. Lector de pantalla e instalación
  local siguen pendientes.

## Revisión visual actual de Resultados por alumno (2026-10-29)

- Se repitió `captura Resultados sin materia y con registros sintéticos` en Edge con API
  interceptada y un alumno ficticio, sin consultar ni modificar datos reales. E2E 1/1 PASS:
  estado sin materia, selección de materia, filtros, consulta de resultado, cinco KPI, tarjetas
  por alumno, encabezados y ausencia de desplazamiento horizontal a 320/390 CSS px en temas claro
  y oscuro.
- Se inspeccionaron las capturas; la vista conserva jerarquía y etiquetas de datos para la ficha
  de calificaciones a 320 px. No surgió un defecto visual nuevo que justifique otra modificación
  en este recorrido.
- Evidencia actual: `reports/qa/ux-calificaciones-20261029-current-continuation/`.
- Límite: esta captura no cierra Extraordinarios, Actas, operación OMR, Classroom ni exportaciones;
  tampoco sustituye zoom al 200 %, lector de pantalla o verificación de la instalación local.

## Revisión visual de Extraordinarios (2026-10-29)

- E2E con alumno, solicitud, resultado, lote y plantilla ficticios; se inspeccionaron 320 y 390 CSS
  px en tema claro y oscuro. Se cubren elegibilidad, final exacta frente a acta, solicitud, historial,
  plantilla, paginación visible y captura de resultado externo, sin emitir escrituras.
- Hallazgo: los conteos fijos mostraban discordancias gramaticales con una fila (“1 elegibles”,
  “1 resultados históricos”) y el conteo de solicitudes no identificaba a quién contaba.
- Cambio: conteos de elegibilidad, alumnos con solicitud y resultados históricos singularizan una
  unidad y explicitan “alumno(s)” donde aplica; plurales conservados para cero y varios.
- Validación: `extraordinariosCalificaciones.test.tsx` 13/13 PASS con frases singulares/plurales;
  E2E visual 1/1 PASS a 320/390 CSS px, claro/oscuro, sin overflow horizontal. Evidencia actual:
  `reports/qa/ux-extraordinarios-20261029-current/`.
- Límite: la prueba usa preview y API interceptada; no verifica generación/persistencia real,
  navegación completa de acciones, zoom al 200 %, lector de pantalla ni instalación local.

## Revisión visual de Actas y exportación (2026-10-29)

- Se recorrieron los modos de lista grupal y consulta individual con periodo, alumnos y claves
  ficticios; el E2E existente confirma generación del HTML y claves en descarga simulada, ausencia
  de overflow a 320 CSS px y comportamiento hasta escritorio. Capturas: `reports/qa/ux-actas-reportes-20261029-current/`.
- Inspección de capturas móviles: los bloques, selectores, ayudas, campo secreto y acciones permanecen
  dentro del viewport; el texto introductorio queda separado de la tarjeta y no se confirmó colisión.
  No surgió un defecto visual nuevo en este recorrido que justifique modificar el componente.
- Validación focal ya ejecutada: `npx playwright test -c tests/gui-responsive/playwright.config.mjs
  --grep "audita visualmente el generador de reportes"` PASS (1/1, Edge, respuestas API ficticias).
- Límite: no verifica escritura/sincronización real con OneDrive, lectores de pantalla, zoom al 200 %
  ni el runtime instalado.

## Revisión visual de captura OMR (2026-10-29)

- Se inspeccionó Revisión y captura con periodo y alumno ficticios, sin cargar ni procesar exámenes
  reales. El recorrido confirma el nombre y ayuda de Página, los selectores de imagen/lote y el
  reflow sin overflow a 320/390 CSS px en tema claro/oscuro. Capturas de vista y viewport:
  `reports/qa/ux-omr-20261029-final/`.
- Hallazgos visuales: en tema claro el título y la ayuda de carga heredaban un fallback casi blanco
  sobre una superficie clara; el placeholder del folio se truncaba a 320 px.
- Cambios: textos de carga ahora usan los tokens adaptativos `--texto`/`--textoSuave`; el placeholder
  se acortó a «Auto QR o manual» sin cambiar el label ni el comportamiento del campo.
- Validación focal: E2E `captura Resultados sin materia y con registros sintéticos` 1/1 PASS en Edge;
  comprueba título, ayuda, placeholder, reflow, encabezados y overflow a 320/390 px en ambos temas.
  ESLint focal PASS y guard WCAG 59/59 pares PASS.
- Límite: la evidencia cubre el estado de captura sin archivo; no valida análisis OMR real, revisión
  de hojas procesadas, zoom al 200 %, lector de pantalla ni la instalación local.

## Revisión visual de Materias (2026-10-29)

- Se reejecutó el recorrido de catálogo con perfiles y materias ficticios. Se añadieron capturas de
  viewport para el encabezado/recordatorio y captura del elemento completo de la materia activa a
  320/390 CSS px en claro/oscuro, además de las páginas completas existentes. Evidencia:
  `reports/qa/ux-materias-20261029-viewports/`.
- Inspección: el recordatorio apila acción debajo del texto a 320 px, y la tarjeta activa presenta
  estado/avance, fechas/grupos, registro de alumnos y acciones dentro del ancho; el archivo histórico
  mantiene conteos rotulados y fechas legibles. No se confirmó un defecto nuevo que justifique tocar
  el componente.
- Validación focal: `audita Materias activas y archivadas con catálogo ficticio` PASS (1/1, Edge),
  con chequeos de overflow y encabezados en ambos temas a 320/390 CSS px, semántica requerida del
  formulario de alta, entrada por teclado al formulario de edición con cancelación y catálogo
  archivado. No ejecuta guardado de alta/edición ni restauración.
- Límite: no es una inspección del runtime instalado ni cubre zoom al 200 % o lector de pantalla.

## Revisión visual de Perfil y PDF institucional (2026-10-29)

- Se recorrió Cuenta con perfil ficticio y se inspeccionaron los paneles de foto, seguridad y PDF
  institucional en capturas de 320 CSS px, en ambos temas; el E2E conserva también páginas completas
  a 320/360/390 CSS px. Evidencia: `reports/qa/ux-cuenta-20261029-final/`.
- Hallazgo: los placeholders largos de Institución y Lema se cortaban visualmente en móvil aunque los
  campos aceptaran el texto completo. Se cambiaron por «Nombre de la institución» y «Lema del PDF»;
  etiquetas, valores, validaciones y payload permanecen iguales.
- Validación focal: `seccionCuenta.test.tsx` 22/22 PASS y E2E `audita Cuenta con perfil ficticio a
  320/360/390 px en ambos temas` PASS (1/1, Edge, perfil sintético). La revisión visual confirmó que
  los nuevos ejemplos caben en el ancho móvil.
- Límite: no verifica zoom real al 200 %, recorrido manual completo de teclado, lector de pantalla ni
  la instalación local.

### Selector de logos legible en móvil (2026-10-29)

- Hallazgo: en el panel PDF, los controles nativos de archivo truncaban su estado de selección a
  320 px. El nombre de cada logo no quedaba claro después de elegirlo.
- Cambio: se reemplazó su presentación por un selector accesible con nombre completo, botón visible,
  nombre/estado explícito y foco visible. A 360 px o menos se apila para evitar que el nombre se
  comprima. Se conservan PNG/JPG/WebP, el límite de 2 MB y el mismo flujo de lectura/guardado.
- Validación: `seccionCuenta.test.tsx` 22/22 PASS; E2E `audita Cuenta con perfil ficticio` 1/1 PASS,
  con archivo dummy a 320 px; capturas inspeccionadas en ambos temas y con nombre seleccionado en
  `reports/qa/ux-cuenta-20261029-filepicker-final/`.
- Pendiente: runtime local, zoom real al 200 % y tecnologías de asistencia.

## Concordancia de los KPIs de Materias (2026-10-29)

- Hallazgo visual: con una materia activa, el KPI mostraba «1 MATERIAS». La etiqueta del KPI de
  grupos también podía quedar en plural con un único grupo.
- Cambio: las etiquetas de ambos conteos ahora usan singular solo cuando el catálogo está disponible
  y el total es uno; el cero, varios elementos y estados no disponibles conservan plural o guion.
- Validación: `seccionPeriodos.edit.test.tsx` 18/18 PASS; E2E `audita Materias activas y archivadas
  con catálogo ficticio` PASS (1/1, Edge), incluyendo una materia y dos grupos a 320/390 CSS px en
  claro/oscuro. Capturas de la reauditoría: `reports/qa/ux-audit-materias-20261029-singular-final/`.
- Aislamiento del E2E: la telemetría best-effort responde localmente con 204 en esta prueba, sin
  conectarse al backend; la reejecución no generó el aviso de proxy observado en la captura inicial.
- Límite: esta evidencia es sintética y no sustituye una inspección de runtime instalado.

## Mensajes de edición y explicación de archivo en móvil (2026-10-29)

- Hallazgos visuales: después de cancelar una edición, el toast «Editando Materia» seguía visible
  al abrir Archivadas y describía un estado que ya había terminado. En esa vista, el panel informativo
  ocupaba varias líneas estrechas a 320 CSS px y repetía en más palabras el efecto del archivo.
- Cambios: inicio, cancelación, éxito y error de edición ahora reemplazan el mismo toast; cancelar
  comunica que no se guardaron cambios. El texto archivado se acortó para explicar qué deja de
  aparecer y qué información se conserva, sin cambiar el archivo ni la persistencia. A 360 CSS px o
  menos, el icono del panel informativo se coloca encima del texto para dejarle más ancho legible.
- Validación: `seccionPeriodos.edit.test.tsx` 18/18 PASS; `seccionPeriodosArchivados.test.tsx`
  y `seccionPeriodos.edit.test.tsx` 22/22 PASS en conjunto; E2E de Materias 1/1 PASS a 320/390 CSS px
  en ambos temas. La captura archivada muestra el aviso correcto y el texto revisado en
  `reports/qa/ux-audit-materias-20261029-archive-readable/`.
- Límite: perfiles, materias y acciones son sintéticos; no se auditó el runtime instalado.

## Calificaciones y Extraordinarios: conteos y selector PDF (2026-10-29)

- **Hallazgos visuales:** con un solo alumno, el encabezado mostraba «1 alumnos en la materia» y el resumen «1 alumnos» / «1 calificados». En móvil, el selector nativo del PDF externo cortaba el estado «No se eligió ningún archivo» y el nombre del PDF.
- **Cambios:** encabezado y contadores singularizan «alumno», «calificado» y «pendiente», conservando los plurales para cero y varios. El selector PDF de Extraordinarios expone un botón con foco visible, estado anunciable, ayuda asociada y nombre de archivo sin truncar. Se mantienen el filtro PDF, el cálculo local de SHA-256 y los metadatos enviados; no cambian datos ni contratos.
- **Validación focal:** `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`: 26/26 PASS para cero, uno, varios, carga y recuperación; `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`: 13/13 PASS, incluidos estado inicial, archivo elegido y validación PDF; E2E de Resultados y Extraordinarios: 1/1 PASS cada uno en Edge, fixture sintético y claro/oscuro a 320/390 CSS px; ESLint focal PASS; guard WCAG 59/59 pares PASS. Capturas actuales inspeccionadas en `reports/qa/ux-audit-calificaciones-20261029-singular/`.
- **Límite:** preview con datos sintéticos; zoom 200 %, lector de pantalla y runtime instalado quedan pendientes.

## Extraordinarios: reducir el recorrido móvil con divulgación progresiva (2026-10-29)

- **Hallazgo:** en el viewport móvil de 320 CSS px, la pantalla completa alcanzaba 4,732 px de alto y mezclaba el flujo principal con el historial de lotes y el registro externo opcional.
- **Cambio:** elegibilidad y preparación/generación permanecen visibles. El historial generado y el registro externo se presentan como divulgaciones nativas cerradas inicialmente, con conteo/propósito en el resumen y el contenido completo disponible al abrir.
- **Resultado medido:** con el mismo fixture, el contenido inicial bajó de 4,732 a 3,572 px a 320 CSS px (1,160 px; 24.5 %) y de 4,379 a 3,308 px a 390 CSS px (1,071 px; 24.5 %). La medición incluye el marco común del portal.
- **Validación focal:** `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`: 13/13 PASS; E2E `audita visualmente Extraordinarios con datos sintéticos en móvil`: 1/1 PASS; comprueba ambos bloques cerrados, apertura con Enter, cierre con Espacio, contenido completo y reducción del scroll; capturas de claro/oscuro a 320/390 CSS px inspeccionadas en `reports/qa/ux-audit-calificaciones-20261029-disclosures/`. ESLint focal y guard WCAG PASS.
- **Límite:** preview y datos ficticios; quedan pendientes zoom 200 %, lector de pantalla y runtime instalado.

## Concordancia del resumen de Extraordinarios (2026-10-29)

- **Hallazgo:** el encabezado general de Calificaciones tomaba el conteo de alumnos de una fuente distinta a la lista académica cargada por Extraordinarios; con el fixture había «0 alumnos» arriba y «1 elegible de 1 alumno» en la sección.
- **Cambio:** Extraordinarios comunica su conteo cargado al encabezado y KPI del periodo. Durante carga, cambio de periodo o error no se presenta un cero como si fuera el resultado vigente. No se modifican criterios de elegibilidad, permisos, cálculos ni payloads.
- **Validación focal:** `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`: 13/13 PASS; E2E `audita visualmente Extraordinarios con datos sintéticos en móvil`: 1/1 PASS y confirma encabezado «1 alumno» y KPI «En el periodo: 1»; ESLint focal PASS.
- **Límite:** evidencia sintética; runtime instalado, zoom 200 % y lector de pantalla siguen pendientes.

## Envío por teclado en edición de Materias (2026-10-29)

- Hallazgo estático: el alta usa un formulario con botón de envío, pero la edición solo agrupaba campos en un `div` y «Guardar cambios» ejecutaba el guardado por `onClick`. Enter en los campos no enviaba la edición.
- Cambio: la edición ahora usa un `<form>` semántico y el botón externo se asocia mediante el atributo `form`; Enter activa la misma operación que el botón, pasando por la validación actual y el mismo endpoint/payload.
- Referencia: [WHATWG HTML Standard, implicit submission](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission) describe el envío implícito con Enter y cómo el botón predeterminado activa el envío.
- Validación focal inicial: `seccionPeriodos.edit.test.tsx` 18/18 PASS; ESLint focal y auditoría SDD PASS; `git diff --check` PASS. En ese corte, la pulsación Enter en navegador real quedaba pendiente.
- Validación añadida: `seccionPeriodos.edit.test.tsx` 19/19 PASS; `responsive-docente.spec.ts` ejecuta el flujo real en Edge con catálogo ficticio a 320 y 390 CSS px, verifica que Enter abre sin escribir y que Enter desde el campo genera exactamente un POST con el payload vigente por viewport; ESLint focal PASS. Evidencia en `reports/qa/ux-materias-edit-enter-20261029-final/`.
- No cambia contratos ni reglas de materia. La cobertura automatizada no sustituye lector de pantalla, zoom 200 % ni comprobación en el runtime instalado.

## Envío del alta de Materias con teclado (2026-10-29)

- Alcance: verificar el formulario existente de alta con datos ficticios, sin cambiar validaciones ni contratos.
- Validación focal: E2E `audita Materias activas y archivadas con catálogo ficticio` PASS (1/1, Edge); en 320/390 CSS px, el formulario de alta y el de edición se envían con Enter y cada iteración confirma una única solicitud con payload vigente. ESLint focal PASS, además de unitarias focales 19/19.
- No cambia validaciones ni contratos. El fixture y las rutas API son ficticios; runtime instalado, zoom 200 % y lector de pantalla siguen pendientes.

## Estado accesible del detalle por alumno (2026-10-29)

- Hallazgo estático: «Ver detalle» insertaba un panel con calificaciones, pero el botón no exponía el estado abierto ni la relación con el panel.
- Cambio: el botón comunica `aria-expanded`; cuando el panel está abierto, `aria-controls` apunta a un ID único generado por React. Al cerrar el panel, el control vuelve a contraído y ya no referencia un elemento desmontado.
- Referencia: [WAI-ARIA APG, Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) recomienda `aria-expanded` para expresar visibilidad y permite `aria-controls` para identificar el contenido controlado.
- Validación focal: `seccionCalificaciones.resumen.test.tsx` 26/26 PASS; ESLint focal y auditoría SDD PASS. No modifica cálculos, API, permisos ni payloads. La prueba automatizada no sustituye lector de pantalla ni verificación en runtime instalado.
- En esta misma iteración se agregó manejo de foco: al abrir por teclado o puntero, el panel recibe el foco; al cerrar, este vuelve al botón invocador cuando sigue montado.
- Validación focal final: `seccionCalificaciones.resumen.test.tsx` 26/26 PASS; ESLint focal, `npm run sdd:audit` y `git diff --check` PASS. El runtime instalado y el lector de pantalla permanecen pendientes.

## Lectura progresiva de columnas sin dato en «Libro completo» (2026-10-29)

- En la captura ficticia de 390 CSS px, 18 columnas vacías repetían «Sin dato» y empujaban el único valor disponible muy abajo. El panel ahora prioriza valores registrados y agrupa las columnas sin fuente en un `<details>` con su conteo; sus nombres y escalas siguen disponibles al expandirlo.
- El valor `0` registrado permanece entre los datos visibles; solo la ausencia de fuente se agrupa. Los cálculos, el esquema recibido y los payloads no cambian.
- Validación: `seccionCalificaciones.resumen.test.tsx` 26/26 PASS; E2E sintético 1/1 PASS en Edge, con apertura por Enter, comprobación del cero y capturas colapsada/expandida a 390 px; ESLint focal, WCAG guard (59/59 pares), `npm run sdd:audit` y `git diff --check` PASS. Evidencia en `reports/qa/ux-calificaciones-libro-expand-20261030/`.
- La prueba usa datos ficticios; lector de pantalla y runtime instalado siguen pendientes.

## Fechas legibles en Materias activas y archivadas (2026-10-29)

- Hallazgo: las fechas numéricas variaban con la configuración regional y podían leerse en distinto orden; el archivo también heredaba el idioma del sistema.
- Cambio: Materias activa y archivada presentan día, mes abreviado en español y año; las fechas de calendario mantienen zona UTC para conservar el día guardado, y los registros históricos conservan la hora local. No cambia el valor ISO ni los contratos.
- Validación focal: `fechaCalendario.test.ts`, `seccionPeriodosArchivados.test.tsx` y
  `seccionPeriodos.edit.test.tsx`: 26/26 PASS; E2E sintético de Materias: 1/1 PASS en Edge a
  320/390 CSS px y ambos temas, incluyendo formato activo/archivado, ausencia de recorte y
  notificaciones anteriores cerradas antes de capturar. ESLint focal, `npm run sdd:audit` y
  `git diff --check` PASS. Capturas inspeccionadas en
  `reports/qa/ux-materias-fechas-20261029/`.
- Límite: entorno y datos sintéticos; no verifica la instalación local ni cambia el pendiente de
  runtime real, zoom 200 % y lector de pantalla.

## Instrucción compartida para páginas del PDF institucional (2026-10-30)

- Hallazgo visual: en el panel PDF de Cuenta, la misma regla de paridad y doble cara se repetía
  debajo de cada uno de los tres campos, alargando el formulario móvil.
- Cambio: la regla aparece una sola vez y se asocia por `aria-describedby` a cada selector. Cada
  campo conserva su resumen calculado y asocia ese resumen; los errores siguen asociados cuando el
  valor es inválido. Etiquetas, opciones, validaciones, guardado y payload permanecen iguales.
- Validación: `seccionCuenta.test.tsx` 22/22 PASS; E2E Cuenta 1/1 PASS en Edge a 320/360/390/640
  CSS px, ambos temas y perfil ficticio; captura de 320 CSS px inspeccionada en
  `reports/qa/ux-cuenta-paginas-20261030/`.
- Límite: ejecución sintética; zoom real al 200 %, lector de pantalla e instalación local siguen
  pendientes.

## Concordancia del conteo visible en Resultados (2026-10-30)

- Hallazgo visual: con una sola fila visible, el estado anunciaba «1 visibles».
- Cambio: el conteo usa «visible» para uno y «visibles» para cero o varios; no altera los filtros,
  conteos académicos ni la fuente de datos.
- Validación: `seccionCalificaciones.resumen.test.tsx` 26/26 PASS; E2E de Resultados con fixture
  ficticio 1/1 PASS en Edge a 320/390 CSS px y claro/oscuro. Captura de 320 CSS px inspeccionada
  en `reports/qa/ux-calificaciones-20261030-singular-visible/`.
- Límite: pantalla sintética; runtime instalado y lector de pantalla permanecen pendientes.

## Desduplicación del resumen de Resultados (2026-10-30)

- Hallazgo visual: cuando Resultados ya había cargado una materia, el total de alumnos aparecía
  simultáneamente en la franja del encabezado, en los KPI y en el resumen del libro.
- Cambio: se oculta solo el contador redundante del encabezado en ese estado; se conserva el mensaje
  cuando falta materia, la consulta carga o se usa otra vista. No cambia el origen ni el cálculo de
  los conteos.
- Validación focal: `captura Resultados sin materia y con registros sintéticos` 1/1 PASS en Edge;
  verifica que el contexto de selección siga visible sin materia y que el contador redundante no se
  muestre tras cargar la materia. Capturas actuales de 320/390 CSS px, ambos temas, detalle y libro
  completo en `reports/qa/ux-audit-calificaciones-current-turn-final/`. ESLint focal y
  `npm run guard:wcag -- --skip-lint` PASS (59/59 pares).
- Límite: fixture sintético en servidor E2E; no valida runtime instalado, zoom real al 200 % ni
  lector de pantalla. La especificación general sigue aprobada y parcialmente abierta.

## Huellas técnicas desplegables en Extraordinarios (2026-10-30)

- Hallazgo visual: al elegir un PDF, la cadena SHA-256 completa ocupaba varias líneas del formulario
  móvil, mezclando metadatos técnicos con los campos de captura.
- Cambio: las huellas del PDF externo, del resultado histórico y del lote generado quedan en
  divulgaciones nativas inicialmente cerradas. El resumen indica qué archivo identifica; abrirlo
  expone el hash original sin truncar y conserva su valor en el payload.
- Validación focal: `extraordinariosCalificaciones.test.tsx` 13/13 PASS; E2E de Extraordinarios 1/1
  PASS en Edge con fixture PDF dummy, apertura/cierre con Enter/Espacio, reflow y temas claro/oscuro
  a 320/390 CSS px. Capturas inspeccionadas en
  `reports/qa/ux-audit-extraordinarios-current-turn-final/`; ESLint y guard WCAG (59/59 pares)
  PASS.
- Límite: fixture sintético; runtime instalado, zoom real al 200 % y lector de pantalla siguen
  pendientes.

## Classroom embebido en Calificaciones: revisión responsive (2026-10-30)

- Se agregó y recorrió una fixture E2E con dos cuentas de curso, dos alumnos, una actividad y una
  evidencia sintéticas. Navega a Calificaciones → Classroom, selecciona materia/curso y revisa
  vinculación, filtro de actividad, mapeo de parcial e historial de evidencias, sin ejecutar
  sincronización ni escritura.
- Capturas actuales de 320/390 CSS px en ambos temas y de escritorio inspeccionadas en
  `reports/qa/ux-audit-classroom-calificaciones-current-turn/`; no hubo desbordamiento horizontal
  del documento ni encabezados fuera del viewport.
- Validación focal: E2E `audita Classroom dentro de Calificaciones con datos sintéticos` 1/1 PASS;
  ESLint focal PASS.
- Límite: fixture simulada; vínculo con cuenta Classroom real, teclado completo, lector de pantalla,
  zoom 200 % y runtime instalado siguen pendientes.

### Ayuda completa para buscar evidencias Classroom en móvil (2026-10-30)

- Hallazgo visual: el placeholder «Alumno, matrícula, actividad, nota o estado» se truncaba en el
  input estrecho a 320/390 CSS px y repetía el nombre visible del campo.
- Cambio: el placeholder ahora es «Alumno o actividad»; la ayuda completa sobre matrícula, nota y
  estado se presenta debajo del campo y queda asociada con `aria-describedby`. No cambia el filtro.
- Validación focal: `classroomEnCalificaciones.test.tsx` 16/16 PASS y E2E `audita Classroom dentro
  de Calificaciones con datos sintéticos` 1/1 PASS; ambos cubren nombre, placeholder, descripción
  accesible, temas claro/oscuro a 320/390 CSS px y escritorio. ESLint focal y guard WCAG 59/59
  pares PASS; capturas inspeccionadas en
  `reports/qa/ux-audit-classroom-calificaciones-current-turn-final/`.

## Claridad del requisito de reautenticación en Cuenta (2026-10-31)

- Hallazgo estático: cuando el docente ya tiene contraseña, «Contraseña actual» condiciona el
  botón Guardar, pero el campo no declaraba `required` ni explicaba por qué se solicita.
- Cambio: la etiqueta indica «(obligatoria)», el input expone el atributo `required` y una ayuda
  asociada explica que se necesita para confirmar el cambio. Endpoint, regla de autenticación y
  payload no cambian.
- Evidencia visual: el recorrido E2E con perfil y APIs ficticias captura el panel de seguridad
  con contraseña existente a 640 CSS px en tema claro; se inspeccionó la captura
  `reports/qa/ux-cuenta-reauth-current-20261031/ux-audit-cuenta-reauth-required-640-light.png`.
  El recorrido completo verifica reflow a 320/360/390/640 CSS px, ambos temas y envío por teclado
  (1/1 PASS en Edge).
- Validación focal: `npm -C apps/frontend run test -- tests/seccionCuenta.test.tsx` (22/22 PASS);
  `npm run build:frontend:docente` PASS con typecheck, lint, guard de bundle y WCAG 61/61.
- El primer intento E2E ocupó 4173 y se detuvo tras comprobar que el preview no respondía; se
  liberó el puerto al terminar. El recorrido se repitió en el puerto aislado 4175 con Edge. La
  inspección manual, zoom real al 200 % y lector de pantalla continúan pendientes.

## Claridad del indicador temporal en Materias (2026-10-31)

- Hallazgo visual/estático: la tarjeta calculaba el porcentaje con las fechas del ciclo, pero el
  `title` lo llamaba «Avance académico», que puede confundirse con calificaciones o actividad
  docente.
- Cambio: se muestra «Tiempo del periodo» junto a la barra nativa, se nombra el `progress` como
  tiempo transcurrido del periodo y se expone un `aria-valuetext` equivalente. El anillo repite el
  porcentaje solo como decoración. Cálculo, estado, datos y contratos no cambian.
- Validación: recorrido E2E sintético de Materias en Edge a 320/390 CSS px y temas claro/oscuro
  (1/1 PASS); verifica nombre/valor accesibles, etiqueta visible, reflow y captura actual. Build
  docente PASS; guard WCAG 61/61; `npm run sdd:audit` y `git diff --check` PASS. Evidencia en
  `reports/qa/ux-materias-current-20261031/`.
- Límite: fixture ficticio; quedan pendientes instalación runtime, zoom 200 %, lector de pantalla
  y revisión completa de estados/acciones de Materias.

## Contador de selección en Extraordinarios (2026-10-31)

- Hallazgo visual: a 320 CSS px, «Elegibilidad y solicitud» compartía una fila con «0
  seleccionados»; el contador se partía y no explicaba que correspondía a alumnos.
- Cambio: el encabezado apila el contador en móvil y muestra «N alumnos seleccionados» con
  singular/plural; la región `aria-live="polite"` anuncia cambios sin mover el foco. No se altera
  la elegibilidad ni el envío del lote.
- Validación: E2E sintético 1/1 PASS en Edge; comprueba 0/1 selección, claro/oscuro a 320/390 CSS
  px, nombre completo del contador y el reflow; build docente PASS, guard WCAG 61/61.
  Capturas: `reports/qa/ux-calificaciones-extra-current-20261031/`.
- Referencia: [WCAG 2.2 SC 4.1.3, Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- Límite: no se usó lector de pantalla ni runtime instalado.

## Confirmación concisa del reporte HTML (2026-10-31)

- Hallazgo visual: tras descargar el HTML, la confirmación repetía la acción de reemplazarlo en
  OneDrive, que ya aparece en la instrucción persistente a pocos píxeles. A 320 CSS px esa
  repetición ocupaba espacio relevante antes de las claves individuales.
- Cambio: la confirmación de descarga dice «Reporte HTML generado y descargado.»; la instrucción
  persistente mantiene el paso de reemplazo y permisos de lectura. El mensaje de guardado con
  selector del sistema sigue indicando que se verifique la sincronización antes de compartir.
- Validación: E2E focal de generación sintética en Edge 1/1 PASS; comprueba la confirmación breve,
  la instrucción persistente y el reflow del flujo individual/grupal en 320/390 CSS px. Capturas
  actualizadas en `reports/qa/ux-calificaciones-reportes-current-20261031/`.
- Límite: descarga sintética; no valida sincronización real en OneDrive.

## Instrucción de nitidez sin suponer cámara (2026-10-31)

- Hallazgo visual: al cargar un archivo de imagen, el aviso de baja calidad indicaba «Enfoca mejor
  la cámara», aunque este control también acepta archivos.
- Cambio: el motivo ahora identifica la borrosidad y recomienda usar una imagen más nítida, válido
  para fotos o archivos; la evaluación de calidad y los umbrales permanecen intactos.
- Validación: E2E OMR sintético en Edge 1/1 PASS; verifica el mensaje nuevo, el estado de archivo
  y que «Analizar página» siga deshabilitado; captura actual inspeccionada a 320 CSS px. No se
  ejecutó análisis OMR ni se modificaron calificaciones. Evidencia en
  `reports/qa/ux-calificaciones-omr-current-20261031/`.

## Evidencias Classroom como fichas móviles sin colisiones (2026-10-30)

- Hallazgo en captura actual: a 320 CSS px, el diseño global de dos columnas para tablas apiladas
  hacía competir siete campos por fila; actividad, nota, fecha y acciones se solapaban aunque no
  hubiera overflow del documento.
- Cambio: la tabla de evidencias conserva estructura y encabezados de tabla en escritorio; hasta
  860 CSS px usa una columna con etiqueta sobre valor y acciones envueltas. No cambian datos,
  orden, cálculos, permisos, endpoints, payloads ni operación de sincronización.
- Validación focal: `audita Classroom dentro de Calificaciones con datos sintéticos` 1/1 PASS en
  Edge a 320/390/700 CSS px, temas claro/oscuro; mide ancho, desbordamiento interno, alineación y
  separación de los siete campos; confirma rol y encabezado de tabla en móvil y presentación
  tabular a 1440 px. ESLint focal PASS; `npm run guard:wcag -- --skip-lint` 61/61 PASS;
  `npm run sdd:audit` y `git diff --check` PASS.
- Capturas antes/después y auditoría: `reports/qa/ux-calificaciones-classroom-cards-20261030/`.
- Referencias: WCAG 2.2 SC 1.4.10 Reflow y 1.3.1 Info and Relationships; WAI Tables Tutorial.
  Límites: datos Classroom ficticios; lector de pantalla, teclado completo, zoom real 200 %,
  cuenta Classroom real y runtime instalado siguen pendientes.

## Reflow de subpaneles Classroom en móvil (2026-10-31)

- Hallazgo en capturas actuales a 320 CSS px: los paneles «Vincular actividades a evaluación continua» y «Revisar actividades por tema» acumulaban bordes, fondos y padding; la ficha de actividad quedaba demasiado estrecha aunque la página no tuviera overflow.
- Cambio: en viewport estrecho, ambos bloques ahora comparten la superficie del contenedor de sincronización, separados por jerarquía tipográfica y una regla divisoria. La tarjeta exterior conserva su fondo y agrupación; no cambian consultas, permisos, calificaciones ni acciones.
- Validación focal: E2E de Classroom 1/1 PASS; prueba de ancho útil >180 CSS px y resumen de actividad sin overflow a 320/390 px; claro/oscuro en 320/390/700 y desktop 1440. Capturas posteriores inspeccionadas en `reports/qa/ux-calificaciones-classroom-after-20261031/`.
- Referencia: [WCAG 2.2, criterio 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) define el viewport equivalente a 320 CSS px y la expectativa de conservar información y funcionalidad sin desplazamiento en dos dimensiones.
- Límites: fixtures Classroom sintéticos; no valida autenticación/sincronización real, lector de pantalla ni zoom manual.

## Notificaciones de Publicación (2026-10-31)

- Hallazgo estático: los éxitos y errores de publicar resultados, generar código, consultar y expirar códigos aparecían en el mensaje contextual y en un toast que repetía el mismo resultado.
- Cambio: el mensaje contextual es el único anuncio para el resultado de la operación. Solo se emite un toast de sesión cuando ofrece la acción separada de cerrar sesión y reintentar.
- Validación focal: `apps/frontend/tests/seccionPublicar.test.tsx` 11/11 PASS; ESLint focal, build docente (TypeScript, lint, bundle guard y WCAG 61/61), `npm run sdd:audit` y diff-check PASS.
- Límites: verificación con datos de prueba; no se revisó visualmente la instalación porque muestra expedientes reales en esta sesión. Sin cambios a publicación, claves, API ni sincronización.

## Región viva del preview Classroom (2026-10-31)

- Hallazgo estático: un contenedor `role="status"` envolvía el resumen, advertencias, tabla de proyección y casillas para confirmar faltantes, de modo que una actualización podía anunciar una región extensa e interactiva completa.
- Cambio: solo el resumen breve lleva `role="status"`; tabla, avisos y controles quedan como contenido navegable normal.
- Validación focal: `apps/frontend/tests/classroomEnCalificaciones.test.tsx` 16/16 PASS; confirma el resumen y que la región viva excluya la tabla y las casillas.
- Límites: no cambia cálculos, sincronización ni confirmaciones de faltantes.

## Confirmación de archivo de Materias accesible por teclado (2026-10-31)

- Hallazgo estático: el diálogo común de confirmación declaraba `aria-modal="true"` y movía
  el foco al confirmador, pero no contenía Tab/Shift+Tab, no respondía a Escape ni restauraba
  el foco al control invocador. Esto afectaba la confirmación para archivar Materias.
- Cambio: foco inicial conservador en Cancelar; navegación circular dentro del diálogo;
  Escape cancela y devuelve el foco al botón invocador. La confirmación afirmativa y los
  contratos de operación permanecen iguales.
- Fundamento: [WAI-ARIA APG, Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  especifica foco dentro del diálogo, ciclo contenido de Tab/Shift+Tab, cancelación con Escape
  y retorno del foco al invocador.
- Validación focal: `tests/confirmDialogProvider.test.tsx` + `tests/seccionPeriodos.edit.test.tsx`
  → 25/25 PASS; `build:docente` PASS (TypeScript, ESLint, bundle guard y WCAG 61/61);
  ESLint de `responsive-docente.spec.ts`, E2E sintético de Materias 1/1, `sdd:audit` y
  `git diff --check` PASS. Capturas actuales del diálogo en `test-results/` para 320/390 px
  y ambos temas.
- Límite: E2E con fixture y APIs interceptadas; no valida instalación docente real ni prueba
  manual con lector de pantalla.

## Navegación interna de Cuenta (2026-10-31)

- Hallazgo en captura sintética a 320 CSS px: la pantalla de Cuenta reúne perfil, sincronización,
  seguridad, PDF, retención y mantenimiento en un recorrido vertical extenso, sin saltos directos
  a sus bloques.
- Cambio: se añadió una navegación de enlaces dentro de Cuenta. Los destinos son encabezados
  enfocables y únicos; la Papelera aparece solo cuando el panel está habilitado. Los bloques y
  formularios permanecen montados, y los enlaces forman cuatro columnas en escritorio y dos en
  pantallas estrechas. Se conserva el texto dentro de cada control y se elimina el subrayado de
  enlace para mantener una presentación de acción consistente.
- Validación focal: `seccionCuenta.test.tsx` 25/25 PASS; E2E Edge con APIs/datos ficticios 1/1 PASS
  a 320/360/390/640 CSS px en tema claro/oscuro y 1024 CSS px de escritorio. Enter mueve foco y
  viewport al encabezado elegido; el E2E mide el texto de cada enlace dentro de su botón y verifica
  cuatro columnas en escritorio. Capturas en `reports/qa/ux-cuenta-navegacion-20261031/`.
- `build:docente` PASS (TypeScript, bundle guard y WCAG 65/65); ESLint focal, `sdd:audit` y
  `git diff --check` PASS. No cambia endpoints, permisos, valores ni persistencia.
- Límite: E2E con APIs interceptadas; instalación local, zoom manual al 200 % y lector de pantalla
  no se verificaron en esta iteración.

## Etiquetas legibles en el selector manual de Calificaciones (2026-10-31)

- Hallazgo estático: cuando existen alumnos con la misma matrícula y nombre en materias/grupos
  distintos, el selector los distingue mediante `etiquetaMateria`, que expone `(ID: ...)` en la
  etiqueta visible. El identificador no ayuda a reconocer la materia y compite con el contexto
  académico que sí necesita la persona docente.
- Cambio: `etiquetarAlumnosParaSelectorManual` usa `etiquetaMateriaParaSelector` al añadir
  contexto; la opción conserva el ID del alumno como `value` y omite el ID interno de materia.
  No cambian selección, permisos ni consultas.
- Validación: `seccionCalificaciones.manualSelector.test.tsx` 5/5 PASS; TypeScript PASS; ESLint
  focal PASS; guard WCAG 65/65 PASS; auditoría SDD y `git diff --check` PASS.
- Límite: el cambio se verificó estáticamente y con componente; no se capturó el runtime ni se
  probó zoom al 200 % o lector de pantalla en esta iteración.

## Icono del cierre en detalle de Calificaciones (2026-10-31)

- Hallazgo estático: «Cerrar detalle» usaba el carácter `×` como icono funcional. La política
  de iconografía UI del repositorio pide usar el catálogo vectorial y ocultar el icono decorativo
  cuando el control ya tiene nombre accesible.
- Cambio: sustituí el glifo por `IconoLucide` con `X` del catálogo compartido. El SVG es
  decorativo (`aria-hidden`) y el botón conserva su nombre «Cerrar detalle», el cierre y el
  retorno del foco.
- Validación: `seccionCalificaciones.resumen.test.tsx` 26/26 PASS; ESLint focal, TypeScript,
  guard WCAG (65/65), auditoría SDD y `git diff --check` PASS.
- Límite: esta iteración no obtuvo captura del runtime ni validó tamaño visual, zoom 200 % o
  lector de pantalla.

## Indicación de contexto nuevo en enlaces de Actualizaciones de Cuenta (2026-10-31)

- Hallazgo estático: los links de descarga, novedades y checksum usan `target="_blank"`, pero su
  texto no advierte que se abrirá otra pestaña o ventana.
- Cambio: una nota visible explica el cambio de contexto y cada nombre accesible añade esa
  información. Se mantienen URL, `target`, `rel` y el comportamiento de descarga.
- Referencia: W3C WAI recomienda advertir antes de abrir una pestaña/ventana nueva para reducir
  desorientación; es una técnica consultiva de accesibilidad.
- Validación focal: `seccionCuenta.test.tsx` 27/27 PASS; typecheck de frontend, ESLint focal, `sdd:audit` y `git diff --check` PASS.

## Recuperación de la carga académica de Extraordinarios (2026-10-31)

- Hallazgo estático: si fallaba la carga inicial de elegibilidad o historial, Extraordinarios dejaba
  visible el error junto con conteos en cero y el mensaje «No hay alumnos registrados», sin ofrecer
  reintento para esas consultas.
- Cambio: error de carga separado de errores de operaciones; la vista no muestra conteos, lista ni
  acciones de esos datos hasta que la carga inicial tenga éxito. «Reintentar carga académica» vuelve
  a consultar los datos sin repetir escrituras; se conserva el descarte de respuestas tardías.
- Validación focal: `extraordinariosCalificaciones.test.tsx` 15/15 PASS, incluyendo fallos y
  recuperación de cada consulta; typecheck, ESLint focal, auditoría SDD y `git diff --check` PASS.
- Alcance: sin cambios en cálculos, API, permisos, persistencia ni payloads.

## Anuncios de copia de claves del reporte individual (2026-10-31)

- Hallazgo estático: un fallo de `navigator.clipboard.writeText` mostraba el texto de error como
  mensaje informativo (`role="status"`), igual que una copia exitosa.
- Cambio: la copia exitosa conserva su anuncio de estado; el rechazo o portapapeles no disponible
  se identifica como alerta y mantiene la alternativa visible para seleccionar/copiar manualmente.
  No se añade la clave al texto del anuncio ni se cambia cómo se genera o distribuye.
- Referencia: [WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  distingue mensajes de resultado de éxito de avisos que identifican errores; su rol apropiado debe
  poder ser reconocido por tecnologías de asistencia.
- Validación focal: `seccionCalificaciones.routing.test.tsx` 21/21 PASS; typecheck, ESLint focal,
  auditoría SDD y `git diff --check` PASS. No se ejecutó el guard CSS porque no cambió el estilo.

## Recuperación y sincronización del buzón de revisión (2026-10-31)

- Hallazgo estático: un fallo inicial del GET se convertía en lista vacía y contadores en cero. Un reintento de lectura no debe activar la operación POST de sincronización. Si el POST terminaba bien y fallaba el GET posterior, la vista podía confundir la actualización del buzón con el resultado de sincronizar.
- Cambio: estados diferenciados de carga, error y vacío confirmado; botón GET-only para reintentar; conservación de la última lista y conteos ante errores posteriores. Tras sincronización exitosa con lectura fallida, un solo mensaje explica el resultado sin declarar fallida la sincronización.
- Validación focal: `appDocente.test.tsx -t "buzón"` 1/1 PASS; TypeScript, ESLint focal, auditoría SDD y diff-check PASS.
- Alcance: sin cambios en API, permisos, payloads o reglas de revisión. Sin cambios CSS; auditoría visual del runtime, zoom manual al 200 % y lector de pantalla no realizados en esta iteración.
## Resultado accesible al resolver solicitudes de revisión (2026-10-31)

- Hallazgo estático: tras guardar una resolución, el handler hacía otro POST de sincronización y cualquier fallo de este segundo flujo podía mostrarse como «No se pudo resolver». La ruta de resolución ya devuelve la solicitud actualizada y persiste el estado local; sincronizar aparte vuelve a importar desde el Portal Alumno.
- Cambio: la interfaz aplica la solicitud devuelta al listado, usa GET para reconciliarlo y conserva el estado resuelto si falla esa lectura. El error de actualización queda separado del éxito de resolución. Se eliminó el POST redundante de sincronización del camino de resolución; el botón manual se conserva.
- Validación focal: `appDocente.test.tsx -t "resuelve solicitud"` 1/1 PASS; TypeScript, ESLint focal, auditoría SDD y diff-check PASS.
- Contratos: endpoints y payloads existentes; sin cambios de API, permisos ni reglas de resolución. Sin auditoría visual runtime, zoom manual al 200 % ni lector de pantalla en esta iteración.
## Etiqueta e instrucciones del campo de respuesta de revisión (2026-10-31)

- Hallazgo estático: el textarea solo comunicaba su propósito y el mínimo de caracteres con un placeholder, que desaparece al escribir y no sustituye una etiqueta visible asociada.
- Cambio: etiqueta visible y enlazada, instrucción persistente por obligatoriedad/mínimo de 8 caracteres y atributo `required`; se reutilizan estilos de campo y la descripción se asocia por `aria-describedby`.
- Fundamento: [WCAG 2.2 SC 3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) indica que los controles que aceptan entrada deben tener etiquetas/instrucciones; el marcado y la relación programática se tratan por SC 1.3.1.
- Validación focal: `appDocente.test.tsx -t "resuelve una solicitud"` 1/1 PASS; TypeScript, ESLint focal, `guard:wcag`, auditoría SDD y diff-check PASS.
- Alcance: sin cambio de endpoint, payload, mínimo de respuesta, permisos ni operación de resolución.

## Anuncio accesible de consulta de actualizaciones en Cuenta (2026-10-31)

- Hallazgo estático: el botón cambia su etiqueta visible y expone `aria-busy`, pero no ofrece una región `status` persistente para anunciar el estado de espera sin mover el foco.
- Cambio: se incorpora una región `status` de solo lectura visual que anuncia la consulta mientras sigue pendiente y queda vacía al finalizar. No cambia la solicitud a GitHub, el resultado ni el foco.
- Referencia: [WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) cubre estados de espera que deben poder anunciarse sin recibir foco; `role="status"` tiene anuncio cortés implícito.
- Validación focal: `apps/frontend/tests/seccionCuenta.test.tsx -t "anuncia el estado de espera"` 1/1 PASS; TypeScript, ESLint focal, guard WCAG 65/65, auditoría SDD y diff-check PASS.
- Límite: no se realiza auditoría de lector de pantalla ni inspección visual del runtime en esta iteración.

## Instrucción persistente para confirmar contraseña (2026-10-31)

- Hallazgo estático: «Confirmar contraseña» solo ofrecía una descripción cuando ya había un error; al corregirse, el campo quedaba sin la indicación de qué debía repetirse.
- Cambio: la instrucción «Repite la nueva contraseña para confirmar el cambio» permanece visible y asociada; el error de discrepancia se agrega a `aria-describedby` y se retira al corregir, conservando la ayuda.
- Fundamento: [WCAG 2.2 SC 3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) recomienda instrucciones suficientes para saber qué dato introducir y evitar errores; SC 1.3.1 exige que la asociación sea programáticamente determinable.
- Validación focal: `npm -C apps/frontend run test -- tests/seccionCuenta.test.tsx -t "permite cambiar contraseña"` (1 PASS; 27 omitidas por filtro); `npm -C apps/frontend run typecheck` PASS; ESLint focal PASS; `npm run sdd:audit` PASS; `git diff --check` PASS. No se ejecutó guard CSS porque no se modificaron estilos.
- Alcance: no cambian la política de autenticación, el endpoint, el payload ni la persistencia.

## Recuperación focal de lecturas Classroom en Calificaciones (2026-10-31)

- Hallazgo estático: un fallo al consultar estudiantes terminaba junto al estado «No hay estudiantes disponibles»; la consulta de cursos ofrecía volver a cargar la sección sin un control directo y la lectura de actividades no exponía reintento propio.
- Cambio previsto: separar error, carga y vacío confirmado por cada consulta; incluir reintento que repite solo el GET de cursos, roster o actividades.
- Alcance: no repetir preview, sincronización ni otras mutaciones; no cambiar endpoints, permisos ni datos.
- Validación focal: `npm -C apps/frontend run test -- tests/classroomEnCalificaciones.test.tsx` (19/19 PASS); TypeScript, ESLint focal, auditoría SDD y `git diff --check` PASS. No se ejecutó guard CSS porque no cambiaron estilos.
- E2E responsive intentado con fixture dummy; el preview se compiló pero dejó de responder antes del recorrido y el proceso se detuvo sin generar cambios de datos. Se mantiene pendiente capturar la vista actual en runtime.

## Evidencias Classroom: error distinto del vacío (2026-10-31)

- Hallazgo estático: el fallo del GET principal limpiaba evidencias y dejaba visible el mismo conteo 0/0 y el mensaje de lista vacía que una respuesta exitosa sin filas. Sin materia o permiso, los controles de búsqueda y la tabla también podían quedar como un panel vacío.
- Cambio previsto: separar carga, error y vacío confirmado; ofrecer un botón local para repetir solo el GET; ocultar filtros/tabla mientras no exista materia o permiso y mostrar una orientación clara al faltar la materia.
- Fundamento: la interfaz no debe codificar un resultado no confirmado como cero; [WCAG 2.2 SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) cubre los estados de carga y error que deben poder determinarse programáticamente sin trasladar el foco, y el vacío solo se muestra después de una respuesta válida.
- Alcance: no cambiar los filtros, query, datos, permisos de otras funciones ni las operaciones de Classroom.
- Validación focal: `npm -C apps/frontend run test -- tests/classroomEnCalificaciones.test.tsx` (23/23 PASS); `npm -C apps/frontend run typecheck`, ESLint focal, `npm run sdd:audit` y `git diff --check` focal PASS. La auditoría visual actual del runtime sigue pendiente.

## Resultados por alumno: identidad estable de filas (2026-10-31)

- Hallazgo: la tabla usaba la matrícula como `key` de React aunque cada fila recibe `alumnoId`; matrículas repetidas producen claves duplicadas y pueden asociar estado de renderizado a la fila equivocada.
- Cambio: prioriza `alumnoId` como clave interna y conserva un fallback para filas históricas que carezcan de ID. No cambia el texto, orden, selección ni contenido de las filas.
- Validación focal: `seccionCalificaciones.resumen.test.tsx` verifica dos matrículas repetidas con identidades distintas y ausencia de warning; prueba, typecheck, ESLint focal, SDD y diff-check PASS.
- Límite: fixture de interfaz sintético; no se inspeccionó visualmente el runtime instalado.

## Acción explícita en el catálogo vacío de Materias (2026-10-31)

- Hallazgo estático: el catálogo vacío pedía registrar una materia mientras el formulario de alta se mantiene plegado; no nombraba el botón «Registrar materia» disponible en la cabecera.
- Cambio: el texto del estado vacío identifica ese botón como la acción que abre el formulario. No se añade otro control ni se cambia el flujo de alta.
- Validación focal: `seccionPeriodos.edit.test.tsx` 23/23 PASS; typecheck frontend, ESLint focal, guard WCAG (65/65 pares), auditoría SDD y diff-check PASS.
- Límite: mejora de copy verificada en componente; no hubo captura nueva del runtime instalado.

## Descripción precisa de Calificaciones en la navegación (2026-10-31)

- Hallazgo estático: el tooltip de la navegación prometía «alta velocidad» sin una métrica o evidencia asociada y no describía las tareas del módulo.
- Cambio: el tooltip identifica consulta de resultados, captura de calificaciones y revisión de exámenes OMR. Etiqueta visible, navegación y capacidades no cambian.
- Validación focal: `appDocente.secciones.test.tsx` 2/2 PASS; typecheck frontend, ESLint focal, guard WCAG (65/65 pares), auditoría SDD y diff-check PASS.
- Límite: texto y ruta validados en componente; no se obtuvo captura actual del runtime.

## Nombres distinguibles para abrir detalle de alumno (2026-10-31)

- Hallazgo estático: filas de alumnos homónimos exponían botones con el mismo nombre accesible «Ver detalle de [nombre]», por lo que una persona que navega por botones no podía diferenciarlos sin volver a recorrer el contenido de cada fila.
- Cambio: el nombre conserva «Ver detalle» al inicio y añade matrícula y grupo; no expone IDs internos ni modifica texto visible, selección o acciones.
- Fundamento: [WCAG 2.2 SC 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html) exige incluir en el nombre accesible el texto de la etiqueta visible y recomienda iniciar por esa etiqueta. Matrícula y grupo aportan contexto para distinguir filas con el mismo nombre.
- Validación focal: `seccionCalificaciones.resumen.test.tsx` 28/28 PASS, TypeScript, ESLint focal, `npm run sdd:audit` y `git diff --check` focal PASS.
- Límite: el navegador lateral no permitió adquirir la pestaña (`browser.user is unavailable`); no se capturó la vista actual ni se verificó con lector de pantalla.

## Identificación de alumnos en controles de Extraordinarios (2026-10-31)

- Hallazgo estático: además de la casilla del lote, las acciones por alumno («Solicitud docente», «Abrir revisión OMR») y el selector de alumno para resultados externos no incorporaban matrícula/grupo. El historial repetía «Abrir revisión del alumno» sin identificar folio o persona.
- Cambio: se conservaron etiquetas y acciones visibles al inicio de los nombres accesibles; ahora cada control y opción identifica matrícula/grupo y las acciones del historial añaden folio. No cambia selección, elegibilidad ni generación.
- Validación focal: `extraordinariosCalificaciones.test.tsx` 16/16 PASS; TypeScript, ESLint focal, `npm run sdd:audit` y `git diff --check` focal PASS.
- Límite: no se capturó el runtime actual ni se verificó con lector de pantalla.

## Orientación del selector de resultado externo sin alumnos registrables (2026-10-31)

- Hallazgo estático: cuando no había un alumno con solicitud docente elegible, o faltaba permiso, el selector solo mostraba su placeholder y la acción quedaba desactivada sin explicar la causa.
- Cambio: se diferencia falta de solicitud, ausencia de alumnado elegible y falta de permiso; el texto guía al paso disponible junto al selector.
- Validación focal: `extraordinariosCalificaciones.test.tsx` 19/19 PASS; TypeScript, ESLint focal, auditoría SDD y diff-check PASS.
- Límite: sin captura visual actual ni prueba manual con tecnología asistiva.
- Límite: no se obtuvo captura actual ni se probó lector de pantalla por indisponibilidad del conector lateral.

## Búsqueda de estudiantes vinculados en Classroom (2026-11-02)

- Hallazgo visual en la captura sintética actual a 320 CSS px: el placeholder «Nombre, correo o matrícula» se corta por el ancho del campo. El rótulo identifica la búsqueda, pero no queda una ayuda visible que explique los criterios.
- Cambio: placeholder breve «Nombre o matrícula» y ayuda visible asociada mediante `aria-describedby`: «Busca por nombre, correo o matrícula». Se conserva la búsqueda efectiva por nombre, correo y matrícula.
- Validación focal: `classroomEnCalificaciones.test.tsx` 23/23 PASS, incluida descripción accesible y búsqueda por correo; E2E de Classroom 1/1 PASS a 320/390/700 CSS px y escritorio, ambos temas, comprobando descripción, placeholder y ausencia de overflow. Capturas inspeccionadas en `reports/qa/ux-calificaciones-classroom-current-20261102/`.
- Fundamento: [WCAG 2.2 SC 3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) y [WAI Forms: Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/) recomiendan instrucciones visibles y asociadas a los controles, sin sustituir su etiqueta.
- Límite: los datos Classroom son ficticios; no se verificó lector de pantalla, zoom real al 200 %, OAuth ni runtime instalado.

## Selector de portada del alta de Materias en móvil (2026-11-02)

- Hallazgo visual en captura sintética de 320 CSS px: el texto nativo del archivo elegido se recortaba a «Elegir archivo N…» dentro de la tarjeta de portada.
- Cambio: selector nativo superpuesto a un control visual que muestra «Elegir imagen» y el nombre/estado del archivo; el archivo sigue siendo operable por teclado y conserva etiqueta, ayuda, validación y carga vigentes.
- Validación: `seccionPeriodos.edit.test.tsx` 23/23 PASS; E2E Edge sintético 1/1 a 320/390 CSS px verifica geometría, nombre/ayuda, selección con PNG dummy, foco visible por teclado y avance al siguiente campo, en claro/oscuro. Typecheck frontend, ESLint focal, SDD audit y diff-check PASS; el guard WCAG confirma 65/65 pares pero permanece bloqueado por ocho declaraciones de color del login fuera de este cambio.
- Capturas inspeccionadas: `reports/qa/ux-materias-portada-20261102/ux-audit-materias-form-dummy-{320,390}-{light,dark}.png` y `ux-audit-materias-portada-seleccionada-dummy-{320,390}-{light,dark}.png`.
- Límite: prueba con preview sintético; siguen pendientes runtime instalado, zoom de texto al 200 % y lector de pantalla.

## Buzón de revisión OMR: búsqueda y conteos en móvil (2026-11-02)

- Hallazgo visual a 320 CSS px: las etiquetas de conteo podían separarse del valor y el placeholder largo se truncaba.
- Cambio: cada conteo fluye como ficha indivisible; el placeholder ahora es breve y la ayuda visible/asociada conserva los criterios de búsqueda efectivos. Sin cambios en filtros ni datos.
- Validación: el E2E Edge sintético 1/1 previo verificó el nombre/descripción de búsqueda, contención de las tres fichas y ausencia de solapamiento a 320/390 CSS px en claro/oscuro.
- Capturas inspeccionadas: `reports/qa/ux-calif-detail-nav-20261102/ux-audit-calificaciones-solicitudes-{320,390}-{light,dark}.png`.
- Límite: fixture ficticio; sin runtime instalado, zoom manual al 200 % ni lector de pantalla.

## Recuperación de búsqueda vacía en evidencias Classroom (2026-11-02)

- Hallazgo estático: cuando había evidencias cargadas pero ninguna coincidía con la búsqueda,
  la tabla explicaba el resultado sin una acción visible para volver a la lista completa.
- Cambio: el estado se identifica como `status` y ofrece «Limpiar búsqueda». La acción solo
  restablece el término local; conserva el curso seleccionado y no repite consultas ni escrituras.
- Fundamento: WCAG 2.2 SC 4.1.3 cubre anuncios programáticos de mensajes de estado como «No
  hay resultados» cuando el contenido cambia sin mover el foco y aconseja no interrumpir
  innecesariamente la tarea. [W3C: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- Validación focal: `npm -C apps/frontend run test -- tests/classroomEnCalificaciones.test.tsx`
  (23/23 PASS); typecheck frontend, ESLint focal, guard WCAG (69/69 pares), auditoría SDD y
  `git diff --check` PASS. La prueba verifica búsqueda sin coincidencias, estado accesible,
  recuperación con una sola acción, conservación del curso y ausencia de un nuevo GET.
- Límite: evidencia de componente con datos dummy; captura del runtime y lector de pantalla
  siguen pendientes.

## Reintento local de capturas del historial Classroom (2026-11-02)

- Hallazgo estático: al fallar una ficha de una página posterior, el texto recomendaba volver a
  consultar el historial desde un control superior que solo cargaba la primera página; la ficha
  fallida no tenía una acción propia. Además, todas las imágenes compartían el mismo texto alternativo.
- Cambio: cada ficha permite volver a descargar solo su imagen, anuncia el estado sin alertas
  intrusivas, conserva las demás capturas y usa un texto alternativo que distingue promedio,
  alumno, parcial y fecha. Las respuestas tardías se descartan al cambiar consulta.
- Validación focal: prueba de paginación confirma que el GET de historial no se repite, la primera
  URL blob permanece y las dos fichas se exponen con nombres distintos. Suite Classroom y
  guardrails focales ejecutados para esta iteración.
- Límite: componente con datos dummy; no se capturó el runtime ni se probó con lector de pantalla.

## Claridad del historial de promedios Classroom (2026-11-02)

- Hallazgo estático: la explicación y el estado vacío usaban el término interno «snapshot»; la ficha agrupaba puntos obtenidos/posibles y detalles WebP, KiB y hash en el mismo texto, aunque esos metadatos no son necesarios para la consulta habitual.
- Cambio: la ficha usa «registro del promedio», expresa los puntos como «X de Y» y conserva los datos técnicos en una divulgación nativa llamada «Detalles técnicos de la captura».
- Fundamento: W3C WAI recomienda lenguaje claro, palabras comunes y retirar o explicar la jerga no necesaria: https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p01-clear-words/.
- Contrato: no cambian las imágenes, el hash SHA-256, su tamaño, las calificaciones ni los datos consultados; solo cambia la presentación y el acceso opcional a metadatos.
- Validación focal: `classroomEnCalificaciones.test.tsx` verifica el resumen claro, el estado vacío, el acceso por teclado a detalles técnicos y la conservación del hash/formatos.

## Etiqueta válida en el secreto del reporte individual (2026-11-03)

- Hallazgo estático: el `<label>` del secreto maestro contenía también un bloque `<div>` con el mensaje de error. El estándar HTML restringe el contenido de `label` a contenido de frase y requiere asociar el control etiquetado sin descendientes de etiqueta adicionales.
- Cambio: el campo ahora usa un `label[for]` explícito y mantiene la ayuda y el error como elementos hermanos vinculados mediante `aria-describedby`; validación, foco de error y generación no cambian.
- Fundamento: [WHATWG HTML, elemento `label`](https://html.spec.whatwg.org/multipage/forms.html#the-label-element) y [W3C WCAG 2.2, etiquetas e instrucciones](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions).
- Validación focal: `seccionCalificaciones.routing.test.tsx` 25/25 PASS; E2E visual sintético 1/1 PASS a 320/390 CSS px y escritorio; TypeScript, ESLint de los archivos tocados, `npm run sdd:audit` y `git diff --check` PASS. La prueba verifica asociación explícita y que el aviso no esté dentro de la etiqueta. Capturas inspeccionadas en `reports/qa/ux-calificaciones-reportes-20261103/`.
- Alcance de evidencia: no cambió la presentación visual; siguen sin verificarse lector de pantalla y runtime instalado.

## Tooltip que cubría el recordatorio en Materias móvil (2026-11-03)

- Hallazgo visual: al llegar con Tab al botón de cierre, la capa global convertía su `aria-label` en un tooltip de 180 px. En 320/390 CSS px la burbuja quedaba encima del mensaje que el mismo control cierra.
- Cambio: el botón conserva el nombre accesible mediante texto `sr-only` y oculta la «×» decorativa; al coincidir el texto del botón con su nombre, se suprime el tooltip redundante y el mensaje queda visible.
- Contrato: conserva botón, orden de foco, acción de cierre, tamaño táctil, nombre accesible y contenido del recordatorio.
- Validación focal: E2E Edge sintético 1/1 PASS a 320/390 CSS px y ambos temas; comprueba el nombre del botón, foco por Tab, ausencia del tooltip superpuesto y geometría del aviso. TypeScript, ESLint focal, auditoría SDD y `git diff --check` PASS. Capturas posteriores inspeccionadas en `reports/qa/ux-materias-tooltip-20261103/`.
- Límite: interacción con fixture ficticio; no se probó lector de pantalla ni runtime instalado.

## Materias · orientación y legibilidad del alta deshabilitada (2026-11-03)

- Hallazgo visual: el botón «Crear materia» podía estar deshabilitado sin indicar qué faltaba; su etiqueta heredaba colores de la acción primaria y la opacidad global la debilitaba.
- Cambio: la ayuda visible queda junto al botón y vinculada con `aria-describedby`; se conserva `disabled` nativo y validación vigente. Las acciones deshabilitadas del flavor docente usan superficies sólidas y tokens de tema legibles, sin afectar su activación. En el formulario móvil, la ayuda aparece encima del botón.
- Validación: `seccionPeriodos.edit.test.tsx` 24/24 PASS; E2E Edge sintético 1/1 PASS a 320/390 CSS px, ambos temas, verifica `aria-describedby`, contraste de etiqueta, disposición del mensaje, ausencia de overflow y estado nativo. La medición espera el fin de la transición CSS para leer los colores finales.
- Capturas actuales inspeccionadas: `reports/qa/ux-materias-disabled-cta-20261103/ux-audit-materias-form-dummy-{320,390}-{light,dark}.png`.
- Límite: fixture docente ficticio; no se probó runtime instalado, lector de pantalla ni zoom real al 200 %.

## Calificaciones · divulgación progresiva de la guía OMR en móvil (2026-11-03)

- Hallazgo visual: a 320 CSS px, la guía de tres pasos se mostraba expandida antes de los controles de captura y alargaba considerablemente el recorrido vertical de una sección operativa.
- Cambio: sin preferencia guardada, la guía empieza plegada hasta 700 CSS px y abierta en escritorio. Se conserva la elección explícita; un mismo control estable permite abrir/cerrar con teclado, mantiene el foco y expone `aria-expanded`.
- Fundamento: WAI-ARIA APG define el patrón de divulgación mediante un botón que conserva foco y estado expandido; WAI describe la divulgación progresiva como forma de limitar información no necesaria para la tarea inmediata. Referencias: [WAI-ARIA APG: Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/), [WAI: Presentation—distinguishing and understanding](https://www.w3.org/WAI/people-use-web/tools-techniques/presentation/).
- Validación focal: `guiaCalificacionesVisual.test.tsx` 2/2 PASS; E2E Edge `captura Resultados sin materia y con registros sintéticos` 1/1 PASS a 320/390 CSS px, en claro/oscuro. Verifica estado inicial, `aria-expanded`, apertura/cierre con teclado, conservación de foco, preferencia explícita y que el distintivo plegado no quede visible. Capturas inspeccionadas en `reports/qa/ux-calificaciones-omr-guide-20261103/`.
- Límite: contenido de OMR y datos de prueba sintéticos; no se verificó el runtime instalado, lector de pantalla ni zoom real al 200 %.

## Orientación para acciones de análisis OMR deshabilitadas (2026-11-03)

- Hallazgo estático: «Analizar página» y «Analizar lote» aparecían inactivos cuando faltaba el archivo o el permiso, pero no explicaban la causa ni la acción siguiente.
- Cambio: cada estado vacío muestra la instrucción correspondiente y la asocia al botón; los estados por falta de permiso indican a quién solicitarlo. Se preservan validaciones, permisos y el atributo nativo `disabled`; los avisos existentes de carga y calidad no se duplican.
- Fundamento: WCAG 2.2 SC 3.3.2 exige instrucciones identificables; USWDS recomienda explicar con ayuda contextual por qué una acción está deshabilitada.
- Validación focal: `escaneo.refactor.test.tsx` 17/17; E2E Edge sintético 1/1 a 320/390 CSS px en claro/oscuro verifica ayuda, `aria-describedby`, estado nativo y contraste de 4.5:1 o mayor. TypeScript, ESLint focal y auditoría SDD PASS. El guard WCAG confirma 69/69 pares de contraste, pero termina con error por seis colores crudos en KPI de Banco (`screens.css:7402,7405-7409`), ajenos a REQ-002AL.
- Capturas de captura individual y lote inspeccionadas en `reports/qa/ux-calificaciones-omr-disabled-action-20261103/`.
- Límite: datos sintéticos; no se probó el runtime instalado, un lector de pantalla ni el zoom real al 200 %.

## Feedback contextual en Cuenta (2026-11-03)

- Hallazgo estático: varios flujos de Cuenta colocaban éxito/error en un único `InlineMensaje` al final de la pantalla, lejos de botones intermedios de Perfil, Seguridad, PDF, Retención y Accesos directos.
- Cambio: cada resultado se renderiza dentro del panel que originó la acción; la región conserva `status`/`alert`, no duplica toasts y no mueve el foco. Los enlaces de actualización siguen usando su resultado local; la Papelera conserva la recuperación junto a su lista.
- Validación focal: `npm -C apps/frontend run test -- tests/seccionCuenta.test.tsx` 28/28 PASS; typecheck frontend, ESLint focal, `npm run sdd:audit` y `git diff --check` PASS (Git informa normalización CRLF→LF del spec).
- Límite: prueba de componentes; la automatización del navegador lateral sigue indisponible y no se capturó un runtime visual actual.

## Estado de error explícito en el selector manual de Calificaciones (2026-11-03)

- Hallazgo estático: cuando fallaba la lectura de exámenes, el selector mostraba «0 disponibles» y «0 coincidencias», confundiendo el error con una consulta exitosa sin resultados; además exponía el mensaje técnico de la excepción.
- Cambio: el error ahora explica que la lista no está disponible, oculta conteos, deshabilita búsqueda/selección y mantiene el botón de reintento. La recuperación repite la consulta existente; no cambia API ni escrituras.
- Validación: `npm -C apps/frontend run test -- tests/seccionCalificaciones.manualSelector.test.tsx` (5/5 PASS); `npm -C apps/frontend run typecheck`, ESLint focal, `npm run sdd:audit` y `git diff --check` PASS.
- Límite: la verificación visual instalada, el lector de pantalla y el zoom al 200 % permanecen pendientes.

## Búsqueda sin tildes en Resultados de Calificaciones (2026-11-03)

- Hallazgo estático: el filtro de Resultados comparaba nombres, matrícula y grupo usando solo minúsculas; «perez» no coincidía con «Pérez», a diferencia de la búsqueda de Alumnos y Classroom.
- Cambio: se normaliza el texto de búsqueda y los campos de comparación con `es-MX`, NFD y eliminación de diacríticos. Las etiquetas y valores originales se conservan.
- Validación: `npm -C apps/frontend run test -- tests/seccionCalificaciones.resumen.test.tsx` (29/29 PASS); `npm -C apps/frontend run typecheck`, ESLint focal, `npm run sdd:audit` y `git diff --check` PASS.
- Límite: validación focal automatizada; runtime visual, lector de pantalla y zoom al 200 % pendientes.

## Orden numérico de notas disponibles en Resultados (2026-11-03)

- Hallazgo estático: las notas vacías se convertían en `-1` durante la comparación; al ordenar de menor a mayor, los alumnos sin nota aparecían antes que quienes sí tenían calificación.
- Cambio: las notas ausentes ahora quedan al final en ambos sentidos y solo las notas disponibles participan en la comparación numérica. La ausencia permanece vacía; no se convierte en cero ni cambia cálculos.
- Validación: `npm -C apps/frontend run test -- tests/seccionCalificaciones.resumen.test.tsx` (29/29 PASS); `npm -C apps/frontend run typecheck`, ESLint focal, `npm run sdd:audit` y `git diff --check` PASS.
- Límite: prueba sintética de orden; no verifica runtime visual, lector de pantalla ni zoom al 200 %.

## Estado claro de notas parciales en Resultados (2026-11-03)

- Hallazgo estático: `tieneCalificacion` considera calificada una fila con cualquier nota de parcial/global/final, pero la interfaz mostraba «Calificada» y «Pendiente», lo que podía leerse como estado final del alumno.
- Cambio: los KPI, filtros, ordenamiento por estado, tabla y detalle describen si existe alguna calificación registrada («Con calificación»/«Sin calificación»). La regla de clasificación y los datos internos permanecen iguales.
- Validación: pruebas focales combinadas de `seccionCalificaciones.resumen.test.tsx` y `seccionCalificaciones.routing.test.tsx` 55/55 PASS; E2E Edge 1/1 a 320/390 CSS px en claro/oscuro con fixture ficticio; typecheck, ESLint focal, `sdd:audit`, `guard:wcag -- --skip-lint` (69/69 pares) y `git diff --check` PASS. La inspección de capturas confirma que las etiquetas completas caben a 320 px y se mantienen alineadas entre encabezado, filtros y fila.
- Límite: no hubo acceso a la pestaña lateral (`browser.user is unavailable`); capturas generadas con fixture sintético, no runtime instalado. Lector de pantalla y zoom al 200 % pendientes.

## Umbral legible en Extraordinarios (2026-11-03)

- Hallazgo: «Final exacta», «Acta», «Elegible · < 6» y «final exacta vigente» requerían interpretar jerga/símbolos y no explicaban que el dato para acta se calcula por separado.
- Cambio: etiquetas «Final del curso»/«Final para acta», estado «Elegible»/«No elegible» y ayuda breve en Extraordinarios y detalle de Resultados. No cambia la condición decimal `< 6`, el redondeo del acta, los valores, permisos ni payloads.
- Validación: `extraordinariosCalificaciones.test.tsx` + `seccionCalificaciones.resumen.test.tsx` (48/48 PASS); `responsive-docente.spec.ts` (E2E Edge 1/1 PASS, 320/390 CSS px, claro/oscuro); typecheck PASS. Capturas inspeccionadas en `reports/qa/ux-extraordinarios-clarity-20261103/`.
- Límite: copy basado en el cálculo vigente de servidor (`calificacionFinalCurso < 6`); las capturas usan fixture sintético. No validan la instalación runtime, zoom real al 200 % ni lector de pantalla.
- Seguimiento: se evitó repetir en la ayuda de la lista el umbral que ya aparece en la introducción; la ayuda del detalle conserva el requisito `< 6` junto a la solicitud.

## Selección visible para generar lote extraordinario (2026-11-03)

- Hallazgo visual: la casilla para incluir a una persona en el lote no tenía texto junto al control; el contador no señalaba qué acción lo modifica.
- Cambio: etiqueta visible y clicable «Incluir en el lote», identidad completa en el nombre accesible y objetivo interactivo de 44 CSS px, con indicador de foco basado en el acento de tema. No cambia elegibilidad, selección local, generación ni payload.
- Validación: pruebas focales de `extraordinariosCalificaciones.test.tsx` + `seccionCalificaciones.resumen.test.tsx` (48/48 PASS); E2E Edge 1/1 comprueba clic en etiqueta, nombre accesible y altura mínima; 320/390 CSS px en claro/oscuro. Typecheck, ESLint focal, guard WCAG (69/69 pares y guard PASS), SDD audit y diff-check PASS.
- Capturas inspeccionadas: `reports/qa/ux-extraordinarios-clarity-20261103/`.
- Límite: fixture sintético; la instalación runtime, lector de pantalla y zoom real al 200 % siguen pendientes.

## Placeholder del nombre completo en Materias móvil (2026-11-03)

- **Hallazgo visual:** el placeholder largo del campo «Nombre de la materia» se cortaba dentro del input a 320 CSS px, como muestran las capturas de `reports/qa/ux-materias-disabled-cta-20261103/`.
- **Cambio:** se acortó el ejemplo a «Ej. Álgebra». La etiqueta «Nombre de la materia», instrucciones, validación y payload no cambian.
- **Fundamento:** W3C WAI recomienda instrucciones y ejemplos suficientes para indicar el dato esperado, manteniendo etiquetas asociadas y evitando información innecesaria; el placeholder sigue siendo una pista y no reemplaza la etiqueta ([Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions), [Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/)).
- **Validación focal:** E2E Edge sintético `audita Materias activas y archivadas con catálogo ficticio` 1/1 PASS; mide el texto del placeholder frente al ancho útil del input a 320/390 CSS px y genera capturas en ambos temas. Typecheck, ESLint focal, guard WCAG (69/69 pares), auditoría SDD y diff check PASS.
- **Límite:** fixture ficticio, no instalación runtime; zoom manual al 200 % y lector de pantalla continúan pendientes.

## Resultados · consulta identificada en el estado sin coincidencias (2026-11-03)

- Hallazgo: el mensaje decía que ningún alumno coincidía con «los filtros aplicados», pero no mostraba el término consultado.
- Cambio: el estado accesible incluye la búsqueda y aclara que se evalúa con los filtros vigentes. «Limpiar búsqueda» elimina solo esa consulta; las demás selecciones se conservan.
- Fundamento: W3C explica que un mensaje como «No results returned» puede ser un mensaje de estado cuando los resultados cambian sin mover el foco; `InlineMensaje` ya comunica ese cambio con `role="status"` ([W3C WCAG 2.2 SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).
- Validación focal: `seccionCalificaciones.resumen.test.tsx` 29/29 PASS; E2E Edge sintético 1/1 a 320/390 CSS px, claro/oscuro, verifica texto `status`, ausencia de overflow, filtro independiente y recuperación. Capturas inspeccionadas en `reports/qa/ux-calificaciones-empty-query-20261103/`.
- Contratos: no cambia la búsqueda, los filtros, la consulta al servidor ni los datos.

## Cuenta · resumen móvil compacto sin palabras partidas (2026-11-03)

- Hallazgo visual: a 320 CSS px, los cinco indicadores informativos se apilaban en una tarjeta por fila, retrasando el acceso a los bloques de Cuenta; esos indicadores no son controles ni requieren una columna completa.
- Cambio: los primeros cuatro indicadores fluyen en dos columnas y el quinto usa el ancho completo. El valor tipográfico se ajusta levemente para evitar dividir «Predeterminado»; se conserva el orden, color, iconografía, contenido y etiquetas.
- Fundamento: W3C permite adaptar o recolocar contenido de aplicaciones para que quepa en 320 CSS px, siempre que no se pierda información/función ni se requiera desplazamiento bidimensional ([WCAG 2.2 SC 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)).
- Validación: E2E Edge sintético 1/1 a 320/360/390/640 CSS px y 1024 px; a 320 verifica la cuadrícula, última fila, altura máxima de 270 CSS px, texto y palabras sin desborde, en claro/oscuro. Capturas inspeccionadas en `reports/qa/ux-cuenta-summary-compact-20261103/`.
- Contratos: no cambia perfil, datos, permisos ni acciones.

## Cuenta · estado explícito de carpeta de sincronización sin guardar (2026-11-03)

- Hallazgo: al escribir una ruta nueva, la tarjeta seguía indicando «Sin configurar»; al editar una ruta ya activa, el estado podía seguir mostrando «Configurada», sin diferenciar el borrador del valor persistido.
- Cambio: el estado muestra «Ruta sin guardar» para una carpeta nueva y «Cambios sin guardar» al editar una ruta activa. Al revertir la edición, vuelve a «Configurada»; el resumen conserva la carpeta activa hasta que el guardado termine. El indicador es `role="status"` y no mueve el foco.
- Validación focal: `sincronizacion.behavior.test.tsx` 11/11 PASS; E2E Edge de Cuenta con perfil ficticio 1/1 PASS a 320/360/390/640 CSS px y escritorio 1024 px, ambos temas. Las capturas claro/oscuro a 320 px se inspeccionaron en `reports/qa/ux-cuenta-unsaved-path-20261103/`. Typecheck, ESLint focal, auditoría SDD y `git diff --check` PASS.
- Contratos: no cambia los endpoints, el guardado, el directorio persistido ni los payloads.

## Materias · opcionalidad explícita de grupos (2026-11-03)

- Hallazgo visual: en alta, la tarjeta introductoria decía que los grupos eran opcionales, pero el campo no lo indicaba y la ayuda repetía el ejemplo que ya estaba en el placeholder. En edición, la etiqueta tampoco señalaba que el campo podía quedar vacío.
- Cambio: alta y edición identifican «Grupos asignados (opcional)». La ayuda de alta queda en «Separa varios grupos con comas» y la de edición añade que puede dejarse vacío; ambas quedan asociadas al control. No cambia la validación, el valor vacío ni el payload.
- Fundamento: WCAG 2.2 SC 3.3.2 requiere que etiquetas/instrucciones expliquen los datos que deben ingresarse ([W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)).
- Validación focal: `seccionPeriodos.edit.test.tsx` 24/24 PASS; E2E Edge sintético de Materias 1/1 PASS a 320/390 CSS px, claro/oscuro. Capturas de alta y edición inspeccionadas en `reports/qa/ux-materias-current-20261103/`. Typecheck y ESLint focal PASS. `guard:wcag` revisó contraste sin anunciar pares fallidos, pero terminó con error por ocho declaraciones de color existentes en `screens.css:7286,7293-7294,9335-9337,9346-9347`, ajenas a Materias y sin cambios en esta edición.


## Cuenta · instrucciones breves para recuperar el acceso (2026-11-03)

- Hallazgo: el aviso para una cuenta sin contraseña local ni Google vinculado era largo y repetía la causa antes de indicar a quién acudir.
- Cambio: el aviso empieza por lo que falta para confirmar el cambio de contraseña, nombra ambos métodos y termina con el siguiente paso: pedir a quien administra EvaluaPro que revise el acceso.
- Validación focal: `seccionCuenta.test.tsx` verifica el texto y que no aparezca un formulario de cambio que no se puede completar.
- Contratos: no cambia los métodos de autenticación, la disponibilidad del formulario ni la recuperación de cuenta.

## Classroom · consulta del historial del promedio (2026-11-03)

- Hallazgo: elegir alumno mostraba «No hay registros» antes de consultar; un fallo de red también podía aparecer junto al estado vacío. Al cambiar la materia podían permanecer seleccionados el alumno, el parcial y el resultado de la materia previa.
- Cambio: el vacío se muestra solo tras una respuesta exitosa. El error tiene estado local en el panel, reemplaza el falso vacío y se limpia al cambiar los filtros. Cambiar materia invalida la solicitud pendiente y limpia alumno, parcial, páginas e imágenes locales previas.
- Fundamento: WCAG 2.2 SC 4.1.3 distingue los estados de operación que deben anunciarse sin mover el foco; el patrón de consulta diferencia carga, error y resultado vacío.
- Validación focal: `classroomEnCalificaciones.test.tsx` prueba vacío confirmado, error sin falso vacío, limpieza al cambiar parcial y descarte al cambiar materia; ejecución actual: 26/26 PASS. Typecheck, ESLint focal, guard WCAG, auditoría SDD y diff-check PASS.
- Contratos: no cambia endpoints, permisos, datos ni payloads; las consultas siguen siendo de lectura.

## Classroom · errores parciales de actividades (2026-11-03)

- Hallazgo estático: las consultas parciales mostraban al docente el nombre interno del recurso y el código de backend sin explicar el siguiente paso.
- Cambio: cada error identifica el curso, actividades o temas en lenguaje claro y ofrece orientación según la causa conocida; los códigos quedan en un desplegable técnico cerrado inicialmente. Los datos parciales se conservan.
- Validación focal: `classroomEnCalificaciones.test.tsx`, typecheck, ESLint focal, auditoría SDD y `git diff --check`.
- Contratos: no cambia endpoint, permisos, datos, calificaciones ni acciones; la consulta sigue siendo de lectura.

## Calificaciones · páginas adicionales en selección manual (2026-11-03)

- Hallazgo: el selector pedía 200 exámenes, pero el endpoint devuelve `nextCursor` cuando hay más; el componente ignoraba ese cursor y la búsqueda local no podía encontrar folios de páginas posteriores.
- Cambio: el docente puede cargar páginas adicionales mediante el mismo GET; el conteo describe los exámenes cargados, la búsqueda se amplía y un fallo de una página conserva lo ya visible y permite reintentar.
- Fundamento: el contrato actual de `GET /examenes/generados` ya ofrece paginación por cursor y límite máximo de 200. Se usa para recuperar el conjunto completo bajo demanda, sin descargarlo todo al seleccionar un alumno.
- Validación focal: `seccionCalificaciones.manualSelector.test.tsx` 6/6 PASS; typecheck y ESLint focal PASS; `guard:wcag` 71/71 pares PASS; `sdd:audit` y `git diff --check` PASS.
- Límite: no se capturó el flujo en runtime; la ventana disponible permanecía en Login y no se proporcionó una sesión ficticia para entrar a Calificaciones.
- Contratos: no cambia ruta, parámetros existentes, permisos, cálculo de calificaciones ni escrituras.

## Calificaciones · enlace a actividad Classroom (2026-11-03)

- Hallazgo visual: «Abrir actividad» usaba el color predeterminado del navegador y no
  seguía la paleta docente; su aspecto variaba según el tema y el historial del enlace.
- Cambio: el enlace conserva el subrayado como señal independiente del color, ahora usa
  colores explícitos por tema y mantiene el mismo tratamiento al visitarlo. El hover
  conserva contraste AA.
- Fundamento: [WCAG 2.2 SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
  pide que el color no sea la única señal visual para distinguir un enlace; el subrayado
  se conserva. [SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
  requiere contraste de texto mínimo de 4.5:1 en este tamaño.
- Validación focal: E2E sintético `audita Classroom dentro de Calificaciones con datos
  sintéticos` 1/1 PASS; verifica navegación segura, subrayado y contraste de enlace y
  hover a 320/390/700 CSS px, claro/oscuro. Capturas inspeccionadas en
  `reports/qa/ux-classroom-grades-link-final-20261103/`.
- Contratos: no cambian el destino HTTPS, `target`, `rel`, permisos ni consulta de datos.

## Calificaciones · estado de error de evidencias Classroom (2026-11-03)

- Brecha de evidencia: la cobertura automatizada comprobaba que el fallo GET no se confundiera con una lista vacía, pero no capturaba la presentación responsive del error ni su recuperación en navegador.
- Cambio: una falla de red que el cliente resumía como «Sin conexión» ahora identifica que no se pudo consultar la lista de evidencias de la materia e indica revisar la conexión con EvaluaPro.
- Validación añadida: el E2E usa una falla de red sintética y comprueba ausencia de conteos/tabla/vacío falso, alerta accesible, foco en el reintento, recuperación por teclado con `Enter` y GET exitoso. Verifica overflow y guarda capturas a 320/390 CSS px, temas claro y oscuro.
- Resultado: `classroomEnCalificaciones.test.tsx` 26/26 PASS; E2E `audita Classroom dentro de Calificaciones con datos sintéticos` 1/1 PASS en Edge sobre servidor aislado (`4204`). Typecheck, ESLint focal, SDD, `git diff --check` y guard WCAG 71/71 pares PASS. Capturas `test-results/ux-audit-classroom-evidencias-error-{320,390}-{light,dark}.png` inspeccionadas.
- Contratos: no cambia endpoint, permisos, consultas ni escrituras; el reintento sigue siendo GET-only.

## Calificaciones · reintento del selector manual con lenguaje directo (2026-11-03)

- Hallazgo estático: la alerta del selector manual recomendaba «revisar el servicio local»,
  un término técnico sin acción clara para el docente, aunque el botón de reintento estaba disponible.
- Cambio: la alerta ahora nombra directamente «Reintentar carga de exámenes» y explica que
  vuelve a consultar la lista. La consulta y su acción GET no cambian.
- Validación focal: `npm test -- seccionCalificaciones.manualSelector.test.tsx` (6/6 PASS),
  ESLint focal, `git diff --check` PASS (Git reportó normalización CRLF→LF del spec) y
  auditoría SDD PASS.

## Navegación docente · salto al contenido principal (2026-11-03)

- Hallazgo: las pantallas docentes repetían cabecera y navegación de sección sin un control
  para que quien navega con teclado llegara directamente a la vista activa. La aplicación ya cuenta con
  el landmark `<main>` exterior, por lo que el destino usa el contenedor de vista, sin anidar
  otro landmark principal.
- Cambio: se incorporó el enlace «Saltar al contenido principal» como primer control del shell;
  aparece al enfocar, dirige al contenedor situado tras las pestañas y muestra foco visible.
- Validación: `appDocente.secciones.test.tsx` 2/2 PASS; Playwright Edge 1/1 con perfiles/API
  ficticios a 320 CSS px, ambos temas. El test verifica orden de Tab, foco tras Enter, un solo
  landmark principal, texto ≥4.5:1 e indicador de foco ≥3:1. Capturas inspeccionadas en
  `reports/qa/ux-docente-skip-main-20261103/`. Typecheck, ESLint focal y auditoría SDD PASS.
- `guard:wcag` reportó 71/71 pares correctos, pero al inicio falló por los fallbacks de color
  crudo del filtro de Temarios, ajenos al enlace. Se quitaron esos fallbacks porque los tokens
  `--surface-2` y `--surface-border-strong` están definidos en ambos temas; el guard volvió a
  pasar con 71/71 pares.
- Límite: no se verificó la instalación local, el lector de pantalla ni zoom real al 200 %.

## Calificar examen · ayuda sin identificadores internos (2026-11-03)

- Hallazgo de código: la ayuda mostraba `requiere_revision`, un nombre interno del estado, en
  vez de expresar qué debe hacer el docente.
- Cambio: el texto indica confirmar las respuestas detectadas cuando se requiere revisión OMR.
  No se modifican las reglas, los cálculos ni la acción de guardado.
- Validación: `seccionCalificar.test.tsx` 6/6 PASS; la prueba conserva el modo de solo lectura,
  comprueba la instrucción nueva y protege que el enum no aparezca en la interfaz. Revisión
  estática; no hubo captura actual porque la pestaña lateral no se pudo enlazar.

## Calificaciones · selector vacío de exámenes revisados (2026-11-03)

- Hallazgo visual a 320 CSS px: el selector deshabilitado repetía «Exámenes revisados/calificados» en su valor y el texto se recortaba.
- Cambio: el valor vacío pasa a «No hay exámenes», manteniendo la etiqueta completa y el mismo estado/permiso del selector.
- Validación: Playwright Edge sintético 1/1 a 320/390 CSS px en claro/oscuro; la aserción comprueba el texto vacío y las capturas muestran el estado completo. TypeScript frontend, ESLint focal, contraste 73/73, SDD y `git diff --check` PASS. No cambia endpoints, cálculos, permisos ni datos.

## Calificaciones · identidad completa del alumno seleccionado (2026-11-03)

- Hallazgo: el valor de un `<select>` nativo puede recortarse en pantallas estrechas y ocultar parte del nombre del alumno.
- Cambio: se presenta bajo el selector la matrícula, nombre y contexto ya usados en la opción; `aria-describedby` asocia el resumen al control sin incorporarlo a su nombre accesible. Se conserva la clave interna seleccionada y el flujo de consulta.
- Validación: componente focal y E2E responsive sintético a 320/390 CSS px en ambos temas; cobertura del nombre completo y de la relación accesible. Sin modificación de API ni datos.

## Cuenta · fila equilibrada en accesos rápidos móviles (2026-11-03)

- **REQ-003T:** En la navegación directa de Cuenta, el último enlace ocupa la fila completa cuando el diseño móvil usa dos columnas; el orden, destinos, acceso por teclado y presentación de escritorio permanecen iguales.
- Hallazgo visual: siete enlaces en dos columnas dejaban el último control aislado en media fila a 320–640 CSS px.
- Cambio: el último enlace ocupa ambas columnas hasta 720 CSS px, ampliando su área de activación y equilibrando la cuadrícula.
- Validación focal: Playwright Edge 1/1 PASS con perfil y APIs ficticios en 320/360/390/640 CSS px, ambos temas; comprobación del `grid-column` del último enlace y ausencia de overflow. Capturas reinspeccionadas en `reports/qa/ux-cuenta-current-goal-20261103/`. No cambia contenido, permisos ni destinos.

## Cuenta · recuperación de foto vinculada que no carga (2026-11-03)

- Hallazgo estático: si fallaba la imagen remota de la cuenta, la vista regresaba al avatar genérico y ocultaba la acción para seleccionar la foto local de respaldo.
- Cambio: al detectar ese error, se muestra una instrucción clara y se permite elegir o cambiar la foto local; la copia señala que se guarda en el equipo y no se envía al servidor. Si cambia el docente o la URL de su foto, se reinicia el estado de fallo y se vuelve a cargar la foto local asociada a esa identidad.
- Validación focal: `npm -C apps/frontend run test -- tests/seccionCuenta.test.tsx` (30/30 PASS), ESLint focal, typecheck del frontend, auditoría SDD y `git diff --check` PASS. Las pruebas cubren el fallo, el respaldo local visible, que no se invoque la API y la separación de fotos al cambiar de identidad.
- Límite: el navegador lateral no pudo enlazarse (`browser.user is unavailable`); el cambio requiere inspección visual posterior en runtime.

## Cuenta · visibilidad de contraseñas de seguridad (2026-11-03)

- Hallazgo estático: los tres campos de cambio de contraseña permanecían ocultos mientras que el acceso docente ya contaba con una acción para mostrarlos; esto dificultaba revisar errores de escritura.
- Cambio: se añadió alternancia independiente por campo, con nombres accesibles diferenciados, estado `aria-pressed`, relación `aria-controls` y foco visible. Las acciones no envían el formulario y no cambian los valores ni la validación.
- Referencia: WAI-ARIA APG recomienda exponer el estado de un botón alternable con `aria-pressed` y mantener estable su etiqueta accesible.
- Validación focal: `npm -C apps/frontend run test -- tests/seccionCuenta.test.tsx` (31/31 PASS), typecheck frontend, ESLint focal, guard WCAG, auditoría SDD y `git diff --check` PASS.
- Límite: la pestaña integrada sigue sin ser enlazable desde la herramienta; no hay inspección de runtime.

## Cuenta · resultado fiable de la Papelera ante error de carga (2026-11-03)

- Hallazgo estático: la Papelera iniciaba con lista vacía y mostraba «No hay elementos» al fallar la primera consulta; el contador también mostraba cero sin respuesta válida. Una actualización posterior fallida no identificaba claramente que los resultados previos eran datos conservados.
- Cambio: se distingue carga, error, vacío confirmado y última carga disponible. El error inicial muestra «No disponible», y solo una respuesta exitosa vacía permite afirmar que la Papelera no tiene elementos. Ante fallo de actualización, se conservan los datos previos y se identifican como última carga.
- Validación focal: `npm -C apps/frontend run test -- tests/seccionCuenta.test.tsx` (33/33 PASS), typecheck frontend, ESLint focal, WCAG 73/73, `npm run sdd:audit` y `git diff --check` PASS.
- Contratos: endpoint, permisos, límite consultado, datos y acción de restaurar permanecen iguales.
- Límite: las pruebas son de componente; esta tanda no reabrió el runtime visual ni una tecnología asistiva.

## Cuenta · auditoría visual actual y recorrido de contraseña (2026-11-03)

- Revisión sintética Edge de Perfil, accesos rápidos, carpeta de sincronización, Seguridad, PDF institucional, Retención, Actualizaciones y Accesos directos. Se inspeccionaron las capturas actuales de 320 px claro/oscuro, la tarjeta compacta de navegación a 1024 px, seguridad a 640 px y el estado sin método de reautenticación. No se detectó recorte o desbordamiento nuevo en esta muestra.
- Hallazgo en la cobertura: el E2E buscaba el campo «Contraseña actual» por etiqueta parcial, que también coincidía con su botón «Mostrar contraseña actual», y esperaba que Tab saltara desde Confirmar contraseña directamente al botón Guardar.
- Cambio de prueba: usar el rol `textbox` para seleccionar el campo y comprobar el orden real Confirmar contraseña → Mostrar confirmación de contraseña → Guardar contraseña. El comportamiento de la interfaz no cambia.
- Validación focal: `audita Cuenta con perfil ficticio a 320/360/390/640 px y navegación de escritorio` 1/1 PASS en Edge con perfil y solicitudes dummy; capturas actuales en `reports/qa/ux-cuenta-current-followup-20261103/`.
- Límite: teclado integral, zoom real al 200 %, lector de pantalla y runtime instalado continúan pendientes.

## Calificaciones · mensaje de conexión recuperable (2026-11-03)

- Hallazgo: Resultados mostraba directamente `Error.message`, omitiendo la sugerencia ya definida por la normalización común de errores.
- Cambio: carga inicial usa `mensajeDeError`; se conservan alerta, ocultamiento de conteos y reintento de solo lectura.
- Prueba focal: `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` comprueba sugerencia útil y ausencia de `ECONNREFUSED`/dirección local.
- Contratos y cálculos: sin cambios.

- Alcance adicional de la misma pantalla: el error de la consulta del historial de captura también pasa por el normalizador compartido; su botón vuelve a habilitarse tras el fallo y conserva su consulta GET.

## Calificaciones · etiquetas y valores en móvil estrecho (2026-11-03)

- Hallazgo visual: a 320 CSS px, las tarjetas disponían etiquetas y notas en dos columnas; el espacio hacía que «Parcial 1» se partiera y competía con el valor numérico.
- Cambio: hasta 359 CSS px la tarjeta usa una columna. Desde 360 CSS px mantiene dos columnas.
- Criterio: WCAG 2.2, SC 1.4.10 Reflow; la guía W3C recomienda que el contenido textual refluya en el viewport requerido sin perder información ni función.
- Validación: el E2E responsive comprobará la geometría en 320/390 CSS px, claro/oscuro y ausencia de overflow.
- Resultado: E2E Edge 1/1 PASS; capturas postcambio inspeccionadas; el rótulo y el valor quedan alineados en filas completas a 320 px y la cuadrícula se conserva a 390 px.

## Calificaciones · revisión actual de Resultados y detalle (2026-11-03)

- Se recorrieron y capturaron resumen, Resultados por alumno, filtros, estado sin coincidencias, detalle del alumno y estado sin materia con fixtures ficticios, Edge, 320/390 CSS px y ambos temas.
- En las capturas actuales inspeccionadas, el estado vacío identifica búsqueda y filtros activos, conserva «Limpiar búsqueda» y el detalle muestra datos del alumno y acciones en bloques legibles. No se detectó recorte nuevo en esa muestra.
- La ejecución mostró un error de conexión del proxy solo al registrar `/api/analiticas/eventos-uso`; el escenario sintético terminó PASS y no dependió de un servicio API real.
- Evidencia: `reports/qa/ux-calificaciones-current-followup-20261103/`.
- Límite: esta revisión no cubrió todas las subsecciones, lector de pantalla, zoom real al 200 % ni runtime instalado.

## Cuenta · foco de teclado en foto de perfil (2026-11-03)

- Verificación E2E con perfil ficticio: una tabulación desde el último acceso directo enfoca el selector de foto; su control envolvente presenta un anillo de 3 px en claro/oscuro y la tabulación siguiente deja el control.
- Las capturas actuales de foco están en `reports/qa/ux-cuenta-followup-20261103/`.
- Sin cambios a selección, almacenamiento local ni envío de imagen. La inspección manual de zoom y lector de pantalla queda pendiente.

## Cuenta · precisión de la guía de seguridad (2026-11-03)

- Hallazgo estático: la guía atribuía AES-256 GCM, auditoría activa y cifrado genérico en reposo a funciones no expuestas por la pantalla Cuenta.
- Cambio: describe la gestión real de contraseña local y cuentas vinculadas; el cierre usa el icono Lucide compartido con nombre accesible.
- Validación focal: `apps/frontend/tests/seccionCuenta.test.tsx`; no cambia autenticación, protección de tokens ni persistencia.

## Calificaciones · etiquetas completas en navegación móvil (2026-11-03)

- Hallazgo visual: la etiqueta «Extraordinarios» se recortaba dentro de su acceso en la cuadrícula de dos columnas a 390 CSS px.
- Cambio: se oculta el índice numérico decorativo en ese rango y el bloque de texto ocupa el ancho liberado, sin cambiar orden ni destino.
- Validación: el E2E de Resultados mide que ninguna etiqueta se recorte a 390 CSS px en ambos temas y conserva la inspección de capturas responsive.

## Calificaciones · contraste del encabezado de actas (2026-11-04)

- Hallazgo visual: «Resultado oficial» usaba el acento cian destinado al fondo oscuro también en tema claro; en la superficie clara era apenas legible.
- Criterio: WCAG 2.2 SC 1.4.3 requiere al menos 4.5:1 para texto normal ([W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- Cambio: se usa un azul profundo para ese rótulo en tema claro y se conserva el acento cian en oscuro.
- Validación: el E2E mide contraste compuesto en el fondo renderizado a 320/390 CSS px y escritorio, en ambos temas.

## Cuenta · guía sin tooltip superpuesto (2026-11-04)

- Hallazgo visual: el tooltip del botón de guía rápida se superponía a la tarjeta de perfil en el layout de 320 CSS px, pese a que el botón ya describe la acción con texto visible.
- Cambio: se elimina la descripción emergente redundante; se conservan la etiqueta, el nombre accesible y el estado/acción de alternancia.
- Validación: el E2E con perfil ficticio comprueba que el hover no crea un elemento `tooltip` a 320 CSS px, en ambos temas.

## Cuenta · guía alineada con el flavor docente (2026-11-04)

- Hallazgo de contenido: la ayuda mencionaba licenciamiento institucional, plan multisede, firma RSA y vigencia offline, opciones que no aparecen en Cuenta y que corresponden a capacidades fuera del alcance de esta pantalla docente.
- Cambio: la guía orienta sobre cuenta y foto local, preferencias del PDF institucional, carpeta OneDrive y métodos disponibles de acceso; se conserva el comportamiento de mostrar/ocultar.
- Validación: `seccionCuenta.test.tsx` 33/33 PASS; E2E Edge focal 1/1 con perfil ficticio, a 320 CSS px en claro y oscuro; verifica los tres destinos reales, ausencia de promesas de licencia y que el texto quede dentro del panel. Capturas inspeccionadas en `reports/qa/ux-cuenta-audit-followup-20261104/`.
- Contratos y capacidades: no se agregan funciones, permisos ni afirmaciones de licenciamiento.

## Classroom · copy de fallos de conexión en Calificaciones (2026-11-04)

- Hallazgo E2E: al abortar la consulta de cursos, el estado contextual mostraba «Sin conexion», sin acento ni identificación del recurso, aunque ofrecía reintentar.
- Cambio: en los estados de cursos, estudiantes y actividades, el fallo genérico de conexión se amplía con el recurso consultado y la acción de verificar la conexión con EvaluaPro e intentarlo de nuevo. Se conservan alerta, reintento GET-only, permisos y endpoints.
- Validación focal: E2E `audita Classroom dentro de Calificaciones con datos sintéticos` comprueba el mensaje, error vs. vacío y reintento por teclado.

## Materias · instrucción y límite del rango de fechas (2026-11-04)

- Hallazgo: la relación entre las fechas se explicaba solo después de ingresar un rango inválido.
- Cambio: la regla se muestra antes de guardar y `min` restringe la fecha de término a la fecha de inicio; el error sigue asociado al campo.
- Validación: E2E Edge sintético 1/1 a 320/390 CSS px verifica instrucción accesible, restricción nativa, bloqueo del CTA y reflujo del error.
- Contratos y cálculos: sin cambios.

## Materias · marcador de Ciclo Académico (2026-11-04)

- Hallazgo visual: el marcador junto a «Ciclo Académico» podía aparecer como un cuadrado vacío, porque el tema oscuro daba tamaño y sombra pero faltaban display, relleno y radio circular; el tema claro no definía su geometría.
- Cambio: el indicador ahora es un punto circular relleno que hereda el color accesible de su etiqueta, sin animación insistente.
- Validación: E2E Edge sintético 1/1 a 320/390 CSS px en tema claro/oscuro; mide tamaño, relleno y `border-radius: 50%`. Capturas revisadas en `reports/qa/ux-materias-ciclo-academico-20261104/`; WCAG guard, contraste y SDD audit PASS.
- Contratos y cálculos: sin cambios.
- Revisión: el punto se amplió ligeramente y se fijó también su proporción mediante `aspect-ratio`; la prueba compara ancho y alto para impedir que una regla flex lo vuelva rectangular. Capturas nuevas revisadas en `reports/qa/ux-materias-dot-square-recheck-20261104/`.

## Materias · etiqueta de Ciclo Académico sin glifo redundante (2026-11-05)

- Hallazgo: en la interfaz reportada, el indicador decorativo se percibe como un cuadrado vacío y parece un error, aunque el texto «Ciclo Académico» ya comunica el contexto.
- Cambio: se retiró el indicador redundante; la etiqueta conserva su texto y jerarquía visual.
- Validación PASS: `npm run test:gui:responsive:e2e:docente -- --grep "audita Materias activas y archivadas con catálogo ficticio"`, 1/1 en Edge a 320/390 CSS px y temas claro/oscuro. Capturas inspeccionadas en `reports/qa/ux-materias-cycle-label-20261105/`.
- Contratos y cálculos: sin cambios.

- Seguimiento de runtime: a solicitud del usuario se reemplazaron ambos bundles de la instalación `docente-local` (app 1.2.10): 39/39 archivos de `dist-docente` y 23/23 de `dist-alumno` coinciden por SHA-256 con el build actual. Las versiones previas quedaron en `%LOCALAPPDATA%\EvaluaPro\logs\gui-bundle-backups\20261105-024333`; los 7 archivos críticos del manifiesto conservan sus hashes y `data` conserva 95 archivos y 284182428 bytes. El runtime seguía apagado al verificar; API/UI no respondían y el navegador lateral no pudo recargar por el bloqueo de navegación, así que queda pendiente observar la pantalla instalada al próximo arranque.

## Calificaciones · cabecera móvil sin columna de icono vacía (2026-11-04)

- Hallazgo E2E: a 320 CSS px, el grid compartido reservaba 44 px para un emblema que no está presente en la cabecera de Calificaciones; la fila de etiquetas quedaba en 45 px y su contenido desbordaba 118 px.
- Cambio: en la cabecera de Calificaciones, el lead usa una columna flexible, las etiquetas pueden envolver y el contador no exige ancho intrínseco mínimo. No se añade un segundo icono ni se cambia el texto, la navegación o los resultados.
- Validación PASS: E2E Edge recorre 13 secciones con datos ficticios a 320 CSS px y E2E de Calificaciones verifica 504/390/320 px en claro/oscuro. El segundo comprueba el icono en la navegación, su ausencia junto al título, tamaño/trazo de los iconos y que contador/etiquetas no se recorten. Capturas a 320 CSS px inspeccionadas en `reports/qa/ux-calificaciones-header-320-20261104/`.

## Extraordinarios · obligatoriedad y reglas del resultado externo (2026-11-05)

- Hallazgo: el formulario mostraba los límites de captura solo después de que algo fallara y no distinguía antes del envío los campos requeridos del lote opcional.
- Cambio: las etiquetas identifican obligatoriedad/opcionalidad; aciertos, total de reactivos y criterios incluyen instrucciones visibles y asociadas programáticamente. Se conservan validadores, cálculo, payload, permisos y opción de lote vacío.
- Criterio: WCAG 2.2 SC 3.3.2 indica que se deben proporcionar etiquetas o instrucciones y aplica a todos los campos, obligatorios u opcionales ([W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)).
- Validación focal: componente Extraordinarios 19/19; E2E sintético 1/1 en móvil, tema claro/oscuro, incluye el estado expandido y verifica `required`, el lote opcional y las descripciones accesibles. Capturas 320 CSS px inspeccionadas en `reports/qa/ux-extraordinarios-required-fields-20261105/`.

## Calificaciones · alcance del KPI de páginas procesadas (2026-11-05)

- Hallazgo visual: la captura de Resultados mostraba 1 alumno con calificación y, a la vez, 0 «Páginas procesadas». Aunque el tooltip ya especificaba el motor OMR, la etiqueta visible no explicaba que eran conteos de lectura OMR.
- Cambio: el KPI ahora se llama «Páginas OMR procesadas»; no cambia el conteo ni la fuente de datos.
- Validación: E2E Edge focal `captura Resultados sin materia y con registros sintéticos`, con fixtures ficticios, ambos temas y 320/390 CSS px; verifica la nueva etiqueta y conserva los KPI de alumnos. Capturas antes/después en `reports/qa/ux-calificaciones-pages-kpi-20261105/`.

## Calificaciones · icono semántico de Aclaraciones (2026-11-05)

- Hallazgo visual: «Con calificación» y «Aclaraciones» compartían el check verde, aunque uno representa resultados y el otro solicitudes de diálogo.
- Cambio: «Aclaraciones» usa el icono Lucide compartido `MessageCircleQuestion` con un acento secundario; etiquetas y conteos permanecen iguales.
- Validación: E2E Edge sintético focal 1/1 PASS a 320/390 CSS px en temas claro/oscuro; verifica la identidad de ambos iconos y el contraste del indicador. Se actualizará la cobertura del catálogo de iconos con la prueba focal.
- Contratos y cálculos: sin cambios.

## Calificaciones · tamaño táctil estable para mostrar el secreto (2026-11-05)

- Hallazgo E2E: el botón «Mostrar secreto maestro» usa `2.75rem` y en tema oscuro midió 43.99997 CSS px de alto, por debajo del mínimo táctil de 44 px del contrato de interfaz.
- Cambio: el control mantiene 44 CSS px de ancho y 45 CSS px de alto para que la escala subpíxel no reduzca el área renderizada bajo el mínimo de 44 × 44 CSS px.
- Validación focal: E2E del generador de reportes HTML con datos ficticios en Edge; verifica dimensiones, contraste, foco y operación de teclado en ambos temas.
- Contratos y cálculos: sin cambios.

## Calificaciones · nombre completo en el selector móvil (2026-11-05)

- Hallazgo visual: a 320 CSS px, la opción «Resultados · consulta por alumno» se truncaba dentro del selector nativo y ocultaba parte del nombre de la vista.
- Cambio: la opción móvil usa «Resultados»; el contexto «Consulta por alumno» permanece en la navegación amplia y el contenido de la vista.
- Validación focal: el E2E responsive sintético confirma que la opción seleccionada se muestra completa a 320 px y que las opciones adyacentes siguen accesibles por teclado.
- Contratos y cálculos: sin cambios.

## Calificaciones · nombres precisos para reportes y exportación (2026-11-05)

- **Hallazgo en captura:** la navegación decía «Actas y exportación», el subtítulo «Resultado oficial» y la descripción «Prepara el resultado oficial», aunque el panel solo ofrece descargas HTML, CSV y XLSX; no genera ni certifica actas.
- **Cambio:** la vista se nombra «Reportes y exportación», el subtítulo «Exportación de calificaciones» y la descripción indica que genera y descarga reportes. Se conservan el ID interno, selección, permisos, formatos, contenido, cálculos y payloads.
- **Validación ejecutada:** `npm -C apps/frontend run test -- --run tests/seccionCalificaciones.routing.test.tsx tests/seccionCalificaciones.manualSelector.test.tsx` (2 archivos, 40 pruebas PASS); E2E Edge `audita visualmente el generador de reportes con datos ficticios` (1/1 PASS), con comprobación del copy, ausencia de las promesas anteriores, contraste claro/oscuro a 320/390/1440 px y disponibilidad de HTML, CSV y XLSX. `npm run sdd:audit` PASS; `git diff --check` exit 0 (Git avisó que su servicio fsmonitor local no respondió).
- **Contratos:** sin cambios a cálculos, datos, endpoints ni payloads.
- Actualización instalada: builds docente/alumno regenerados; tras sustituir los bundles, las comprobaciones por árbol SHA-256 dieron 39/39 y 23/23 archivos idénticos. Respaldo anterior: `%LOCALAPPDATA%\\EvaluaPro\\logs\\gui-bundle-backups\\20261105-025239`. Datos locales conservados (95 archivos, 284182428 bytes); runtime apagado, por lo que la observación visual instalada queda para el próximo arranque.

## Centro de versión · normalización de iconos tecnológicos (2026-11-05)

- Hallazgo: la lista de tecnologías dibujaba nueve SVG propios con trazo y colores de marca fijos. No eran recursos oficiales; variaban respecto al resto del catálogo y rompían la regla de que la lista técnica use símbolos Lucide compartidos.
- Cambio: React, TypeScript, Vite, Node.js, SQLite, Prisma, OMR y criptografía usan símbolos Lucide semánticos; tecnologías desconocidas usan capas como fallback. Color, trazo, tamaño, escala y semántica decorativa provienen de `IconoLucide`.
- Validación focal: `iconos.test.tsx` y `versionInfoPage.test.tsx`; cada tecnología renderizada conserva 20 × 20 px, trazo 2, `currentColor` y estado decorativo. El guard del catálogo deja como excepciones solo ilustración, QR y gráfica.
- Contratos: etiquetas, enlaces y navegación sin cambios; no se incorporan dependencias.

## GUI docente · emblemas principales circulares (2026-11-05)

- **Hallazgo visual:** el marco cuadrado del icono de Materias parecía un cuadro de glifo faltante junto al bloque «Ciclo Académico».
- **Cambio:** los emblemas de las diez secciones principales usan ahora marco circular compartido de 52 × 52 px y glifo de 24 px en ambos temas; se mantiene el rótulo sin marcador redundante.
- **Validación:** `iconos.test.tsx` 8/8; E2E Edge con datos ficticios 1/1 para las diez secciones, claro/oscuro, 320 CSS px; capturas inspeccionadas en `reports/qa/ux-icon-seccion-circular-20261105/`; build docente, guard WCAG 102/102 y auditoría SDD PASS.
- **Límite:** la primera ejecución Playwright con Chromium no pudo iniciar porque su ejecutable no está instalado; se completó el mismo E2E usando Edge instalado. No es una verificación de la instalación empaquetada.

## Materias · diferenciar emblema de KPI contiguo (2026-11-05)

- Hallazgo visual: el emblema principal y el KPI «Materias» repetían el mismo glifo `BookOpenText` en la misma cabecera.
- Cambio: el emblema de sección usa `LibraryBig`; el KPI conserva `BookOpenText`. Ambos pasan por el adaptador Lucide y mantienen la escala, el trazo y el color contextual compartidos.
- Causa raíz adicional: dos resets finales de superficies BEM no excluían `.icono-seccion-orb`; al inspeccionar el estilo calculado eliminaban el relleno y dejaban solo el borde circular. Ambos resets ahora excluyen el emblema.
- Validación focal: E2E Edge 1/1 compara las formas SVG del emblema y KPI y comprueba fondo visible, círculo 52 × 52 px y glifo 24 px para las diez secciones; tema fijado explícitamente, 320 CSS px, claro/oscuro. Build docente, ESLint, WCAG 102/102, SDD y `git diff --check` PASS.
- Contratos: solo cambia el símbolo decorativo; valores, etiquetas, navegación y accesibilidad no cambian.

## Materias · legibilidad de los pasos del estado vacío (2026-11-05)

- Hallazgo visual: en tema claro, las etiquetas claras de cada paso aparecían sobre rectángulos claros dentro de una cápsula oscura; la cascada hacía que el texto perdiera contraste.
- Cambio: el stepper de Materias usa una superficie clara única en tema claro, sin tarjetas anidadas; texto y flechas consumen tokens de texto del tema. El tema oscuro conserva su superficie oscura y texto claro.
- Validación focal: el E2E de emblemas mide los tres pasos y una flecha en ambos temas; evidencia de 320 CSS px en `reports/qa/ux-materias-icon-distinct-20261105/`.
- Contratos: la secuencia sigue siendo decorativa; no se cambian las instrucciones, el estado vacío ni la acción «Registrar materia».
