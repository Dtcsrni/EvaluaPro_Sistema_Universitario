---
id: SPEC-126
titulo: Mejora UX de Alumnos y matrícula
version: 1.1.32
fecha: 2026-11-05
autor: Codex
modulo: frontend_docente_alumnos_ux
estado: approved
---

## Contexto

La pantalla de Alumnos combina altas, edición, reinscripción, filtros y seguimiento de grupo. La revisión detectó información de matrícula repetida en tarjetas, el indicador ambiguo `Sin Derecho`, emoji decorativos, atributos de formulario incompletos e IDs internos visibles en etiquetas de materias. El runtime docente ya estuvo disponible para la revisión visual inicial y la comprobación de selectores; faltan los demás tamaños, temas y recorridos de interacción definidos abajo.

La auditoría del flujo de edición mostró que, al guardar, la vista regresaba al formulario de alta y mostraba el mensaje genérico «Alumno actualizado». La confirmación debe nombrar el expediente afectado y seguir expuesta como mensaje de estado sin duplicar el anuncio en un toast.

La captura posterior al guardado también mostró que el tooltip del botón «Editar» mantenía el nombre anterior aunque el botón siguiera enfocado y la tarjeta ya mostrara el nombre actualizado. La capa compartida de tooltips debe seguir las mutaciones del nombre accesible del control activo cuando dicho tooltip se presenta.

La captura de confirmación a 320 CSS px encontró que el tooltip actualizado cubría el correo de la tarjeta. Al enfocar una acción situada en la mitad inferior del viewport, la capa debe preferir el espacio inferior y desplazar la vista solo lo necesario para mostrar el tooltip completo; conserva la colocación superior si la página no puede desplazarse más. La revalidación del 2026-11-05 determinó que el tooltip del botón «Editar» es redundante porque su acción ya está visible; se suprime para ese botón y se conserva el nombre accesible completo. Las reglas de colocación y actualización aplican a los demás tooltips que sí se muestran.

Fuentes de diseño accesible:

