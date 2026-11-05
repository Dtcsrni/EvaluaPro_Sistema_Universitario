---
id: SPEC-131
titulo: Sistema de notificaciones Toast
version: 1.2.20
fecha: 2026-11-05
autor: Codex / EvaluaPro Team
modulo: frontend_ui_toast
estado: approved
---

## Contexto

El sistema común muestra notificaciones para las áreas docente, alumno y administración. La inspección estática encontró una sola región `aria-live="polite"` para todos los niveles, incluidos errores; `role="status"` envuelve botones interactivos; la duración solo se pausa con puntero, no al entrar con teclado ni al ocultar la pestaña; los errores pueden desaparecer en 7.5 s; el cierre usa un nombre genérico y en móvil las acciones compiten por espacio.

Esta especificación conserva `emitToast`, `onToast`, niveles y payloads existentes. Añade semántica explícita y opciones de persistencia compatibles. Las notificaciones no tomarán el foco ni interrumpirán como diálogo.

## Requisitos Funcionales

- **REQ-131-001 Anuncio accesible:** cada notificación debe exponer su título y mensaje. Éxitos, información y avisos se anuncian de forma cortés (`status`) desde una región viva vacía que existe antes del primer mensaje; errores se anuncian como error (`alert`) sin incluir los botones dentro de la región viva.
- **REQ-131-001a Errores globales:** los eventos globales `error` y `unhandledrejection` presentan texto seguro y una siguiente acción comprensible; no interpolan el mensaje arbitrario de la excepción en la interfaz.
- **REQ-131-002 Acciones y teclado:** los botones conservan nombre accesible, foco visible y área táctil utilizable. El temporizador se pausa mientras el puntero o foco estén en la notificación y mientras el documento no sea visible. Mientras una acción asíncrona esté en curso, sus botones de acción se deshabilitan y la misma acción no se invoca más de una vez.
- **REQ-131-003 Duración:** los mensajes informativos y de éxito tienen tiempo suficiente y duración acotada. Los errores y notificaciones con acciones se mantienen hasta que la persona los cierre o active una acción, salvo que el emisor solicite explícitamente duración temporal.
- **REQ-131-004 Duplicados y capacidad:** reutilizar un `id` actualiza el mismo aviso y su temporizador sin dejar timers huérfanos, también cuando está en espera. Los eventos globales de error comparten un mismo `id` para actualizar una sola alerta persistente y reducir interrupciones duplicadas. Mostrar como máximo cuatro avisos simultáneos en escritorio y uno en móvil (hasta 520 CSS px); encolar los excedentes en orden de llegada, indicar cuántos esperan y empezar su temporizador solo al mostrarlos. Al redimensionar, conservar el aviso que contiene el foco y no perder ni vencer los demás. No retirar abruptamente el elemento que contiene el foco.
- **REQ-131-005 Presentación:** mantener lectura clara en tema claro/oscuro y en anchos móviles; respetar movimiento reducido y evitar que las acciones o el cierre se recorten.
- **REQ-131-006 Compatibilidad:** conservar la interfaz del bus y las llamadas existentes; una acción o cierre no debe producir una promesa rechazada sin manejar.
- **REQ-131-007 Feedback contextual sin duplicados:** cuando una pantalla mantenga el resultado de una operación en contexto, no repetir el mismo éxito o error en un toast. El detalle local debe usar semántica de error o estado correcta; un toast adicional solo se permite si comunica una recuperación distinta (por ejemplo, renovar la sesión) y su texto no duplica el detalle.
- **REQ-131-008 Controles y contenido legible:** el viewport flotante evita solaparse de forma relevante con el control enfocado, cualquier acción/control interactivo visible o cualquier bloque individual de texto visible de la pantalla. Entre ubicaciones que protegen esos elementos, prioriza la que cubra menos texto auxiliar visible (ayuda, etiquetas, estados y contenido explicativo). Evalúa nueve posiciones distribuidas por esquinas, centros de bordes y centro del viewport; si ninguna tiene solapamiento igual o menor a 1 % con cada control y bloque de texto, coloca las notificaciones en el flujo junto al contenido visible. Si el usuario se desplaza y el host sale del viewport, se reubica cerca del contenido que está viendo. El cálculo se actualiza al cambiar el foco, al desplazarse, al redimensionar la ventana y al cambiar la cantidad de avisos.
- **REQ-131-009 Cambios de interfaz sin interrupciones:** no emitir toasts informativos cuando la propia interfaz ya expone el nuevo estado de selección, filtro, edición, pestaña, modo o carga con contenido y semántica accesible. Reservar toasts para resultados o sucesos que no queden representados en contexto.
- **REQ-131-007A Calificar examen:** el resultado de guardar y los errores de calificación se presentan en el panel contextual sin repetir el mismo contenido en un toast. Si el error invalida la sesión, el toast adicional ofrece la acción para renovarla y un texto distinto que dirige al detalle contextual.
- **REQ-131-001b Rechazo de acciones:** si una acción del toast falla al lanzar o rechazar, mantener un error persistente con un siguiente paso claro y no presentar el `message` arbitrario de la excepción, que puede incluir detalles internos.

## Criterios de Aceptación

