# Auditoría GUI: evidencia y hallazgos

Fecha de revisión: 2026-10-25
Runtime: EvaluaPro docente en navegador integrado, tema oscuro automático, viewport observado de 571 × 764 CSS px.

## Calificaciones — consulta por alumno

- **Hallazgo inicial (alto, legibilidad):** la tabla de nueve columnas se comprimía al ancho del contenedor. En la captura `02-calificaciones.jpg`, los encabezados, estados y botones se montaban; las columnas de nota apenas conservaban espacio para su contenido.
- **Causa en CSS:** el patrón de filas tipo ficha se aplicaba solo hasta 480 px, aunque el fallo ya era visible a 571 px. La tabla usaba `table-layout: fixed` y `min-width: 0`, de modo que no preservaba anchos de columna legibles.
- **Mejora aplicada:** ampliar el patrón adaptable hasta 700 px. Cada alumno conserva nombre y matrícula en el encabezado de ficha; grupo, cortes, bono, final y estado conservan sus etiquetas; la acción ocupa una fila completa. Las filas con `colspan` ocupan el ancho completo de la ficha.
- **Verificación posterior:** captura `16-calificaciones-fichas-mobile.jpg`; la tabla se presenta como fichas legibles y el botón «Ver detalle» ya no comparte espacio con estado ni notas.
- **Prueba:** `apps/frontend/tests/gui.responsive.contract.test.tsx`, 6/6 casos. Build docente: typecheck, lint, guard del bundle y `wcag-guard` correctos; contraste reportado 20/20 pares.
- **Sincronización:** la verificación directa del espejo canónico terminó correctamente con SHA-256 de árbol `fba937b244fae1c007c0199ddb41e2fccedbcc23e183833adcf8168b57f7057e` y 296 archivos. Una invocación de verificación a través de `npm` resolvió una ruta de sandbox distinta y falló; la ejecución directa con `-RepoRoot` y `-LocalRoot` explícitos verificó el árbol operativo y ambos espejos.
- **Pendiente:** revisar esta composición a 320/390 CSS px, tema claro, teclado y las dos vistas internas restantes de Calificaciones.

## Calificaciones — navegación de vistas

- **Observación inicial:** a 571 px las cinco vistas internas se apilaban en una sola columna y consumían gran parte del primer viewport, aunque ya existía una cuadrícula de dos columnas para tablet.
- **Causa:** al ampliar el punto de quiebre de las fichas de resultados, la regla de una columna de la navegación quedó accidentalmente extendida hasta 700 px.
- **Corrección:** separar los puntos de quiebre: fichas de resultados hasta 700 px, dos columnas para la navegación entre 481 y 860 px, una columna hasta 480 px.
- **Verificación runtime:** `17-actas-nav-grid.jpg` muestra las cinco vistas en dos columnas y la sección Actas y exportación seleccionada.
- **Prueba focal:** el contrato responsive valida tanto la ficha de resultados como el punto de quiebre de la navegación.

## Navegación docente en viewport estrecho

- En Materias, Calificaciones, Cuenta y Alumnos, el selector nativo «Ir a sección» expone las secciones y sincroniza su opción con la vista activa.
- Capturas de referencia: `01-materias.jpg`, `02-calificaciones.jpg`, `03-cuenta.jpg`, `04-alumnos.jpg`. Revisión posterior disponible en `11-materias-responsive.jpg`, `12-calificaciones-responsive.jpg`, `13-cuenta-responsive.jpg` y `14-alumnos-responsive.jpg`.
- **Pendiente:** comprobar 320, 390 y 1023 CSS px; foco por teclado, tema claro y cada sección permitida.

## Acceso con Google — diagnóstico de disponibilidad

- **Hallazgo de la captura aportada:** la UI atribuyó una respuesta fallida al backend a un Client ID ausente, aunque ambas condiciones son distintas y requieren instrucciones diferentes.
- **Corrección:** el sondeo de capacidades distingue `disponible`, `sin_configuracion` y `sin_respuesta`; un error de red ya no se anuncia como falta de configuración. El acceso alternativo por correo y contraseña permanece disponible cuando la política lo permite.
- **Verificación runtime:** `http://localhost:4000/api/autenticacion/capacidades-integraciones` devolvió HTTP 200, `oauthGoogleBackend: true` y Client ID presente. El servicio estático/proxy en `4173` respondió HTTP 429 en una consulta y HTTP 200 en la siguiente, con la misma configuración activa.
- **Regresión:** pruebas focales de autenticación, selector manual de Calificaciones y contrato responsive: 45/45 aprobadas; prueba del guard del bundle: 3/3 aprobadas. Build docente: TypeScript, ESLint, guard del bundle y contraste WCAG 2.x (20/20) aprobados.
- **Entrega local:** sincronización `publish` + `verify` completada; SHA-256 del árbol `33c6f8f9156be2788439c42997e99f6426b4fffb65fdaaf211142f866675daef`, 363 archivos.

## Calificaciones — captura manual y Classroom

- **Selector de captura manual:** el runtime expuso inscripciones con etiquetas visibles repetidas, respaldadas por identificadores distintos. Las opciones repetidas ahora incluyen materia y grupo; se conservan las inscripciones y sus valores de selección. Prueba focal incluida en `seccionCalificaciones.manualSelector.test.tsx`.
- **Estado vacío de Classroom:** el `caption` accesible de la tabla aparecía también como texto visual y duplicaba el mensaje de estado vacío. El estilo de solo lector de pantalla se amplió al contenedor compartido por la vista Classroom. Captura posterior: `18-classroom-empty-caption-fixed.jpg`.

