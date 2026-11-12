---
id: SPEC-135
titulo: Reporte compartible de calificaciones y consulta individual del alumno
version: 1.2.23
fecha: 2026-11-05
autor: Codex / EvaluaPro Team
modulo: frontend_docente_alumno_publicacion_calificaciones
estado: approved
---

## Contexto

Actualmente Calificaciones puede descargar un libro XLSX por periodo y el docente puede
publicar resultados a un Portal Alumno remoto. La carpeta OneDrive configurada en
EvaluaPro transporta snapshots cifrados para sincronizar equipos; el repositorio no
implementa la publicación del libro de calificaciones en esa carpeta. El Portal Alumno
recibe resultados sincronizados y autentica con un código de periodo de un solo uso más
matrícula. El portal no recibe ni conserva el correo del alumno como parte del perfil
sincronizado.

La persona docente solicita reemplazar el libro compartido por un reporte más legible,
que pueda conservarse y compartirse desde OneDrive. Autoriza que el reporte de periodo
muestre las calificaciones de todo el grupo. El modo inicial será una lista grupal sin
clave. El modo opcional individual pedirá matrícula y una clave distinta derivada por
alumno y ciclo desde un secreto maestro del docente, y las claves se mostrarán en
EvaluaPro para que se distribuyan manualmente, una por alumno.

OneDrive documenta enlaces de solo lectura y acceso para personas específicas. Su lista
oficial de formatos previsualizables incluye HTML; eso no garantiza que una vista previa
ejecute JavaScript ni que OneDrive funcione como hosting web. Por ello el archivo debe
ser autocontenido, legible sin scripts y verificarse en el tenant objetivo antes de
prometer comportamiento interactivo.

## Referencias de diseño y plataforma