1. El DOM identifica correctamente los anuncios corteses y urgentes y mantiene las acciones accesibles como controles.
2. El temporizador no elimina un aviso mientras está enfocado, bajo el puntero o con la pestaña oculta; al reanudarse conserva el tiempo restante.
3. Los errores y avisos con acción no desaparecen por defecto; quien envía puede optar explícitamente por tiempo temporal.
4. Actualizar por `id`, cerrar o desmontar el provider limpia temporizadores y registros asociados; los avisos excedentes se presentan al liberarse un espacio y no vencen mientras esperan.
5. Los botones tienen nombres que identifican la notificación; pueden operarse por teclado y se ven en vista estrecha.
6. Se preservan payloads usados por las áreas docente, alumno y administración.
7. La superficie mantiene contraste estable de ambos temas y el icono de toast no hereda animaciones decorativas de otros componentes.
8. Los errores globales no muestran mensajes crudos potencialmente sensibles y orientan a comprobar el resultado antes de repetir.
9. Si el mismo fallo se reporta como `error` y `unhandledrejection`, se presenta una sola alerta global persistente.
10. Materias, Calificaciones, Evaluaciones, Alumnos, Asistencias, Banco, Plantillas, Cuenta y Trabajo coordinado conservan un único resultado contextual por operación; solo los fallos de sesión pueden añadir una acción de recuperación claramente distinta.
11. El viewport de toast no cubre más del 1 % del área de ningún control enfocado/interactivo ni de ningún bloque individual de texto visible. Si ninguna posición de las nueve candidatas cumple ese límite, usa el flujo del documento. Entre posiciones seguras, elige la de menor solapamiento total con texto. Cambios de foco, scroll, resize y tamaño del toast reevalúan la ubicación sin mover el foco.
14. Si las nueve posiciones candidatas superan el 1 % de solapamiento con texto o controles visibles, la región de notificaciones usa `data-placement="flow"`; no basta con elegir la posición con menos solapamiento.
12. Una acción asíncrona de toast acepta un solo intento simultáneo; durante la espera sus botones de acción comunican y exponen el estado deshabilitado, y al terminar el aviso sigue la recuperación actual de éxito/error.
13. Cambiar pestaña, modalidad, limpiar un filtro o abrir la edición de Plantillas actualiza su estado visible sin un toast que repita el mismo cambio; al actualizar el catálogo, el botón expone el progreso y el toast comunica solo el resultado final o el error.
15. Al guardar una calificación, el mensaje «Calificación guardada» aparece una sola vez en el panel y no se emite toast. Un fallo genérico se describe en el panel sin toast repetido. Un 401 mantiene el error contextual y permite un único toast complementario con acción «Cerrar sesión» y sin repetir el detalle.
16. Si las cuatro esquinas tienen texto, pero una posición central candidata queda libre, el toast usa esa posición segura en vez de pasar innecesariamente a `flow`.
17. A 1440 CSS px, los botones no estrechan el cuerpo del toast: el mensaje dispone de al menos 75 % del ancho de la tarjeta y se lee en tres líneas o menos; las acciones se distribuyen en una fila independiente.
18. En vista móvil, título y mensaje principal de cada toast usan como mínimo 14 CSS px; la cantidad de avisos en espera permanece distinguible y secundaria.
19. Un rechazo síncrono o asíncrono de una acción conserva una alerta persistente y orienta a verificar el resultado; el texto crudo de la excepción no aparece en la interfaz.
20. Cuando se cierre la última notificación que se colocó en el flujo del documento, el host vacío regresa a `document.body`, retira sus estilos de flujo y no deja un bloque espaciador dentro de formularios, cabeceras u otros contenedores flex/grid.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-131-001, REQ-131-001a | Anuncio accesible y texto seguro para errores globales | `apps/frontend/tests/toastProvider.test.tsx` | Región `status` montada vacía antes del primer aviso; el texto cambia al llegar el estado; errores globales no exponen texto arbitrario y `alert` permanece separado de los controles |
| REQ-131-002, REQ-131-003 | Pausa con puntero/foco/pestaña oculta, persistencia, operación por teclado y exclusión mutua de acciones asíncronas | `apps/frontend/tests/toastProvider.test.tsx` | 16/16 pruebas focales PASS; una promesa diferida verifica aria-busy, aria-disabled, texto «En curso…» y una sola invocación simultánea |
| REQ-131-004, REQ-131-006 | Duplicados por id, cola responsive FIFO sin pérdida, timers al mostrar, acciones seguras y limpieza | `apps/frontend/tests/toastProvider.test.tsx` | 22/22 PASS; incluye cola móvil de un aviso, promoción FIFO tras resize con un aviso enfocado y cola previa, inicio del timer al promover, deduplicación, pausa y acciones asíncronas |
| REQ-131-005, REQ-131-008, criterio 18 | Apariencia responsive, movimiento reducido, temas, foco/controles/contenido y legibilidad tipográfica móvil | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `apps/frontend/tests/toastProvider.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts`; guard de contraste WCAG | E2E sintético focal 1/1 PASS a 320/390/1440 CSS px y ambos temas; comprueba título/mensaje móvil ≥14 px, ancho útil del mensaje (≥75 % de la tarjeta) y máximo tres líneas a 1440 px. Capturas anteriores en `reports/qa/ux-toast-actions-20261103/`; guard WCAG de esta actualización validado. |
| REQ-131-007 | Resultados contextuales sin duplicar anuncios; CTA de sesión solo con texto complementario | `apps/frontend/tests/seccionLeaseSincronizacion.toast.test.tsx`; `apps/frontend/tests/seccionAlumnos.test.tsx`; `apps/frontend/tests/seccionCuenta.test.tsx`; `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `apps/frontend/tests/seccionPeriodos.portada.test.tsx`; `apps/frontend/tests/seccionPeriodos.feedback.test.tsx`; `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `apps/frontend/tests/seccionAsistencias.test.tsx`; `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `apps/frontend/tests/seccionTemarios.test.tsx`; `apps/frontend/tests/banco.refactor.test.tsx`; `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/frontend/tests/plantillas.hooks.test.tsx`; `apps/frontend/tests/seccionAutenticacion.test.tsx`; `apps/frontend/tests/seccionRehidratacionLotes.test.tsx`; `apps/frontend/tests/mensajeInline.test.ts` | Materias: 30/30 PASS; Calificaciones: 19/19 PASS; Evaluaciones: 28/28 PASS; Alumnos: 21/21 PASS; Cuenta: 25/25 PASS: PDF/retención, accesos y actualización muestran resultado contextual sin duplicado; el toast solo acompaña recuperación de sesión; Asistencias: 17/17 PASS; Temarios: 17/17 PASS; sincronización: 2/2 PASS; Banco: 7/7 PASS para error persistente de historial/reintento sin toast duplicado; Plantillas: 27/27 PASS para alta, actualización, errores de generación, éxito individual sin duplicado y recuperación de sesión; hooks de Plantillas: 12/12 PASS para errores contextuales de descarga, regeneración y OMR; autenticación: 43/43 PASS entre componente y clasificación de mensajes para deduplicación y recuperación de sesión; Rehidratación de lotes: 20/20 PASS para los tres errores contextuales sin duplicación y la acción de sesión persistente; emisores restantes pendientes |
| REQ-131-002 | Acciones asíncronas sin reintento simultáneo y estado visible | `apps/frontend/tests/toastProvider.test.tsx` | 16/16 PASS; prueba con promesa diferida verifica `aria-busy`, `aria-disabled`, texto «En curso…» y una sola invocación hasta resolver |
| REQ-131-009 | Evitar toasts informativos redundantes cuando el estado y el resultado de interfaz ya quedan visibles | `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/frontend/tests/plantillas.hooks.test.tsx`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `apps/frontend/tests/seccionAsistencias.test.tsx`; `apps/frontend/tests/seccionTemarios.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | 54/54 pruebas focales de Plantillas PASS; «Todos Presentes» confirma el resultado con un estado accesible junto al pase de lista. En OMR, el E2E sintético confirma el resultado junto al análisis y no duplica el aviso en un toast; verifica además la acción de confirmación con contraste ≥4.5:1 en ambos temas y 320/390 CSS px, sin guardar calificaciones; 1/1 PASS. Temarios muestra el árbol recién creado/actualizado y conserva toasts solo para resultados que no quedan representados en el contenido actual. |
| REQ-131-007A | Calificar examen: resultado contextual único y recuperación distinta para sesión expirada | `apps/frontend/tests/seccionCalificar.test.tsx` | Implementado: éxito y error genérico no duplican toast; 401 conserva el error contextual y añade solo el CTA complementario de renovación. Prueba focal: 3 casos PASS. |
| REQ-131-001b | Rechazo síncrono/asíncrono de una acción sin filtrar el detalle arbitrario | `apps/frontend/tests/toastProvider.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | 25/25 pruebas del provider PASS; el E2E Edge sintético comprueba mensaje y capturas claro/oscuro a 320 CSS px, sin exponer el texto de la excepción. |
| REQ-131-008, criterios 11, 14 y 16 | Buscar posiciones centrales seguras antes de colocar notificaciones en flujo | `apps/frontend/tests/toastProvider.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | 24/24 pruebas de componente y E2E focal 1/1 PASS; cubre nueve posiciones, fallback `flow`, foco/controles, área total cubierta de texto y mensaje legible con acciones |
| REQ-131-010 / criterio 20 | Restaurar el host vacío al cerrar la última notificación en flujo | `apps/frontend/tests/toastProvider.test.tsx` | PASS: prueba reproduce inserción del host dentro de cabecera flex y verifica su retorno a `document.body`, eliminación de estilos de flujo y ausencia del bloque vacío; provider 26/26 PASS |