## Cuenta — disponibilidad de sincronización

- **Observación runtime:** con la sesión docente activa, la pantalla de Cuenta mostró el estado normal «Sin configurar» y el formulario para elegir una carpeta; no se modificó la ruta ni la configuración. El runtime volvió a responder HTTP 200 en broker, API y UI después del reintento autorizado.
- **Hallazgo de código:** si `GET /sincronizaciones/local/lease` fallaba, `AppDocente` dejaba `estadoLease` en `null`; Cuenta seguía mostrando «Pendiente» y «Consultando…» sin terminar ni ofrecer recuperación.
- **Mejora:** el estado ahora diferencia «Consultando», «Sin configurar», «Configurada» y «Sin conexión». El error explica que no se pudo consultar el servidor y ofrece «Reintentar consulta», que repite únicamente el GET. No cambia ni guarda la preferencia de carpeta.
- **Regresión:** `sincronizacion.behavior.test.tsx` cubre error, reintento y transición a «Sin configurar». Las pruebas focales de Cuenta y sincronización pasaron 28/28; build docente, TypeScript, ESLint, guard del bundle y contraste WCAG 20/20 pasaron.
- **Entrega local:** bundle docente construido y copiado con respaldo `backups/ux-account-sync-20261025-234334`; SHA-256 de `index.html` coincide entre build y runtime. Tras recargar la UI y navegar de nuevo a Cuenta, el estado observado fue «Sin configurar» y no apareció alerta. El caso de desconexión se verificó con prueba, no provocando una caída en la instalación activa.

## Alumnos — selectores de materia y reinscripción

- **Hallazgo runtime:** los selectores mostraban etiquetas `ID: ...` para distinguir materias; esos identificadores ayudan al sistema, pero no orientan al docente. La pantalla muestra los controles de reinscripción, alta y filtro, además del contexto de materia seleccionada.
- **Mejora:** los selectores muestran el nombre y la fecha de inicio en formato `DD/MM/AAAA`; los grupos archivados agregan grupo y cantidad de alumnos. El ID queda como `value` interno. Los registros no se modificaron.
- **Verificación runtime:** tras publicar y recargar, el selector mostró materias con fechas legibles; no quedaron etiquetas con `ID:`. La UI docente respondió HTTP 200; `innerWidth=583` y `documentElement.scrollWidth=571`, sin desbordamiento horizontal. No se guardaron capturas con datos de alumnos.
- **Regresión y build:** las pruebas focales Alumnos, Cuenta y sincronización pasaron 54/54; build docente, TypeScript, ESLint, guard del bundle, `git diff --check` y WCAG 20/20 pares pasaron.
- **Entrega local:** bundle docente copiado con respaldo `backups/ux-alumnos-20261025-234742`; se verificó el nuevo texto en el selector y ausencia de IDs visibles.
- **Pendiente:** revisar Alumnos a 320/390 CSS px, temas claro/oscuro, teclado, filtros, edición, reinscripción y estados vacíos con evidencia visual sanitizada.

## Portal de alumno — acceso a resultados

- **Hallazgo de contenido:** etiquetas sin acentos y errores de formato expresados con abreviaturas (`letras/números/guion/guion_bajo`) dificultaban corregir el código de acceso o matrícula. La ayuda mezclaba recargar, volver a consultar e ingresar sin una secuencia uniforme.
- **Mejora revisada en código:** acentuación consistente, restricciones de formato explicadas con caracteres concretos y pasos de consulta con acción visible. Se conservan validación, nombres de campos, transporte y contrato de consulta.
- **Pruebas y build:** `appAlumno.test.tsx` y `appAlumno.behavior.test.tsx`, 6/6; build `dist-alumno` correcto.
- **Entrega:** variante `dist-alumno` copiada con respaldo `backups/ux-alumno-portal-20261025-235035`, `index.html` verificado por SHA-256 y el bundle instalado contiene el texto corregido.
- **Límite de evidencia:** el runtime lateral activo solo permitió revisar la variante docente; el portal de alumno no tuvo una vista runtime disponible en esta sesión, así que la inspección visual de esta sección sigue pendiente.

## Calificaciones — contexto de materia en vistas históricas

- **Hallazgo runtime:** los selectores de Resultados, Actas y Extraordinarios mostraban IDs internos en el nombre de la materia. Las vistas históricas marcaban el curso archivado con un paréntesis, pero no aportaban fecha de inicio para distinguir cursos repetidos.
- **Mejora:** un helper compartido presenta `Nombre de materia · inicia DD/MM/AAAA` y conserva `· Archivada` como estado textual. Se aplicó a Resultados, Actas, Extraordinarios, el selector de reporte/encuadre, Classroom y Alumnos; los IDs continúan como valores internos de los controles.
- **Compatibilidad:** el historial archivado sigue seleccionable y las pruebas mantienen el estado histórico y las operaciones originales.
- **Regresión:** 49 pruebas focales de resumen, extraordinarios, utilidades y Alumnos pasan; build docente y alumno pasan, incluido WCAG 20/20 en la variante docente.
- **Entrega y runtime:** las dos variantes frontend se actualizaron con respaldo `backups/ux-calificaciones-20261025-235905-dist-docente` y `...-dist-alumno`. Tras recargar la UI docente, Resultados, Actas y Extraordinarios mostraron nombre, fecha y marca «Archivada» sin IDs técnicos. `innerWidth=583`, `scrollWidth=571`, sin desbordamiento.
- **Pendiente:** completar recorridos de teclado, temas, exportaciones y demás acciones de cada subvista; validar otros anchos.

