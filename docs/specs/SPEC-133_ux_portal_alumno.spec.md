---
id: SPEC-133
titulo: UX y accesibilidad del portal Alumno
version: 1.1.31
fecha: 2026-11-05
autor: Codex / EvaluaPro Team
modulo: frontend_portal_alumno_ux
estado: approved
---

## Contexto

El portal Alumno permite ingresar con código y matrícula, consultar resultados y su
detalle, descargar PDF, solicitar revisión de reactivos y registrar conformidad. El
componente principal también presenta perfil y contexto académico (materias, agenda,
avisos e historial). La revisión estática actual encontró oportunidades concretas de
claridad, recuperación y operación accesible. No se formula una conclusión visual: la
auditoría de runtime fue expresamente diferida.

Hallazgos comprobables en `apps/frontend/src/apps/app_alumno/AppAlumno.tsx`:

- El acceso usa un `<div>` y botón `type="button"`; no expone un formulario HTML con envío
  por Enter.
- La guía del acceso dice que, si no aparecen resultados, se pulse «Recargar», aunque en
  esa pantalla no existe esa acción. También hay instrucciones repetidas entre el hero y
  `HelperPanel`, y varios textos carecen de acentos. La cabecera del acceso también repite
  la misma promesa en el título, la descripción, el encabezado del formulario y el hero.
- El comentario de revisión se identifica solo con `placeholder`; su requisito de mínimo
  12 caracteres y el requisito de marcar preguntas se comunican mediante toast después
  de activar la acción.
- La tabla de comparación no incluye caption ni `scope` en encabezados; cada casilla de
  revisión tiene el mismo nombre «Revisar», sin indicar el número de pregunta.
- El botón que expande el detalle no expresa `aria-expanded` ni relaciona la acción con
  el panel que abre.
- Los fallos de detalle se muestran con opción de cerrar el aviso, pero sin una acción
  contextual para reintentar ese mismo folio.

La spec se limita a UX, accesibilidad, presentación y recuperación en el portal web. La
identidad visual y requisitos transversales existentes están definidos por SPEC-054; el
contrato funcional existente está descrito por SPEC-047.

## Referencias de diseño y accesibilidad