## Revalidación de cambios de interfaz ya visibles (2026-10-31)

- En Plantillas se quitaron toasts de información al cambiar pestaña o modalidad, limpiar el filtro y abrir edición: la pestaña seleccionada, el modo presionado, el valor del filtro y el formulario abierto ya comunican esos estados.
- Las guías activas de Generación e Historial ahora declaran `aria-expanded`, conservan el foco en el control equivalente tras mostrar/ocultar y no emiten toasts; la preferencia se mantiene en `localStorage`.
- El botón anuncia el progreso de la actualización («Recargando catálogo…») sin toast redundante; se conservan los toasts de éxito y error al concluir la operación remota.
- `npm run test -- tests/plantillas.refactor.test.tsx`: 30/30 PASS. ESLint y typecheck focales PASS; `npm run sdd:audit` PASS.

## Calificación: resultado contextual sin toast duplicado (2026-10-31)

- Hallazgo estático y prueba existente: al guardar una calificación, «Calificación guardada» aparecía en el panel y en un toast. Los errores se duplicaban de igual forma, aunque un 401 sí necesita conservar una acción para renovar la sesión.
- Cambio: el éxito y los errores genéricos permanecen solo en el panel; para 401 se conserva un toast `warn` con acción «Cerrar sesión» y texto que remite al detalle contextual sin repetir el error.
- Validación focal: `apps/frontend/tests/seccionCalificar.test.tsx` verifica éxito sin toast, error genérico sin toast y recuperación distinta por 401; prueba focal 3 casos PASS. TypeScript, ESLint focal, guard WCAG, auditoría SDD y diff-check.
- Alcance: sin cambio de cálculo OMR, payload, endpoint, permiso ni escritura de calificación.