## Accesibilidad transversal — cierre del recordatorio

- **Hallazgo runtime (2026-10-26):** en Classroom, el botón «Cerrar recordatorio» medía 22 × 20 CSS px. El control aparecía también en Materias y Calificaciones; su nombre accesible estaba presente.
- **Referencia:** WCAG 2.2, criterio 2.5.8, establece objetivo de 24 × 24 CSS px o una excepción de espaciado equivalente. Fuente primaria: [W3C WAI — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **Mejora:** el área pulsable subió a 32 × 32 CSS px y mantiene un mínimo explícito de 24 × 24; no cambia el cierre del aviso ni el flujo de asistencia.
- **Regresión:** `gui.responsive.contract.test.tsx`, 9/9; `npm run guard:wcag`, PASS (20/20 pares de contraste); `npm -C apps/frontend run build:docente`, PASS (incluye TypeScript, ESLint y guard del bundle).
- **Entrega local:** copia del bundle docente con respaldo `backups/ux-touch-target-20261026-000901-dist-docente`; SHA-256 de `index.html` coincide. Tras recargar, runtime midió 32 × 32 CSS px, nombre accesible presente y sin desbordamiento a 583 CSS px (documento 571 px).
- **Límite:** no se aceptó la captura recortada del control porque el navegador devolvió un encuadre incompleto. La verificación posterior se basa en medidas DOM de la GUI activa; la captura visual archivada queda pendiente.

## Cuenta — lenguaje y señal de éxito

- **Hallazgo runtime/código (2026-10-26):** el título del panel mezclaba mayúsculas de encabezado y `&` («Actualizaciones del Sistema & Installer Hub»), mientras que el mensaje de éxito añadía un emoji al lado de una acción ya señalada con icono.
- **Mejora:** título «Actualizaciones de EvaluaPro e Installer Hub», etiqueta «Mantenimiento y actualizaciones» y texto de éxito sin emoji. Conserva el icono, las acciones, la validación SHA-256 y el respaldo.
- **Regresión:** `seccionCuenta.test.tsx` y `ux.visual.test.tsx`, 23/23; build docente PASS con TypeScript, ESLint, guard de bundle y contraste 20/20.
- **Entrega local:** respaldo `backups/ux-account-copy-20261026-001432-dist-docente`; SHA-256 de `index.html` coincide. Tras recargar y cambiar a Cuenta, el título nuevo está visible, el anterior no aparece y no hay desbordamiento (`scrollWidth=571`).
- **Límite:** la comprobación usa texto y layout DOM; no se conservó una captura que pudiera exponer información del perfil docente.

## Materias — alta y edición de campos obligatorios

- **Hallazgo runtime/código (2026-10-26):** alta y edición ya deshabilitaban la acción hasta completar nombre y fechas, pero los controles no exponían `required` ni explicaban qué campos se podían omitir. La regla de creación y edición confirma que grupos pueden quedar vacíos; la portada está marcada opcional y tiene valor genérico por defecto.
- **Referencia:** W3C WAI recomienda indicar los campos obligatorios/opcionales y asociar instrucciones con sus controles. [WAI — Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/).
- **Mejora:** alta y edición anuncian que nombre y fechas son obligatorios, y grupos (y portada en alta) opcionales. Los tres campos requeridos llevan `required` y `aria-describedby` hacia la instrucción. No cambian la validación de nombre, rango de fechas ni grupo.
- **Regresión:** `seccionPeriodos.edit.test.tsx` y `seccionPeriodos.portada.test.tsx`, 9/9; `sdd:audit` PASS; build docente PASS con TypeScript, ESLint, bundle guard y contraste 20/20.
- **Entrega local:** respaldo del bundle `backups/ux-materias-required-20261026-001858-dist-docente`; SHA-256 de `index.html` coincide. Runtime comprobó instrucciones, semántica `required`, botón de alta deshabilitado en blanco y reflow de 571 px en viewport 583; alta y edición no guardaron cambios.
- **Límite:** verificación estructural DOM en runtime; no se archivó captura por presencia de datos de curso.

## Calificaciones — instrucción del número de página OMR

- **Captura actual (2026-10-26):** `2026-10-26/01-calificaciones-omr-before.png`, vista «Revisión y captura» a 583 × 780 CSS px, tema oscuro. La cola y los contadores OMR estaban vacíos; no se capturaron nombres de alumnos.
- **Hallazgo:** el campo «Página» inicia en `0` y su placeholder dice «0 = detectar QR». Como el control ya tiene valor `0`, el placeholder no aparece. La ayuda vigente de formularios y el backend establecen que los números manuales empiezan en 1; no se explicaba la diferencia entre el modo QR y la entrada manual.
- **Mejora:** se conserva `0` para no cambiar el flujo; una instrucción visible aclara que `0` intenta detectar la página con QR y que la entrada manual usa el número impreso desde 1. `aria-describedby` asocia la instrucción y `aria-labelledby` conserva el nombre breve «Página».
- **Referencia:** W3C WAI recomienda instrucciones visibles para formatos y reglas de entrada, asociadas al control; [Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/) y WCAG 2.2 SC 3.3.2.
- **Regresión:** `apps/frontend/tests/escaneo.refactor.test.tsx` comprueba el valor predeterminado, el nombre accesible, la descripción asociada y el texto visible. Resultado: 9/9.
- **Validación de fuente:** `npm -C apps/frontend run lint`, `npm -C apps/frontend run build:docente`, `npm run guard:wcag` y `npm run sdd:audit` pasan; contraste 20/20 pares.
- **Verificación runtime posterior (2026-10-26):** la instalación local se actualizó con respaldo `backups/ux-calificaciones-page-hint-20261026-003500`; el `index.html` docente fuente e instalado coincide en SHA-256 (`3897E2E2E3B2035F220760203932FE39359EEBB7DA4D3F908533D25CCF4D6F79`). En una pestaña limpia del navegador integrado, el selector abrió «Calificaciones > Revisión y captura» y mostró el texto junto al campo con valor `0`; el nombre accesible fue «Página», la descripción se encontró asociada por `aria-describedby` y no hubo overflow horizontal a 1280 × 720 CSS px. La cola OMR mostró 0 en cola, 0 procesadas y 0 pendientes. Sin cargar imágenes ni enviar operaciones.
- **Captura posterior:** `2026-10-26/03-calificaciones-omr-page-help-full.png` muestra el campo corregido sin datos personales.
- **Pendiente:** completar recorridos de acciones OMR, exportaciones y validación en 320/390/571/1023 CSS px, teclado y tema claro.

## Cuenta — reflow del resumen a 320 CSS px

- **Captura actual (2026-10-26):** `2026-10-26/04-cuenta-estados-before-320.png`, runtime docente en la sección Cuenta a 320 × 780 CSS px, tema oscuro. El encuadre muestra el resumen de estados sin datos de contacto.
- **Hallazgo medido:** `cuenta-panel` tiene 237 px de ancho útil y `overflow: hidden`; su cabecera y resumen alcanzan 285 px. El documento se mantiene en 308 px, de modo que no hay barra horizontal global, pero el contenido se corta dentro de la tarjeta. El recordatorio ocupa 164 px de alto en esta vista, otro costo vertical que se evaluará en una pasada posterior del shell.
- **Impacto:** parte del resumen queda fuera de la superficie visible y texto de Cuenta pierde letras al borde; la ausencia de overflow en `documentElement` no basta para detectar este fallo.
- **Referencia:** WCAG 2.2, SC 1.4.10 Reflow: el contenido vertical debe presentarse a 320 CSS px sin pérdida de información ni scroll en dos dimensiones, salvo excepciones específicas. [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Acceso — diagnóstico OAuth de Google obsoleto

- **Hallazgo del 2026-10-26:** la captura mostraba que un fallo al consultar capacidades se atribuía erróneamente a que faltaba el Client ID. El backend local sí respondió y confirmó OAuth configurado; la carpeta instalada contenía bundles JavaScript antiguos además del build vigente.
- **Corrección:** se sincronizaron en espejo ambos directorios `assets` compilados, conservando explícitamente los recursos locales de OCR. La guardia docente rechaza el mensaje OAuth obsoleto; el registro PWA usa `updateViaCache: 'none'`; el servidor de origen revalida HTML y `portal-sw.js` en lugar de tratarlos como assets inmutables.
- **Entrega:** respaldo de bundles y scripts en `%LOCALAPPDATA%\EvaluaPro\backups\ux-bundle-before-sync-20261026-071000`; los hashes SHA-256 del `index.html` docente coinciden entre build e instalación, las referencias JS/CSS instaladas existen y no quedan bundles docentes con el mensaje antiguo. Se preservan `tessdata`, `tesseract-core` y `tesseract-worker`. Los scripts de arranque/guardia también se respaldaron y sincronizaron; el proceso web ya activo conserva los headers que cargó al iniciar hasta su siguiente arranque.
- **Validación:** al recargar el navegador lateral se cargó `index-gNcqFFP5.js`; el error OAuth obsoleto no está en el bundle ni se muestra en Cuenta. Layout de Cuenta validado en 320 y 390 CSS px sin scroll horizontal del documento; escritorio 1268 CSS px sin desbordamiento. Pruebas focales PWA/responsive/Cuenta: 35/35; lint; build docente con guard y contraste 20/20; build alumno; contrato de caché 1/1; `git diff --check`; API `/api/salud/live` en `ok`.
- **Revisión posterior:** Cuenta se midió a 320/390/571/1023 CSS px, sin overflow del documento; el tema claro se revisó a 320 y 1023 px y el resumen apila sus indicadores a 320 px. El iframe OAuth añade 9 px al `scrollWidth` interno de la tarjeta, pero la superficie interactiva visible permanece dentro de ella.
- **Pendiente:** recorrer Cuenta con teclado y cubrir estados de formularios/guardado/errores en tema claro y oscuro. Un contrato nativo general ejecutado junto a la aserción de caché falló en una comprobación de inclusión de migraciones SQLite; la aserción nueva pasó por separado.

## Calificaciones — reflow de Actas y Revisión OMR

- **Hallazgo runtime (2026-10-26):** a 320 CSS px, aunque el documento no desbordaba, `calif-action-deck` exigía una columna mínima de 360 px y `.calif-deck-card__field` una mínima de 220 px. Actas y Revisión OMR se extendían fuera de su contenedor y parte de la interfaz podía quedar recortada. WCAG 2.2 SC 1.4.10 exige reflow a 320 CSS px sin pérdida de información o funcionalidad. [W3C — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- **Mejora:** vistas internas, tarjetas de acción y campos ahora pueden encogerse al ancho disponible; la cuadrícula de acciones usa una columna fluida en móvil. El cambio conserva etiquetas, campos y operaciones.
- **Regresión:** `gui.responsive.contract.test.tsx`, 13/13; build docente con TypeScript, ESLint, guard del bundle y WCAG 2.x contraste 20/20; build alumno PASS.
- **Entrega y runtime:** ambos bundles sincronizados con respaldo `backups/ux-calificaciones-reflow-before-sync-20261026-062500`. En navegador lateral, Actas a 320 CSS px: `calificaciones-experience` 239/239 px, vista 239/239, tarjeta 237/237 y campo 189/189; Revisión OMR: vista 239/239 y sin descendientes fuera del contenedor. A 390 y 571 px, Revisión OMR mantiene contenido dentro del área (`309/309` y `490/490`); el documento no desborda.
- **Pendiente:** verificar tema claro, teclado, estados de cola OMR con datos aplicables y exportaciones; no se generaron descargas ni cambios de calificaciones.

## Calificaciones — recuperación desde una búsqueda sin resultados

- **Evidencia runtime actual:** consulta «Resultados por alumno» a 571 CSS px, tema claro, con una búsqueda deliberadamente sin coincidencias. La vista conserva el total del curso y muestra `0 visibles` con el mensaje de estado; no se mostraron filas con nombres o notas. La captura se inspeccionó en el navegador integrado y no se archivó como imagen.
- **Hallazgo:** el aviso decía que no había coincidencias, pero no ofrecía una acción para recuperar la lista. El campo no usaba el tipo semántico `search`.
- **Mejora:** el control ahora expone `type="search"`. El estado sin resultados ofrece «Limpiar búsqueda» solo cuando hay texto de búsqueda; la acción borra únicamente esa búsqueda y mantiene orden y filtro de estado.
- **Regresión:** `seccionCalificaciones.resumen.test.tsx` añade un recorrido con datos sintéticos que confirma el estado vacío, el control de recuperación y la aparición de filas tras limpiarlo. Resultado focal: 20/20.
- **Pendiente de este cambio:** guardia WCAG, lint, typecheck, build y verificación visual del bundle actualizado en el runtime instalado. No se alteraron ni guardaron calificaciones.

## Materias — reflow del panel a 320 CSS px

- **Hallazgo runtime (2026-10-26):** a 320 CSS px, el documento no mostraba overflow, pero `.materias-panel` desplegaba una columna implícita de 331 px dentro de 239 px; cabecera, guía, alta y catálogo rebasaban el panel y podían quedar recortados.
- **Mejora:** el panel móvil usa una columna `minmax(0, 1fr)` y permite que los bloques directos, el encabezado, la guía y el formulario reduzcan su ancho; las filas de metadatos e indicadores pueden envolver.
- **Regresión y build:** el contrato nuevo de Materias pasó 1/1; `build:docente` y `build:alumno` pasaron; guard de bundle, ESLint y WCAG 2.x contraste 20/20 pasaron.
- **Entrega local:** respaldo final `backups/ux-materias-mobile-final-before-sync-20261026-084854`; ambos bundles instalados coinciden con los `index.html` compilados por SHA-256. Se preservaron `tessdata`, `tesseract-core` y `tesseract-worker`.
- **Verificación runtime:** navegador lateral sobre la instalación, panel 239/239 px a 320; cada bloque directo 207 px y dentro del panel. A 390, panel 309/309 px; a 571, 490/490 px; documento sin overflow en los tres anchos. No se guardaron datos ni se capturaron nombres de alumnos.
- **Pendiente:** completar los estados archivados, edición, acciones de grupos y recorridos de teclado/tema; no se marca REQ-001 como completo.

## Materias archivadas — iconos y conteos históricos

- **Hallazgo runtime/código (2026-10-26):** la vista archivada mostraba dos registros y cuatro conteos por registro; indicadores y estado vacío usaban emojis, con formas y color distintos del catálogo de iconos de EvaluaPro.
- **Mejora:** sustituí los emojis por iconos Lucide decorativos en la tarjeta informativa, el estado vacío y los conteos de alumnos, reactivos, plantillas y calificaciones. Se conservaron los textos, las cantidades y la navegación.
- **Regresión y build:** `seccionPeriodosArchivados.test.tsx`, 2/2; build docente PASS con TypeScript, ESLint, guard del bundle y WCAG 20/20; build alumno PASS.
- **Entrega local:** respaldo `backups/ux-materias-archive-icons-before-sync-20261026-092254`; los índices docente y alumno coinciden con sus builds por SHA-256 y se preservaron las carpetas OCR.
- **Runtime:** tras recargar la instalación, la vista presenta dos registros, cuatro iconos de conteo, ningún emoji, y panel 490/490 px a 571; sin overflow interno a 320/390/571 px. La tarjeta informativa y sus iconos se verificaron en DOM.
- **Límite de captura:** no guardé capturas porque la cabecera fija incluye el perfil y el recorte del navegador no respetó el desplazamiento vertical; los archivos de evidencia no deben contener datos del perfil o materias.
- **Pendiente:** confirmar por recorrido si existe restauración de materias en otro flujo; esta lista no expone acción de restaurar. Faltan tema claro, teclado y captura segura.

## Materias — nombres visibles sin ID técnico

- **Hallazgo (2026-10-26):** `etiquetaMateria()` añadía el identificador interno a nombres visibles y etiquetas accesibles en las tarjetas, apertura de grupos y acciones de portada; el `title` de las tarjetas archivadas también revelaba el ID al pasar el cursor.
- **Mejora:** Materias usa `nombreMateriaVisible()` en títulos, confirmaciones y nombres accesibles de grupo/portada. Se conserva `_id` para operaciones de datos y el ID explícito de metadatos archivados; no se cambiaron API ni contratos CRUD.
- **Regresión y build:** pruebas focales de edición, portada, listas y archivo: 4 archivos, 13/13; build docente PASS con TypeScript, guard del bundle, ESLint y WCAG contraste 20/20; build alumno PASS. `sdd:audit` PASS; `git diff --check` limpio.
- **Entrega local:** ambos bundles sincronizados tras respaldo `C:\Users\evega\AppData\Local\EvaluaPro\backups\ux-materias-clean-labels-before-sync-20261026-094138`; SHA-256 de `index.html` coincidió entre build e instalación para docente y alumno. No se tocaron recursos OCR.
- **Runtime:** navegador integrado recargado desde `localhost:4173`; la tarjeta activa, el nombre accesible del grupo y las etiquetas de portada/guardado no contienen el ID. Sin overflow del documento; panel 239/239 px a 320, 309/309 px a 390 y 490/490 px a 571; contenido directo máximo 207, 277 y 458 px respectivamente. No se guardaron cambios ni capturas con datos de perfil o materias.
- **Pendiente:** cerrar recorridos completos de teclado, tema claro, demás estados y acciones antes de completar REQ-001.

## Alumnos — reflow de lista a 320/390 CSS px

- **Hallazgo runtime (2026-10-26, tema oscuro):** a 320 CSS px, `.alumnos-lista` conservaba una columna implícita de 283 px dentro de 198 px; las tarjetas rebasaban el explorador y el panel medía 302 px de scroll interno para 237 px visibles. A 390 px, la lista aún excedía su ancho disponible en 15 px. El documento no mostraba overflow, por lo que la pérdida ocurría dentro de los contenedores.
- **Mejora:** la lista usa una columna `minmax(0, 1fr)` en móvil y limita sus `li` y tarjetas a 100% con `min-width: 0`; conserva el orden, acciones y contenido de cada expediente.
- **Compatibilidad:** el frontend y backend validan la matrícula CUH de nueve dígitos; la interfaz anticipa la regla que ya aplicaban ambos esquemas del servidor. El input de correo continúa opcional; `type=email` aporta semántica sin cambiar el envío.
- **Regresión y build:** pruebas de Alumnos y contrato responsive, 2 archivos/25 pruebas PASS; build alumno PASS; build docente PASS con TypeScript, ESLint, guard del bundle y WCAG contraste 20/20.
- **Formulario:** ayuda visible y atributos `required` marcan matrícula, nombres, apellidos y materia; correo y grupo se nombran opcionales. `type=email` conserva la validación de correo del backend y el payload no cambia.
- **Entrega local:** versión final sincronizada con respaldo `C:\Users\evega\AppData\Local\EvaluaPro\backups\ux-alumnos-required-fields-before-sync-20261026-100826`; SHA-256 de los índices docente y alumno coincide entre build e instalación.
- **Runtime:** en la instalación recargada, el panel y la lista refluye sin overflow a 320 (237/237 y 198/198 px), 390 (307/307 y 268/268 px) y 583 CSS px (500/500 y 461/461 px). La primera tarjeta también queda dentro del track en los tres anchos. Se usó una sesión con expedientes existentes; no se guardaron datos ni capturas.
- **Pendiente:** revisar tema claro, foco y teclado, zoom, errores/estados vacíos y opciones de filtro en el recorrido completo antes de completar SPEC-126.

## Calificaciones — recuperación de búsqueda vacía

- **Hallazgo runtime (2026-10-26):** al buscar una cadena sin coincidencias, el libro indicaba cero filas pero no ofrecía un camino directo para recuperar la lista. La inspección fue en Calificaciones de la instalación local (`127.0.0.1:4173`); no se cambió ninguna nota.
- **Mejora:** el estado explica que los filtros no encontraron alumnos y, si hay texto de búsqueda, presenta “Limpiar búsqueda”. La acción borra solo la búsqueda y conserva los demás filtros; el campo se expone como `type=search`.
- **Regresión:** `seccionCalificaciones.resumen.test.tsx`, 20/20; WCAG contraste y diff CSS PASS; ESLint y TypeScript PASS; `test:frontend:ci` PASS (90 archivos/469 pruebas).
- **Suite completa:** `test:backend:ci` PASS (57 lotes); `test:portal:ci` PASS (32/32 al repetir fuera del sandbox por ENOENT de Vite en sus tres intentos sandbox); `test:tdd:enforcement:ci`, `perf:check` (4 presupuestos), `ci:policy:audit` y `sdd:audit` PASS. `test:coverage:ci` no completó: `backend-root-31` agotó los tres límites de 480 s con cobertura v8, así que el runner no llegó a portal/frontend coverage.
- **Build y entrega:** build docente PASS con TypeScript, ESLint, guard del bundle y WCAG 20/20; build alumno PASS. Se respaldaron los bundles instalados en `C:\Users\evega\AppData\Local\EvaluaPro\backups\gui-ux-20261026-121914` y se sincronizaron ambos destinos sin borrar archivos preexistentes. Los 592 archivos fuente docente y los 458 de alumno coinciden con sus destinos por SHA-256; recursos OCR extra de la instalación se conservaron.
- **Validación runtime:** en la app instalada, Calificaciones mostró 12 registros; la búsqueda sintética mostró el estado de cero coincidencias y “Limpiar búsqueda”; al limpiarla reaparecieron los 12. Se restauró la búsqueda vacía. No se archivó captura para evitar conservar nombres/matrículas visibles.
- **Pendiente:** completar revisión visual de Calificaciones en tema claro/oscuro, teclado y flujos de cada sección; la cobertura total sigue pendiente por el lote PDF lento.

## Cuenta — lectura de indicadores de perfil

- **Hallazgo runtime (2026-10-26, tema claro):** a 571 CSS px, el resumen del perfil comprimía cuatro tarjetas en la primera fila y dejaba una quinta aislada; `Predeterminado` se dividía en medio de la palabra.
- **Mejora:** el ancho mínimo de tarjeta subió de 6 a 8 rem en la banda móvil/tablet. A 571 px las cinco tarjetas quedan distribuidas 3+2, y los estados largos caben sin cortes extraños. También se sustituyeron los emojis de la guía y de la búsqueda de actualizaciones por iconos SVG compartidos; el de búsqueda ahora coincide con la acción.
- **Regresión y build:** `gui.responsive.contract.test.tsx`, 14/14; `seccionCuenta.test.tsx`, 20/20; build docente PASS con TypeScript, ESLint, guard del bundle y contraste WCAG 20/20; build alumno PASS.
- **Entrega local:** respaldo final `C:\Users\evega\AppData\Local\EvaluaPro\backups\gui-ux-cuenta-summary-icons-20261026-170421`; los 637 archivos docente y 503 de alumno coinciden por SHA-256 con los bundles instalados.
- **Verificación runtime:** se recargó la app y la vista Cuenta mostró los cinco estados completos en distribución 3+2 a 571 px; el árbol accesible confirma los nombres de ayuda/búsqueda sin emojis. Revisé también el tema oscuro y restauré el tema claro. No se guardó captura por los datos de perfil que aparecen en cabecera.
- **Pendiente:** revisar Cuenta en tema oscuro, teclado y estados interactivos de formularios/guardado antes de cerrar REQ-003.

## Calificaciones — finales ausentes en Extraordinarios

- **Hallazgo runtime (2026-10-26):** en la instalación docente, filas sin final mostraban `0.00` en “Final exacta” y “Acta” junto a “No elegible”. El servicio de lista académica devuelve cadena vacía cuando faltan componentes y `extraDisponible=false`; la causa visual era `Number('')`, que produce cero.
- **Corrección:** `decimal()` representa valores nulos o vacíos con `—`; conserva `0.00` para una calificación cero explícita. No se alteraron cálculo, elegibilidad ni registros.
- **Regresión:** prueba de ausencia vs. cero real añadida en `extraordinariosCalificaciones.test.tsx`; suite focal 10/10. `npm run test:ci` PASS tras regenerar el SVG de despliegue que fallaba inicialmente; 57 lotes backend, portal 32/32 y frontend 90 archivos/470 pruebas; build, lint, typecheck, WCAG 20/20, diagramas, rutas y políticas de cumplimiento PASS.
- **Entrega y runtime:** respaldo `C:\Users\evega\AppData\Local\EvaluaPro\backups\ux-extra-missing-grade-20261026`; ambas variantes instaladas sincronizadas y SHA-256 de `index.html` coincidente. Tras recargar localhost:4173 y abrir Extraordinarios, las 12 filas muestran `—` en final/acta y “No elegible”; no se modificaron datos académicos.
- **Nota:** el primer intento de suite dentro del sandbox falló al regenerar Prisma por `EPERM` en el cliente compartido; el reintento autorizado terminó correctamente. El chequeo de diagramas requirió regenerar el SVG de despliegue.

## Cuenta — evitar placeholders redundantes en credenciales

- **Hallazgo runtime (2026-10-26):** el placeholder de “Nueva contraseña” se rellenaba automáticamente como `Nueva contraseñaUsa al menos 8 caracteres.` aunque la pantalla ya mostraba el nombre y la ayuda persistente.
- **Causa y corrección:** `TooltipLayer` observaba el DOM y asignaba placeholders vacíos usando el texto de la etiqueta; las ayudas dentro de la etiqueta se concatenaban. Se retiró esa mutación global. Las etiquetas y ayudas visibles siguen presentes, y los placeholders escritos explícitamente se conservan.
- **Regresión:** contrato UX comprueba que contraseña y búsqueda no reciban placeholder automático, que el correo conserve su ejemplo explícito y que enfocar la contraseña no muestre un tooltip redundante. Suite completa PASS: frontend 90 archivos/471 pruebas (el runner reintentó una falla de carga diferida y pasó); portal 11/11 archivos, 32/32; backend 57 lotes; lint, typecheck, build, guard WCAG 20/20, docs, diagramas, rutas y políticas PASS.
- **Entrega:** respaldo de ambos bundles en `C:\Users\evega\AppData\Local\EvaluaPro\backups\ux-tooltip-no-label-placeholders-20261026`; sincronización con robocopy sin borrar archivos existentes. Los índices instalados coinciden con los builds: docente `398BACDCE27F9A1777AF77265BABB3D5BD779E6792CDD810284181C57208D64D`, alumno `B112B7E8C93ABD5D91E33EEE4E3729EDB468DD1A69DFAE7BEF5397E394A9906F`.
- **Verificación runtime:** navegador integrado conectado a localhost:4173; inputs de contraseña tienen `placeholder=null` y valor vacío; la ayuda “Usa al menos 8 caracteres.” permanece visible. No se cambió contraseña ni se guardó información de cuenta.

## Acceso Google — comprobación posterior a la captura

- **Runtime actual (2026-10-26):** API y UI responden HTTP 200; los listeners 4000 y 4173 pertenecen al Node embebido de `%LOCALAPPDATA%\EvaluaPro`. `GET /api/autenticacion/capacidades-integraciones` responde `oauthGoogleBackend=true`, Client ID presente, `requireGoogleOAuth=false` y acceso por contraseña permitido.
- **GUI actual:** en la Cuenta de la instalación servida por localhost:4173 está renderizado el control GSI de Google. El Client ID no se copió al reporte ni a logs.
- **Alcance de la comprobación:** el estado de error de la captura ya no se reproduce en el runtime observado. El frontend consulta la capacidad al iniciar, reintenta cada 15 s y ofrece reintento manual; el build valida consistencia de IDs cuando OAuth es obligatorio. No se cerró la sesión docente actual ni se ejecutó una autenticación real de Google, así que no se afirma un login end-to-end ni se identifica retrospectivamente por qué el endpoint estaba sin configurar en la captura.

## Materias — tooltips de foco y teclado

- **Hallazgo runtime (2026-10-26):** enfocar «Nombre de la materia» mostraba una ayuda emergente que no se cerraba con Escape y podía desaparecer al mover el puntero hacia ella. Eso incumplía el comportamiento esperado para contenido emergente activado por foco/hover.
- **Mejora:** `TooltipLayer` ahora conserva la ayuda al pasar entre el control y el tooltip, permite cerrarlo con Escape, conserva el foco en el campo y enlaza/desenlaza su ID mediante `aria-describedby` mientras está visible. Se conserva la ayuda nativa al ocultarlo.
- **Regresión:** contrato UX prueba hover del tooltip, cierre con Escape, relación accesible y foco persistente. `ux.quality.test.tsx` pasó 6/6; `test:ci` terminó con lint, typecheck/build, backend (57 lotes), portal (32 pruebas), frontend (471 pruebas), docs, rutas y políticas PASS.
- **Build y entrega:** build docente/alumno PASS; guard docente, lint y WCAG contraste 20/20 PASS. Respaldo en `C:\Users\evega\AppData\Local\EvaluaPro\backups\ux-tooltip-hover-escape-20261026`; sincronización no destructiva de ambas variantes, hashes SHA-256 coincidentes para todos los archivos fuente y recursos OCR adicionales preservados.
- **Runtime:** en `http://localhost:4173`, con el formulario de Materias abierto y el campo vacío, se comprobó tooltip visible + `aria-describedby`; Escape lo ocultó (1→0), quitó solo el ID temporal y mantuvo el foco en el campo. No se guardó captura con nombres de estudiantes o información del perfil.
- **Referencia:** [WCAG 2.2, contenido en hover o foco](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) y [WAI-ARIA APG, patrón Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/).

## Alumnos — UUID en selector y consistencia de iconos

- **Hallazgo runtime (2026-10-26):** al revisar Alumnos en el navegador lateral, el `<option>` seleccionado exponía un UUID interno como `Help` accesible y como tooltip porque el formulario asignaba el ID al atributo `title`; la opción ya tenía nombre legible de materia/fecha. También persistía el emoji de foco en el botón plegado de la guía y en la ayuda posterior al formulario.
- **Mejora:** retiré ese `title` sin alterar el `value` de la opción; sustituí los emojis por el icono SVG `info` compartido, oculto a tecnología asistiva porque el texto ya comunica el propósito.
- **Regresión/build:** `seccionAlumnos.test.tsx` y `guiaAlumnosVisual.test.tsx`, 2 archivos/12 pruebas PASS; build docente PASS con TypeScript, ESLint, guard de bundle y contraste WCAG 20/20; build alumno PASS.
- **Entrega:** respaldo de ambos bundles en `C:\Users\evega\AppData\Local\EvaluaPro\backups\ux-alumnos-cleanup-before-sync-20261026`; se sincronizaron ambos sin purgar extras y todos los hashes SHA-256 fuente/destino coincidieron.
- **Runtime posterior:** API `/api/salud/live` y UI `/` respondieron 200. Tras recargar la instalación, Materias mostró cero registros aunque antes de esa recarga el navegador había presentado datos; la consola no mostró errores. El estado puede reflejar sesión/base de datos distinta; no es concluyente y no se alteraron datos. La CLI de lectura no tiene credencial local, así que no pude confirmar por API el estado canónico ni verificar el selector corregido con datos. Pendiente validar cuando la lista real esté disponible.