- [W3C WAI: etiquetar controles](https://www.w3.org/WAI/tutorials/forms/labels/)
- [W3C WAI: instrucciones para formularios](https://www.w3.org/WAI/tutorials/forms/instructions/)
- [WCAG 2.2: identificación y corrección de errores](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
- [WCAG 2.2: reflow (SC 1.4.10)](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [WCAG 2.2: bypass blocks (SC 2.4.1)](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html): orientación para ofrecer navegación directa al contenido relevante.
- [W3C WAI: tablas de datos](https://www.w3.org/WAI/tutorials/tables/)
- [W3C WAI-ARIA APG: patrón de divulgación](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): el control comunica `aria-expanded`, puede relacionarse con su contenido mediante `aria-controls` y se activa con Enter/Espacio.
- [W3C WAI: mensajes de estado (WCAG 2.2 SC 4.1.3)](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): confirma que los resultados de una acción se exponen mediante un rol accesible sin exigir que se mueva el foco.
- [W3C WAI: G199, confirmación de envío exitoso](https://www.w3.org/WAI/WCAG21/Techniques/general/G199): la confirmación debe indicar claramente que la acción se completó.

## Alcance

Mejorar la presentación y captura de expedientes de alumnos en el frontend docente. No cambiar API, persistencia, permisos, formato de matrícula CUH, umbrales de asistencia, reglas académicas, importación de listas ni semántica de reinscripción.

## Requisitos Funcionales

- **REQ-001 (Tarjetas de alumno):** El nombre y la matrícula deben presentarse una sola vez cada uno, con jerarquía legible. Matrícula, grupo y correo conservan sus etiquetas y contenido.
- **REQ-002 (Indicadores):** Reemplazar `Sin Derecho` por texto que describa el dato observado —alumnos con cuatro o más inasistencias— sin inferir una decisión de elegibilidad. Conservar exactamente el cálculo y su umbral actuales.
- **REQ-003 (Formulario):** Mantener etiqueta visible e instrucción completa del formato de matrícula. Los placeholders de matrícula, nombres y apellidos deben ser concisos y caber completos en 320 CSS px; son pistas y no sustituyen las instrucciones visibles ni el nombre accesible. Declarar propósito/autocompletado adecuado para nombres, apellidos y correo; marcar el correo como campo de correo sin alterar validación o envío existentes. Cuando el correo se sugiera automáticamente desde la matrícula, asociar esa explicación con el campo; retirar la asociación al pasar a edición manual.
- **REQ-003A (Envío de alta/edición por teclado):** El formulario de alumno debe permitir enviar con Enter y conservar un nombre accesible. Mantener las validaciones y payloads actuales, incluida la validación propia del correo del backend; no activar validación nativa que altere el comportamiento existente. Evitar envíos duplicados mientras se procesa una solicitud.
- **REQ-003B (Aviso no interruptivo de matrícula):** La validación de formato de matrícula puede actualizarse mientras se escribe; su mensaje asociado al campo debe usar un anuncio cortés (`status`/`polite`) y no un `alert` asertivo que interrumpa cada pulsación. Mantener `aria-invalid`, la relación `aria-describedby`, el error visible, la regla de formato y el bloqueo del envío hasta corregirlo.
- **REQ-004 (Consistencia visual):** Retirar emoji decorativos de títulos y acciones, usar la iconografía compartida y mantener textos en español con uso de mayúsculas natural. Reutilizar tokens existentes.
- **REQ-005 (Responsive y accesibilidad):** Revisar tarjetas, ayudas, selectores y acciones en temas claro/oscuro, teclado, zoom y anchos móviles; errores y estados deben permanecer identificables con texto. El placeholder de búsqueda de la lista debe caber íntegro a 320 CSS px, mientras la ayuda visible explica que admite nombre, matrícula y correo. Los tooltips que se muestran en acciones de tarjetas deben evitar cubrir sus metadatos: prefieren el espacio inferior y, si hace falta, desplazan la vista solo lo necesario para mostrar el tooltip completo. Si la página no puede desplazarse más, conservan la colocación superior. El botón «Editar» muestra una etiqueta de acción visible y no presenta un tooltip redundante; su nombre accesible conserva el nombre completo del alumno.
- **REQ-006 (Compatibilidad):** Conservar CRUD, permisos, filtros, importación, estados vacíos, reinscripción, etiquetas accesibles y datos históricos. La búsqueda por nombre, matrícula o correo debe tolerar diferencias de acentuación para que escribir sin tildes no oculte coincidencias.
- **REQ-006A (Recuperación de filtros):** Cuando la búsqueda y/o el grupo no produzcan resultados, identificar de forma breve los filtros activos en el mensaje de estado, sin repetir el encabezado ni nombrar filtros vacíos. Ofrecer una acción para limpiar búsqueda y grupo y recuperar la lista completa, sin cambiar la materia seleccionada.
- **REQ-006B (Consistencia de grupos):** Los chips, el selector y el filtro de grupo usan la misma comparación sin distinguir mayúsculas/minúsculas. Si hay expedientes cuyo grupo solo difiere por capitalización, mostrarlos bajo una sola opción/chip y contar todos los expedientes que coinciden con el filtro aplicado, conservando la etiqueta original del primer grupo encontrado.
- **REQ-006C (Presentación única del filtro de grupo):** Para una a tres opciones de grupo, mostrar el grupo de botones rápidos (incluido «Todos») y omitir el selector nativo. Con cuatro o más opciones, mostrar el selector nativo y omitir los botones rápidos para mantener compacta la lista. Si no existen grupos, omitir ambos controles. Ambas presentaciones conservan el mismo filtro y la misma acción para limpiar búsqueda/grupo; nunca deben mostrarse duplicadas.
- **REQ-007 (Orientación en estados vacíos):** Los estados vacíos de Alumnos describen las acciones disponibles en esta pantalla. Pueden dirigir a Classroom para administrar la conexión con Google, pero no deben prometer importación de alumnos desde Classroom mientras la ruta activa no ofrezca esa capacidad.
- **REQ-008 (Carga y recuperación de la lista):** Mientras se cargan alumnos o falla la consulta del padrón, no mostrar conteos en cero ni el estado «No hay alumnos registrados» como resultado confirmado. Anunciar la carga, distinguir el error y ofrecer reintentar solo la consulta GET de alumnos. Si ya hay datos visibles al fallar una actualización, conservarlos e indicar que puede estar desactualizada. Una respuesta exitosa con cero alumnos sigue mostrando el estado vacío confirmado. No cambiar endpoint, filtros, permisos ni mutaciones.
- **REQ-009 (Carga y recuperación del catálogo):** Mientras se carga o falla el catálogo de materias, no presentar la selección inicial como si el catálogo estuviera vacío ni afirmar que no hay materias. Comunicar carga/error y ofrecer volver a consultar solo el catálogo existente. Si hay materias previamente cargadas, conservarlas e indicar que pueden estar desactualizadas. No cambiar rutas, permisos ni mutaciones.
- **REQ-010 (Prioridad del padrón en móvil):** Cuando existan alumnos y la vista esté en un viewport de hasta 720 CSS px, presentar el formulario de alta plegado de forma inicial para que el padrón y sus filtros queden antes del formulario extenso. El control debe indicar estado expandido, permitir abrir/cerrar por teclado y lector de pantalla, y mantener el formulario abierto durante una edición. Si el padrón confirmado está vacío, el formulario inicia abierto. En escritorio conserva el formulario abierto. No cambiar validación, orden del DOM, permisos, endpoints ni payloads.
- **REQ-010A (Actualización responsive del formulario):** Mientras no exista una preferencia manual, actualizar el estado automático del formulario cuando el viewport cruza 720 CSS px, incluso si la ventana cambia de tamaño después de cargar la pantalla. Conservar la elección manual del usuario durante cambios posteriores de viewport.
- **REQ-005A (Retorno de foco al cerrar edición):** Al guardar o cancelar una edición, devolver el foco al botón que abrió el formulario. Cancelar también debe invalidar el foco inicial diferido para que no robe el foco de retorno. Si el expediente ya no está disponible, llevar el foco al encabezado de la lista.
- **REQ-005B (Contexto completo de materia en el filtro de lista):** Cuando el valor de «Materia de la lista» no quepa completo en viewports estrechos, mostrar junto al selector el nombre íntegro de la materia seleccionada y asociarlo como descripción accesible. Mantener visible la explicación de que el filtro solo cambia la lista, preservar el selector nativo, sus opciones completas, teclado, selección y comportamiento actual.
- **REQ-011 (Confirmación contextual de alta y edición):** Los mensajes de éxito de alta y edición identifican al alumno por nombre completo, conservan su semántica `status` y no se duplican en un toast. No se cambian operaciones, permisos ni payloads.
- **REQ-012 (Actualización de tooltip enfocado):** Si cambia el nombre accesible del control que mantiene el foco y su tooltip se presenta, el tooltip actualiza su texto sin esperar a que el usuario quite y devuelva el foco. No altera el nombre accesible ni el estado del control. Si la acción ya está expresada por una etiqueta visible y el tooltip sería redundante, se suprime sin retirar el nombre accesible.
- **REQ-015 (Contraste de datos y avisos en tarjetas):** matrícula, grupo, correo y el indicador «4+ inasistencias» mantienen contraste de texto mínimo 4.5:1 sobre el fondo efectivamente renderizado en tema claro y oscuro. No cambiar etiquetas, umbrales, significado ni datos.

## Criterios de Aceptación

1. Una tarjeta muestra nombre, matrícula, grupo y correo sin duplicar matrícula ni recortar datos.
2. El contador de inasistencias explica qué mide y no comunica una decisión académica no calculada por esa vista.
3. Los campos personales mantienen etiquetas e instrucciones visibles; los propósitos de nombre, apellidos y correo se exponen de forma programática. La ayuda de correo automático se asocia al campo solo mientras la sugerencia siga activa.
4. Las pantallas de referencia y posterior se revisan en ejecución en tema claro y oscuro, a 320/390 px y escritorio; se recorren teclado y estados aplicables. Una pantalla no disponible queda pendiente.
5. Las pruebas de compatibilidad confirman matrícula, alta/edición, filtros (incluida búsqueda sin distinguir acentos), permisos, importación y reinscripción sin cambios de contrato.
6. Pasan `npm run guard:wcag`, lint, typecheck frontend y las pruebas frontend focales; se registra el resultado exacto.
7. A 320 CSS px, los placeholders de Matrícula, Nombres y Apellidos caben íntegros; la instrucción asociada a Matrícula conserva el prefijo CUH, el límite de nueve dígitos y un ejemplo completo.
8. El estado sin coincidencias permite limpiar búsqueda y grupo con una sola acción; la materia seleccionada se conserva y vuelven a mostrarse los alumnos.
9. Al guardar o cancelar una edición mediante teclado, el foco vuelve al botón Editar correspondiente; cancelar rápidamente no debe perder el foco por un callback diferido, y si el botón desapareció el foco queda en el encabezado de la lista.
10. Si los datos contienen grupos que solo difieren en mayúsculas/minúsculas, la presentación disponible (chips o selector) muestra una sola opción; su conteo coincide con los alumnos que muestra el filtro.
11. El estado sin materia orienta a elegir una asignatura y ubica la administración de la conexión con Google Classroom; el estado sin alumnos explica el alta individual mediante el formulario y ubica esa misma conexión. Ninguno promete importar alumnos desde Classroom.
12. Con uno a tres grupos, solo aparece el grupo de botones rápidos; con cuatro o más, solo aparece el selector nativo; sin grupos, no aparece ninguno. Cambiar de modo no altera conteos, filtrado ni limpieza de filtros.
13. El placeholder «Nombre» de la búsqueda de la lista se muestra completo a 320 CSS px y su ayuda identifica nombre, matrícula y correo como criterios de búsqueda.
14. Al cargar o fallar el catálogo sin datos disponibles, el estado inicial de la lista no se presenta como vacío confirmado; el error permite reintentar solo la consulta del catálogo. Si hay datos previos, se conservan y se identifican como posiblemente desactualizados.
15. En móvil con alumnos existentes, el formulario inicia plegado y la lista/filtros quedan disponibles antes del alta; el botón expone `aria-expanded` y `aria-controls`, se puede activar con Enter/Espacio y abre/cierra el contenido. En padrón confirmado vacío inicia abierto; al editar un expediente se abre y no puede ocultarse hasta terminar la edición. En escritorio inicia abierto.
16. Después de un alta o edición, el mensaje `status` identifica por nombre completo al alumno registrado o actualizado, permanece fuera del formulario y no se repite en un toast.
17. Al actualizar el nombre de un alumno con el foco de vuelta en su botón «Editar», la etiqueta visible de acción sigue siendo «Editar», el nombre accesible contiene el nombre completo actualizado y no aparece un tooltip redundante.
18. Al cruzar 720 CSS px mediante cambio de tamaño u orientación, el formulario cambia a su estado responsive automático. Una acción manual previa de abrir/cerrar conserva su elección al volver a cambiar el viewport.
19. En la confirmación de edición con foco devuelto a «Editar», no aparece un tooltip que cubra el correo de la tarjeta a 320/390 CSS px en temas claro/oscuro. Los tooltips de otras acciones que sí se muestran respetan las reglas de posición de REQ-005.
20. La cabecera ofrece el enlace «Ver lista de alumnos», que lleva el foco y el viewport al título del padrón sin modificar materia, búsqueda ni grupo. La relación de destino está identificada por un ID único y la acción funciona con teclado.
21. En viewports de hasta 360 CSS px, la introducción de Alumnos conserva al menos 200 CSS px útiles para el título y la descripción, evitando comprimir el texto junto al icono.
22. Los rótulos y valores de matrícula, grupo y correo, así como el indicador «4+ inasistencias», mantienen contraste mínimo de 4.5:1 sobre la composición de superficies real en tema claro y oscuro a 320 y 390 CSS px.
23. En escritorio, Materias, Alumnos y el ancho de columna disponible determinan el reflow: cabecera, KPI, formulario, filtros y tarjetas no se recortan cuando la navegación lateral reduce el espacio; cada etiqueta de formulario queda junto a su control y el emblema de Alumnos no repite el icono junto al título.
24. El padrón general se distingue del conteo de la materia seleccionada; las etiquetas de contexto no usan puntos animados como si indicaran actividad en vivo.
25. Las iniciales decorativas del avatar caben dentro del círculo a 320 CSS px, sin truncamiento ni cambio de identidad del expediente.
26. El botón «Editar» conserva el nombre completo del alumno para tecnologías de asistencia sin mostrar un tooltip redundante que tape tarjetas vecinas.
27. A 320 y 390 CSS px, el selector «Materia de la lista» conserva sus opciones nativas; el nombre actual completo permanece visible junto al selector y se incluye en su descripción accesible. Cambiarlo solo filtra la lista, no cambia materia del formulario ni altera permisos, conteos o datos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-006 | Tarjetas, filtros, materias y conservación de CRUD | `apps/frontend/tests/seccionAlumnos.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementación cubierta; búsqueda en español ignora diferencias de tildes para nombre, matrícula y correo. Reflow verificado a 320/390/571/1023 CSS px. Tarjetas con cuatro registros ficticios capturadas a 320/390 px en claro/oscuro; metadatos reorganizados a 320 px y contraste claro corregido. Datos reales no identificables siguen pendientes |
| REQ-002 | Indicador de inasistencias | `apps/frontend/tests/seccionAlumnos.test.tsx` | Implementado y cubierto; describe el umbral observado sin inferir elegibilidad; falta cotejar visualmente el estado con datos reales no identificables |
| REQ-003 | Formulario de alta y edición | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado y cubierto; campos obligatorios, opcionales, correo/autocomplete e instrucción de matrícula verificados; el error de formato queda asociado al campo. El E2E comprueba que los placeholders de matrícula, nombres y apellidos quepan íntegros a 320 CSS px y que la ayuda visible conserve el formato y ejemplo de matrícula completos. La sugerencia automática de correo queda asociada hasta que el usuario edita el valor |
| REQ-003B | Anuncio cortés de error de formato de matrícula durante escritura | `apps/frontend/tests/seccionAlumnos.test.tsx` | PASS: prueba focal 1/1; verifica `role="status"`, ausencia de `alert`, asociación `aria-describedby`, `aria-invalid`, mensaje visible y bloqueo del envío hasta corregir. Typecheck, ESLint focal, WCAG 81/81, SDD y `git diff --check` PASS. |
| REQ-004 | Iconografía, textos y consistencia visual | `apps/frontend/tests/seccionAlumnos.test.tsx`; `apps/frontend/tests/guiaAlumnosVisual.test.tsx`; `apps/frontend/tests/ux.visual.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | La cabecera usa un solo emblema Lucide; KPI, estados y acciones conservan iconografía semántica. Captura E2E integral con fixtures ficticios a 1024/1440 CSS px en claro/oscuro. En 1024, las vistas reordenan contenido según el ancho del panel, los campos quedan alineados y las tarjetas preservan el correo sin recorte; `scrollWidth` de las secciones queda dentro del ancho visible. Runtime instalado y datos no ficticios pendientes |
| REQ-005 | Responsive y teclado | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `apps/frontend/tests/seccionAlumnos.test.tsx`; `apps/frontend/tests/ux.quality.test.tsx`; `apps/frontend/tests/ux.visual.test.tsx`; `apps/frontend/tests/tooltipLayer.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Reflow y filtro rápido de grupo con nombre accesible, `aria-pressed`, Enter y Espacio cubiertos. E2E focal confirma la secuencia de tabulación Matrícula → Nombres → Apellidos → Correo → Grupo → Materia → Crear alumno, con indicador de foco visible en teclado y fixture ficticio. El resumen de inasistencias comunica carga/error y ofrece reintento. El tooltip de edición evita tapar el correo a 320/390 CSS px en ambos temas. Revisión global de teclado, zoom y lector de pantalla siguen pendientes |
| REQ-005B | Nombre completo de la materia actual visible y asociado al filtro de la lista | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: prueba de componente y Playwright Edge 1/1 verifican el nombre extenso junto al selector y en su descripción accesible, 320/390 CSS px en claro/oscuro, sin overflow; cambiar materia filtra solo la lista. Typecheck, ESLint focal, WCAG 102/102, SDD y diff-check PASS. Capturas inspeccionadas en `reports/qa/ux-audit-alumnos-select-current-20261105/`. |
| REQ-004A, criterio 24 | Claridad de padrón general y estado de contexto seleccionado | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | La cabecera etiqueta el conteo como «Padrón general» para distinguirlo del KPI «En materia». Se retiran las insignias redundantes y los puntos animados que podían parecer actividad en vivo. |
| REQ-004B, criterio 25 | Avatares legibles sin iniciales recortadas | `apps/frontend/tests/utilidades.appDocente.test.ts`; `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | El avatar usa la primera y última inicial normalizadas para caber en el círculo; el nombre completo sigue visible en la tarjeta. |
| REQ-004C, criterio 26 | Nombre accesible sin tooltip que oculte contenido | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | El nombre accesible conserva el nombre completo; el E2E comprueba que pasar el puntero no cree el tooltip redundante sobre la tarjeta siguiente. |
| REQ-006A | Mensaje contextual y acción única para recuperar la lista desde filtros sin coincidencias | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: prueba focal 34/34 y E2E Edge 2/2; el estado identifica búsqueda y grupo activos sin repetir el encabezado; limpiar filtros mantiene materia y restaura lista a 320/390 CSS px en ambos temas. Typecheck, ESLint focal, WCAG 73/73, SDD y diff-check PASS. |
| REQ-006B | Comparación y conteo coherentes de grupos con capitalización mixta | `apps/frontend/tests/seccionAlumnos.test.tsx` | Prueba focal verifica una sola opción/chip, conteo combinado y resultados equivalentes al filtro sin distinguir capitalización |
| REQ-006C | Presentación adaptativa sin duplicar chips y selector | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; componente cubre 1–3 grupos, cuatro grupos y ningún grupo. E2E Edge dummy confirma chips solos, filtro/limpieza, apilado y placeholder completo a 320/390 px en claro/oscuro. |
| REQ-005A | Retorno del foco desde Guardar/Cancelar al invocador o encabezado de respaldo | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; pruebas de cancelar/guardar y E2E de guardado con teclado verifican el foco devuelto |
| REQ-007 | Orientación veraz y accionable en estados vacíos, sin prometer funciones no disponibles en la ruta activa | `apps/frontend/tests/seccionAlumnos.test.tsx` | Las pruebas focales comprueban la selección de materia, el alta individual y la ubicación de la conexión Classroom; no afirman que el flujo activo importe alumnos |
| REQ-008 | Carga, error recuperable y vacío confirmado del padrón de alumnos; reintento GET-only | `apps/frontend/tests/seccionAlumnos.test.tsx`; `apps/frontend/tests/recursosAcademicos.hooks.test.tsx` | Validado: loading/error no presenta el padrón como vacío; el error ofrece reintento GET-only; el hook conserva los datos previos ante fallo y recupera el listado; el reintento no repite consultas ajenas ni mutaciones |
| REQ-009 | Carga/error/recuperación del catálogo de materias en la sección Alumnos | `apps/frontend/tests/seccionAlumnos.test.tsx`; `apps/frontend/tests/appDocente.test.tsx` | Implementación y pruebas focales en esta tanda; el reintento usa `refrescarMaterias` y conserva rutas actuales |
| REQ-010 | Divulgación accesible del alta en viewport móvil con padrón disponible | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: componente 33/33 (registro previo) y Playwright Edge 1/1 en preview aislado, 320/390 CSS px en claro/oscuro y 1024/1440 en ambos temas para edición; verifica divulgación por control, operaciones dummy y ausencia de overflow. Capturas actuales en `reports/qa/ux-alumnos-current-goal-20261031/`. |
| REQ-010A | Recalcular el plegado al cambiar el viewport y conservar la preferencia manual | `apps/frontend/tests/seccionAlumnos.test.tsx` | Implementado; la prueba focal cubre cambios entre 390 y 1024 CSS px y persistencia de la elección manual |
| REQ-011 | Confirmación de alta/edición contextual, con el alumno identificado en mensaje de estado y sin toast duplicado | `apps/frontend/tests/seccionAlumnos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: pruebas focales comprueban el nombre completo y el rol `status`, sin emitir toast; E2E Edge sintético confirma el aviso fuera del formulario y captura claro/oscuro a 320/390 CSS px. |
| REQ-012 | Tooltips visibles sincronizados con el control enfocado; tooltip redundante de Editar suprimido | `apps/frontend/tests/tooltipLayer.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Los tooltips que se muestran siguen el nombre accesible actualizado; el botón Editar conserva etiqueta visible y nombre accesible completo, sin tooltip duplicado. E2E ficticio y capturas vigentes revalidados el 2026-11-05. |
| REQ-014 | Reflow de la introducción de Alumnos en móviles angostos | `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; E2E mide al menos 200 CSS px de ancho de lectura a 320 CSS px y verifica overflow cero. |
| REQ-015 | Contraste del contenido y del indicador de inasistencias de las tarjetas | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: Playwright Edge calcula contraste sobre el fondo compuesto de rótulos y valores de matrícula/grupo/correo y del aviso «4+ inasistencias» a 320/390 CSS px en claro/oscuro; sin resultados por debajo de 4.5:1. Capturas actuales en `reports/qa/ux-alumnos-audit-current-20261104/`. |
| REQ-013 | Acceso directo desde la cabecera al padrón de alumnos | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: Playwright Edge 1/1 con perfil/datos ficticios; Enter mueve el foco al encabezado y lo deja visible. Verificado a 320/390 CSS px en claro/oscuro, sin overflow; materia y filtros no cambian. Capturas actuales en `reports/qa/ux-alumnos-current-goal-20261031/`. |

## Estado responsive del formulario ante cambios de viewport (2026-11-03)

- **Hallazgo:** el estado inicial consultaba `window.innerWidth` durante el render, sin escuchar `resize`; un cambio de tamaño u orientación podía dejar el formulario expandido o plegado según el ancho anterior.
- **Cambio:** el componente actualiza el modo automático al cambiar el viewport hasta que la persona elige abrir o cerrar manualmente. Esa preferencia explícita se conserva en cambios posteriores. No cambia el breakpoint, el orden del contenido, la edición ni los contratos.
- **Validación focal:** `apps/frontend/tests/seccionAlumnos.test.tsx` comprueba 1024 → 390 → 1024 CSS px y que la preferencia manual sobreviva nuevos cambios.
- **Límite:** la captura local más reciente disponible para esta sección es anterior; el navegador integrado reporta `browser.user is unavailable`, así que no se afirma una revisión visual posterior al cambio.

## Colocación del tooltip al confirmar edición (2026-11-03)

- **Vigencia:** este comportamiento de actualización y colocación se conserva para tooltips presentados. La decisión del 2026-11-05 que suprime el tooltip redundante de «Editar» prevalece para ese control; véase «Alumnos · avatares y tooltip de edición en móvil».

- **Hallazgo visual:** al devolver el foco al botón «Editar» tras guardar, el tooltip actualizado cubría el correo del alumno en la tarjeta a 320 CSS px.
- **Cambio:** en acciones de tarjetas de Alumnos el tooltip usa el ancho disponible del viewport y prefiere aparecer debajo del control. Si falta espacio, desplaza la vista solo lo necesario; en redimensionamiento conserva el tooltip visible. La animación inferior también mantiene su posición final correcta.
- **Validación focal:** `tooltipLayer.test.tsx` 3/3 PASS; E2E Edge `audita visualmente Alumnos con lista y formulario ficticios` 1/1 PASS con aserción geométrica de no superposición a 320/390 CSS px, claro/oscuro, y confirmación/foco conservados. Typecheck y ESLint de archivos afectados PASS; guard WCAG 71/71 pares, auditoría SDD y `git diff --check` PASS. Capturas inspeccionadas en `reports/qa/ux-alumnos-auditoria-20261103/`.
- **Límite:** fixtures ficticios; lectores de pantalla, zoom manual al 200 % y runtime instalado siguen pendientes.

## Revalidación visual E2E de edición (2026-11-03)

- **Evidencia:** `npm run test:gui:responsive:e2e:docente -- --grep "audita visualmente Alumnos con lista y formulario ficticios"` con Edge y puerto aislado `4417` → 1/1 PASS.
- **Cobertura:** fixture ficticio y API interceptada; lista, formulario, edición y confirmación revisados a 320/390/1024/1440 CSS px en claro/oscuro. La prueba comprueba reflow sin overflow, correo completo asociado al campo, materia/periodo completos, una sola actualización por el endpoint previsto, retorno de foco al botón y actualización del tooltip.
- **Capturas actuales:** `reports/qa/ux-alumnos-edicion-20261103/`.
- **Límite:** no demuestra comportamiento del runtime instalado, zoom manual al 200 % ni uso con lector de pantalla.

## Carga y recuperación del padrón (2026-10-31)

- **Hallazgo:** un fallo en `GET /alumnos` dejaba la lista inicial indistinguible de una respuesta exitosa sin registros; el resumen podía mostrar ceros y el estado vacío no ofrecía recuperación.
- **Cambio:** el hook expone carga/error y reintento aislado para `GET /alumnos`; conserva filas anteriores ante fallo, y la sección muestra carga, error recuperable y conteos no confirmados sin declarar un padrón vacío. `AppDocente` conecta el reintento con el hook. Endpoints, permisos y mutaciones permanecen iguales.
- **Validación focal:** `seccionAlumnos.test.tsx` y `recursosAcademicos.hooks.test.tsx` → 34/34 pruebas PASS; typecheck frontend PASS; ESLint focal PASS; guard WCAG 65/65 pares PASS; `sdd:audit` y `git diff --check` PASS.
- **Límite:** no se capturó runtime instalado en esta validación; zoom 200 % y lector de pantalla siguen pendientes conforme a REQ-005.

## Revalidación focal de la iconografía en estados vacíos (2026-10-28)

- Hallazgo estático: las tarjetas rápidas de materia y el flujo ilustrativo “Comienza seleccionando una materia” aún usaban el carácter Unicode `➔` como flecha. La prueba anterior detectaba pictogramas emoji, pero no este símbolo.
- Cambio: ambas vistas usan `ArrowRight` del catálogo Lucide compartido; los adornos permanecen fuera del nombre accesible del contenido.
- Validación focal: `tests/seccionAlumnos.test.tsx` comprueba que las dos variantes no impriman el glifo y que el estado sin materias renderice los dos iconos.

## Auditoría visual responsive con expedientes ficticios (2026-10-28)

- Capturas de la lista con cuatro alumnos ficticios a 320 y 390 CSS px, en tema claro y oscuro: `reports/qa/ux-audit-20261028-alumnos-dummy-current/`.
- Hallazgos: a 320 px, matrícula/grupo/correo se comprimían en etiquetas estrechas; además, reglas genéricas `item-meta span` con `!important` aplicaban colores oscuros también en tema claro.
- Cambio: a 360 px o menos, metadatos ocupan filas de ancho completo y muestran etiqueta/valor apilados. En tema claro, contenedores, etiquetas y valores de metadatos vuelven a la paleta clara con contraste legible; cálculos y contratos no cambian.
- Validación focal previa: `GUI_RESPONSIVE_PORT=4417 E2E_BROWSER_CHANNEL=msedge E2E_SCREENSHOT_DIR=reports/qa/ux-audit-20261028-alumnos-dummy-current npx playwright test -c tests/gui-responsive/playwright.config.mjs --grep "audita tarjetas de Alumnos"` → 1/1 PASS, incluye 320/390 px, ambos temas, datos ficticios y aserción de color de texto claro.
- Revalidación (2026-10-29): `GUI_RESPONSIVE_PORT=4183 E2E_BROWSER_CHANNEL=msedge E2E_SCREENSHOT_DIR=reports/qa/ux-audit-20261029-alumnos-dummy-current npx playwright test -c tests/gui-responsive/playwright.config.mjs --grep "audita tarjetas de Alumnos con expedientes ficticios"` → 1/1 PASS. En navegador real automatizado, el filtro de grupo conserva foco visible y se activa con Espacio/Enter; las filas y el anuncio de resultados cambian de 4 a 2 y vuelven a 4. Las cuatro capturas sintéticas fueron inspeccionadas y se guardan en `reports/qa/ux-audit-20261029-alumnos-dummy-current/`.
- Pendiente: zoom manual al 200 %, recorrido completo del resto de controles con teclado y lector de pantalla; no se usaron ni requieren datos reales identificables.

## Envío por teclado de alta y edición (2026-10-29)

- Hallazgo estático: los campos de registro/edición estaban dentro de una sección y las acciones
  eran botones `type="button"`; Enter no ejecutaba la acción principal.
- Cambio: convertir el bloque en un formulario con nombre accesible y manejador de envío que
  despacha alta o edición según el modo activo. `noValidate` conserva el comportamiento previo
  de validación del cliente/correo; se conservan las guardas de permisos, matrícula, payload y
  acción duplicada durante carga.
- Validación focal: `tests/seccionAlumnos.test.tsx` 17/17 PASS, incluida alta con Enter y una
  sola llamada; `build:docente` PASS (TypeScript, ESLint, bundle docente y contraste WCAG 54/54);
  `sdd:audit` y `git diff --check` PASS. La validación visual completa, zoom 200 %, recorrido
  global de teclado y lector de pantalla continúan pendientes según REQ-005.

## Legibilidad de metadatos en tarjetas móviles (2026-10-29)

- Hallazgo visual: en capturas actuales a 320 CSS px, los rótulos de matrícula, grupo y correo
  heredaban `0.62rem` y espaciado amplio entre letras. Al comprimirse las tarjetas, esa
  combinación hacía difícil distinguir las etiquetas del dato.
- Cambio: en tarjetas de hasta 480 CSS px, elevar rótulos a 0.75rem y valores a 0.85rem,
  reducir el espaciado de mayúsculas y aumentar el interlineado de datos que se parten en varias
  líneas. No cambia el orden, contenido ni comportamiento de la tarjeta.
- Validación: `E2E_BROWSER_CHANNEL=msedge GUI_RESPONSIVE_PORT=4186 npm run
  test:gui:responsive:e2e:docente -- --grep "audita tarjetas de Alumnos con expedientes ficticios"`
  → 1/1 PASS. El E2E confirma rótulos de al menos 12 px y valores de al menos 13 px a 320/390
  CSS px en temas claro/oscuro, contenido completo y ausencia de overflow. Se inspeccionaron
  `test-results/ux-audit-alumnos-dummy-320-light.png` y
  `test-results/ux-audit-alumnos-dummy-390-dark.png`. ESLint focal, contraste 59/59,
  `sdd:audit` y `git diff --check` PASS. Zoom manual y lector de pantalla siguen pendientes.

## Recorrido de teclado del formulario de Alumnos (2026-10-29)

- Validación focal en Edge con fixture ficticio: `GUI_RESPONSIVE_PORT=4187 E2E_BROWSER_CHANNEL=msedge npm run test:gui:responsive:e2e:docente -- --grep "audita visualmente Alumnos con lista y formulario ficticios"` → 1/1 PASS.
- El E2E verifica en orden los seis campos y la acción de alta, y confirma que Nombres muestra el halo de foco al recibir foco por teclado. No envía el formulario ni modifica registros.
- Límite: esto cierra solo el recorrido de foco del formulario de alta en esta vista; la edición, el flujo completo de la sección, zoom 200 % y lector de pantalla siguen pendientes.

## Texto del correo sugerido en móvil estrecho (2026-10-29)

- Hallazgo visual confirmado a 320 CSS px: el valor autogenerado
  `CUH512410168@cuh.mx` ocupaba 159 px y el campo solo dejaba 107 px para texto; la dirección
  quedaba cortada aunque la ayuda inferior la repitiera completa.
- Cambio: hasta 360 px se oculta el icono decorativo del campo de correo, se reducen los
  márgenes internos y el texto del input queda en 14 px para que la dirección completa sea
  legible. No cambia la sugerencia, el valor ni la edición manual.
- Regresión focal: E2E con matrícula ficticia mide que el texto quepa, comprueba que controles
  queden dentro del formulario y captura ambos temas a 320 px; también conserva las
  verificaciones de overflow y foco. Resultado: 1/1 PASS en
  `reports/qa/ux-alumnos-20261029-form320-final/`.
- Límite: alta/edición completa, zoom 200 % y lector de pantalla continúan pendientes según
  el alcance general de la spec.

## Contexto completo de materia en el formulario móvil (2026-10-29)

- Hallazgo visual: a 320 CSS px el selector nativo recortaba el nombre seleccionado de la materia,
  dificultando confirmar a qué curso se asignaría el nuevo alumno.
- Cambio: en anchos de hasta 480 CSS px, el formulario muestra debajo del selector un resumen que
  envuelve el nombre completo y fecha de inicio. `aria-labelledby` preserva el nombre accesible del
  control como «Materia»; opciones, ID seleccionado y payload no cambian.
- Validación: `seccionAlumnos.test.tsx` 17/17 PASS; E2E `audita visualmente Alumnos con lista y
  formulario ficticios` 1/1 PASS, con verificación del resumen y capturas de panel a 320 CSS px en
  claro/oscuro en `reports/qa/ux-alumnos-20261029-materia-contexto/`.
- Límite: no valida runtime instalado, zoom 200 % ni lector de pantalla.

## Edición de expediente: ruta, nombre de acción y correo completo (2026-10-30)

- **Hallazgo:** «Guardar cambios» enviaba `POST /alumnos/:id`, aunque la ruta aprobada en
  backend es `POST /alumnos/:id/actualizar`. Además, en la lista varios botones se anunciaban
  solo como «Editar», sin distinguir al alumno; en móvil el correo editado podía quedar
  recortado dentro del input.
- **Cambio:** el formulario ahora usa la ruta de actualización existente y conserva método,
  payload, permisos y validaciones. Los botones Editar/Eliminar exponen el nombre del expediente.
  Durante edición, el correo completo aparece debajo del campo y queda asociado con
  `aria-describedby` para que el valor siga identificable aunque el input no tenga espacio para
  mostrarlo completo.
- **Validación:** `seccionAlumnos.test.tsx` 17/17 PASS. Playwright focal
  `audita visualmente Alumnos con lista y formulario ficticios` 1/1 PASS: comprueba el estado de
  edición a 320/390 CSS px en claro/oscuro, foco, correo completo, envío con Enter, exactamente
  una llamada `POST /api/alumnos/alumno-dummy-001/actualizar` con el payload esperado y bloqueo
  de escrituras a otras rutas. Capturas inspeccionadas en
  `reports/qa/ux-alumnos-edicion-current-turn/`.
- **Límite:** API y datos simulados; no modifica registros. Zoom 200 %, lector de pantalla y
  runtime instalado continúan pendientes.

## Contexto completo de materia en la edición de escritorio (2026-10-30)

- **Hallazgo visual:** en el formulario de edición, el selector nativo de Materia recortaba
  la etiqueta completa tanto en 1024 como en 1440 CSS px. El texto contextual completo solo
  aparecía en móvil, por lo que escritorio no ofrecía confirmación visible del nombre/periodo.
- **Cambio:** el resumen completo de la materia seleccionada ahora se muestra debajo del
  selector en todos los tamaños y se envuelve sin desbordar. Opciones, valor seleccionado,
  ID enviado y payload permanecen iguales.
- **Validación:** Playwright focal con datos ficticios y API interceptada, incluido el envío
  único de edición: 1/1 PASS. Capturas del formulario a 1024 y 1440 CSS px en ambos temas en
  `reports/qa/ux-alumnos-edicion-desktop-200-turn/`. `guard:wcag --skip-lint` confirma
  59/59 pares de contraste y el E2E verifica ausencia de overflow.
- **Límite:** la evidencia cubre el formulario de edición, no toda la lista en escritorio.
  Zoom 200 %, revisión manual con lector de pantalla y runtime instalado siguen pendientes.

## Placeholder legible para matrícula en móvil estrecho (2026-10-30)

- **Hallazgo visual:** a 320 CSS px el placeholder `Ej. CUH512410168` se cortaba, aunque la ayuda
  completa ya aparecía debajo del campo.
- **Cambio:** el placeholder ahora es `CUH + 9 cifras`; la ayuda visible y asociada conserva el
  prefijo CUH, la regla de exactamente nueve dígitos y el ejemplo completo `CUH512410168`. No
  cambian la etiqueta, validación, flujo de alta/edición ni payloads.
- **Validación:** Playwright Edge verifica por medición de texto que el placeholder cabe en el
  campo a 320 CSS px y captura la pantalla anterior/posterior; E2E de tarjetas a 320/390 CSS px
  PASS (1/1), E2E de lista y formulario/edición PASS (1/1), `seccionAlumnos.test.tsx` 17/17 PASS.
  ESLint focal, guard WCAG, auditoría SDD y diff check PASS.
- Evidencia antes/después: `reports/qa/ux-alumnos-placeholder-after-20261030/`.
- Referencia: W3C WAI, Form Instructions; el placeholder no reemplaza la etiqueta y las
  instrucciones de formato deben seguir disponibles para las personas que completan el campo.
- **Límite:** fixture/API ficticias; zoom real al 200 %, lector de pantalla y runtime instalado
  siguen pendientes.

## Recuperación desde búsqueda sin coincidencias (2026-10-31)

- **Hallazgo:** al combinar búsqueda y grupo sin resultados, la persona debía borrar manualmente
  los filtros por separado para volver a ver la lista.
- **Cambio:** el estado vacío explica que ambos filtros afectan los resultados y ofrece «Limpiar
  filtros». La acción borra búsqueda y grupo, conserva la materia seleccionada y no altera los
  datos ni el contrato del API.
- **Validación:** `seccionAlumnos.test.tsx` 21/21 PASS; E2E Edge con expedientes ficticios 1/1
  PASS, comprobando cero resultados, recuperación de los cuatro alumnos y materia conservada a
  320/390 CSS px en temas claro/oscuro. Se inspeccionaron capturas del estado vacío en
  `reports/qa/ux-audit-alumnos-clear-filter-20261031/`. `build:frontend:docente` PASS
  (TypeScript, ESLint, bundle guard y WCAG 61/61); `sdd:audit` PASS.
- **Límite:** zoom manual al 200 %, lector de pantalla y runtime instalado continúan pendientes.

## Retorno de foco después de editar (2026-10-31)

- **Hallazgo:** al cerrar el formulario de edición, su botón de acción se desmonta y el foco de
  teclado quedaba en el documento, sin una referencia al alumno cuyo expediente se editó.
- **Cambio:** guardar o cancelar devuelve el foco al botón Editar que inició el flujo. Si la fila
  se desmonta, el foco pasa al encabezado «Alumnos de la materia» como destino estable.
- **Validación:** pruebas focales de cancelar/guardar y expediente desaparecido, más E2E con guardado por Enter, verifican el
  retorno de foco; se incluye cancelar antes de que venza el foco inicial diferido. El E2E usa API/expedientes ficticios y bloquea otras escrituras.
- **Límite:** lector de pantalla y runtime instalado siguen pendientes.

## Ayuda asociada al correo sugerido (2026-10-31)

- **Hallazgo:** al autogenerar el correo institucional desde la matrícula, la explicación «Sugerido automáticamente» era visible, pero no quedaba asociada programáticamente con el campo.
- **Cambio:** el input ahora referencia esa ayuda mientras conserva el valor automático. Cuando el docente modifica el correo, se retira la sugerencia y también su referencia accesible; en edición permanece asociada la nota del correo completo.
- **Validación focal:** `npm -C apps/frontend run test -- tests/seccionAlumnos.test.tsx` 18/18 PASS; `npm run build:frontend:docente` PASS (TypeScript, ESLint, bundle guard, WCAG 61/61); `npm run sdd:audit` PASS; `git diff --check` exit 0.

## Contexto de selectores y lectura de tarjetas estrechas (2026-10-31)

- **Hallazgo visual:** en móvil, los selectores de materia del formulario y de la lista tenían nombres casi iguales aunque cambian contextos independientes. Los metadatos de las tarjetas apilaban etiqueta y valor a 320 CSS px, hacían la lista más larga y podían dejar un carácter del correo aislado al final de línea.
- **Cambio:** las etiquetas distinguen la materia del alumno de la materia de la lista; cada control recibe ayuda visible y asociada que explica qué cambia. En tarjetas de hasta 360 CSS px, el grupo queda en una fila compacta, mientras matrícula y correo usan el ancho completo para preservar su lectura; el correo ofrece puntos naturales de salto en `@`, `.`, `_` y `-`, sin insertar caracteres en su contenido.
- **Validación focal:** `npm -C apps/frontend run test -- tests/seccionAlumnos.test.tsx` → 22/22 PASS; el E2E Edge `audita visualmente Alumnos con lista y formulario ficticios` → 1/1 PASS con API/datos ficticios, asociaciones de nombre/ayuda, alineación de grupo, matrícula en una línea y reflow a 320 CSS px en ambos temas. Capturas generadas e inspeccionadas en `reports/qa/ux-audit-alumnos-contexto-correo-20261031/`. `npm -C apps/frontend run build:docente` PASS (TypeScript, ESLint, bundle guard, WCAG 65/65); `npm run sdd:audit` y `git diff --check` PASS.
- **Límite:** no cambia materia guardada, contratos ni datos; zoom manual al 200 %, lector de pantalla y runtime instalado siguen pendientes.

## Consistencia del filtro de grupo con capitalización mixta (2026-10-31)

- **Hallazgo estático:** la lista de chips/selector deduplicaba con coincidencia exacta, pero el filtro aplicado comparaba en minúsculas. Con grupos `3A` y `3a`, se mostraban dos opciones con conteos parciales aunque ambas mostraban los mismos alumnos.
- **Cambio:** chips y selector deduplican con la misma equivalencia sin distinguir mayúsculas; el conteo incluye todos los alumnos que el filtro correspondiente presenta. Se conserva la capitalización de la primera etiqueta de grupo encontrada y no se modifican valores persistidos.
- **Validación focal:** `seccionAlumnos.test.tsx` 23/23 PASS; typecheck de frontend, ESLint focal, `sdd:audit` y `git diff --check` PASS.
- **Límite:** no se altera la escritura de grupos, contratos de API ni datos existentes; la evidencia es de componente con expedientes ficticios.

## Orientación veraz sobre Classroom en estados vacíos (2026-10-31)

- **Hallazgo:** la primera revisión confundió un importador presente en el componente legado `SeccionClassroom` con la ruta activa. `AppDocente` carga `SeccionClassroomSync`, que administra OAuth y remite la consulta de cursos, alumnos y calificaciones a Calificaciones; no expone la importación del roster.
- **Cambio:** el estado sin materia guía a elegir una asignatura y ubica la administración de conexión; el estado sin alumnos indica el alta individual disponible en el formulario y la sección de conexión. Ambos evitan prometer una importación no disponible en el flujo activo.
- **Validación focal:** `seccionAlumnos.test.tsx` 24/24 PASS; typecheck frontend, ESLint focal, guard WCAG (65/65 pares), `sdd:audit`, validador de handoff (11/11) y `git diff --check` PASS.
- **Límite:** ruta confirmada por código y texto por prueba de componente; no se capturó el runtime instalado ni se verificaron zoom 200 % y lector de pantalla.

## Búsqueda de alumnos tolerante a tildes (2026-11-03)

- **Hallazgo estático:** el filtro de nombre, matrícula y correo solo convertía a minúsculas; una consulta escrita sin tilde no encontraba nombres como «María» o «López».
- **Cambio:** la búsqueda normaliza diacríticos en el texto ingresado y los campos comparados. Solo afecta la consulta en memoria; no cambia nombres, matrículas, correos almacenados, filtros de grupo, contratos ni escrituras.
- **Validación focal:** `npm -C apps/frontend run test -- tests/seccionAlumnos.test.tsx` 33/33 PASS; `npm -C apps/frontend run typecheck` PASS; ESLint focal para componente y prueba PASS; `npm run sdd:audit` PASS; `git diff --check` PASS.
- **Límite:** verificación de componente con datos ficticios; no se capturó runtime visual de esta interacción, zoom 200 % ni lector de pantalla.

## Mensaje de búsqueda sin coincidencias contextual (2026-11-03)

- Hallazgo visual: el estado vacío repetía «no hay coincidencias» en el título y la explicación, y no nombraba los valores activos de búsqueda/grupo.
- Cambio: el título ahora es «Sin coincidencias»; la explicación resume solo búsqueda y/o grupo activos. «Limpiar filtros» sigue eliminando ambos y conserva la materia.
- Validación: prueba de componente y E2E responsive actualizados para verificar el texto dinámico y la recuperación en 320/390 CSS px, claro/oscuro.
- Resultado: `seccionAlumnos.test.tsx` 34/34 PASS y E2E Edge 2/2 PASS con datos ficticios; el lector visual confirma menos texto repetido y filtros nombrados. ESLint focal, typecheck, WCAG 73/73, `sdd:audit` y `git diff --check` PASS.
- Límite: sin zoom real al 200 %, lector de pantalla ni runtime instalado.

## Auditoría visual de escritorio y reflow por ancho real (2026-11-05)

- **Hallazgo visual:** a 1024 CSS px, la navegación lateral reducía la columna de contenido, pero los puntos de quiebre de Alumnos seguían usando el ancho de ventana. La cabecera/KPI, el selector de materia y los correos de tarjetas se comprimían y parte del contenido quedaba recortado. Además, el icono de usuarios aparecía dos veces en la misma cabecera y los controles de nombre/apellidos no quedaban alineados con sus rótulos.
- **Cambio:** se introdujo un contenedor de ancho para Alumnos, con reflow de cabecera, KPI, formulario, filtros y metadatos de tarjetas acorde al espacio efectivo. En el escritorio estrecho el formulario usa dos columnas, baja a una con menos espacio, y mantiene sus campos alineados. Se conserva el emblema principal como único icono de la cabecera.
- **Validación:** E2E Edge con API/expedientes ficticios, flujo lista → edición → confirmación, a 1024/1440 CSS px en ambos temas y 320/390 CSS px para los estados móviles; 1/1 PASS. Se verifican ancho interno, ancho útil del correo, alineación etiqueta/control, ausencia del icono duplicado y ninguna escritura fuera del fixture. Capturas actuales inspeccionadas en `reports/qa/ux-alumnos-desktop-audit-20261105/`.
- **Evidencia visual:** revisión de lista, alta, edición y confirmación en claro y oscuro; notas en `reports/qa/ux-alumnos-desktop-audit-20261105/review-notes.md`.
- **Límite:** datos ficticios y frontend de prueba; la instalación local, el zoom manual al 200 % y el lector de pantalla no se verificaron.

## Alumnos · etiquetas de contexto sin estado animado ambiguo (2026-11-05)

- **Hallazgo visual:** la etiqueta «Control Escolar y Matrículas» repetía la descripción de
  la sección y un punto verde pulsante sugería actividad en vivo sin representarla. El
  nombre de materia seleccionado también llevaba un punto animado innecesario. El contador
  «Total de alumnos» no aclaraba que era el padrón general, distinto del conteo por materia.
- **Cambio:** se retiró la insignia redundante, se eliminaron los puntos animados de contexto
  y se renombró el conteo «Padrón general». Se conservan ambos valores y sus cálculos.
- **Validación focal:** prueba de Alumnos, E2E Edge con expedientes ficticios a 320/390 px en
  claro/oscuro, typecheck frontend, ESLint focal, guard:wcag, SDD y `git diff --check`.
- **Contratos:** no cambian filtros, conteos, endpoints, permisos ni operaciones.

## Alumnos · avatares y tooltip de edición en móvil (2026-11-05)

- **Hallazgo visual:** las iniciales de cuatro letras excedían el avatar circular a 320 CSS
  px; el tooltip derivado del nombre accesible de «Editar» podía cubrir el avatar de la
  tarjeta contigua aunque el nombre completo ya estaba visible en la tarjeta.
- **Cambio:** los avatares muestran una inicial del nombre y una del apellido; el nombre
  accesible completo del botón se conserva y el tooltip redundante se suprime.
- **Validación focal ejecutada (2026-11-05):** `seccionAlumnos.test.tsx` 34/34 PASS;
  `utilidades.appDocente.test.ts` 11/11 PASS; E2E Edge con expediente ficticio 1/1 PASS a
  320/390 y escritorio 1024/1440 CSS px, en ambos temas; `npx eslint
  tests/gui-responsive/responsive-docente.spec.ts` PASS. Se reemplazaron 34 capturas en
  `reports/qa/ux-alumnos-desktop-audit-20261105/`. La revisión confirma iniciales de avatar
  contenidas, etiqueta visible y nombre accesible completo; el tooltip duplicado no aparece.
- **Contratos:** los datos, el orden, la edición y los nombres accesibles se conservan.