Validación ejecutada el 2026-10-29: `npm -C apps/frontend run test -- tests/toastProvider.test.tsx`
(12/12 PASS); `npm -C apps/frontend run test -- tests/gui.responsive.contract.test.tsx -t toast`
(1/1 PASS); ESLint focal, typecheck de frontend, `npm -C apps/frontend run build:docente`
(bundle docente verificado; ESLint y WCAG integrados, 39/39 pares PASS), auditoría SDD de
esta spec y `git diff --check` PASS. El 2026-10-29, el recorrido E2E aislado con estado sintético
generó capturas a 320/390 px en temas claro y oscuro y confirmó que los controles de acción
quedan dentro de la tarjeta; las capturas se guardaron bajo `%TEMP%\evaluapro-ux-audit-20261029\screens-toast\`.
Esto no es una auditoría de la instalación local. Zoom 200 %, lector de pantalla y verificación
en runtime instalado siguen pendientes.

### Feedback contextual en Plantillas (2026-10-31)

- Alta y título duplicado ya se anuncian junto al formulario; se retiró el toast que repetía
  exactamente ese resultado. Los errores de alta, edición y eliminación permanecen como alerta
  contextual; un 401 puede añadir únicamente la acción diferenciada para recuperar la sesión.
- Tras actualizar correctamente, el editor se cierra y conserva el toast «Plantilla actualizada».
  Se eliminó «Edición cancelada», que se emitía también después de guardar y describía mal el
  resultado.
- Validación focal: `npm -C apps/frontend run test -- tests/plantillas.refactor.test.tsx`
  (25/25 PASS), ESLint focal y typecheck de frontend PASS.
- La captura visual de estos resultados, zoom 200 % y lector de pantalla no se validaron en esta
  iteración.

### Generación, historial y acciones OMR en Plantillas (2026-10-31)

- La generación individual y por lote conserva su confirmación/error en el panel de generación;
  se retira el toast repetido. Las advertencias de generación individual permanecen como toast
  porque agregan información distinta. Los errores al reabrir un trabajo OMR, regenerar/archivar/
  restaurar un paquete, descargar/regenerar un examen o cargar/descargar detalle OMR permanecen
  en contexto; un 401 puede añadir solo el aviso separado para recuperar sesión.
- `plantillas.refactor.test.tsx`: 27/27 PASS, incluidos éxito individual sin duplicación, fallo
  contextual y acción diferenciada para sesión. `plantillas.hooks.test.tsx`: 12/12 PASS, incluidos
  descarga de lote, regeneración y carga de detalle OMR sin repetir el mismo error.
- Las acciones que solo cuentan con toast (por ejemplo, descarga exitosa o exportación de dataset)
  conservan esa vía. No cambian rutas, permisos, cálculos ni payloads.
- El inventario de avisos redundantes de Plantillas se completó en la iteración 1.2.9; permanece
  pendiente la verificación manual con runtime instalado, zoom 200 % y lector de pantalla.

### Toasts y foco de la pantalla (2026-10-31)

- El dock flotante en escritorio podía ocultar por completo un control de página enfocado. Ahora
  mide ambos rectángulos y elige la esquina con menor intersección; si cualquiera de las cuatro
  esquinas lo cubriría por completo, pasa a flujo normal del documento. Recalcula al llegar/crecer
  un aviso, al cambiar foco, al desplazar la página y al redimensionar la ventana; no mueve el foco.
- `toastProvider.test.tsx`: 15/15 PASS; los tres casos geométricos prueban la posición alternativa,
  el fallback al flujo y el recálculo tras foco y resize con dimensiones simuladas.
- Contrato CSS focal 1/1, typecheck frontend, ESLint, compilación docente y bundle guard PASS;
  `guard:wcag` calcula 65/65 pares PASS, `sdd:audit` y `git diff --check` PASS.
- Base normativa: WCAG 2.2 SC 2.4.11 exige que el componente enfocado no quede completamente oculto
  por contenido del autor. Las pruebas con rectángulos sintéticos no equivalen a una captura de la
  pantalla real ni demuestran que nunca se cubra texto u otro contenido no enfocado.
- La API de control del navegador lateral respondió `browser.user is unavailable`; no se produjo
  una captura visual nueva en esta iteración.

### Protección frente a acciones duplicadas (2026-10-31)

- Hallazgo estático: la acción de recuperación puede devolver una promesa, pero el componente no bloquea un segundo clic mientras continúa pendiente. En acciones como renovar sesión o reintentar una consulta esto puede iniciar solicitudes concurrentes.
- Criterio: bloquear invocaciones simultáneas por notificación y exponer los botones de acción deshabilitados hasta que la promesa se resuelva o rechace; conservar el error persistente y el retorno de foco actuales.
- Cambio: se bloquean las acciones repetidas por clave de toast, ambas acciones muestran «En curso…» y `aria-disabled`, y el grupo expone `aria-busy` mientras se procesa. Se mantiene el botón de cierre disponible y no se mueve el foco.
- Validación: suite `toastProvider.test.tsx` (16/16 PASS); contrato CSS focal de toast 1/1 PASS; ESLint focal, typecheck, auditoría SDD y `git diff --check` PASS. No cambia la firma de `emitToast` ni obliga a los emisores a adoptar nuevos campos.

### Errores contextuales en Trabajo coordinado (2026-10-31)

- La adquisición de control duplicaba el mismo error: persistía en el panel y se enviaba además
  como toast urgente; el estado local usaba `role="status"` aun cuando era un error.
- El panel ahora conserva el detalle en un `InlineMensaje` semántico. Solo ante un error de
  autenticación con acción de recuperación se muestra un toast de aviso con un mensaje distinto
  y la acción «Cerrar sesión»; no vuelve a anunciar el detalle como segundo error urgente.
- `seccionLeaseSincronizacion.toast.test.tsx`: 2/2 PASS con `ToastProvider` real. Typecheck
  frontend, ESLint focal, `guard:wcag` (61/61 pares), `sdd:audit` y `git diff --check` PASS.
- La verificación cubre adquisición de control; no cierra todavía la ubicación, anuncios,
  temporización y solapamiento de todos los demás flujos transversales ni la auditoría manual
  con zoom 200 %, lector de pantalla y runtime instalado.

### Feedback contextual en Alumnos (2026-10-31)

- Alta, edición, eliminación y reinscripción conservan su resultado en la sección sin repetirlo
  en un toast con el mismo contenido. Los errores locales usan semántica de alerta y las
  confirmaciones usan estado cortés.
- Un fallo genérico deja su detalle en contexto; un error 401 puede añadir un toast distinto
  con la acción «Cerrar sesión». Editar o eliminar al alumno actualmente editado conserva la
  confirmación después de cerrar el formulario.
- `seccionAlumnos.test.tsx`: 21/21 PASS. ESLint focal, `sdd:audit` y `git diff --check` PASS.
- Esta evidencia cubre CRUD/reinscripción de Alumnos y no cierra la auditoría de todos los
  emisores de toast, ni la verificación manual con lector de pantalla, zoom 200 % o runtime
  instalado. La compilación docente de esta ejecución no quedó disponible para confirmar.

### Cambio de contraseña en Cuenta (2026-10-31)

- La confirmación y el error ya permanecían en el panel Cuenta, pero se volvían a emitir en un
  toast con el mismo texto. Se conservará el mensaje local y solo se emitirá un toast adicional
  cuando el error ofrezca una acción distinta para renovar la sesión.
- La cobertura focal comprobará el éxito sin toast, el fallo genérico sin duplicación y el error
  de sesión con mensaje complementario y acción «Cerrar sesión».
- `seccionCuenta.test.tsx`: 24/24 PASS para la suite de Cuenta, incluidos esos tres casos.
- Pendiente: revisar las demás operaciones de Cuenta y los emisores de toast del resto de la GUI;
  no se declara completo el requisito transversal ni la verificación con lector de pantalla,
  zoom 200 % y runtime instalado.

### Operaciones de Materias (2026-10-31)

- El código de alta, edición, archivado y eliminación guardaba resultado en el panel y emitía
  además un toast con el mismo contenido. Entrar a edición también emitía una explicación mientras
  el formulario mostraba ese mismo contexto.
- Se conserva el resultado contextual; el toast se reserva para una acción distinta de recuperación
  de sesión. La cancelación y las descargas mantienen sus avisos porque no duplican un mensaje local.
- Validación focal: suites `seccionPeriodos.edit.test.tsx`, `seccionPeriodos.portada.test.tsx` y
  `seccionPeriodos.feedback.test.tsx`: 30/30 PASS; confirman el estado único para alta, reintento
  de portada, edición, archivado y eliminación, el error local y la acción complementaria de sesión.
- Emisores de otras pantallas y verificación manual con runtime instalado, zoom 200 % y lector de
  pantalla siguen pendientes.

### Error de generación de reporte en Calificaciones (2026-10-31)

- La exportación ya conserva el error en el formulario y además lo enviaba como toast redundante.
- Se conservará el error contextual en el formulario y se quitará el anuncio repetido. No cambian
  endpoint, archivo, contenido del reporte ni datos de calificación. Las respuestas HTTP fallidas
  no mostrarán el código técnico crudo; indicarán si hay que volver a iniciar sesión, revisar
  permisos o reintentar según el estado.
- `seccionCalificaciones.routing.test.tsx`: 19/19 PASS. Cubre 400/401/403/500 con mensajes de
  recuperación adecuados, ausencia de códigos HTTP crudos y ausencia de toast duplicado.
- Emisores de otras operaciones/pantallas y verificación manual con runtime instalado, zoom 200 %
  y lector de pantalla siguen pendientes.

### Carga de una lista en Asistencias (2026-10-31)

- Al fallar la lectura de los registros, la pantalla ya muestra una alerta con botón para reintentar
  y bloquea el guardado para evitar sobrescribir datos no cargados; además repetía el fallo en un toast.
- Se conserva la alerta contextual, la recuperación y el bloqueo; se elimina solamente el toast
  duplicado. Endpoints, datos y reglas de asistencia no cambian.
- `seccionAsistencias.test.tsx`: 14/14 PASS. Confirma alerta contextual, ausencia de toast,
  guardado bloqueado mientras faltan los datos y recuperación tras reintentar.
- Fundamento: WCAG 2.2 SC 4.1.3 pide exponer los mensajes de estado sin exigir cambio de foco;
  el patrón Alert de WAI-ARIA APG indica que el anuncio no debe mover el foco ni desaparecer
  automáticamente.

### Guardado de política en Evaluaciones (2026-10-31)

- La operación ya mostraba «Configuración guardada» como estado en la vista de política y además
  emitía un toast con el mismo resultado.
- Se conservará la confirmación local, que permanece junto al formulario; se quitará el toast
  redundante. No cambian política seleccionada, versiones, persistencia ni payload.
- `seccionEvaluaciones.test.tsx`: 26/26 PASS; el test confirma el estado accesible y que el bus
  no recibe el aviso duplicado. Los demás emisores de Evaluaciones quedan fuera de este ajuste.

### Error de eliminación en Temarios (2026-10-31)

- `SeccionTemarios` ya no interpola `error.message` directamente en el toast. Usa el mensaje
  normalizado para errores remotos y una explicación genérica para errores desconocidos; ante
  401 informa que venció la sesión y ofrece «Cerrar sesión».
- `seccionTemarios.test.tsx`: 18/18 PASS; dos casos cubren que no se filtren detalles técnicos
  y que el 401 incluya una acción de recuperación. No afecta los emisores ni el contenido de
  éxito de Temarios.
- Esta comprobación cubre solo la eliminación; siguen pendientes otros emisores y runtime,
  zoom y lector de pantalla.

### Errores de archivo en Evaluaciones (2026-10-31)

- Archivar políticas y archivar/restaurar evidencias ya no muestran `error.message` en el toast.
  El mensaje indica el registro y la acción; ante resultado incierto pide actualizar y verificar
  el estado antes de repetir; ante 401 añade «Cerrar sesión» como recuperación.
- `seccionEvaluaciones.test.tsx`: 28/28 PASS; contempla error técnico genérico sin filtrarlo y
  error 401 con acción de sesión. Emisores de otras operaciones siguen pendientes.

### Validación complementaria (2026-10-29)

- Se corrigió la etiqueta de la acción de sesión a «Cerrar sesión» y `clienteComun.test.ts` lo comprueba junto al contrato de emisión del evento.
- `clienteComun.test.ts` y `toastProvider.test.tsx`: 27/27 PASS. El recorrido E2E del toast se amplió a 320, 390 y 1440 CSS px, tema claro/oscuro, encaje de acciones, ubicación del contenedor dentro del viewport de escritorio y activación de «Continuar» con Enter: 1/1 PASS.
- Capturas sintéticas inspeccionadas: `reports/qa/ux-toast-20261029-final/`. Esto amplía la verificación visual a escritorio, pero no comprueba interacción con lector de pantalla ni instalación local.

### Validación complementaria (ajuste de región viva, 2026-10-29)

- `status` cortés ahora existe vacío desde el montaje del provider y se actualiza al emitir un aviso; `alert` de error permanece dinámico y separado de los controles. Se actualiza también la prueba del caso inicial y la salida de cola.
- `toastProvider.test.tsx`: 12/12 PASS; contrato CSS responsive focal: 1/1 PASS; ESLint focal, typecheck de frontend, `sdd:audit`, compilación `build:docente` y `wcag-guard` PASS; contraste: 54/54 pares PASS.
- Base normativa: WAI-ARIA 1.3, sección 5.3.5, recomienda crear regiones `status` vacías y modificar su contenido cuando deba anunciarse; `alert` es la excepción descrita por el estándar.
- El runtime local no respondió en esta sesión (GET de UI y API rechazados); quedan pendientes la captura actual, el lector de pantalla y la comprobación en la instalación.

### Auditoría visual actual de toast (2026-10-31)

- Playwright Edge con emisor sintético: `audita notificaciones globales en móvil y escritorio,
  ambos temas y teclado`, 1/1 PASS en 320/390/1440 CSS px, tema claro/oscuro.
- Capturas actuales inspeccionadas en `reports/qa/ux-audit-toast-current-goal-20261031/`.
  En móvil, el área de avisos fluye antes de la interfaz y las acciones quedan visibles dentro
  de cada toast; en escritorio, el contenedor permanece dentro del viewport y las acciones
  de teclado funcionan con Enter. El fixture de escritorio deja un toast sobre texto de estado
  vacío; no demuestra que el overlay evite controles de una pantalla con datos reales.
- `toastProvider.test.tsx`: 12/12 PASS; contrato CSS responsive focal: 1/1 PASS; ESLint
  focal PASS. No hubo cambio de código en esta auditoría.
- Siguen pendientes lector de pantalla, zoom manual al 200 %, runtime instalado y comprobación
  de posibles solapamientos en flujos poblados.

### Revisión de pantalla poblada y colisión de acciones (2026-10-31)

- Un fixture con dos alumnos ficticios mostró que un toast de advertencia podía cubrir el
  botón «Editar» de una tarjeta cuando esa acción no tenía el foco. La causa era que el
  algoritmo solo consideraba el control enfocado.
- El cálculo ahora puntúa las cuatro esquinas contra todos los controles visibles; evita
  cualquier ubicación que oculte por completo alguno y usa flujo si ninguna es segura.
  Las ubicaciones izquierdas limitan el ancho a 320 px para respetar el margen de contenido
  cuando existe una columna lateral estrecha, y colocan las acciones bajo el texto para
  conservar su ancho legible. También se corrigió la referencia obsoleta al elemento enfocado
  durante el recálculo.
- `toastProvider.test.tsx`: 17/17 PASS. E2E focal con fixture dummy: 1/1 PASS en 320, 390 y
  1440 CSS px, tema claro/oscuro; valida controles visibles y teclado. Capturas inspeccionadas
  en `reports/qa/ux-audit-toast-poblada-20261031/`.
- Las capturas de escritorio muestran que el ancho reducido evita cubrir la tarjeta de alumnos
  y conserva visibles su avatar, nombre, acciones y el foco. En móvil, el flujo normal evita
  tapar controles, pero la captura con la búsqueda enfocada no muestra los avisos en el
  viewport. Una variante fija para móvil mantuvo el aviso visible, pero su botón «Cerrar» se
  solapó con el selector de materia (70 × 31 px); se descartó para no bloquear el control. Falta
  ubicar el flujo móvil cerca de la tarea activa. El E2E no acredita runtime instalado, lector
  de pantalla ni zoom manual al 200 %.

### Revisión móvil en lista poblada (2026-10-31)

- La primera revisión mostró que el flujo del documento podía dejar el aviso fuera del viewport
  al enfocar la búsqueda de Alumnos. La variante flotante anterior era demasiado alta y cubría
  controles; una medición actual con dos alumnos ficticios probó la ubicación y el tamaño a
  320/390 CSS px, en ambos temas.
- En móvil se muestra un aviso a la vez; los siguientes esperan y se indican como `+N en espera`
  dentro de la tarjeta. Las acciones van en una columna compacta y el texto conserva su contenido.
  Al ampliar la ventana se recupera la cola sin perder avisos ni tiempo restante de los que ya
  estaban visibles.
- La ubicación móvil ahora usa el cálculo de interferencia existente; la geometría de medición
  permanece fija mientras se evalúan posiciones, incluso cuando el estado actual es flujo, para
  evitar un ciclo de re-render al alternar entre flujo y posición flotante.
- Entre esquinas que protegen el foco y los controles visibles, la puntuación ahora elige la que
  cubre menos texto auxiliar (ayudas, etiquetas, estados y contenido explicativo). Si todas las
  ubicaciones seguras se cruzan con texto, puede quedar un solapamiento parcial para conservar
  visibles los controles.
- `toastProvider.test.tsx`: 20/20 PASS. E2E con fixture de dos alumnos dummy: 1/1 PASS a 320,
  390 y 1440 CSS px, temas claro/oscuro, scroll al inicio y regreso al campo enfocado. Comprueba
  que el aviso móvil está dentro del viewport, conserva el foco, no oculta por completo ningún
  control y que la acción «Continuar» funciona con teclado en escritorio.
- Capturas actualizadas en `reports/qa/ux-audit-toast-poblada-20261031/`.
- Revalidación final de esta corrección: `toastProvider.test.tsx` 20/20 PASS; `gui.responsive.contract.test.tsx -t toast` 1/1 PASS; E2E focal 1/1 PASS; `npm run guard:wcag` 65/65 pares PASS. Capturas 320/390 claro/oscuro y 1440 claro/oscuro regeneradas e inspeccionadas; los controles clave permanecen visibles y el foco no queda totalmente cubierto.
- Pendientes transversales: probar más pantallas densas y tipos de aviso con acciones dobles,
  lector de pantalla, zoom 200 %, y runtime instalado. En fallback en flujo, una pantalla larga
  aún puede dejar la tarjeta fuera del viewport; no se afirma resuelto para todos los contextos.

### Cuenta: feedback contextual sin toast duplicado (2026-10-31)

- Los resultados de guardar PDF, retención, regenerar accesos y comprobar actualizaciones ya se
  muestran en Cuenta. El toast repetía éxito/error sin añadir una acción; eliminarlo deja una
  sola confirmación junto al flujo y conserva los datos, endpoints y recuperación contextual.
- Si una operación falla porque venció la sesión, el detalle permanece en Cuenta y se permite un
  toast adicional únicamente para la acción distinta de cerrar sesión y renovar el acceso.
- La restauración desde Papelera conserva su toast de éxito porque el elemento desaparece de la
  lista y no se genera un mensaje inline que confirme el resultado.
- Validación focal: `seccionCuenta.test.tsx` 25/25 PASS; PDF, retención, accesos y actualizaciones
  muestran el resultado en contexto, y la recuperación de sesión conserva un CTA distinto.

### Fallback geométrico de notificaciones (2026-10-31)

- Se endureció la selección de esquina: la superposición permitida es como máximo 1 % del área
  de cada control y bloque de texto visible. Si ninguna esquina cumple, la región pasa a `flow`.
- Se agregó una regresión con cuatro bloques de texto ubicados en las esquinas; antes del cambio
  se reproducía que el aviso eligiera `bottom-right` y cubriera texto. La regresión usa `span`
  para comprobar el texto compacto que la detección anterior no contemplaba; el aviso ahora usa
  `flow` cuando todos los rincones están ocupados.
- La medición incorpora también texto semántico compacto (`span`, `small`, `strong`, `em`, `b`),
  celdas de tabla, `output` y `code`; excluye controles interactivos y contenido bajo `aria-hidden`.
- Validación actual: `toastProvider.test.tsx` 21/21 PASS; contrato CSS responsive focal 1/1 PASS;
  typecheck, ESLint focal, `guard:wcag` (65/65 pares), `sdd:audit` y `git diff --check` PASS.
- Las capturas y E2E poblados existentes corresponden a la revisión anterior; la nueva regla
  geométrica aún no tiene auditoría visual en el runtime instalado ni verificación manual de zoom
  o lector de pantalla.

## Referencias

- W3C WAI, [WCAG 2.2 SC 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- W3C WAI, [WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
- W3C, [WAI-ARIA 1.3, Live Region Roles](https://www.w3.org/TR/wai-aria-1.3/#live_region_roles).
- W3C WAI, [ARIA APG Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/): evitar que alertas desaparezcan automáticamente y no mover el foco.
- Material Design 3, [Snackbar](https://m3.material.io/components/snackbar/overview): avisos breves no modales que pueden ser temporales o persistir hasta una acción.
- Apple Human Interface Guidelines, [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback): integrar la señal de estado en contexto y ajustar la interrupción a la importancia del mensaje.

## Alineacion del E2E con el fallback en flujo (2026-10-31)

- Hallazgo: la prueba exigia posicionamiento `fixed` incluso cuando el algoritmo correctamente seleccionaba `data-placement="flow"` porque todas las esquinas superaban el limite de solapamiento.
- Cambio: el E2E valida que `flow` use posicion relativa y no cubra controles/foco; la visibilidad dentro del viewport se comprueba cuando el documento esta en su inicio. Las capturas se toman con el aviso en pantalla, antes de devolver el foco al formulario.
- Validacion: `audita notificaciones globales en movil y escritorio, ambos temas y teclado` 1/1 PASS a 320/390/1440 CSS px; fixtures y datos dummy; seis capturas inspeccionadas. La prueba unitaria de cuatro esquinas sigue siendo la que verifica el cambio a `flow`.
- Limite: la captura es sintetica de E2E, no del runtime instalado; no valida lector de pantalla ni zoom manual al 200 %.

## Orden FIFO al reducir la capacidad visible (2026-11-02)

- Hallazgo estático: al cambiar de escritorio a móvil, los avisos visibles excedentes se añadían después de los que ya estaban en espera. Así, un aviso más nuevo podía adelantarse a otros que llegaron antes.
- Cambio: los avisos desplazados se insertan en su orden de llegada antes de la cola previa; el aviso que contiene el foco se conserva visible.
- Validación focal: `toastProvider.test.tsx` incorpora un caso con cuatro avisos visibles, uno previo en cola, foco dentro de un aviso y reducción a móvil; verifica la promoción FIFO hasta agotar la cola.
- Límite: comprobación de componente con geometría y datos sintéticos; el runtime instalado, el lector de pantalla y el zoom al 200 % siguen pendientes.

## Inventario de emisores redundantes en Plantillas (2026-11-03)

- Se retiraron avisos de estado que repetían selección de hoja OMR, inicio de procesamiento,
  selección de archivos, cambios de temas/cantidad y apertura/cierre/carga de previsualizaciones.
  Los controles ya muestran selección, progreso o el contenido resultante.
- El estado y resumen del job OMR se anuncian en el panel; se agregó allí la nota persistente de
  que ese proceso no guarda ni modifica calificaciones. Los errores y el resultado verificable
  del ZIP de QA (etiquetas, fuentes y SHA-256) conservan Toast porque aportan recuperación o
  información que no aparece en el panel.
- `plantillas.hooks.test.tsx` y `plantillas.refactor.test.tsx` agregan regresiones para preview,
  cierre, resolver/finalizar y el enlace PDF. Pruebas focales Plantillas: 54/54 PASS; typecheck,
  ESLint focal, `guard:wcag` (69/69 pares), `sdd:audit` y `git diff --check` PASS.
- No se alteraron contratos, cálculos, permisos ni payloads. No se verificó el runtime instalado,
  lector de pantalla ni zoom real al 200 %.

## Legibilidad de mensajes con acciones en escritorio (2026-11-03)

- Hallazgo visual reproducido: en 1440 px, los botones ocupaban la tercera columna del toast y reducían el mensaje a una franja estrecha con saltos de línea casi palabra por palabra.
- Cambio: el toast usa dos columnas para icono y contenido; las acciones ocupan una fila completa debajo del mensaje. No cambia el bus, los payloads ni los tiempos.
- Aceptación: el cuerpo conserva al menos 75 % del ancho de la tarjeta y el mensaje sintético cabe en tres líneas o menos a 1440 px.
- Validación focal: `toastProvider.test.tsx` 23/23 PASS; E2E Edge 1/1 PASS a 320/390/1440 CSS px, claro/oscuro y teclado, incluyendo la medición de ancho y líneas. Capturas inspeccionadas en `reports/qa/ux-toast-actions-20261103/`.
- Límite: fixture sintético; la pestaña lateral no expone automatización (`browser.user is unavailable`). Runtime instalado, lector de pantalla y zoom real al 200 % siguen pendientes.

## Selección por área total de texto cubierto (2026-11-03)

- Hallazgo: las posiciones seguras se ordenaban por el peor solapamiento proporcional de un bloque individual. Esto podía preferir una ubicación que cubría más texto total si cada bloque tenía una proporción ligeramente menor.
- Cambio: se conserva el límite máximo de 1 % por bloque individual para declarar segura una posición; el desempate ahora minimiza el área total de texto cubierta, calculada como unión geométrica para no contar dos veces bloques superpuestos.
- Validación: `toastProvider.test.tsx` 24/24 PASS; la regresión nueva primero falló con el algoritmo anterior (seleccionaba `bottom-left`) y pasa con el criterio total (`bottom-right`).
- Contratos, niveles, payloads, tiempos, foco y llamadas de emisores no cambian. Sin verificación visual con runtime instalado, lector de pantalla ni zoom real al 200 %.
- Validación visual complementaria: E2E focal Edge 1/1 PASS con la pantalla Alumnos poblada por fixtures dummy, viewport móvil 320/390 px y escritorio 1440 px, temas claro/oscuro y operación de teclado. Midió la posición frente al foco y los controles, revisó acciones de al menos 44×44 px y el ancho/líneas del mensaje en escritorio. Capturas inspeccionadas en `reports/qa/ux-toast-algorithm-current-20261103/`; el runtime de usuario en 4173 no se modificó.

## Resultado contextual en la mesa de vinculación por lote (2026-11-03)

- Hallazgo: al vincular una imagen desde la mesa, la fila ya conservaba «Vinculado» o el error, pero además se emitía un toast con el mismo resultado; el error se marcaba como `status` y no permitía distinguir su severidad.
- Cambio: el resumen de cada archivo ahora anuncia el éxito como `status` y el error como `alert`. Se quitó el toast redundante; un error de sesión conserva un toast separado con la acción explícita para renovar el acceso. El resumen del lote sigue informando el total procesado.
- Validación focal: `seccionRegistroEntrega.test.tsx` 6/6 PASS; cubre éxito, error genérico y recuperación de sesión en la mesa, además del flujo individual existente.
- Contratos: no cambian rutas, payloads, permisos, pasos de revisión ni resultados de lote.

## Acción masiva contextual en Asistencias (2026-11-03)

- Hallazgo: «Todos Presentes» actualizaba cada fila y además repetía la misma confirmación en un toast global.
- Cambio: el aviso ahora aparece junto a la lista como `status`, recuerda revisar los registros antes de guardar y no interrumpe el flujo con un toast duplicado.
- Validación focal: `seccionAsistencias.test.tsx` comprueba el mensaje contextual y la ausencia de emisión del toast durante la acción.
- Contratos y payloads de asistencia no cambian.

## Legibilidad tipográfica móvil (2026-11-03)


- Hallazgo: el título se reducía a 13 px y el mensaje principal a 12.5 px en pantallas móviles.
- Cambio: ambos usan 14 px como mínimo; el indicador de cola pasa a 0.75 rem. Se conserva el límite de altura desplazable y el tamaño táctil de las acciones.
- Validación focal: E2E de Toast en Edge 1/1 PASS a 320/390/1440 CSS px y tema claro/oscuro; incluye comprobación del tamaño computado mínimo de 14 px para título y mensaje en móvil.
- Sin cambios de temporizadores, payloads, semántica ni comportamiento de cola.

## Acciones primarias con contraste consistente en OMR y GUI docente (2026-11-03)

- Hallazgo visual: «Confirmar revisión» y otros CTA docentes heredaban un gradiente con contraste insuficiente; además, una regla de tema oscuro reintroducía fondo menta y texto oscuro. La paleta primaria del flavor docente ahora usa superficies sólidas con texto blanco y tokens explícitos de hover para ambos temas. Los estados `:disabled` quedan fuera de las reglas activas.
- El resultado «Análisis completado» permanece junto al análisis como estado accesible y deja de duplicarse en un toast que cubría el tablero.
- Validación focal: ambos E2E Edge pasan 1/1; Reportes comprueba «Generar / actualizar HTML» y «Pasar lista» en 320/390 CSS px, claro/oscuro; OMR verifica «Confirmar revisión», estados y ausencia de guardado/confirmación. Capturas inspeccionadas en `reports/qa/ux-primary-contrast-20261103/`.
- Se usan fixtures sintéticos; no se analiza ni modifica información real.

## Error contextual en Recuperación de lotes (2026-11-03)

- Hallazgo estático: los errores al cargar el inventario, verificar y reconstruir ya se mostraban en el panel con acción para reintentar, pero también se emitía un toast con el mismo texto.
- Cambio: se eliminó el toast duplicado. Si el error indica que la sesión expiró, el panel conserva el detalle y se presenta un toast persistente con la acción distinta «Cerrar sesión» y una instrucción breve para reintentar.
- Validación focal: `seccionRehidratacionLotes.test.tsx` 20/20 PASS; cubre tres errores contextuales sin toast duplicado y la recuperación complementaria para sesión vencida. ESLint focal y typecheck PASS.
- No cambian rutas, permisos, contratos ni acciones de recuperación de lotes.

## Resultado visible al crear o actualizar un temario (2026-11-03)

- Hallazgo: tras crear desde PDF o captura manual, la pantalla abría el árbol y mostraba el contenido resultante, además de emitir un toast de éxito repetido. La edición tenía la misma duplicación.
- Cambio: se retiraron esos tres toasts de éxito; el árbol activo muestra el temario y sus temas. Los toasts para resultados no representados en pantalla y para recuperación de errores se mantienen.
- Validación: `seccionTemarios.test.tsx` 18/18 PASS; las pruebas manual, PDF y edición verifican la apertura del árbol actualizado y ausencia del toast redundante. `typecheck`, `guard:wcag`, `git diff --check` y `sdd:audit` PASS.
- Contratos, cálculos, permisos y payloads no cambian. Sigue pendiente validar runtime instalado, lector de pantalla y zoom real al 200 %.

## Mensaje seguro al fallar una acción del toast (2026-11-03)

- Hallazgo estático: el `catch` de acciones del toast interpolaba `Error.message`; una acción podía propagar rutas, códigos o información interna en una alerta visible.
- Requisito: conservar una alerta persistente y una instrucción útil para comprobar el resultado, sin mostrar contenido arbitrario de la excepción en rechazos síncronos o asíncronos.
- Cobertura focal: `apps/frontend/tests/toastProvider.test.tsx` verifica ambos modos de fallo y que no se exponga el detalle sensible.
- Validación completada: `toastProvider.test.tsx` 25/25 PASS; E2E Edge `audita notificaciones globales en móvil y escritorio, ambos temas y teclado` 1/1 PASS; capturas del rechazo a 320 CSS px en claro y oscuro; typecheck frontend, ESLint focal, `guard:wcag` (81/81 pares), `sdd:audit` y `git diff --check` PASS.
- El cambio mantiene persistencia y recuperación, sin modificar el contrato público del toast ni las acciones existentes.

## Restaurar el host al cerrar el último toast en flujo (2026-11-05)

- **Hallazgo visual en el Login integrado:** el algoritmo movió correctamente el host de notificaciones al flujo porque ninguna posición flotante protegía el texto. Al cerrar el último toast, el efecto de ciclo de vida salía sin reubicarlo. El host vacío permanecía como hijo de `.auth-card-header`, y su regla flex reservaba altura, dejando un hueco antes de las pestañas y el título.
- **Cambio:** el host ahora vuelve a `document.body` y elimina `style`/`data-placement` de flujo cuando ya no hay avisos visibles ni en cola. No modifica las ubicaciones mientras existan notificaciones.
- **Validación focal ejecutada:** `npm --workspace apps/frontend run test -- tests/toastProvider.test.tsx` → 26/26 PASS. La regresión fuerza `flow` dentro de una cabecera flex, cierra la última notificación y verifica que no quede bloque espaciador. ESLint focal PASS.
- **Límite:** la captura observada es del runtime integrado previo al cambio; el código del worktree no se sincronizó con la instalación local. La prueba de componente verifica la geometría/limpieza del host, no el runtime instalado.