- W3C WCAG 2.2, [3.3.1 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification): identificar y describir errores de entrada en texto.
- W3C WCAG 2.2, [3.3.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions): proporcionar etiquetas e instrucciones cuando se requiere entrada.
- W3C WCAG 2.2, [3.3.3 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html): ofrecer sugerencias conocidas para corregir errores.
- W3C WCAG 2.2, [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): exponer estados sin mover el foco.
- W3C WCAG 2.2, [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): las tablas de datos pueden requerir desplazamiento bidimensional, pero una presentación móvil en tarjetas reduce esa carga cuando la estructura lo permite.
- W3C WAI, [Form Instructions Tutorial](https://www.w3.org/WAI/tutorials/forms/instructions/): asociar instrucciones con sus campos.
- WHATWG, [HTML Standard: autocomplete](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill): `one-time-code` identifica un código temporal de verificación; `current-password` identifica la credencial reutilizable de la cuenta.

## Requisitos Funcionales

- **REQ-133-001 Acceso operable:** convertir el acceso en un formulario semántico con
  envío por Enter y botón principal explícito; mantener etiquetas visibles, ayudas y
  validación asociada a cada campo, evitando ejemplos que parezcan credenciales ya
  ingresadas en los campos vacíos. Presentar matrícula antes del código para seguir el
  orden de usuario y credencial; ocultar el código al inicio, ofrecer mostrar/ocultar sin
  enviar el formulario y usar el autocompletado correspondiente a una credencial reutilizable.
  Conservar normalización, formatos admitidos, ruta, payload y política de intentos/cooldown
  vigentes.
- **REQ-133-002 Instrucciones precisas:** corregir la guía de acceso para no presentar
  acciones que aún no están disponibles; eliminar duplicidad de instrucciones y mejorar
  redacción, acentuación y términos para estudiantes sin cambiar reglas de negocio. En el
  acceso, el título, las instrucciones de credenciales y el resumen de funciones deben
  aportar información distinta, sin repetir una misma introducción en el hero.
- **REQ-133-003 Estados de acceso:** distinguir carga, éxito, error, espera de cooldown y
  recuperación. El aviso de cooldown explicará cuánto resta o cuándo se puede reintentar;
  tecnologías de asistencia recibirán un anuncio único al iniciar la espera, mientras que
  el contador que cambia cada segundo no generará anuncios repetidos que interrumpan la
  escritura. Al editar credenciales
  fuera del cooldown, retirar el error anterior del intento fallido; durante el cooldown,
  conservar el aviso que explica la espera. Mantener mensajes de error en texto y no
  exponer información sensible de autenticación.
- **REQ-133-004 Resultados y contexto:** organizar el resumen académico, resultados,
  materias, agenda, avisos e historial con jerarquía y etiquetas comprensibles. Los conteos
  especificarán qué representan y los estados vacíos o fallidos ofrecerán una acción
  contextual cuando la operación correspondiente exista. Si una tarjeta señala un error,
  la alerta global resumirá la disponibilidad y la acción sin repetir sus mensajes locales;
  aclarará que las calificaciones principales siguen disponibles cuando así sea. Los iconos de estas tarjetas
  deben representar semánticamente su área (por ejemplo, calendario para agenda e historial
  para registros), usando el catálogo común de producto y conservando familia y geometría.
- **REQ-133-005 Detalle por folio:** el control para abrir/cerrar detalle expondrá estado
  expandido y relación con su panel; su nombre accesible identificará el folio asociado y
  conservará ese contexto. El chevrón cambiará explícitamente entre iconos compartidos de
  abajo/arriba según `aria-expanded`, sin depender de transformaciones CSS sobre el estado.
  Los estados de carga y error serán locales a ese resultado y el
  error permitirá reintentar el detalle.
- **REQ-133-006 Comparación accesible:** incluir nombre/caption de tabla, encabezados con
  alcance explícito; marcar el número de pregunta de cada fila como encabezado de fila
  (`scope="row"`) y los encabezados restantes como encabezados de columna (`scope="col"`).
  Las casillas de selección tendrán un nombre que identifique pregunta y folio. Mantener los
  valores y estados recibidos del servicio sin reinterpretar aciertos.
- **REQ-133-007 Solicitud de revisión:** proporcionar etiqueta visible e instrucción
  persistente para comentario obligatorio, explicar el mínimo actual de 12 caracteres y
  el requisito de seleccionar al menos una pregunta. Informar la validación junto al
  formulario y preservar la selección/comentario al corregir. Mientras la solicitud está en
  curso, comunicar el estado y evitar envíos simultáneos duplicados para el mismo folio; si
  falla, volver a habilitar el reintento sin perder la entrada y mostrar el error recuperable
  junto al formulario. Deshabilitar temporalmente la selección y el comentario para que la
  solicitud visible coincida con el payload en curso. Comunicar éxito en el mismo contexto
  sin duplicar mensajes transitorios. Mantener exactamente la validación del cliente, ruta
  y payload existentes.
- **REQ-133-008 Conformidad y PDF:** mantener las acciones asociadas al folio correcto,
  incluir el folio en el nombre accesible de acciones repetidas como PDF, solicitud de
  revisión y conformidad, aclarar el estado de cada acción y hacer que sus confirmaciones
  de éxito/error también identifiquen el folio. Comunicar carga y resultado de forma
  accesible, sin cambiar sus endpoints, payloads ni manejo de archivos. La conformidad solo
  registra el valor positivo: durante el envío no se puede cambiar la casilla y, tras éxito,
  permanece marcada y bloqueada con un estado contextual persistente; un error recuperable
  permite reintentar sin perder la selección. No emitir un toast de éxito redundante.
- **REQ-133-009 Presentación accesible y adaptable:** respetar tokens y la identidad de
  SPEC-054; revisar claro/oscuro, foco, contraste, teclado, movimiento reducido, reflow a
  320 CSS px y zoom de texto a 200 %. Los botones con icono mantendrán separación visible
  entre icono y etiqueta, sin solapamiento ni pérdida de lectura. No depender solo del
  color, iconos o animación.
- **REQ-133-010 Contratos:** no cambiar autenticación, datos persistidos, permisos,
  endpoints, payloads, resultados, reglas de calificación ni estados contractuales OMR.
- **REQ-133-011 Prioridad de resultados:** en la vista autenticada, presentar la lista
  principal de calificaciones inmediatamente después del resumen de folios y antes del
  contexto secundario (perfil, materias, agenda, avisos, historial y guía). Conservar todos
  los datos y operaciones; no cambiar cálculos ni las listas internas.
- **REQ-133-012 Identificación de versión:** el control que abre la información de versión
  conserva el texto visible dentro de su nombre accesible e indica claramente la acción.
  En el tema claro, el texto pequeño del distintivo conserva contraste mínimo 4.5:1.
- **REQ-133-013 Avisos sin duplicación:** cuando un error ya aparece en una alerta contextual
  persistente con recuperación local, no repetir el mismo texto en un toast. Un toast
  adicional solo se mostrará si añade una acción necesaria para recuperar la sesión, con
  texto propio que complemente la alerta. Si el sistema invalida la sesión fuera de una
  acción voluntaria de salida, explicar junto al acceso que la sesión ya no está activa y
  cómo continuar; no atribuir el cierre al alumno ni mostrar el toast de salida voluntaria.
  La salida voluntaria conserva su confirmación breve. Mantener el detalle del error visible
  y preservar los flujos de reintento existentes.
- **REQ-133-016 Fin del cooldown:** al terminar la espera de seguridad, anunciar con `status`
  que el acceso vuelve a estar disponible y detener el temporizador de actualización. Durante
  la espera, conservar el contador visible fuera de la región viva para no anunciar cada
  segundo. No cambiar la duración ni el número de intentos.
- **REQ-133-017 Errores de PDF comprensibles:** ante errores HTTP al abrir el PDF, el aviso identifica el folio y explica el estado con una acción comprensible, sin exponer códigos HTTP como mensaje visible. Mantener una acción de recuperación de sesión en 401 y conservar el status HTTP en telemetría para diagnóstico; no cambiar la ruta ni los permisos.
- **REQ-133-018 Comparación móvil legible:** hasta 700 CSS px presentar cada pregunta como tarjeta vertical con etiquetas visibles para clave correcta, respuesta, estado y solicitud de revisión; evitar que la acción dependa del desplazamiento horizontal. Mantener una única representación expuesta a accesibilidad en cada breakpoint, sincronizar ambas presentaciones con la misma selección y validación, y conservar la tabla semántica en pantallas amplias. No cambiar datos, cálculos ni payloads.

## Criterios de Aceptación

1. Se puede enviar el acceso con Enter o el botón, y el formulario expone nombres,
   ayudas y errores asociados; los formatos, normalización y requests se conservan.
2. Ninguna instrucción ofrece una acción ausente de la pantalla; el texto está corregido y
   es consistente, y la cabecera de acceso, las instrucciones del formulario y la lista de
   funciones tienen propósitos distintos sin repetir la misma promesa.
3. El cooldown, carga, errores y éxitos son entendibles y accesibles; el cooldown no causa
   anuncios cada segundo.
4. El control de cada resultado y sus acciones repetidas permiten identificar su folio por
   nombre accesible; el detalle comunica estado expandido, carga, fallo y reintento local sin
   perder el folio seleccionado.
5. La tabla puede identificarse fuera de contexto; los encabezados y checkboxes distinguen
   filas/preguntas y folio.
6. Antes de enviar una revisión, la interfaz explica selección y longitud mínima; las
   validaciones aparecen junto a los controles y conservan valores al corregirse. El
   request resultante mantiene el mismo esquema.
7. La revisión por tema claro/oscuro, foco, teclado, contraste y responsive no encuentra
   pérdida de contenido o interacción dentro del alcance.
8. La matriz no declarará verificada la revisión visual manual hasta contar con capturas
   actuales del runtime y comprobación en ambos temas, anchos y zoom aplicables.
9. En el acceso, el icono y el texto de «Consultar» conservan al menos 6 CSS px de separación y ambos permanecen legibles a los siete anchos del recorrido.
10. En resultados, los folios y calificaciones aparecen en el orden del DOM inmediatamente
    tras el resumen y antes del contexto secundario, a 320 CSS px y en escritorio.
11. El distintivo de versión tiene nombre accesible que incluye su texto visible y la acción;
    su contraste conservador en tema claro cumple 4.5:1 como mínimo.
12. Los errores de acceso, resultados y detalle no generan anuncios de toast redundantes;
    el toast de sesión, si aparece, comunica una instrucción de recuperación distinta.
13. Mientras se envía una solicitud de revisión, pregunta y comentario quedan bloqueados;
    al terminar se habilitan. El error queda junto al formulario y permite reintentar con la
    selección y comentario conservados; el éxito también se anuncia en contexto y no duplica
    un toast.
14. Al desplazar la tabla comparativa con teclado, el foco visible queda en la región de
    comparación y no añade un contorno redundante a toda la tarjeta del folio.
15. En móvil (hasta 700 CSS px), cada pregunta se presenta en una tarjeta vertical con sus
    cuatro etiquetas y checkbox visibles sin desplazamiento horizontal; en pantallas amplias
    se conserva la tabla semántica con encabezados y navegación por teclado.
16. Si falla la consulta de resultados, no se presenta «Sin resultados»; la alerta ofrece
    reintentar la consulta sin volver a ingresar. Un resultado vacío solo aparece después
    de una respuesta válida sin filas.
17. Al terminar el cooldown, el estado accesible anuncia que se puede volver a ingresar y el
    botón «Consultar» queda habilitado. El temporizador deja de ejecutarse hasta el siguiente
    cooldown, sin anuncios por segundo ni cambios a la política de seguridad.
18. El control visible de abrir/cerrar detalle no muestra un tooltip redundante que cubra datos del folio; su nombre accesible sigue identificando la acción y el folio.
19. La confirmación de conformidad no se puede alterar mientras se envía ni después de quedar
    registrada; el error vuelve a habilitar el reintento conservando la selección, y el éxito
    identifica el folio en un estado accesible del mismo contexto sin duplicarse en un toast.
20. En el acceso, matrícula precede al código; el código inicia oculto y se marca como
    credencial reutilizable, y el botón accesible permite mostrarlo y ocultarlo sin perder el
    valor ni enviar el formulario.
21. Los campos vacíos de matrícula y código no muestran placeholders con apariencia de
    credenciales; sus etiquetas visibles e instrucciones accesibles explican qué ingresar.
22. Las tarjetas de contexto usan iconos cuyo significado coincide con perfil, materias,
    agenda, avisos e historial. Todos provienen del catálogo compartido y conservan escala,
    trazo, marco y nombres accesibles/decorativos establecidos.
23. Si falla una consulta de contexto con las calificaciones disponibles, la alerta global
    comunica que algunos datos académicos faltan y que los resultados siguen disponibles;
    los detalles identifican el área afectada en su tarjeta, sin duplicar el texto del error.
    La acción de reintento recupera el contexto sin volver a consultar los resultados.

## Validación focal prevista

- `apps/frontend/tests/appAlumno.behavior.test.tsx` y `apps/frontend/tests/appAlumno.test.tsx`:
  acceso por Enter, cooldown, persistencia de formularios, detalle, revisión, conformidad,
  PDF y estados recuperables.
- `apps/frontend/tests/ux.quality.test.tsx` y `apps/frontend/tests/ux.visual.test.tsx`:
  contrato de shell alumno y texto/estados que cambien.
- `apps/frontend/tests/gui.responsive.contract.test.tsx` solo si se modifican reglas
  responsive del portal.
- ESLint de los componentes y pruebas afectadas, typecheck frontend, `guard:wcag` y
  `git diff --check`.
- Captura/runtime en tema claro y oscuro, teclado, 320 CSS px y zoom de texto al 200 %;
  verificación manual de lector de pantalla si el entorno está disponible.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-133-001, REQ-133-002, criterios 20–21 | Formulario de acceso, credenciales, guía, jerarquía de contenido y errores asociados | `apps/frontend/tests/appAlumno.behavior.test.tsx`; `apps/frontend/tests/appAlumno.test.tsx`; `apps/frontend/tests/ux.quality.test.tsx`; `apps/frontend/tests/ux.visual.test.tsx`; `tests/gui-responsive/responsive-alumno.spec.ts` | El acceso pone matrícula antes del código, usa `current-password`, la oculta por defecto y ofrece mostrar/ocultar con teclado. Los campos vacíos no presentan ejemplos que parezcan credenciales capturadas y conservan sus etiquetas e instrucciones. Pendientes de validación en runtime instalado, zoom real y lector de pantalla |
| REQ-133-003, REQ-133-004, criterios 22–23 | Cooldown, contexto, conteos, iconos semánticos y recuperación contextual sin mensajes duplicados | `apps/frontend/tests/appAlumno.behavior.test.tsx`; `apps/frontend/tests/iconos.test.tsx`; `tests/gui-responsive/responsive-alumno.spec.ts` | La prueba de comportamiento cubre cooldown, error/vacío y reintento tras 503 sin volver a ingresar ni recargar resultados. E2E Edge valida iconos semánticos y captura el fallo actual a 320 CSS px, en claro/oscuro: resumen global sin repetir el error de la tarjeta, lista de calificaciones visible y CTA recuperable. Al cerrar sesión se vacían datos locales y respuestas tardías de otra sesión no reemplazan el contexto activo. |
| REQ-133-005, REQ-133-006, criterio 18 | Detalle por folio, reintento, chevrón coherente con estado, encabezados y nombre de pregunta | `apps/frontend/tests/appAlumno.behavior.test.tsx`; `tests/gui-responsive/responsive-alumno.spec.ts`; `apps/frontend/tests/iconos.test.tsx` | Estado expandido, reintento, caption y encabezados explícitos. E2E móvil verifica iconos compartidos distintos `chevronAbajo`/`chevronArriba`, sincronizados con `aria-expanded`, que Ver/Ocultar conserve el folio en el nombre accesible y que no aparezca tooltip redundante. |
| REQ-133-007, REQ-133-008, criterio 19 | Solicitud de revisión, conformidad no reversible y PDF identificados por folio | `apps/frontend/tests/appAlumno.behavior.test.tsx` | Implementado; prueba de comportamiento 14/14 PASS. Durante el envío y tras el éxito la casilla queda bloqueada; un error recuperable permite reintentar conservando selección. El éxito identifica el folio en un estado contextual persistente y no duplica toast. Endpoint y payload inalterados. |
| REQ-133-009 | Reflow responsive, separación de icono/etiqueta, tabla comparativa y evidencia visual | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `apps/frontend/tests/ux.visual.test.tsx`; `tests/gui-responsive/responsive-alumno.spec.ts` | Reflow sintético cubierto a 320/360/390/768/1024/1440 px; E2E verifica separación mínima de 6 px entre icono y texto del botón principal en los siete anchos. Captura actual a 320 px detectó el título de tabla oculto dentro del scroll horizontal; ahora queda visible antes de la tabla y el caption sigue disponible para lectores de pantalla. E2E focal en Edge 2/2 PASS (login claro y flujo móvil angosto con resultados/detalle). Zoom, lector y runtime instalado pendientes |
| REQ-133-010 | Conservación de rutas y payloads del portal | `apps/frontend/tests/appAlumno.behavior.test.tsx` | Sin cambios de contrato; request/payload existentes verificados. El reinicio por sesión solo afecta estado transitorio de la interfaz |
| REQ-133-011 | Prioridad de calificaciones frente a contexto secundario | `tests/gui-responsive/responsive-alumno.spec.ts`; `reports/qa/ux-portal-alumno-20261029-current-turn/` | Implementado: el resumen contiene solo folios y la lista de calificaciones es su siguiente elemento en el DOM, antes del contexto secundario. Los conteos de materias y avisos permanecen en sus tarjetas. E2E focal verifica orden, datos y reflow a 320, 360, 390, 768, 1024, 1440 y 1920 CSS px. |
| REQ-133-012 | Nombre y contraste del distintivo de versión | `tests/gui-responsive/responsive-alumno.spec.ts` | E2E focal 1/1 PASS; nombre incluye versión visible y acción, contraste conservador ≥4.5:1 |
| REQ-133-013 | Errores contextuales sin toast duplicado; diferenciar salida voluntaria e invalidación de sesión | `apps/frontend/tests/appAlumno.behavior.test.tsx`; `tests/gui-responsive/responsive-alumno.spec.ts` | Componente 16/16 PASS. E2E Edge sintético focal 1/1 en 320 CSS px: invalidación limpia token, vuelve al formulario y explica el nuevo acceso sin toast de salida; salida voluntaria conserva su toast según prueba de componente. Capturas claro/oscuro en `reports/qa/ux-alumno-session-invalidation-20261105/`. Runtime instalado y lector de pantalla pendientes. |
| REQ-133-014 | Foco visible localizado en la región comparativa, sin contorno redundante en la tarjeta del folio | `tests/gui-responsive/responsive-alumno.spec.ts` | E2E Edge 8/8 PASS con navegación por teclado; capturas a 320/360 CSS px. Runtime instalado, zoom 200 % y lector de pantalla pendientes |
| REQ-133-015, REQ-133-018 | Comparación móvil en tarjetas sin desplazamiento horizontal; tabla semántica en pantallas amplias | `tests/gui-responsive/responsive-alumno.spec.ts`; `apps/frontend/tests/appAlumno.behavior.test.tsx` | Implementado; E2E Edge final 3/3 en 320, 768 y 1920 CSS px, además de corrida responsive 10/10; componente 16/16. Confirma cuatro etiquetas visibles por tarjeta, checkbox accesible, tabla/encabezados en tablet y escritorio, y sin overflow lateral en temas claro/oscuro. Build Alumno, typecheck, ESLint focal, WCAG 102/102, SDD y diff-check PASS. Zoom 200 % y lector de pantalla pendientes. |
| REQ-133-016 | Fin del cooldown anunciado y temporizador detenido | `apps/frontend/tests/appAlumno.behavior.test.tsx` | Prueba focal verifica el mensaje `status`, reactivación del botón y limpieza del intervalo al vencer la espera. |
| REQ-133-017 | Errores HTTP de PDF en lenguaje claro, identificados por folio y con recuperación de sesión en 401 | `apps/frontend/tests/appAlumno.behavior.test.tsx` | Prueba focal 14/14 PASS cubre 401, 403, 404, 429 y 503; verifica recuperación de sesión en 401, status en telemetría y ausencia de «HTTP N» visible. ESLint, typecheck, SDD y `git diff --check` PASS. |

### Jerarquía de copy en el acceso (2026-10-31)

- Hallazgo estático: título, descripción principal, encabezado del formulario y hero
  repetían la promesa genérica de consultar resultados, sin separar el propósito de la
  pantalla de las instrucciones de acceso ni de las funciones disponibles.
- Cambio: la cabecera expresa la consulta; el formulario se titula «Ingresa al portal» y
  explica las credenciales; el hero introduce la lista con «Después de ingresar» y
  «Podrás consultar». Se mantienen los formatos, rutas y mensajes de acceso.
- Validación: `appAlumno.behavior.test.tsx` + `appAlumno.test.tsx` 14/14 PASS;
  `ux.quality.test.tsx` 1/1 PASS; snapshot DOM de `ux.visual.test.tsx` 1/1 PASS;
  ESLint focal y typecheck frontend PASS.
- Límite: es evidencia estática y de render de componente; no acredita captura visual del
  runtime instalado, zoom 200 % ni lector de pantalla.

### Resultado contextual de solicitud de revisión (2026-10-31)

- Durante el envío, las preguntas y el comentario quedan bloqueados para mantener la
  correspondencia entre lo visible y la solicitud enviada.
- Los errores y éxitos de revisión se presentan junto al formulario con semántica accesible;
  solo se conserva un toast si ofrece una acción adicional de recuperación de sesión.
- Un fallo vuelve a habilitar los controles y conserva las entradas para reintentar. No
  cambian validaciones, ruta ni payload.
- Validación: `appAlumno.behavior.test.tsx` + `appAlumno.test.tsx` 14/14 PASS; ESLint
  focal PASS; `build:alumno` PASS; `sdd:audit` PASS; `git diff --check` PASS.
- Límite: no se hizo captura nueva ni verificación del runtime instalado, zoom al 200 % o
  lector de pantalla.

### Verificación del distintivo de versión (2026-10-30)

- En la captura de acceso del Portal Alumno en tema claro, el sello `v1.2.10` conserva
  legibilidad junto al selector de tema y no se confunde con un botón sin contexto.
- El nombre accesible ahora identifica versión y acción (`Versión v1.2.10. Abrir
  información de versión`); la aserción valida la versión visible y la acción.
- El E2E en Microsoft Edge, viewport móvil de 390 CSS px y fixture sintético aprobó
  1/1; contraste estimado de forma conservadora contra blanco: al menos 4.5:1.
- Captura: `reports/qa/ux-alumno-20261030-current/gui-alumno-login-claro-mobile.png`.
- La captura es de preview con datos sintéticos, no una captura de la instalación local.

### Revalidación responsive con fixture sintético (2026-10-29)

- E2E en preview aislado con perfil y resultados ficticios: acceso, resumen y detalle a
  320/360/390 CSS px; tabla comparativa desplazable y solicitud de revisión en los tres
  anchos móviles. Acceso/resultados también se verifican a 768/1024/1440 CSS px; el
  login y resultados se capturan en ambos temas en móvil. Los recorridos por ancho pasan
  1/1; no hay overflow horizontal y los controles tienen nombre accesible.
- La inspección de capturas confirma que el resumen evita repetir conteos de materias y
  avisos, concentra métricas/contexto en anchos móviles medianos y conserva una columna a
  320 px. La ayuda de revisión usa título y pasos más cortos. El detalle y la guía aún
  hacen largo el documento completo, aunque toda la información y las acciones siguen
  visibles.
- Revalidación tras el cambio: `appAlumno.test.tsx` + `appAlumno.behavior.test.tsx` 12/12
  PASS; el contrato UX para alumno pasa 2/2; E2E móvil 3/3 PASS a 320/360/390 px, con
  assertion de columnas y títulos sin cortes.
- Límite: evidencia del preview con fixture sintético; no verifica instalación local,
  zoom al 200 %, tecnologías de asistencia ni todos los estados de negocio.

### Prioridad de resultados en móvil (2026-10-29)

- Captura E2E actual a 320 CSS px: los folios aparecían después de Perfil, Materias,
  Agenda, Avisos, Historial y una guía de tres pasos, aunque consultar calificaciones es la
  tarea principal del portal.
- Criterio aplicado: diferir contenido secundario para mantener el primer recorrido enfocado
  en la tarea principal, conservando acceso al contexto y ayuda ([NN/g, Defer Secondary
  Content When Writing for Mobile Users](https://www.nngroup.com/articles/defer-secondary-content-for-mobile/);
  [GOV.UK, Writing for user interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces)).
- Criterio aplicado: la consulta de calificaciones es la tarea principal tras el acceso; el
  contexto y la guía son secundarios, aunque siguen disponibles en la misma pantalla.
- Implementación: la lista «Resultados por folio» pasa inmediatamente después del resumen y
  antes de las tarjetas de contexto y la guía; no cambian folios, datos, operaciones ni
  respuestas del servicio.
- Playwright en Edge con fixture sintético: `GUI_RESPONSIVE_ALUMNO_PORT=4193
  E2E_BROWSER_CHANNEL=msedge npm run test:gui:responsive:e2e:alumno -- --grep "login estable
  en (mobile-narrow|desktop-lg)"` → 2/2 PASS a 320 y 1920 CSS px. Se comprueba el orden
  del DOM. Capturas actuales en `reports/qa/ux-portal-alumno-20261029-current-turn/`.
- Pruebas `appAlumno.test.tsx` y `appAlumno.behavior.test.tsx`: 12/12 PASS; ESLint,
  typecheck frontend, SDD y `git diff --check` PASS.

## Resultado de validación focal (2026-10-28)

- `npm run test -- tests/appAlumno.test.tsx tests/appAlumno.behavior.test.tsx --reporter=dot`:
  2 archivos y 8 pruebas aprobadas.
- `npm run typecheck` en `apps/frontend`: aprobado.
- ESLint focal de `AppAlumno.tsx` y sus pruebas: aprobado.
- Build de producción Alumno en una carpeta temporal aislada: aprobado.
- `npm run guard:wcag`: bloqueado por el lint global en archivos preexistentes de otras
  secciones (`SeccionCalificaciones.tsx` y `SeccionPlantillas.tsx`, regla `max-lines`);
  no reportó errores en los archivos de esta spec.
- No se hizo auditoría visual runtime; no se afirma conformidad visual o WCAG completa.

### Revalidación focal posterior (2026-10-28)

- Se agregó estado visible de preparación de PDF y de envío de conformidad por folio; el PDF listo ofrece una instrucción si el navegador bloquea ventanas emergentes. Endpoints y payloads no cambian.
- Pruebas de `appAlumno.test.tsx` y `appAlumno.behavior.test.tsx`: 8/8 PASS; ESLint focal y typecheck frontend PASS.
- Build Alumno dirigido a `.tmp/spec133-dist-alumno-2`: PASS. `guard:wcag -- --skip-lint`: 33/33 pares PASS.
- La auditoría visual runtime sigue pendiente; esta revalidación no comprueba lector de pantalla ni apariencia en ambos temas/zoom/ancho.

### Aprobación y verificación focal (2026-10-28)

- La persona usuaria aprobó la implementación de SPEC-133.
- Repetición de `tests/appAlumno.test.tsx` y `tests/appAlumno.behavior.test.tsx`: 8/8 PASS.
- ESLint focal de `AppAlumno.tsx` y ambas pruebas: PASS; `npm run typecheck` en
  `apps/frontend`: PASS; `git diff --check`: PASS.
- Se corrigió además la indentación inconsistente de las etiquetas de Agenda y Avisos.
- La revisión visual de runtime continúa pendiente; no se declara conformidad visual
  completa a partir de pruebas automatizadas.

### Claridad de escalas de calificación (2026-10-28)

- La tarjeta ahora distingue la nota del examen (sobre 5) de las calificaciones de
  parcial/global y de periodo (sobre 10), con formato numérico `es-MX`.
- El detalle presenta en una sección plegable la versión de política y los bloques de
  evaluación continua/exámenes, indicando que se expresan sobre 10. No cambia cálculos,
  datos, endpoints ni payloads.
- `tests/appAlumno.behavior.test.tsx` y `tests/appAlumno.test.tsx`: 9/9 PASS; ESLint focal,
  typecheck frontend, `guard:wcag -- --skip-lint` (33/33 pares de contraste) y
  `git diff --check`: PASS.
- La inspección visual runtime sigue pendiente; estas comprobaciones automatizadas no
  acreditan apariencia final en temas, zoom o anchos móviles.

### Recuperación aislada del contexto académico (2026-10-28)

- Las consultas de perfil, materias, agenda, avisos e historial ahora se resuelven de
  forma independiente; el fallo de una no descarta respuestas correctas de las demás.
- Las tarjetas distinguen «no disponible por error» de una lista realmente vacía, aclaran
  los conteos mostrados y ofrecen reintentar contexto sin volver a consultar resultados.
  Se conservan rutas, payloads y datos recibidos.
- `appAlumno.behavior.test.tsx` y `appAlumno.test.tsx`: 10/10 PASS; typecheck y ESLint
  focal PASS; build Alumno aislado PASS; `guard:wcag -- --skip-lint` (39/39 pares),
  `sdd:audit` y `git diff --check` PASS.
- La revisión visual runtime continúa pendiente y no se afirma conformidad visual completa.

### Limpieza de datos de sesión y respuestas tardías (2026-10-28)

- Cerrar sesión y comenzar una nueva vacían los datos locales del alumno anterior,
  incluidos perfil, contexto académico, cachés por folio y borradores. Las respuestas
  de cargas anteriores no pueden repoblar esos datos ni mostrar avisos en la sesión nueva.
- `appAlumno.test.tsx` y `appAlumno.behavior.test.tsx`: 12/12 PASS. Incluye cambio de
  alumno con el nuevo perfil demorado y resultado que llega después del cierre de sesión.
- No cambia rutas ni payloads. ESLint focal, typecheck, guard WCAG y auditoría SDD PASS.
- Sigue pendiente la inspección visual en runtime.

### Prioridad del acceso en móvil (2026-10-28)

- La captura E2E inicial a 390 × 844 CSS px mostró que la introducción, beneficios y
  decoración empujaban el formulario completo fuera del primer viewport. Se reordenó el
  DOM para que el formulario aparezca primero en móvil y su orden visual coincida con la
  lectura y el foco. En escritorio se conserva la presentación a la izquierda y el
  formulario a la derecha.
- Se retiraron insignias repetidas y la ilustración decorativa; el formulario ahora tiene
  su propio encabezado. A 360 px o menos se compacta la introducción para que el CTA no
  quede cortado.
- Evidencia antes/después y límites: `reports/qa/ux-wave1/portal-alumno-login-visual-audit-20261028.md`.
- E2E de acceso con API ficticia: 5/5 PASS a 1920, 1024, 768, 390 y 320 CSS px; a 390
  y 320 el título, ambos campos y botón están completamente dentro del primer viewport.
  Tema claro en móvil 390 px: 1/1 PASS con el mismo criterio de visibilidad completa.
  Pruebas focales Alumno/responsive 36/36 PASS, UX del acceso 1/1 PASS, build Alumno,
  ESLint focal, `guard:wcag -- --skip-lint` (39/39 pares) y `git diff --check` PASS.
- Tema claro se verificó en el preview a 390 px. Zoom al 200 %, verificación manual de
  foco y lector de pantalla siguen pendientes; las capturas del preview no acreditan el
  runtime instalado ni conformidad WCAG completa.

### Detalle comparativo desplazable en móvil (2026-10-29)

- **Hallazgo visual:** la tabla conserva las cinco columnas dentro de una región con desplazamiento horizontal para evitar overflow de página, pero en pantallas estrechas no explicaba que había más columnas ni podía recibir foco para desplazarse con teclado.
- **Cambio:** la región comparativa por folio ahora tiene nombre accesible, descripción, foco visible y `tabIndex=0`; en móvil muestra una instrucción para desplazarse horizontalmente. No cambia filas, resultados, selección ni payloads de revisión.
- **Validación:** E2E de Portal Alumno 6/6 PASS en cinco anchos y tema claro; abrió el detalle, verificó región/tabla/campo de comentario, desplazamiento sin overflow y foco a 320/390 px. 12/12 pruebas de `appAlumno.test.tsx` y `appAlumno.behavior.test.tsx` PASS. Capturas de página completa en ambos temas a 390 px y del detalle a 320 px en `%TEMP%\evaluapro-ux-alumno-20261029`.
- **Límite:** las capturas provienen de preview aislado con respuestas sintéticas; zoom 200 %, lector de pantalla y runtime instalado siguen pendientes. La spec permanece `approved`.

### Consistencia de fixture y capturas de calificaciones (2026-10-29)

- La revisión de las capturas detectó que el fixture declaraba 17/20 aciertos y una nota de
  8.5/5. El valor ficticio no concordaba con el cálculo ni con la escala que presenta la GUI.
- Se corrigió a 4.25/5 y el E2E ahora verifica ese texto, además de acentos en «Matemáticas» y
  «Revisión de resultados». No cambia código de producción, cálculo ni datos del portal.
- `npm run test:gui:responsive:e2e:alumno`: 8/8 PASS, incluidas siete dimensiones y el login
  claro; capturas actualizadas en `reports/qa/ux-alumno-fixture-valid-20261029/`. ESLint focal
  PASS.
- Evidencia limitada a fixtures sintéticos; no implica comprobación de runtime instalado ni
  de datos reales.

### Evitar doble envío de solicitud de revisión (2026-10-29)

- Hallazgo estático: el botón de solicitud no reflejaba el estado de envío; con respuesta lenta,
  activarlo varias veces podía emitir solicitudes paralelas para el mismo folio.
- Cambio: se expone «Enviando solicitud…», `aria-busy` y botón deshabilitado por folio durante
  el POST, con bloqueo sincrónico para impedir doble activación antes del siguiente render.
  Al fallar, se libera el envío y se conservan selección y comentario para reintentar. Ruta,
  payload y validaciones permanecen iguales.
- Validación focal: `tests/appAlumno.behavior.test.tsx` 9/9 PASS; comprueba una sola solicitud
  mientras está en curso, reintento tras fallo y conservación de la entrada.
- `build:docente` PASS con TypeScript, ESLint, bundle guard y contraste WCAG 54/54; auditoría
  `sdd:audit` y `git diff --check` PASS. Revisión manual en runtime instalado y lector de
  pantalla pendientes según el criterio de aceptación general.

### Revalidación móvil actual (2026-10-29)

- Playwright Edge `login estable en mobile-narrow`: 1/1 PASS a 320 × 844 CSS px con
  respuestas interceptadas y expediente ficticio. Recorre acceso, resultados y detalle;
  comprueba nombres de controles, reflow, tabla de respuestas y solicitud de revisión.
- Capturas actuales inspeccionadas en
  `reports/qa/ux-portal-alumno-20261029-continue/`: acceso, resultados en ambos temas y
  detalle.
- Límite: preview sintético, no instalación local. Runtime canónico no disponible; zoom real
  al 200 %, lector de pantalla y sincronización real siguen pendientes.

### Avisos de error contextuales (2026-10-31)

- Hallazgo estático: el fallo de ingreso, resultados y detalle se anunciaba tanto en una
  alerta persistente local como en un toast con el mismo error; en la mayoría de fallos el
  toast no añadía recuperación.
- Cambio: la alerta local queda como mensaje principal. Solo se emite un toast cuando el
  error ofrece una acción de sesión, con instrucción breve y distinta para evitar repetir el
  error. Rutas, payloads y reintentos no cambian.
- Referencia: WCAG 2.2 SC 4.1.3 recomienda hacer identificables los mensajes de estado sin
  mover el foco ni interrumpir innecesariamente el trabajo.
- Validación focal: `appAlumno.behavior.test.tsx` y `appAlumno.test.tsx` → 14/14 PASS;
  build Alumno, ESLint focal, guard WCAG (61/61), auditoría SDD y `git diff --check` PASS.
- Límite: análisis estático; no es una comprobación con lector de pantalla ni runtime.

### Foco localizado en la comparación del folio (2026-10-31)

- Hallazgo en captura sintética actual a 360 CSS px: al enfocar la región con la tabla
  comparativa, el estilo compartido marcaba también la tarjeta completa del folio.
- Cambio: el indicador `:focus-visible` permanece en la región desplazable; se elimina el
  contorno adicional de sus tarjetas ancestro en Docente y Alumno. Administración conserva
  su regla previa.
- Validación: `responsive-alumno.spec.ts` 8/8 PASS en Edge (revalidado el 2026-10-31) con
  respuestas interceptadas a 320/360/390 CSS px y anchos de tablet/escritorio; comprueba foco de teclado en región y
  ausencia de contorno en la tarjeta. Capturas en
  `reports/qa/ux-entrega-current-focus-20261031/alumno-regression/`.
- Fundamento: WCAG 2.2 SC 2.4.7 requiere foco visible para identificar el componente activo;
  [W3C: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).
- Límite: preview con datos ficticios; lector de pantalla, zoom manual al 200 % y runtime
  instalado siguen pendientes.

### Encabezado de fila para pregunta (2026-10-31)

- Hallazgo: la columna «Pregunta» mostraba el número de reactivo como `<td>`, sin declararlo
  como encabezado de su fila.
- Cambio: el número ahora usa `<th scope="row">`; las cinco columnas conservan sus
  encabezados `<th scope="col">`, el caption y los valores del servicio.
- Fundamento: el tutorial de tablas de WAI/W3C explica que `<th>` y `scope="row"`/`scope="col"`
  exponen las relaciones entre encabezados y celdas para tecnologías de asistencia:
  https://www.w3.org/WAI/tutorials/tables/two-headers/.
- Validación focal: `appAlumno.behavior.test.tsx` 11/11 y `responsive-alumno.spec.ts` 8/8
  PASS; la fila se reconoce como `rowheader` y el estado inicial móvil conserva la primera
  columna. Capturas 320/360 CSS px en `reports/qa/ux-entrega-current-focus-20261031/alumno-regression/`.
- Límite: la prueba de árbol accesible no sustituye una sesión con lector de pantalla real.

### Error de consulta de resultados recuperable (2026-11-03)

- Hallazgo: cuando fallaba la carga inicial de resultados, el portal mostraba a la vez la alerta de error y el estado «Sin resultados»; el aviso de error no ofrecía reintento local.
- Cambio: el vacío se presenta únicamente tras una respuesta válida; la alerta de error ofrece volver a consultar resultados con la sesión existente y se limpia al iniciar el reintento.
- Validación focal: `apps/frontend/tests/appAlumno.behavior.test.tsx` verifica error, ausencia del falso vacío, recuperación de resultados y una sola solicitud de ingreso.

### Cooldown sin toast redundante (2026-11-02)

- Hallazgo estático: la guarda defensiva de `ingresar()` volvía a anunciar en un toast el
  tiempo de espera que ya estaba visible en el formulario. La validación del formulario
  también bloquea el envío durante el cooldown.
- Cambio: se conserva la guarda y el aviso contextual; se elimina el toast duplicado.
- Validación focal: `appAlumno.behavior.test.tsx` verifica tres intentos fallidos, el bloqueo
  del botón y del reenvío, la permanencia del aviso contextual, la ausencia del toast de
  cooldown y que no se agregue otra solicitud.


## Portal Alumno · instrucciones de credenciales por campo (2026-11-03)

- Hallazgo estático: la ayuda de Matrícula hablaba de la expiración del código de acceso, desviando esa instrucción del campo correspondiente.
- Cambio: el campo Código incluye la recuperación si expira; Matrícula solo indica el formato sin espacios. No cambian validación ni autenticación.
- Validación focal: `appAlumno.behavior.test.tsx` comprueba que cada ayuda accesible esté asociada al campo correcto.

## Portal Alumno · fin accesible del cooldown (2026-11-03)

- Hallazgo estático: el cooldown anunciaba el inicio de la espera y mostraba un contador, pero al terminar solo desaparecía el aviso; el lector de pantalla no recibía confirmación de que el acceso volvía a estar disponible. El intervalo de un segundo tampoco se detenía al llegar a cero.
- Cambio: el estado anuncia una sola vez «Ya puedes volver a intentar ingresar» al terminar y el intervalo se limpia al llegar a cero o al desmontar el componente. El contador sigue fuera de la región viva mientras avanza.
- Fundamento: WCAG 2.2 SC 4.1.3 indica que, cuando se elimina un mensaje de espera, conviene proporcionar un estado equivalente como «sistema disponible» para usuarios de tecnología asistiva ([W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).
- Validación focal: `appAlumno.behavior.test.tsx` comprueba el inicio, vencimiento, disponibilidad del botón y detención del temporizador.
- Contratos: no cambia intentos, duración del cooldown, endpoints ni autenticación.

## Portal Alumno · acciones nombradas por folio (2026-11-03)

- Hallazgo estático: en cada tarjeta se repetían nombres accesibles genéricos para ver el PDF,
  solicitar revisión y enviar conformidad, aunque cada acción opera sobre un folio distinto.
- Cambio: los nombres accesibles ahora identifican el folio asociado y actualizan su verbo
  durante la carga. El texto visible, las operaciones y los payloads se conservan.
- Validación focal: `npm test -- appAlumno.behavior.test.tsx` (14/14 PASS), ESLint focal,
  `git diff --check` y auditoría SDD PASS.

## Portal Alumno · quitar tooltip que cubría la calificación (2026-11-03)

- Hallazgo visual en E2E a 320 CSS px: al expandir el detalle, la capa global tomaba el `aria-label` extendido del botón y su tooltip se superponía al tipo y la calificación del examen.
- Cambio: el texto visible «Ver/Ocultar detalle» permanece como nombre base, y un fragmento `sr-only` aporta el folio a tecnologías de asistencia. El nombre accesible mantiene acción y folio; la capa común reconoce que el nombre coincide con el texto del botón y suprime el tooltip redundante.
- Validación focal: `login estable en mobile-narrow` 1/1 PASS con datos dummy; tras abrir el detalle verifica el nombre completo del botón y ausencia de `role="tooltip"`. Captura revalidada en `test-results/ux-student-continuation-20261103/gui-alumno-detalle-mobile-narrow-inicio-full.png`.
- No cambian resultados, cálculos, acciones, endpoints ni payloads. La prueba es sintética; no sustituye el runtime instalado ni un lector de pantalla real.

## Portal Alumno · errores al abrir PDF en lenguaje claro (2026-11-03)

- Hallazgo estático: un fallo HTTP al abrir el PDF se mostraba como `HTTP N`, sin explicar el problema ni cómo recuperarse; el aviso tampoco identificaba cuál folio falló.
- Cambio: el aviso ahora incluye el folio y un mensaje distinto para sesión vencida, falta de acceso, archivo ausente, límite de solicitudes y errores del servicio. El status numérico se conserva únicamente en telemetría. Para 401 se mantiene la acción de cerrar sesión.
- Validación focal: `npm -C apps/frontend run test -- tests/appAlumno.behavior.test.tsx` (14/14 PASS), ESLint focal, typecheck frontend, auditoría SDD y `git diff --check` PASS. Cubre 401, 403, 404, 429 y 503, incluyendo 401 con recuperación de sesión y status conservado en telemetría.
- Contratos: no cambian endpoint, permisos, PDF, sesión ni payloads.

## Portal Alumno · confirmación asociada al folio (2026-11-03)

- Hallazgo estático: los toasts de conformidad usaban títulos generales; en una lista de varios resultados no señalaban cuál folio se había confirmado o cuál falló.
- Cambio: los mensajes de éxito y error incluyen el folio, preservan su acción de recuperación de sesión y permiten reintentar después de un fallo.
- Validación focal: `npm -C apps/frontend run test -- tests/appAlumno.behavior.test.tsx` (14/14 PASS), ESLint focal, typecheck frontend, auditoría SDD y `git diff --check` PASS. Prueba el primer intento fallido y el segundo exitoso con el mismo folio.
- Contratos: no cambian endpoint, permisos ni payload.

## Portal Alumno · error de resultados en móvil (2026-11-03)

- Hallazgo visual en 320 CSS px: el aviso heredaba la cuadrícula compartida de dos columnas y el texto se superponía al botón de reintento.
- Cambio: el aviso de resultados usa una columna en móvil; el botón queda debajo del mensaje, a todo el ancho disponible y con altura mínima de 44 px. La solicitud de resultados silencia el toast genérico porque el mismo error ya se presenta con recuperación contextual en la pantalla.
- Validación: E2E Edge focal 1/1 PASS con tres respuestas HTTP 503 dummy seguidas por una recuperación, en tema claro y oscuro. Verifica que no se muestre el falso estado vacío ni el toast duplicado, que el botón quepa y que el reintento recupere los resultados con la sesión existente. Capturas inspeccionadas en `reports/qa/ux-portal-error-recovery-20261103/`.
- Contratos: sin cambios en endpoints, datos, autenticación ni payloads.

## Portal Alumno · revalidación responsive y revisión visual focal (2026-11-03)

- Se ejecutó `npm run test:gui:responsive:e2e:alumno` con fixtures sintéticos y Edge (`E2E_BROWSER_CHANNEL=msedge`): 8/8 PASS en anchos de 320, 360, 390, 768, 1024, 1440 y 1920 CSS px; cubre nombre de controles, ausencia de overflow, orden resultados/contexto y navegación/tabla móvil.
- Se generaron 20 capturas en `reports/qa/ux-portal-alumno-audit-20261103/`. Revisión visual focal de seis: acceso 320 claro; resultados 320 claro/oscuro y escritorio 1440; detalle 320 oscuro antes y después de navegar por teclado. El contenido visible conserva el reflow; en la tabla comparativa el desplazamiento horizontal es local y el estado enfocado puede mover la vista hacia columnas siguientes.
- No se observó un defecto visual nuevo en esas capturas, así que esta revalidación no introduce un cambio de presentación. Runtime instalado, zoom manual 200 % y lector de pantalla siguen pendientes.

## Portal Alumno · instrucción concisa para comentario de revisión (2026-11-03)

- Hallazgo en captura sintética actual a 320 CSS px: la etiqueta del comentario y la ayuda repetían el requisito de longitud y la selección de preguntas, ya explicada antes de la tabla.
- Cambio: la etiqueta identifica el campo como obligatorio y conserva el mínimo de 12 caracteres; el atributo `required` hace explícita la obligatoriedad al árbol accesible. La ayuda persistente explica el propósito del comentario sin repetir requisitos. Se conservan la validación existente y los payloads.
- Evidencia: `reports/qa/ux-portal-alumno-current-20261103/gui-alumno-detalle-mobile-narrow-inicio-full.png`; el campo y su instrucción se leen completos y no generan overflow horizontal a 320 CSS px.
- Validación focal: `appAlumno.behavior.test.tsx` 14/14 PASS; Playwright Edge `login estable en mobile-narrow` 1/1 PASS con fixture dummy; typecheck frontend, ESLint focal y auditoría SDD PASS.
- Límite: no se validaron runtime instalado, zoom real al 200 % ni lector de pantalla.

## Portal Alumno · conformidad persistente y no reversible (2026-11-03)

- Hallazgo estático: la API solo registra conformidad positiva, pero tras enviar el checkbox seguía editable y podía aparentar que el alumno había revocado una acción que el servidor no permite revertir.
- Cambio: durante la solicitud se bloquea el control; ante error se conserva la selección y se permite reintentar; al éxito permanece marcado y bloqueado y el contexto confirma el folio. Se elimina el toast de éxito redundante. Endpoint y payload no cambian.
- Validación focal: `npm -C apps/frontend run test -- tests/appAlumno.behavior.test.tsx` (14/14 PASS), `npm -C apps/frontend run typecheck`, ESLint focal, `npm run guard:wcag -- --skip-lint`, `npm run sdd:audit` y `git diff --check` PASS.
- La suite enfocada contenía dos expectativas antiguas que detenían el recorrido antes de esta interacción: nombre de región de resultados y singular del conteo de avisos. Se alinearon al contenido accesible actual, sin cambiar la interfaz de producción.
- Límite: no se validó con el runtime instalado ni lector de pantalla real.

## Portal Alumno · evitar toast duplicado al solicitar revisión (2026-11-04)

- Hallazgo reproducible: una respuesta 503 a la solicitud mostraba la alerta recuperable
  junto al formulario y, en paralelo, el toast genérico «Portal con error».
- Cambio: la solicitud envía `silenciarErrores: true` al cliente compartido. El formulario
  sigue mostrando el mensaje contextual y conservando selección/comentario; el toast
  separado de recuperación de sesión sigue activo para los casos en que aporte una acción
  distinta.
- Evidencia: E2E Edge focal 1/1 con API y alumno ficticios; reproduce 503 y reintento exitoso,
  verifica ausencia del toast duplicado, conservación de entradas y estado en claro/oscuro a
  320 CSS px. Capturas inspeccionadas en
  `reports/qa/ux-portal-review-error-20261104/`.
- Validación focal: `appAlumno.behavior.test.tsx` 15/15, typecheck frontend, ESLint focal y
  `git diff --check` PASS. El E2E fallaba antes del cambio por el toast adicional.
- Límite: no se envió una solicitud al servicio real; zoom 200 %, lector de pantalla y runtime
  instalado no se validaron.

## Portal Alumno · orientación fiable del chevrón de detalle (2026-11-05)

- Hallazgo E2E actual: el detalle se expandía y `aria-expanded` cambiaba a `true`, pero la
  cascada visual conservaba el icono girado del estado cerrado.
- Cambio: el botón selecciona explícitamente `chevronAbajo`/`chevronArriba` del catálogo
  Lucide compartido según el folio abierto; se retiraron las rotaciones CSS que podían
  quedar anuladas por estilos globales. No cambia texto, contenido, foco ni estado del panel.
- Validación: `iconos.test.tsx` 8/8 PASS; E2E Edge focal 3/3 PASS con API/folios ficticios,
  incluye error y recuperación, error al solicitar revisión y apertura/cierre del detalle a
  320 CSS px en claro/oscuro. Capturas actuales en `reports/qa/ux-portal-audit-current-20261105/`.
- Contratos: `aria-expanded`, `aria-controls`, nombre del folio y operaciones conservados.

## Portal Alumno · diferenciar salida voluntaria e invalidación (2026-11-05)

- Hallazgo estático: una misma función mostraba «Sesión cerrada» tras la salida voluntaria y
  cuando el sistema invalidaba una sesión, atribuyendo al alumno una acción que no realizó.
- Cambio: la salida voluntaria conserva su toast; ante invalidación, el portal lleva al acceso
  y presenta allí un aviso persistente con el siguiente paso. No duplica la alerta con toast.
- Validación focal: `appAlumno.behavior.test.tsx` 16/16 PASS; typecheck y ESLint focal PASS.
- Contratos: no cambian token, rutas, permisos, requests ni telemetría.

## Portal Alumno · campos de acceso sin ejemplos ambiguos (2026-11-05)

- Hallazgo visual en captura actual a 320 CSS px: los campos vacíos mostraban `2024-001`
  y `ABC123`, que podían confundirse con credenciales ya capturadas.
- Cambio: se retiraron ambos placeholders. Se mantienen las etiquetas y ayudas accesibles
  que indican qué matrícula y código debe ingresar el alumno.
- Validación focal prevista: prueba de comportamiento del formulario, typecheck frontend,
  ESLint focal, auditoría SDD y `git diff --check`.
- Contratos: no cambian normalización, autocompletado, ruta ni payload del acceso.
