---
id: SPEC-140
titulo: UX de Sincronización y respaldos docentes
version: 1.0.23
fecha: 2026-11-05
autor: Codex / EvaluaPro Team
modulo: frontend_docente_sincronizacion_ux
estado: approved
---

## Contexto

La sección docente Sincronización y respaldos reúne publicación al Portal Alumno,
exportación/importación de paquetes, instantáneas locales, coordinación de equipos e
intercambio entre equipos. Son flujos distintos en una página extensa. La inspección estática
detectó que no hay acceso directo a cada tarea; el estado superior puede mostrar «Sin dato»
ante un fallo sin historial; y la etiqueta «Actualizado» se basa en la carga de recursos
académicos, no en la actualización del historial de sincronización.

La ayuda de estados en Publicación sigue WCAG 2.2 SC 4.1.3: los mensajes de carga, resultados
y errores se exponen como estados programáticos sin mover el foco. Referencia primaria:
[W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
y [WAI-ARIA 1.2 — alert role](https://www.w3.org/TR/wai-aria-1.2/#alert).

El usuario autorizó mejorar toda la GUI de EvaluaPro y pidió completar los ciclos necesarios
sin solicitar aprobaciones repetitivas. Esta spec limita los cambios a navegación, etiquetas
y estados visibles; no modifica contratos, almacenamiento, seguridad ni acciones de dominio.

## Requisitos Funcionales

- **REQ-140-001 Navegación entre tareas:** ofrecer enlaces accesibles a Publicación, Paquetes,
  Respaldo completo y Sincronización entre equipos. Incluir Trabajo coordinado solo cuando
  esa sección esté configurada y visible. Cada enlace llevará a un encabezado identificable,
  enfocable y visible, sin desmontar secciones ni descartar estado local.
- **REQ-140-002 Estado del historial:** distinguir consulta inicial, historial vacío válido,
  consulta fallida sin resultados, historial previo conservado y consulta fallida con datos
  previos. No presentar un error de lectura como operación de sincronización fallida ni como
  ausencia confirmada de operaciones.
- **REQ-140-003 Etiqueta de fecha:** describir `ultimaActualizacionDatos` como la carga de
  datos locales, sin insinuar que corresponde a la última operación o actualización del
  historial.
- **REQ-140-004 Compatibilidad:** conservar todas las acciones, permisos, confirmaciones,
  endpoints, payloads, archivos, cifrado, persistencia, sincronización y reglas definidas en
  SPEC-048 y sus specs relacionadas.
- **REQ-140-005 Accesibilidad y reflow:** los enlaces deben tener nombres claros, funcionar
  con teclado, señalar destinos con foco visible y envolver en pantallas estrechas. El foco
  de los encabezados usa el token de acento primario de cada tema, con trazo sólido de 3 px,
  para distinguir la navegación sin el marco oscuro/claro del color de texto. Los estados de
  carga, error y vacío conservan roles semánticos y contraste de ambos temas.
- **REQ-140-006 Estado de materias para publicar:** la pantalla de publicación distingue carga,
  fallo de consulta recuperable, lista válida vacía y falta de permiso. El fallo ofrece reintento;
  el estado vacío indica cómo habilitar la publicación. No se habilitan acciones sin una materia
  seleccionable. Se conservan contratos, permisos y flujo de publicación vigentes.
- **REQ-140-007 Mensajes de paquetes:** exportación e importación muestran un único mensaje
  contextual; los errores se exponen como alertas y los éxitos como estados. Solo se emite un
  toast si aporta una acción distinta de recuperación de sesión. El resumen identifica como
  importado solo el archivo cuya aplicación terminó correctamente; seleccionar, validar o
  cancelar un archivo no se presenta como una importación completada.
- **REQ-140-008 Mensajes de respaldo completo:** si no existe un método de protección
  configurado, explicar que exportar e importar están bloqueados y quién puede resolverlo.
  Los errores de exportar/importar y las
  credenciales faltantes se anuncian como alertas; los éxitos y cancelaciones se anuncian como
  estados. Antes de aplicar un respaldo, la confirmación identifica el nombre del archivo,
  el impacto, el contenido validado y el respaldo automático previo. No se duplica el feedback
  contextual en toasts; cualquier toast de sesión debe aportar una acción recuperable independiente.
  Si se elige un archivo antes de proporcionar la credencial, indicar que debe ingresarse o
  renovarse la credencial y volverse a seleccionar el archivo para continuar.
- **REQ-140-009 Mensajes de sincronización entre equipos:** los resultados de push y pull se
  anuncian una sola vez en su resumen contextual; errores usan alerta y estados no erróneos usan
  `status`. El toast se reserva para recuperación de sesión con acción independiente.
- **REQ-140-010 Mensajes de Trabajo coordinado:** credenciales faltantes, fallas de Google y
  fallas de operación se exponen como alertas explícitas; éxito y cancelación se muestran como
  estados. Los toasts no repiten el resultado y solo aparecen con una acción de recuperación
  complementaria para la sesión.
- **REQ-140-011 Formularios de respaldo y sincronización legibles:** la opción seleccionada de
  protección se lee completa en móvil; los CTA primarios de exportación, push y coordinación
  mantienen contraste WCAG AA en ambos temas; los checkbox de inclusión de PDFs y
  auto-actualización conservan tamaño de control y rótulo junto al control. La medición de
  contraste exige colores opacos y no acepta gradientes sin analizar. En Sincronización entre
  equipos, la ayuda de fecha indica que se usa hora local y que, al dejarla vacía, cada dirección
  continúa desde su cursor guardado. El límite de paquetes visible coincide con el máximo del
  servicio: 1–20 por consulta.
- **REQ-140-012 Iconografía de la cabecera:** el icono de la cabecera de Sincronización utiliza
  el sistema compartido de iconos decorativos. Su trazado queda dentro del `viewBox` visible y
  conserva el tamaño, color y ocultamiento semántico actuales.
- **REQ-140-013 Iconografía de tareas:** los encabezados de Paquetes, Respaldo completo,
  Sincronización entre equipos y Trabajo coordinado usan símbolos del catálogo compartido que
  representan cada tarea, en vez de repetir el icono de recarga. El texto del encabezado sigue
  nombrando la tarea; los iconos adyacentes son decorativos y no duplican el nombre accesible.
- **REQ-140-014 Control ocupado:** cuando el estado vigente indica que otro equipo conserva el
  lease, no se presenta «Tomar control de edición» como acción disponible. Se ofrece actualizar
  el estado con una consulta de solo lectura; cuando el servicio confirma que el control está
  disponible, la acción para adquirirlo vuelve a aparecer. Los errores de consulta se muestran
  como alerta y no borran el último estado conocido. Los controles de credencial para publicar
  o traer snapshots permanecen ocultos mientras otro equipo conserva el lease y se limpian al
  entrar a ese estado.
- **REQ-140-015 Contraste de aviso de respaldo:** el aviso que explica que el respaldo completo
  está bloqueado hasta configurar un método de protección conserva contraste de texto mínimo
  4.5:1 en tema claro y oscuro, sin perder su jerarquía de advertencia ni el siguiente paso.
- **REQ-140-016 Foco del selector de respaldo:** el control para importar el archivo `.ep-snapshot`
  conserva nombre accesible y muestra el foco del teclado en su superficie visible, aunque el
  input nativo se mantenga visualmente oculto para conservar el diseño del CTA.
- **REQ-140-017 Publicación activa y código visible:** revisar el estado de una materia seleccionada
  tras generar un código de acceso y simular la publicación con servicios interceptados. El estado
  debe distinguir el código compartible del listado de vigencia, no exponer el secreto en la lista,
  y mantener etiquetas, acciones y lectura dentro del viewport en móvil y escritorio, con espacio
  interno suficiente entre los controles y el borde de su panel.

## Criterios de Aceptación

1. Los enlaces apuntan a los cuatro encabezados visibles; el enlace de Trabajo coordinado
   aparece únicamente cuando existe estado configurado.
2. Al navegar por enlace, el encabezado destino recibe el foco y queda visible; ningún panel
   se desmonta ni pierde datos. El indicador de foco usa el token de acento primario en ambos
   temas, con 3 px de trazo y 4 px de separación, sin heredar el color de texto.
3. La consulta fallida sin resultados muestra un estado de consulta fallida; con historial
   previo, conserva los datos y comunica que el historial no se actualizó.
4. El estado inicial de inventario vacío sigue siendo distinto del error de consulta y los
   errores conservan su mensaje y acción de reintento.
5. La fecha se etiqueta como carga de datos locales, no como actualización del historial.
6. No se alteran contratos de sincronización, publicación, archivos, cifrado ni datos.
7. Pruebas focales de `seccionSincronizacion.test.tsx` y `sincronizacion.behavior.test.tsx`,
   lint/types relevantes y guard WCAG pasan. La revisión visual del runtime se informa por
   separado de las pruebas aisladas.
8. Publicación comunica estados de carga, error con recuperación, vacío y falta de permiso; el
   E2E de viewport confirma el vacío y el bloqueo de acciones cuando no hay materias cargadas.
9. Paquetes anuncia éxito o error una sola vez de forma contextual; los errores tienen semántica
   de alerta y un toast aparece únicamente cuando ofrece recuperación de sesión complementaria.
   El archivo y tamaño importados se registran en el resumen tras una aplicación completada; la
   cancelación o un error de validación/aplicación no aparecen como importación.
10. Respaldo completo distingue alerta de error de estado de éxito/cancelación, explica la
    ausencia de métodos de protección con el siguiente paso y no expone la credencial introducida
    en sus mensajes. La confirmación de reemplazo muestra el nombre del archivo seleccionado y
    conserva el resumen de contenido, el impacto y el respaldo automático antes de aplicar.
11. Push y pull presentan resultado contextual semántico sin toast duplicado; si el error requiere
    renovar sesión, aparece únicamente el toast con esa acción adicional.
12. Antes de resolver la primera consulta del historial, la interfaz presenta «Consultando
    historial» y no anuncia que el historial está vacío.
13. En Trabajo coordinado, credenciales faltantes y errores se anuncian como alertas; los
    resultados exitosos y cancelaciones se anuncian como estados sin toast redundante.
14. Con métodos de protección ficticios habilitados, la opción «Contraseña de cuenta» cabe
    completa a 320, 390 y 1024 CSS px; los CTA Exportar y Enviar cambios (push) usan fondo opaco
    sólido y logran al menos 4.5:1 en ambos temas, sin overflow horizontal.
15. En Sincronización entre equipos, el checkbox de PDFs mide entre 18 y 24 CSS px y su etiqueta
    conserva el patrón de fila a 320 CSS px; los controles de fecha y límite se entienden por sus
    etiquetas accesibles. En el estado del historial, la casilla Auto-actualizar usa la misma
    escala y alineación.
16. En Trabajo coordinado configurado, el método «Contraseña de cuenta» cabe completo a 320 CSS
    px; el CTA «Tomar control de edición» mantiene al menos 4.5:1 en ambos temas. La validación usa
    lease ficticio interceptado y no ejecuta operaciones de coordinación reales.
17. Los estados solo lectura y control propio comunican quién tiene el lease y cuándo expira; el
    estado propio expone las acciones de publicar, traer y liberar sin ejecutarlas durante la prueba.
18. En Sincronización entre equipos, al introducir un límite superior a 20 la interfaz conserva
    20 y envía como máximo 20; las instrucciones asociadas explican el rango, el valor inicial,
    la hora local y el uso del cursor guardado cuando no se indica fecha.
19. La cabecera usa el icono compartido `sincronizacion`, decorativo y oculto a tecnologías de
    asistencia; el trazado no queda recortado por el `viewBox`.
20. Los encabezados de Paquetes, Respaldo completo, Sincronización entre equipos y Trabajo
    coordinado usan iconos diferentes y coherentes con la tarea (`PackageOpen`, `DatabaseBackup`,
    `sincronizacion` y `UsersRound`, respectivamente); son decorativos y no alteran el nombre
    accesible del encabezado.
21. En estado `solo_lectura`, «Tomar control de edición» no aparece; «Actualizar disponibilidad»
    consulta el lease sin escribir, conserva el mensaje del equipo propietario y, si el servicio
    devuelve `disponible`, muestra la acción de adquisición. Si falla la consulta, se anuncia el
    error y se conserva el estado previo. El selector de protección, la contraseña y el acceso
    OAuth no aparecen mientras las acciones protegidas no están disponibles.
22. El texto del aviso de configuración de Respaldo completo mantiene contraste mínimo 4.5:1 en ambos temas a 320 CSS px.
23. Si se elige un archivo de respaldo antes de ingresar la credencial necesaria, la alerta explica que debe proporcionarse la credencial y volver a seleccionar el archivo. La importación no inicia hasta recibir el archivo y la credencial.
24. El encabezado principal presenta un solo emblema junto a «Sincronización y respaldos»; el título conserva su nombre textual sin repetir otro icono.
25. El selector nativo del archivo de respaldo conserva su nombre accesible y, al recibir foco, presenta en su control visible el indicador de 3 px, color `--ui-accent-primary` y offset de 4 px, también en ambos temas.
26. Con fixture de materia y respuestas de publicación/código interceptadas, se puede generar el código en el estado simulado; la vista identifica el estado «Listo para compartir», muestra el código solo en su panel y presenta vigencia/vencimiento sin repetirlo en la lista. Ninguna solicitud llega a API real; el contenido cabe a 320, 390 y 1024 CSS px en claro/oscuro, y el título y selector conservan al menos 12 px de separación al borde del panel.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-140-001 | Navegación y destinos accesibles entre tareas | `apps/frontend/tests/seccionSincronizacion.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: cuatro enlaces destino; coordinación aparece solo si está configurada |
| REQ-140-002 | Carga inicial, vacío, error y conservación de historial previo | `apps/frontend/tests/seccionSincronizacion.test.tsx` | PASS: la carga inicial no se presenta como vacío; error de consulta y conservación de resultados previos diferenciados |
| REQ-140-003 | Etiqueta semántica de carga de datos | `apps/frontend/tests/seccionSincronizacion.test.tsx` | PASS: fecha identificada como carga de datos locales |
| REQ-140-004 | Contratos y acciones preservados | `apps/frontend/tests/sincronizacion.behavior.test.tsx` | PASS: comportamiento focal existente conservado; sin cambios a servicios ni payloads |
| REQ-140-005 | Reflow, foco y semántica de estados | `apps/frontend/tests/seccionSincronizacion.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: el E2E comprueba los cuatro destinos en claro/oscuro; el foco usa `--ui-accent-primary`, trazo sólido de 3 px y offset de 4 px. Capturas posteriores en `reports/qa/ux-sync-current-audit-20261105/`; las de la primera pasada se reemplazaron al reejecutar. |
| REQ-140-006 | Estados de materias y reintento en Publicación | `apps/frontend/tests/seccionPublicar.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: prueba focal distingue carga, error, vacío y falta de permiso; E2E confirma aviso de vacío y controles bloqueados en móvil. |
| REQ-140-007 | Mensajes semánticos y sin duplicación en Paquetes; resumen solo tras aplicar | `apps/frontend/tests/seccionPaqueteSincronizacion.test.tsx`; `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: éxito como status, error como alert; sin toast duplicado; selección, error y cancelación no se reportan como importación completada. La UI distingue Paquetes entre equipos de Respaldo completo y nombra sus acciones «Exportar paquete» e «Importar paquete». Prueba focal 36/36 y E2E actual 1/1 con capturas a 320 px. |
| REQ-140-008 | Mensajes y confirmación informada en Respaldo completo | `apps/frontend/tests/seccionInstantaneaLocal.test.tsx`; `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: el diálogo identifica el archivo seleccionado y conserva impacto, detalle validado y respaldo previo; errores y credenciales tienen semántica de alerta, sin toast duplicado ni exposición de credencial. La prueba focal confirma que una credencial faltante explica volver a elegir el archivo y no inicia la importación. |
| REQ-140-009 | Mensajes semánticos y sin duplicación en sincronización entre equipos | `apps/frontend/tests/seccionSincronizacionEquipos.test.tsx` | Implementado: push/pull muestran el único resultado contextual y no duplican toasts; error es alert. |
| REQ-140-010 | Mensajes semánticos y sin duplicación en Trabajo coordinado | `apps/frontend/tests/seccionLeaseSincronizacion.toast.test.tsx` | Implementado: credencial faltante como alert; publicación como status sin duplicación; recovery toast de sesión conserva acción. |
| REQ-140-011 | Legibilidad de formularios, límites reales y contraste de CTA | `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `apps/frontend/tests/seccionPaqueteSincronizacion.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: el límite mostrado y enviado se acota a 20 conforme al servicio; ayudas describen hora local y cursor; la fecha de exportación indica hora local y efecto del campo vacío; la etiqueta de PDF explica el aumento de tamaño. Opciones completas, CTA sólidos con contraste 5.45:1 y checkbox legibles; 320/390/1024 CSS px, ambos temas y sin overflow. Lease interceptado; sin escrituras reales. |
| REQ-140-012 | Cabecera con icono compartido, sin recorte ni repetición junto al título | `apps/frontend/tests/seccionSincronizacion.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: pruebas de componente y E2E comprueban un icono `sincronizacion` decorativo en el orb, h2 textual sin SVG y captura actual en claro/oscuro a 320 CSS px. |
| REQ-140-013 | Iconografía específica por tarea | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E valida iconos específicos y semántica decorativa en la navegación actual; capturas de tareas a 320 CSS px. |
| REQ-140-014 | Solo lectura y actualización segura del estado del lease | `apps/frontend/tests/seccionLeaseSincronizacion.toast.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componentes 12/12 y E2E de coordinación; actualiza mediante GET, oculta adquisición/credenciales cuando el lease está ocupado, restaura la acción al quedar disponible y conserva el estado ante error. Solo fixtures ficticios. |
| REQ-140-015 | Contraste WCAG AA del aviso cuando falta configurar la protección del respaldo | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge mide el texto renderizado y exige 4.5:1 en ambos temas a 320 CSS px; antes del cambio medía 1.52:1 en claro. |
| REQ-140-016 | Foco visible en el selector nativo oculto de respaldo | `tests/gui-responsive/responsive-docente.spec.ts` | E2E focal verifica nombre accesible e indicador visible heredado por el label (3 px, token primario, offset 4 px). |
| REQ-140-017 | Publicación activa y código de acceso en estado simulado | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge intercepta generación, publicación y consulta; comprueba código solo en su panel, vigencia, reflow y ausencia de overflow a 320/390/1024 CSS px. |

### Aviso cuando los respaldos no tienen método de protección

- La captura E2E actual mostraba «método de desbloqueo» y términos internos de configuración,
  sin decir directamente que exportar e importar estaban bloqueados.
- El aviso ahora comunica el bloqueo, explica que falta definir cómo se protege el archivo y
  dirige al administrador local. No cambia credenciales, cifrado ni operaciones.
- Investigación primaria: W3C WCAG 2.2 SC 3.3.3 recomienda dar una sugerencia correctiva cuando
  se conoce cómo resolver un problema: [Understanding Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html).
- Validación focal: `seccionInstantaneaLocal.test.tsx` y la captura E2E de navegación en 320 CSS px,
  claro/oscuro. La E2E también confirma que no se presentan controles de exportación en este estado.

### Formulario con método de protección disponible

- **Hallazgo visual:** el selector truncaba «Contraseña de la cuenta» en el viewport móvil; el CTA heredaba un gradiente verde con texto de contraste insuficiente.
- **Cambio:** se acortó la etiqueta a «Contraseña de cuenta» sin cambiar el valor `contrasena`; el CTA usa el fondo primario opaco del sistema y texto claro en ambos temas.
- **Validación:** E2E sintético con perfil ficticio a 320/390/1024 CSS px; la medición exige fondo opaco sin imagen de gradiente y contraste mínimo 4.5:1. El tema claro y oscuro dieron 5.45:1; las capturas se inspeccionaron manualmente.

### Formularios y estado de sincronización entre equipos

- **Hallazgos visuales:** el botón push heredaba el mismo gradiente verde de bajo contraste. La regla genérica `.campo input` aplicaba a las casillas de inclusión de PDFs y auto-actualización ancho y padding de campo de texto, separándolas de sus etiquetas.
- **Cambio:** el CTA push usa el mismo token primario sólido; ambas casillas conservan tamaño de control de 19 CSS px, alineación con su etiqueta y una superficie de selección clara. No se altera el valor, payload, intervalo de actualización ni operaciones push/pull.
- **Validación:** la prueba de navegación verifica nombres de los controles, tamaño y disposición de los checkbox, contraste 5.45:1 del push, reflow y ausencia de overflow a 320/390/1024 CSS px en ambos temas. El historial usa un evento ficticio de push; capturas de lista e indicador auto-refresh inspeccionadas.

### Trabajo coordinado entre equipos

- **Hallazgo visual:** el selector recortaba «Contraseña de la cuenta docente» a 320 CSS px (220 px de texto en 158 px útiles).
- **Cambio:** la opción visible se redujo a «Contraseña de cuenta», manteniendo el valor `contrasena`; no cambian la credencial ni las operaciones.
- **Validación:** E2E Edge con lease ficticio interceptado y perfil dummy; estado disponible a 320/390/1024 CSS px claro/oscuro; solo lectura y control propio capturados a 320 px oscuro, con texto visible y acciones propias enumeradas sin activarlas. No se contacta el servicio real.

## Estado de materias para Publicación (2026-10-31)

- Hallazgo en captura actual a 320 CSS px: sin materias, los controles de publicar/generar código aparecían deshabilitados, pero no se explicaba si la causa era carga, error, ausencia de materias o permisos.
- Cambio: Publicación recibe los estados reales del hook académico. Muestra carga, error con reintento, lista vacía con siguiente paso o falta de permiso; conserva la lista previa cuando la consulta falla tras una carga exitosa. El selector y acciones no permiten operar sin permiso/materia.
- Validación focal: `seccionPublicar.test.tsx` 10/10 PASS; E2E de navegación/publicación 1/1 PASS con datos ficticios, sin materias, 320 px claro/oscuro, 390 px y 1440 px; verifica estado semántico, controles bloqueados y ausencia de overflow. Capturas en `reports/qa/ux-publicacion-after-20261031/`.
- Sin cambios en endpoints, payloads, sincronización, permisos de dominio ni reglas de publicación. Límite: sin runtime autenticado ni portal real.

## Validación focal (2026-10-29)

- `npm -C apps/frontend test -- tests/seccionSincronizacion.test.tsx tests/sincronizacion.behavior.test.tsx`: 2 archivos, 14/14 PASS.
- Playwright Edge: `Navegación de tareas de Sincronización es directa y accesible en móvil con datos ficticios`: 1/1 PASS a 320 × 800 CSS px. Comprueba el foco y la visibilidad de los cuatro encabezados, ausencia de overflow horizontal, orden de los enlaces antes de la guía y estado oculto de Trabajo coordinado si no está configurado.
- Capturas inspeccionadas en claro/oscuro y de destinos en `reports/qa/ux-sync-task-navigation-20261029/`.
- Typecheck frontend PASS; ESLint focal de componentes y pruebas unitarias PASS; guard WCAG PASS (59/59 pares); `npm run sdd:audit` PASS; `git diff --check` PASS.
- Límite: el E2E usa API interceptada y datos ficticios. Runtime local canónico: UI `localhost:4173` sin conexión y API `127.0.0.1:4000` sin conexión. No se afirma verificación en la instalación ni interacción real con servicios de sincronización.

### Contraste de KPI en tema claro/oscuro (2026-10-30)

- La captura clara mostró etiquetas y valores en acentos demasiado tenues para texto pequeño.
  La reserva `#94a3b8` contrasta 2.56:1 sobre blanco y los acentos menta/cian/violeta del
  valor dan 1.86–2.98:1; WCAG 2.2 SC 1.4.3 requiere al menos 4.5:1 para texto normal.
- Los rótulos compartidos ahora consumen `--ui-text-secondary`; los valores de Sincronización
  usan `--ui-text-primary`. Se conservan los colores semánticos en iconos decorativos.
  El cambio no modifica métricas, datos ni contratos.
- Capturas actuales en `reports/qa/ux-sync-20261030-current-audit/` inspeccionadas en claro y
  oscuro a 320 CSS px, además de los cuatro destinos de navegación. El contraste y el foco
  resultan visualmente más claros; el recorrido conserva los destinos visibles y sin overflow.
- `gui.responsive.contract.test.tsx` y `seccionSincronizacion.test.tsx`: 32/32 PASS;
  pruebas de comportamiento (`seccionSincronizacion.test.tsx` y
  `sincronizacion.behavior.test.tsx`) 14/14 PASS; Playwright focal 1/1 PASS;
  guard WCAG 59/59 pares PASS.
- El E2E usa preview aislado y API con datos ficticios. No demuestra runtime instalado,
  servicios de sincronización reales, zoom 200 % ni lector de pantalla.

### Límite y filtros de Sincronización entre equipos (2026-11-03)

- Hallazgo: el campo aceptaba hasta 200 paquetes aunque el servicio limita cada recepción a 20. La fecha no explicaba la zona horaria local ni el uso del cursor al dejarla vacía; la descripción del historial mezclaba nombres en inglés y acciones en español.
- Cambio: el control y el payload se limitan a 20; las ayudas describen el rango, hora local y cursor por dirección. La descripción de actividad usa términos en español.
- Validación focal: `sincronizacion.behavior.test.tsx` verifica etiquetas, ayudas, rango enviado y omisión de fecha manual; `seccionSincronizacion.test.tsx` cubre la nueva descripción. Sin cambios en rutas ni payloads.

### Ancho útil de la guía rápida en móvil (2026-11-03)

- Hallazgo visual en captura actual a 320 CSS px: la guía dentro del historial estaba colocada en
  un contenedor `item-glass` que la envolvía con otra superficie y padding. La doble envoltura
  comprimía los pasos y aumentaba sus saltos de línea.
- Cambio: se quitó la superficie externa redundante; `HelperPanel` conserva su tarjeta, semántica
  y contenido, con mayor ancho útil para sus instrucciones.
- Validación focal: E2E Edge del recorrido de Sincronización 1/1 PASS; verifica una tarjeta para la
  guía y el ajuste de texto, foco y overflow a 320/390/1024 CSS px. Typecheck, lint/guard WCAG
  (81/81 pares), `sdd:audit` y `git diff --check` PASS. Capturas posteriores inspeccionadas en
  `reports/qa/ux-sync-guide-mobile-20261103/`. Runtime instalado y tecnologías asistivas no se validaron.

### Contraste del aviso de protección de respaldo (2026-11-04)

- Hallazgo visual cuantificado: el texto de advertencia en tema claro medía 1.52:1 sobre el fondo compuesto, por debajo del mínimo de 4.5:1 para texto normal de WCAG 2.2 SC 1.4.3 ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- Cambio: el aviso reutiliza el token semántico de advertencia del tema y una superficie opaca, manteniendo su rol, contenido y acción bloqueada.
- Validación: E2E Edge con datos ficticios comprueba contraste renderizado a 320 CSS px en claro/oscuro, texto dentro del panel y ausencia de overflow.
- Sin cambios en configuración, cifrado, permisos, endpoints ni payloads.

### Indicador de foco coherente en navegación de tareas (2026-11-05)

- Hallazgo visual: las capturas actuales muestran un marco negro grueso alrededor de los
  encabezados destino. La regla usa el token de texto (`--texto`) como color del indicador,
  que cambia entre ambos temas y no mantiene el patrón de foco de la GUI.
- Cambio: los encabezados mantienen el mismo destino y foco; el indicador ahora usa
  `--ui-accent-primary`, trazo sólido de 3 px y offset de 4 px.
- Validación: E2E Edge focal 1/1 PASS con datos ficticios; aserciones de color del token,
  estilo, grosor y offset para los cuatro encabezados en ambos temas. Se conserva la cobertura
  de reflow/overflow existente a 320/390/1024/1440 CSS px. Capturas antes/después en
  `reports/qa/ux-sync-current-audit-20261105/`.
- No se modifican enlaces, estado, datos ni acciones de sincronización; no se escriben datos.