- [Microsoft Support: compartir archivos y carpetas en OneDrive](https://support.microsoft.com/en-us/onedrive/share-files-and-folders-in-microsoft-onedrive): describe enlaces, permisos de solo lectura y acceso para personas específicas.
- [Microsoft Support: formatos previsualizables en OneDrive, SharePoint y Teams](https://support.microsoft.com/en-au/onedrive/file-types-supported-for-previewing-files-in-onedrive-sharepoint-and-teams): incluye HTML; no especifica que una previsualización ejecute JavaScript.
- [Microsoft Learn: strict browser file handling](https://learn.microsoft.com/en-us/sharepoint/dev/solution-guidance/security-permissivesetting): documenta que, en el manejo estricto, HTML con scripts potencialmente dañinos puede mostrarse como código o descargarse sin ejecutar.
- [Microsoft Graph v1.0: crear enlace para compartir un archivo](https://learn.microsoft.com/es-es/graph/api/driveitem-createlink?view=graph-rest-1.0): requiere permisos Graph para automatizar enlaces y diferencia alcance anónimo, organización y personas elegidas.
- [WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): los estados de operación deben poder anunciarse sin mover el foco.
- [WCAG 2.2 SC 3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html): los formularios deben explicar la información solicitada sin instrucciones innecesarias.
- [W3C WAI: Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/): describir formato esperado y asociar ayuda persistente al campo.
- [WCAG 2.2 SC 2.1.1: Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html): toda función debe poder operarse mediante teclado; el HTML semántico permite conservar el comportamiento nativo de envío de formularios.
- [WCAG 2.2 SC 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): contenido de desplazamiento vertical debe presentarse a 320 CSS px sin pérdida ni desplazamiento bidimensional, salvo contenido que realmente requiera una disposición bidimensional.

## Requisitos Funcionales

- **REQ-135-001 (Reporte grupal):** Desde Calificaciones, generar por periodo un HTML autocontenido con el nombre del periodo, fecha de generación, tabla legible de alumnos y calificaciones existentes y resumen del estado de la publicación. No inferir ceros, promedios, resultados faltantes ni elegibilidad; reutilizar los datos autoritativos ya expuestos por EvaluaPro. El reporte puede mostrar a todo el grupo según autorización expresa del docente, pero nunca incluir contraseñas, tokens, códigos de acceso, respuestas OMR, correos ni datos ajenos a la consulta de calificaciones.
- **REQ-135-002 (Presentación y resistencia):** El HTML debe tener estructura semántica, encabezados de tabla, contraste, reflow a 320 CSS px, impresión legible y español corregido. Hasta 800 CSS px, la lista grupal presenta fichas individuales por alumno con cada dato rotulado; en escritorios e impresión conserva la tabla de comparación. La consulta individual presenta los datos descifrados como campos rotulados y refluibles, sin requerir desplazamiento horizontal a 320 CSS px. Cualquier región tabular con desplazamiento debe poder recibir foco y tener nombre e instrucción accesibles. El contenido y su jerarquía deben seguir legibles sin JavaScript y sin recursos remotos; filtros o búsqueda son mejoras progresivas y no la única forma de localizar una fila. Los valores dinámicos se escapan al serializar.
- **REQ-135-003 (Flujo OneDrive):** El docente podrá generar/actualizar el archivo desde EvaluaPro y guardarlo o reemplazarlo en la carpeta que OneDrive sincroniza, conservando el libro XLSX actual. La interfaz explicará que debe compartir desde OneDrive con permiso de lectura y que en modo grupal todos los lectores del archivo verán la lista completa. En modo individual, indicará que la vista previa de OneDrive puede no ejecutar el formulario y dará la alternativa de descargar y abrir localmente el HTML. No se automatizará Graph ni se incorporarán credenciales de Microsoft en esta fase. No usar la carpeta interna de snapshots cifrados como destino de HTML legible.
- **REQ-135-004 (Modos de consulta):** El modo inicial será una lista grupal sin clave, según autorización expresa del docente. El modo individual opcional pedirá matrícula y clave personal. La clave se derivará mediante HMAC-SHA-256 del ciclo normalizado y matrícula normalizada con un secreto maestro que el docente ingresa en EvaluaPro. Cada fila se cifra independientemente con AES-GCM y solo la clave personal correspondiente permite descifrarla. EvaluaPro muestra las claves junto a la identidad de cada alumno para distribución manual individual; no automatiza correo ni requiere backend remoto al consultar.
- **REQ-135-005 (Secreto maestro y claves):** El modo individual identifica el secreto maestro como obligatorio en la etiqueta visible y en el estado programático del campo; muestra junto a este el mínimo de 20 caracteres. El secreto no se incluye en el HTML ni se persiste en la base de datos. El docente debe reutilizarlo al actualizar para conservar claves; al cambiarlo, debe regenerar el HTML y redistribuir las nuevas claves. Las claves derivadas y el secreto maestro no se escriben en logs ni telemetría. El reporte individual no incluye matrículas, nombres ni calificaciones en claro fuera de los campos que el alumno introduce.
- **REQ-135-006 (Regeneración y vigencia):** Actualizar el reporte significa volver a generar y guardar/reemplazar el archivo desde EvaluaPro. Una copia HTML estática no se actualiza por sí sola; la interfaz mostrará fecha de generación para que el docente identifique una copia anterior. La sincronización y los permisos de lectura los gestiona OneDrive fuera del reporte.
- **REQ-135-007 (Compatibilidad y alcance):** Conservar las rutas, payloads y funciones actuales de publicación, consulta XLSX y Portal Alumno. No modificar cálculos, permisos docentes ni reglas de calificación. El Portal Alumno permanece como build separado; Administración del negocio queda fuera del alcance.
- **REQ-135-008 (Contexto de claves durante la generación):** Al cambiar el secreto maestro o iniciar una nueva generación HTML, ocultar las claves personales previamente mostradas. Bloquear los controles de contexto desde que inicia la operación, incluso mientras está abierto el selector nativo de archivo, hasta completar o cancelar el guardado. Mantener ese contexto fijo hasta resolver la operación para que una respuesta tardía no presente claves bajo otro periodo, modo o secreto. Si se cancela el selector, comunicar que no se guardó y que el archivo anterior, si existía, quedó intacto; no asumir que ya había una versión.
- **REQ-135-009 (Formato de clave individual):** El formulario HTML individual indicará que la clave tiene 22 caracteres, distingue mayúsculas y minúsculas y puede contener guion o guion bajo. La instrucción visible se asociará programáticamente con el campo y la validación nativa rechazará longitudes o caracteres ajenos al alfabeto base64url sin alterar la derivación ni la comparación actuales.
- **REQ-135-010 (Envío por teclado):** Los controles de generación de reportes pertenecerán a un formulario semántico con nombre accesible. Pulsar Enter en el secreto maestro ejecutará «Generar / actualizar HTML» con el contexto actual; las descargas CSV y XLSX conservarán su acción independiente.
- **REQ-135-011 (Vigencia del resultado en el formulario):** al cambiar periodo, modo de acceso o secreto maestro, limpiar el mensaje de resultado/error de la generación anterior para no presentarlo como resultado de la configuración actual. Mantener las claves personales ocultas al cambiar el contexto.
- **REQ-135-012 (Confirmación precisa de guardado):** después de guardar mediante el selector de archivo, informar que el HTML quedó guardado en la ubicación seleccionada y, si está en OneDrive, que debe esperar la sincronización antes de compartirlo. No afirmar que el reporte se «actualizó» si la interfaz no puede saber si era una copia previa o una ubicación nueva.
- **REQ-135-013 (Estado de disponibilidad de periodos):** el panel de reportes distingue carga, error recuperable y vacío confirmado. Mientras se cargan periodos sin lista disponible, anuncia carga y no muestra el estado vacío; ante error, explica que la consulta falló y ofrece reintentar; solo comunica que no hay periodos después de una consulta válida sin resultados. Si aún hay periodos de una carga previa, conserva su selección y permite usarlos mientras comunica la actualización/error.
- **REQ-135-014 (Visibilidad del secreto maestro):** el secreto maestro inicia enmascarado. Un control de botón permite alternar entre enmascarar y mostrar únicamente el valor ya escrito para que el docente pueda comprobarlo. El control tiene nombre accesible, estado `aria-pressed`, relación `aria-controls` y es operable por teclado. La alternancia no modifica, persiste, copia ni registra el secreto, validación, derivación de claves o payload; al iniciar/completar/cancelar una generación y al cambiar el modo se vuelve a enmascarar.
- **REQ-135-015 (Verificación de clave individual):** la consulta offline inicia con la clave individual enmascarada y ofrece un botón nativo adyacente para mostrarla u ocultarla. Su nombre describe la acción actual y su `aria-controls` apunta al campo; `type="button"` evita enviar el formulario. Activarlo por teclado conserva foco y valor, no persiste ni transmite la clave y se refluye a 320 CSS px sin overflow.
- **REQ-135-016 (Contraste de controles del generador):** los textos de los botones secundarios CSV y XLSX, incluidos sus estados hover, mantienen contraste mínimo 4.5:1 en tema claro y oscuro y en anchos móviles de 320 y 390 CSS px. La medición automatizada espera a que termine la transición de tema para evaluar el estado visual estable.

## Criterios de Aceptación

1. El HTML grupal puede abrirse localmente o en vista previa sin depender de CDN, servidor EvaluaPro ni JavaScript. El modo individual requiere JavaScript y Web Crypto en el navegador; se explica que OneDrive podría bloquear ese formulario y cómo descargar/abrir el archivo localmente.
2. El reporte muestra el periodo y cada fila incluida en los datos recibidos, distingue valores ausentes de cero y excluye códigos, tokens, correos, respuestas OMR y otros campos sensibles no solicitados.
3. La descarga no sustituye ni deshabilita XLSX y no escribe en la carpeta interna de snapshots cifrados. El docente recibe instrucciones claras sobre visibilidad de la lista grupal, acceso de solo lectura y alternativa local cuando OneDrive no ejecute el formulario individual.
4. Cada alumno recibe una clave determinista distinta para su matrícula y ciclo, sin que el HTML contenga la clave ni los datos de filas en claro; una clave incorrecta u otra matrícula no revela el registro.
5. La lista privada de claves aparece únicamente en EvaluaPro tras generarla; no se guarda, incluye correo ni se registra en telemetría. El docente puede copiar la clave individual asociada a cada alumno.
6. El secreto maestro se identifica como obligatorio en el modo individual. Si se reutiliza al regenerar, las claves permanecen iguales; al cambiarlo, se generan claves nuevas y la UI avisa que deben redistribuirse.
7. La validación visual en OneDrive requiere una cuenta/tenant de prueba con datos dummy; una prueba local del HTML no basta para confirmar el comportamiento de la vista previa y de los enlaces compartidos.
8. Al cambiar el secreto o comenzar una nueva generación HTML, las claves anteriores dejan de mostrarse; los controles de contexto y el botón de generación permanecen deshabilitados durante la espera del selector nativo, la respuesta del servicio y el guardado, hasta terminar o cancelar la operación.
9. Las claves generadas tienen 22 caracteres base64url; el campo muestra y anuncia el formato, acepta una clave válida y marca una longitud o caracteres no admitidos antes de ejecutar la consulta.
10. El formulario tiene nombre accesible y Enter desde el secreto maestro genera el HTML con el periodo, modo y secreto visibles; CSV y XLSX no se disparan como envío secundario.
11. En modo individual, el resultado se muestra con cada etiqueta y valor visibles a 320 CSS px, sin scroll horizontal en documento o tarjeta; una clave válida nunca revela datos de otra matrícula.
12. Después de generar el HTML, cambiar el periodo, modo o secreto limpia el mensaje de resultado anterior; este no se presenta como válido para la configuración nueva.
13. El mensaje posterior al guardado confirma el archivo y la ubicación elegida sin dar por hecho que reemplazó una copia previa; menciona esperar la sincronización cuando el destino está en OneDrive.
14. Si la interfaz deshabilita la generación por falta de permiso, explica el motivo y el siguiente paso sin habilitar ni alterar las acciones protegidas.
15. Al abrir Actas y exportación mientras se cargan los periodos, se anuncia carga y no se presenta un falso vacío. Si falla la consulta sin periodos previos, se muestra error y reintento; si no hay periodos tras carga válida, se explica el vacío. Una lista ya cargada se conserva durante actualización/error.
16. En el HTML individual, la clave empieza oculta; el botón Mostrar/Ocultar alterna la visibilidad con ratón y teclado, conserva el valor y no dispara el envío. A 320 CSS px, ambos controles siguen visibles sin overflow.
17. Descargar CSV y Descargar XLSX mantienen contraste de texto de al menos 4.5:1 en reposo y hover, en tema claro/oscuro a 320/390 CSS px; la medición no captura un color intermedio de la transición de tema.

## Organización de la interfaz

El panel de exportación debe vivir en un componente enfocado, separado del coordinador
general de Calificaciones, para mantener la complejidad de la vista dentro del límite
ESLint y aislar estado temporal del secreto y las claves. La extracción debe conservar
las rutas, permisos, payloads, mensajes y acciones descritas en los requisitos.

### Mensaje de resultado ligado al contexto vigente (2026-10-31)

- Hallazgo: un resultado de generación permanecía visible tras cambiar periodo, modo o secreto, y podía parecer correspondiente a la nueva configuración.
- Cambio: los mensajes previos de resultado/error se limpian al cambiar cualquiera de esos controles; las claves personales continúan ocultándose cuando cambia el contexto.
- Validación focal: `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` cubre cambio de modo, secreto y periodo con datos dummy.

### Confirmación precisa del guardado del HTML (2026-11-03)

- Hallazgo: el mensaje decía «actualizado» incluso si se guardaba por primera vez en una ubicación nueva.
- Cambio: el resultado confirma «guardado en la ubicación seleccionada» y separa ese hecho de la sincronización pendiente con OneDrive.
- Validación focal: `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` comprueba el mensaje durante generación HTML grupal e individual y tras cambios de contexto.

### Acceso a reportes bloqueado por permiso (2026-11-03)

- Hallazgo: los botones de HTML, CSV y XLSX quedaban deshabilitados cuando faltaba el permiso, sin explicar el motivo ni cómo solicitar acceso.
- Cambio: el panel informa la condición junto a las acciones, manteniendo los botones deshabilitados.
- Validación focal: `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` comprueba el aviso y el bloqueo de los tres formatos.

## Validación focal prevista

- `apps/backend/tests/analiticas.xlsx.sv.contract.test.ts` y pruebas de exportación pertinentes para el reporte generado.
- `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` para modos del HTML, validación asociada del secreto y distribución manual de claves.
- ESLint focal, typecheck de paquetes afectados, guard WCAG aplicable y `git diff --check`.
- Prueba de aceptación de HTML con fixture dummy y verificación manual en OneDrive con enlace de lectura.
- E2E del archivo HTML generado abierto como `file://` en navegador real con Web Crypto: consulta incorrecta y correcta, aislamiento entre alumnos, estructura accesible y reflow a 320 CSS px.
- E2E focal del generador: contraste de las acciones CSV/XLSX y claves visibles en ambos temas; las aserciones esperan transiciones de color/fondo finitas antes de evaluar el contraste.
- Intento visual 2026-10-29: `localhost:4173` abrió en el navegador lateral, pero el runtime estaba autenticado con un perfil docente identificable. No se realizaron acciones en esa sesión ni se archivaron capturas; no había fixture dummy disponible.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-135-001, REQ-135-002, REQ-135-004, REQ-135-005 | Reportes grupal e individual autocontenidos, protección individual, consulta offline, reflow móvil y tabla imprimible | `apps/backend/tests/analiticas.html.calificaciones.test.ts`; `tests/gui-responsive/responsive-docente.spec.ts` | JSDOM valida cifrado/serialización; E2E Edge abre ambos archivos con `file://` y datos dummy. El individual valida clave correcta/incorrecta, aislamiento y campos a 320 px; el grupal verifica fichas rotuladas a 320/390/768 px, tabla a 1024 px e impresión. Capturas de grupo en `reports/qa/ux-audit-html-report-current-20261105/`. OneDrive real pendiente |
| REQ-135-003, REQ-135-006 | Generación/actualización local, permiso para generar, reemplazo manual en OneDrive y comunicación de vigencia/publicación | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | Además de comunicar guardado y sincronización, Calificaciones muestra la fecha/hora tomada del `<time datetime>` del HTML generado; prueba focal verifica el valor semántico. Reemplazo en runtime objetivo y OneDrive real pendientes |
| REQ-135-004, REQ-135-005 | Modo individual opcional con claves por matrícula/ciclo derivadas, cifrado independiente, secreto mínimo identificado como obligatorio, asociado al campo, y distribución manual | `apps/backend/tests/analiticas.html.calificaciones.test.ts`; `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Componente 33/33 PASS; E2E Edge sintético 1/1 a 320/390 CSS px, ambos temas: etiqueta visible «(obligatorio)», atributo `required`, error inline enlazado, corrección del mínimo y generación/teclado conservados. Captura 320 px inspeccionada en `reports/qa/ux-report-secret-required-20261105/`. OneDrive real pendiente |
| REQ-135-008 | Ocultar claves previas, fijar contexto durante generación/selección y comunicar correctamente cancelación | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | 15/15 PASS; se valida cancelación sin solicitud de backend, mensaje neutral y reactivación del botón |
| REQ-135-009 | Longitud/alfabeto de clave personal e instrucción asociada al campo | `apps/backend/tests/analiticas.html.calificaciones.test.ts` | Verifica clave de 22 caracteres, límites, patrón e instrucción asociada; archivo focal 7/7 PASS. La ejecución real en navegador sigue pendiente |
| REQ-135-010 | Envío semántico por Enter para generar HTML sin acoplar CSV/XLSX | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | 14/14 pruebas focales PASS; Enter, nombre del formulario, payload HTML y botones de exportación independientes verificados |
| REQ-135-011 | Mensaje de generación asociado al contexto vigente | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | Prueba focal añadida: el mensaje de éxito se limpia al cambiar el modo del reporte. |
| REQ-135-012 | Confirmación de guardado sin asumir reemplazo previo y espera de OneDrive | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | Prueba focal verifica el mensaje después del guardado en los modos grupal e individual. |
| REQ-135-013 | Estado explícito de carga, error recuperable y vacío confirmado del selector de periodos | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | Implementado; 3 casos nuevos cubren carga, error con reintento y conservación de la lista ante error de actualización. Suite focal 30/30 PASS; typecheck y guard WCAG PASS. |
| REQ-135-014 | Mostrar/enmascarar el secreto maestro solo bajo acción explícita y volver a ocultarlo al cambiar el contexto | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; 31/31 pruebas de componente y E2E 1/1 verifican enmascarado inicial, alternancia por teclado con nombre estable y `aria-pressed`, valor intacto, control mínimo 44 × 44 px, contraste de icono/límite/foco y reinicio tras cambiar modo/generar. |
| REQ-135-015 | Mostrar/ocultar clave individual en el reporte HTML offline | `apps/backend/tests/analiticas.html.calificaciones.test.ts`; `tests/gui-responsive/responsive-docente.spec.ts` | JSDOM 9/9 y E2E Edge 1/1 PASS: estado inicial enmascarado, botón no-submit, alternancia por Enter/Espacio, valor conservado y reflow a 320 CSS px. Captura inspeccionada en `reports/qa/ux-reporte-html-clave-toggle-20261103/clave-visible-320.png`. El preview estándar de E2E excedió su tiempo de espera; el mismo test se ejecutó con el bundle docente precompilado como servidor de salud y el HTML generado abierto por `file://`. Typecheck backend, ESLint focal, WCAG 81/81 y auditoría SDD PASS. |
| REQ-135-016 | Contraste estable de acciones CSV/XLSX, sus estados hover y las claves individuales en ambos temas | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge 1/1 PASS en 320/390 CSS px; espera transiciones finitas antes de medir. La comparación estable del CSS existente cumple ≥4.5:1, por lo que no se cambió el estilo de producto. Capturas inspeccionadas en `reports/qa/ux-html-report-baseline-stable-20261104/`. |
| REQ-135-007 | Contratos docentes existentes y XLSX preservados | `apps/backend/tests/analiticas.xlsx.sv.contract.test.ts`; `apps/frontend/tests/seccionCalificaciones.routing.test.tsx` | Verificado focalmente: contratos XLSX 9/9 y navegación/exportación Calificaciones 5/5; el endpoint del nuevo reporte conserva el payload acordado. No cubre vista previa o enlace compartido de OneDrive |

### Ajuste de accesibilidad 1.2.1

- El anillo de foco de los campos y botones del modo individual usa `#005ea8`, con
  contraste mínimo 3:1 medido frente a las superficies claras `#ffffff` y `#f3f6fb`.
- La prueba `analiticas.html.calificaciones.test.ts` calcula y bloquea ambos umbrales.

### Refactor focal de exportación 1.2.4

- La interfaz de exportación HTML/CSV/XLSX se aisló en `PanelExportacionCalificaciones.tsx`;
  permanece montada pero oculta al cambiar de vista para conservar modo, estado del reporte
  y claves mostradas. El coordinador `SeccionCalificaciones.tsx` queda bajo el límite
  ESLint de 1600 líneas.
- Se verificó de forma explícita que el contexto se bloquea mientras está abierto el
  selector de destino, además de durante la respuesta y el guardado.

### Validación posterior al refactor (2026-10-28)

- `tests/seccionCalificaciones.routing.test.tsx`: 11/11 PASS; incluye el selector nativo
  pendiente y verifica bloqueo del periodo, modo, secreto y botón de generación.
- `tests/analiticas.html.calificaciones.test.ts` y
  `tests/analiticas.xlsx.sv.contract.test.ts`: 16/16 PASS; el HTML grupal/individual y el
  contrato existente XLSX permanecen cubiertos.
- Typecheck de frontend y backend, ESLint focal de página/exportador y backend, guard
  WCAG (39/39 pares), auditoría SDD y `git diff --check`: PASS.
- ESLint normal dejó de exceder `max-lines`: `SeccionCalificaciones.tsx` queda en 1590
  líneas y el panel vive en `PanelExportacionCalificaciones.tsx`.
- La prueba de descarga produjo el aviso esperado de JSDOM «Not implemented: navigation
  to another Document» en dos casos; las pruebas concluyeron PASS. Vista real, OneDrive y
  reemplazo/sincronización permanecen pendientes de un tenant de prueba con datos dummy.

### Revisión visual responsive (2026-10-28)

- Se capturó el flujo del constructor con datos sintéticos en Edge a 390 px (oscuro y claro)
  y 1440 px; se verificó ausencia de desbordamiento horizontal.
- El primer render mostró que la tabla privada de claves recortaba encabezados y acciones en
  móvil. Se cambió a tarjetas semánticas con alumno, matrícula, clave y acción rotulados.
  La cabecera de formatos ahora puede ajustarse en varias líneas sin partir su texto.
- Evidencia: `reports/qa/ux-audit-20261028-reportes/`. Las capturas son de UI local con API
  interceptada y datos dummy; OneDrive y el reemplazo/sincronización real siguen pendientes.

### Revisión responsive adicional a 320 px (2026-10-29)

- El E2E focal ahora recorre la opción grupal, la configuración individual y las tarjetas de
  claves a 320 px, además de conservar capturas a 390 px y escritorio. El estándar WCAG 2.2
  SC 1.4.10 usa 320 CSS px como ancho de reflow para contenido con desplazamiento vertical;
  esto no sustituye zoom, lector de pantalla ni validación manual.
- Hallazgo: las opciones largas del modo se cortaban dentro del selector y el periodo
  elegido no se distinguía completo a 320 px. Se acortaron las opciones a «Lista grupal» y
  «Consulta individual»; el alcance sigue explicado en la ayuda persistente. El periodo
  completo ahora se repite como resumen visible, dinámico y asociado con `aria-describedby`,
  sin ampliar el nombre accesible del control.
- Evidencia actual: `reports/qa/ux-audit-20261029-reportes-current/` contiene capturas del
  estado grupal, individual y claves a 320 px, claves en ambos temas, 390 px y escritorio.
  Se usaron exclusivamente alumnos y credenciales ficticias con API interceptada.
- Pendiente: revisar el HTML descargado y los permisos/preview en un tenant OneDrive de
  prueba; también quedan keyboard/foco manual, zoom al 200 %, lector de pantalla y
  navegador con Web Crypto sin asistencia del runtime de pruebas.
- Validación focal final: Playwright `audita visualmente el generador de reportes con datos
  ficticios` 1/1 PASS; `tests/seccionCalificaciones.routing.test.tsx` 11/11 PASS; ESLint del
  E2E PASS; build docente PASS con TypeScript, lint, bundle guard y WCAG 39/39. SDD audit y
  `git diff --check` PASS.

### Reflow del HTML grupal (2026-10-29)

- El reporte presenta una ficha por alumno hasta 800 CSS px, con cada calificación rotulada;
  en escritorio conserva la tabla para comparar el grupo y en impresión se mantiene esa
  tabla. La región tabular tiene nombre, instrucción y foco de teclado.
- La prueba focal con dos filas sintéticas verifica las fichas, valores ausentes, contexto
  accesible, breakpoint, tabla impresa y conteo de filas. `analiticas.html.calificaciones.test.ts`
  8/8 PASS, typecheck backend, ESLint focal, auditoría SDD de SPEC-135 y `git diff --check`
  PASS.
- La apariencia real en navegador, impresión física y vista previa/enlace de OneDrive siguen
  pendientes; no se usaron datos reales.

### Envío por teclado del reporte individual (2026-10-29)

- **Hallazgo:** el secreto maestro y «Generar / actualizar HTML» no estaban dentro de un formulario; Enter desde el campo no iniciaba la acción primaria.
- **Cambio:** el panel ahora es un formulario accesible con envío HTML por Enter. CSV y XLSX siguen como controles independientes de tipo botón. No cambia el endpoint ni el payload.
- **Criterio:** WCAG 2.2 SC 2.1.1 exige que toda la funcionalidad se opere por teclado; se usa el envío nativo de formularios según la recomendación de W3C.
- **Validación focal:** `npm -C apps/frontend test -- tests/seccionCalificaciones.routing.test.tsx` (14/14 PASS); `npm -C apps/frontend run build:docente` PASS (TypeScript, ESLint, bundle docente y WCAG 54/54); `npm run sdd:audit` PASS; `git -c core.fsmonitor=false diff --check` PASS.
- **Límite:** la verificación del HTML en navegador local y OneDrive continúa pendiente.

### Reflow del resultado individual en navegador (2026-10-29)

- **Hallazgo visual:** al abrir el HTML individual a 320 CSS px, los resultados se creaban como una tabla con ancho mínimo de 680 px y quedaban parcialmente fuera de pantalla dentro de un scroll horizontal.
- **Cambio:** el resultado descifrado ahora se presenta como una ficha semántica con cada dato rotulado, usando el estilo responsivo ya establecido para las fichas del reporte grupal.
- **Evidencia actual:** `reports/qa/ux-report-file-20261029-edge/` contiene capturas inspeccionadas del HTML individual `file://`, antes de consultar y después de una consulta válida, en Edge a 320 CSS px.
- **Validación focal:** E2E real de navegador con dos alumnos ficticios, clave incorrecta/correcta, aislamiento entre alumnos, envío con Enter, Web Crypto, ausencia de recursos remotos y sin scroll horizontal: 1/1 PASS. `analiticas.html.calificaciones.test.ts`: 8/8 PASS; typecheck backend y ESLint focal PASS; `guard:wcag` 54/54 pares, `sdd:audit` y `git diff --check` PASS.
- **Límite:** OneDrive/SharePoint de prueba, lector de pantalla y zoom manual al 200 % continúan pendientes; las capturas y pruebas usan datos dummy y no acreditan ejecución del formulario en la vista previa de OneDrive.

### Revalidación actual del flujo de generación (2026-10-29)

- Playwright Edge `audita visualmente el generador de reportes con datos ficticios`: 1/1
  PASS. Verifica selección del periodo, modo individual, generación HTML, descarga y
  presentación de claves individuales con botón de copia; usa dos identidades ficticias.
- Capturas actuales inspeccionadas de generación previa y claves distribuidas en
  `reports/qa/ux-html-report-20261029-continue/`, incluida la vista de 320 px en tema claro.
- Límite: OneDrive real, runtime local, zoom manual al 200 % y lector de pantalla continúan
  pendientes. El E2E valida descarga local y fixture interceptado, no permisos ni reemplazo
  del archivo en OneDrive.

### Consulta individual: claridad de resultado y evidencia completa (2026-10-30)

- La inspección del HTML offline a 320 CSS px encontró que el anuncio exitoso «Consulta lista.»
  no expresaba qué podía hacer el alumno. Ahora indica «Resultado disponible para esta
  matrícula.»; conserva la región `role="status"` y no revela más datos.
- Las capturas E2E del formulario y resultado ahora abarcan la página completa, para que la
  evidencia no corte el encabezado al tomarla después del desplazamiento hacia la nota.
- Capturas actuales inspeccionadas en
  `reports/qa/ux-reporte-html-20261030-current-audit/`; se usaron solo dos identidades
  ficticias y el HTML se abrió como `file://` sin recursos remotos.
- Validación focal: `analiticas.html.calificaciones.test.ts` 8/8,
  `seccionCalificaciones.routing.test.tsx` 14/14 y E2E offline 1/1 PASS.
- La jerarquía de fichas y reflow se revisó con WCAG 2.2 SC 1.4.10 y las instrucciones de
  credencial con SC 3.3.2. Las capturas no prueban por sí solas conformidad; OneDrive real,
  teclado manual, lector de pantalla y zoom al 200 % siguen pendientes. Referencias W3C:
  [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) y
  [Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html).

### Distribución de controles del reporte en escritorio (2026-10-30)

- **Hallazgo visual:** el formulario individual ocupaba una tarjeta de escritorio muy ancha, pero
  apilaba periodo y modo de acceso como filas completas; eso alargaba el flujo y estiraba ambos
  selectores sin aportar espacio de lectura.
- **Cambio:** a partir de 1025 CSS px, periodo y modo de acceso comparten una fila en dos columnas;
  la explicación del modo, el secreto y las acciones conservan el ancho completo. Por debajo del
  breakpoint, los controles siguen apilados.
- **Validación focal:** E2E `audita visualmente el generador de reportes con datos ficticios` 1/1
  PASS; comprueba geometría de columnas en escritorio, no desbordamiento a 320 px y los modos
  grupal/individual con descarga y claves dummy. `seccionCalificaciones.routing.test.tsx` 14/14,
  ESLint focal y guard WCAG 59/59 pares PASS. Capturas inspeccionadas en
  `reports/qa/ux-audit-reportes-current-turn-final/`.
- **Límite:** no verifica OneDrive real, pantalla instalada, lector de pantalla ni zoom manual al
  200 %.

### Mensaje de cancelación del selector (2026-10-31)

- **Hallazgo:** al cancelar el selector nativo, «Actualización cancelada» asumía que el archivo ya existía aunque el docente estuviera generando el primer reporte.
- **Cambio:** el mensaje ahora dice «No se guardó el reporte; el archivo existente, si lo había, quedó intacto.» La prueba confirma que la cancelación no envía la solicitud de generación y reactiva el botón.
- **Alcance:** no cambia generación, archivo previo, contratos, persistencia ni sincronización OneDrive.
- **Validación:** `npm -C apps/frontend run test -- tests/seccionCalificaciones.routing.test.tsx` 15/15 PASS; `npm run build:frontend:docente` PASS (TypeScript, lint, bundle guard, WCAG 61/61); `npm run sdd:audit` PASS; `git diff --check` exit 0.

### Error inline del secreto maestro en navegador (2026-10-31)

- **Hallazgo reproducido:** al enviar vacío o con menos de 20 caracteres, la validación nativa HTML detenía el formulario antes de ejecutar el manejador `onSubmit`; el mensaje inline personalizado no aparecía en Edge.
- **Cambio:** el campo intercepta `invalid`, suprime el globo nativo y expone el error persistente junto al input, con `aria-invalid` y `aria-describedby`; al completar el mínimo, el error se retira.
- **Validación:** E2E Edge `audita visualmente el generador de reportes con datos ficticios` 1/1 PASS; prueba previa falló exactamente por ausencia del error inline. Datos y credenciales dummy; no se llamó a OneDrive.
- **Límite:** vista previa/reemplazo en OneDrive, teclado/foco manual fuera de Playwright, zoom 200 % y lector de pantalla siguen pendientes.

### Contraste de las acciones primarias del generador (2026-11-03)

- **Hallazgo:** «Generar / actualizar HTML» heredaba una superficie degradada de bajo contraste que también afectaba a otras acciones principales visibles en Calificaciones.
- **Cambio:** la paleta de acciones primarias del flavor docente usa fondo sólido opaco, texto blanco y un token de hover contrastado en ambos temas; estados deshabilitados siguen usando su tratamiento propio. Se elimina la excepción visual específica del generador.
- **Validación focal:** E2E Playwright Edge 1/1 PASS; inspecciona «Generar / actualizar HTML» y «Pasar lista» en 320/390 CSS px, en claro/oscuro, junto con el recorrido de reporte grupal e individual y claves dummy. Capturas en `reports/qa/ux-primary-contrast-20261103/`.
- **Límite:** los resultados concretos de la ejecución se anotan en el registro de cobertura después de correrla; no implica validación del runtime instalado ni de OneDrive real.

### Fecha de vigencia visible tras generar el HTML (2026-11-03)

- **Hallazgo:** aunque el HTML generado ya contiene su fecha, la pantalla docente no la mostraba; esto dificultaba distinguir una copia reciente antes de reemplazar el archivo sincronizado.
- **Cambio:** después de una generación exitosa, Calificaciones presenta la fecha/hora extraída del elemento semántico `<time datetime>` del HTML. La fecha se limpia al cambiar periodo, modo o secreto y no altera el payload ni el archivo. Si los metadatos faltan o no son una fecha válida, no inventa una fecha sustituta.
- **Validación focal:** `npm -C apps/frontend run test -- tests/seccionCalificaciones.routing.test.tsx` (30/30 PASS), ESLint de los dos archivos modificados, typecheck del frontend y `git diff --check` PASS.
- **Límite:** la prueba usa HTML sintético con metadatos dummy; no verifica el runtime instalado ni la sincronización de OneDrive.

### Contraste estable de exportaciones secundarias (2026-11-04)

- **Hallazgo inicial:** una lectura inmediata al cambiar tema midió un par bajo mientras fondo y texto aún transitaban entre paletas.
- **Verificación:** tras esperar las transiciones CSS finitas, el estilo de producto existente mantiene al menos 4.5:1. Se fijó el E2E para medir el estado estable y cubrir en reposo/hover Descargar CSV y Descargar XLSX en claro/oscuro a 320/390 CSS px, además de los datos/claves individuales ficticios.
- **Cambio de producto:** ninguno; la reproducción estable no confirmó una deficiencia de contraste.
- **Validación focal:** E2E Edge 1/1 PASS. Capturas inspeccionadas en `reports/qa/ux-html-report-baseline-stable-20261104/`.
- **Límites:** sin OneDrive real, runtime instalado, lector de pantalla ni zoom manual al 200 %.

### Secreto maestro identificado como obligatorio (2026-11-05)

- **Hallazgo:** el campo individual tenía `required` nativo y una ayuda con longitud mínima, pero la etiqueta visible no advertía que era obligatorio.
- **Cambio:** la etiqueta «Secreto maestro del ciclo» incorpora «(obligatorio)» solo en el modo individual; el campo y sus validaciones permanecen sin cambios.
- **Criterio:** WCAG 2.2 SC 3.3.2 recomienda identificar los campos requeridos para prevenir envíos incompletos ([W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)).
- **Validación focal:** prueba de componente de Calificaciones 33/33 PASS; E2E Edge con datos ficticios 1/1 PASS, incluida la etiqueta visible, `required`, generación y teclado; captura 320 CSS px inspeccionada. ESLint focal, typecheck y SDD audit PASS; build docente y verificación del bundle PASS; WCAG guard 100/100 pares PASS; `git diff --check` PASS.
