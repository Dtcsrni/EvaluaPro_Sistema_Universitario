---
id: SPEC-129
titulo: UX de Asistencias docentes
version: 1.0.26
fecha: 2026-11-05
autor: Codex
modulo: frontend_docente_asistencias_ux
estado: approved
---

## Contexto

La pantalla docente de Asistencias presenta resumen, pase de lista y reglas por periodo/grupo. La inspección estática de `SeccionAsistencias.tsx` detectó tres riesgos para una decisión académica: al fallar la consulta del resumen solo se emite un toast y se conservan los datos previos; las consultas de sesiones y reglas fallidas se silencian; y los chips de grupo calculan sus conteos sobre todos los periodos, aunque la lista y las operaciones sí se limitan al periodo seleccionado. Los controles de navegación tampoco declaran el patrón ARIA de pestañas. Crear una sesión inicializa todos los registros como presentes, sin una explicación visible junto a la lista.

La revisión inicial fue estática. Posteriormente se capturó la vista inicial en un preview aislado con respuestas dummy, sin seleccionar materia ni generar un pase de lista; no sustituye la revisión del runtime instalado ni los estados operativos con datos.

## Fuentes de diseño y accesibilidad

- [W3C WAI-ARIA APG: Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): define roles, relación entre pestaña y panel, y navegación con teclado.
- [W3C WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): los mensajes dinámicos deben poder exponerse programáticamente sin exigir que el foco se mueva.
- [W3C WAI-ARIA 1.2: `aria-busy`](https://www.w3.org/TR/wai-aria-1.2/#aria-busy): comunica que un elemento se está modificando y que las tecnologías de asistencia pueden esperar a que termine.
- [W3C WCAG 2.2 SC 3.3.1: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification): el error detectado se identifica y describe en texto.
- [W3C WCAG 2.2 SC 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): el contenido vertical debe presentarse a 320 CSS px sin pérdida; una tabla puede conservar desplazamiento bidimensional en su propio contenedor cuando lo requiere su significado, manteniendo el resto de la página en reflow.
- [W3C WCAG 2.2 SC 1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html): las relaciones entre encabezados y datos de una tabla deben poder determinarse programáticamente.
- [W3C WAI-ARIA APG: Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): el control de expandir/contraer comunica `aria-expanded`, puede señalar el panel mediante `aria-controls` y opera con Enter/Espacio.
- [Nielsen Norman Group: Defer Secondary Content When Writing for Mobile Users](https://www.nngroup.com/articles/defer-secondary-content-for-mobile/): prioriza el contenido esencial en pantallas móviles y permite abrir la información complementaria cuando la persona la necesita.
- Política local: `docs/WCAG_UI_POLICY.md` y `docs/DESIGN.md`.

## Requisitos Funcionales

- **REQ-001 (Contexto y cifras):** Restringir los conteos de grupo al periodo activo y a alumnos activos. El KPI de alumnos identifica si la cifra corresponde al periodo completo o al grupo seleccionado. Al cambiar periodo o grupo, no presentar ni aceptar como actuales respuestas tardías del contexto anterior.
- **REQ-001A (Alcance de métricas):** La ayuda de «Asistencia promedio» y «Examen bloqueado» identifica si sus datos corresponden al periodo completo o al grupo seleccionado, de acuerdo con el alcance enviado a la consulta del resumen. No describir como global una métrica filtrada por grupo y no alterar los cálculos ni la consulta.
- **REQ-002 (Estados del resumen):** Diferenciar consulta sin datos, carga, resultado vacío válido y fallo de API. Ante error, ocultar cifras y resultados anteriores, mostrar un mensaje junto al resumen y permitir reintentar.
- **REQ-003 (Estados de sesiones y reglas):** No silenciar fallos de lectura de sesiones o reglas; explicar qué área no cargó y ofrecer recuperación sin presentar un fallo como una lista vacía.
- **REQ-004 (Pestañas accesibles):** Asociar `tablist`, `tab` y `tabpanel` con selección anunciada, nombres accesibles y operación por teclado conforme al patrón APG, preservando las tres vistas y sus acciones.
- **REQ-005 (Default del pase de lista):** Mantener el valor por defecto vigente de registros iniciales y explicar junto a la lista que todos comienzan como presentes y deben revisarse antes de guardar. No modificar cálculos, valores persistidos ni permisos.
- **REQ-006 (Responsive y claridad):** Revisar encabezado, filtros, chips, tabla/lista, acciones y formularios a 320, 390, 768 y 1024 CSS px, zoom de texto 200 %, temas claro/oscuro, foco visible, estados hover/disabled y movimiento reducido. Las etiquetas completas de los filtros deben envolver o reacomodarse sin quedar recortadas dentro de su propio contenedor, incluso si el documento no presenta overflow horizontal. Los valores de periodo y grupo seleccionados deben quedar legibles en los filtros estrechos. Los ejemplos de campos no deben quedar cortados a 320 CSS px. Conservar contexto visual de periodo/grupo.
- **REQ-007 (Compatibilidad):** Conservar las rutas, payloads, permisos, flujo de confirmación, cálculo de faltas y derecho a examen, persistencia, excepciones y contratos establecidos por SPEC-039.
- **REQ-008 (Anuncios de resumen):** Mantener los KPI visibles fuera de una región viva extensa. Al consultar el resumen, anunciar una sola frase breve con el periodo, grupo y cifras principales; conservar los mensajes de error existentes y no mover el foco.
- **REQ-009 (Guardado de regla):** Durante el envío de una regla, impedir envíos repetidos, deshabilitar el control de guardado y exponer progreso comprensible y programático. Al concluir, restaurar el control, actualizar las reglas activas con la respuesta de lectura posterior y conservar un aviso de éxito coherente con esos valores; no cambiar datos, endpoint ni política de reglas.
- **REQ-010 (Encabezados del resumen):** La tabla de asistencia debe tener un nombre/caption accesible, encabezados de columna con `scope="col"` y nombres completos accesibles aunque la interfaz use abreviaturas visuales. Explicar las abreviaturas visibles junto a la tabla, sin cambiar datos ni cálculos.
- **REQ-011 (Errores de escritura):** Los errores al crear sesión, guardar el pase, guardar reglas o autorizar excepciones presentan una acción y título específicos, texto de error seguro y una instrucción que evite repetir a ciegas una escritura cuyo resultado no se confirmó. Si la sesión venció, conservar la acción para cerrarla y renovar acceso.
- **REQ-012 (Tabla desplazable por teclado):** La tabla ancha conserva su semántica nativa y puede recibir foco en su región desplazable para recorrer columnas con teclado. La instrucción asociada nombra la acción de teclado y la alternativa táctil/puntero; no añade controles ni cambia el orden de lectura.
- **REQ-013 (Recordatorio contextual):** El aviso persistente de pase de lista conserva el acceso directo y el cierre en todas las secciones. En Asistencias ofrece el texto explicativo completo; fuera de esa sección usa una versión breve para no competir con el trabajo principal. Mantener la región `status` y los objetivos táctiles.
- **REQ-014 (Copy preciso y jerarquía sin redundancia):** El encabezado y sus instrucciones describen las tareas reales sin afirmar que el control está activo ni prometer que completar el pase requiere un clic. El nombre de la sección aparece una sola vez en la jerarquía del encabezado; los símbolos redundantes no se repiten junto al título. Los pasos y la descripción de la sesión indican revisar registros y permiten entender las modalidades de captura.

## Criterios de Aceptación

1. Los conteos de chips coinciden con los alumnos activos del periodo seleccionado y del grupo correspondiente; el KPI de alumnos nombra el contexto de su cifra, incluido «todos los grupos» cuando no hay grupo filtrado.
2. Una carga fallida o tardía no muestra datos de otro periodo/grupo ni ceros ficticios; el mensaje ofrece reintento y se anuncia sin mover el foco.
3. Fallos de sesión y reglas se distinguen de listas válidamente vacías.
4. Las tres pestañas y paneles tienen semántica y relaciones verificables; flechas, Home/End y Tab funcionan como corresponda.
5. La lista comunica que el estado inicial es Presente; se mantienen las reglas de guardado y lectura actual.
6. Las pruebas focales, lint, typecheck, guard WCAG y build docente pasan.
7. La revisión visual y de teclado se valida en navegador lateral con datos dummy; si el navegador lo impide, se registra el bloqueo y no se declara verificación visual.
8. La matriz vincula cada requisito con una prueba ejecutable y evidencia observada.
9. Los KPI visibles no forman una región viva; un mensaje de estado conciso anuncia la actualización del resumen.
10. A 320 CSS px, la etiqueta completa «Materia o Periodo Académico» es visible dentro de su campo en ambos temas; la prueba inspecciona los límites del texto renderizado además de `scrollWidth`.
11. «Guardar regla» aparece después de todos los controles que modifica, incluida la opción de equivalencia de retardos; al activarla, sus campos adicionales también preceden al botón.
12. Con una petición de guardado pendiente, un doble clic produce una sola solicitud, el botón comunica «Guardando regla…» y `aria-busy`; al resolverse, el botón vuelve a estar disponible y el resultado se anuncia una sola vez.
13. El resumen expone un caption con su contexto, cada columna tiene `scope="col"` y las columnas compactas P/F/R/J/% tienen nombres accesibles completos y una leyenda visible.
14. Los cuatro errores de escritura identifican la acción y comunican cómo verificar el resultado antes de repetirla; no muestran mensajes de red crudos. Un `401` ofrece la acción persistente «Cerrar sesión».
15. La acción «Todos Presentes» anuncia su resultado junto al pase de lista como estado accesible; no emite un toast redundante y conserva la revisión manual antes de guardar.
16. La región nombrada del resumen de asistencia aparece en el orden de Tab, conserva la descripción de teclado/gesto y mantiene el foco como destino del desplazamiento de la tabla.
17. En una sección distinta de Asistencias, el recordatorio anuncia «Pase de lista pendiente hoy.» y mantiene los dos controles operables; en Asistencias vuelve a mostrar la explicación completa. A 320 CSS px, el aviso compacto acomoda texto y acciones en una sola fila sin solaparse ni causar overflow, conserva objetivos táctiles de 44 px y ocupa menos altura que el expandido.
18. A 320 CSS px, el ejemplo del campo «Tema o contenido temático cubierto» se muestra completo en claro y oscuro sin cortar el valor que escriba la persona.
19. Las ayudas de «Asistencia promedio» y «Examen bloqueado» describen el periodo/grupo seleccionado; ninguna conserva el texto «global» cuando hay un grupo seleccionado. El cálculo y el payload de consulta permanecen iguales.
20. Después de guardar una regla, la lista activa refleja los valores enviados y su acción coincide con el aviso de éxito una vez concluida la recarga.
21. A 320 CSS px, las etiquetas y valores activos de los filtros de periodo y grupo se leen completos en ambos temas sin recortar el contenido del selector.
22. El encabezado y la tarjeta de sesión describen el seguimiento y la captura manual/QR con términos concretos, no usan «Activo», «1 clic» o «semáforo» como instrucciones, y no repiten un icono junto al título de la sección.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Conteos por periodo/grupo, contexto explícito del KPI y descarte de respuestas obsoletas | `apps/frontend/tests/seccionAsistencias.test.tsx` | PASS focal: conteos activos, respuesta tardía de sesiones descartada y etiqueta del KPI cambia entre todos los grupos, grupo seleccionado y falta de periodo |
| REQ-001A | Alcance contextual de asistencia promedio y bloqueo de examen | `apps/frontend/tests/seccionAsistencias.test.tsx` | PASS: prueba verifica los dos KPIs sin periodo, en todos los grupos y con el grupo A; el texto deja de decir «global» al filtrar. La consulta y los cálculos no cambian. Prueba de componente 18/18, typecheck, ESLint focal desde el workspace, WCAG 81/81, SDD y `git diff --check` PASS. |
| REQ-002 | Carga, error, resultado vacío y recuperación del resumen | `apps/frontend/tests/seccionAsistencias.test.tsx` | PASS focal: error visible, sin falso vacío y reintento recupera datos |
| REQ-003 | Error y recuperación en sesiones, registros y reglas | `apps/frontend/tests/seccionAsistencias.test.tsx` | PASS focal: errores diferenciados; fallo al abrir lista bloquea guardar y permite reintento |
| REQ-004 | Roles, asociación panel-pestaña y teclado | `apps/frontend/tests/seccionAsistencias.test.tsx` | PASS focal: asociación, flechas, Home y End verificados; revisión manual pendiente |
| REQ-005 | Estado inicial y acción masiva antes de guardar | `apps/frontend/tests/seccionAsistencias.test.tsx` | PASS focal: Presente inicial comunicado y «Todos Presentes» confirmado junto a la lista mediante `status`, sin toast; payload existente verificado |
| REQ-006 | Reflow, contraste, zoom, foco y claridad visual | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `apps/frontend/tests/ux.quality.test.tsx`; `apps/frontend/tests/seccionAsistencias.test.tsx`; `apps/frontend/tests/guiaAsistenciasVisual.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Parcial: E2E sintético con respuestas interceptadas, no runtime instalado. Resumen, pase de lista y reglas en tema claro/oscuro a 320 y 390 CSS px, oscuro a 768/1024; error/reintento en resumen a 320; guía plegada por defecto en viewports de hasta 767 px; etiquetas y controles dentro del ancho útil; acciones «Todos Presentes» y «Guardar lista» apiladas y verificadas dentro de su tarjeta a 320/390 px; reflow del rótulo de periodo a 320 px medido contra el panel y sus renglones renderizados. Capturas anteriores en `reports/qa/ux-asistencias-current-audit-after-20261103/`; revisión actual de resumen, pase de lista y reglas en `reports/qa/ux-asistencias-audit-current-20261104/`. Se redujo el relleno duplicado dentro de los selectores estrechos y el E2E verifica con medición tipográfica que los valores activos de periodo/grupo caben a 320 px en ambos temas. El botón «Guardar regla» sigue a la opción de retardos; se verifica su orden y, tras guardar, la consistencia de la regla activa y el toast. El placeholder del tema «Ej. Unidad 2» también se mide completo. Zoom 200 %, recorrido manual completo y lector de pantalla pendientes |
| REQ-007 | Permisos, payloads y persistencia existentes | `apps/frontend/tests/seccionAsistencias.test.tsx`; `apps/backend/tests/integracion/asistencia.reglas.test.ts` | PASS focal/contrato existente: solo lectura, registros y reglas conservados |
| REQ-008 | Anuncio breve del resumen sin anunciar la cuadrícula KPI completa | `apps/frontend/tests/seccionAsistencias.test.tsx` | Prueba focal verifica contexto actualizado y ausencia de `aria-live` en la cuadrícula |
| REQ-009 | Progreso, exclusión de envíos simultáneos y coherencia entre regla activa y aviso de éxito | `apps/frontend/tests/seccionAsistencias.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: prueba focal de doble evento y `aria-busy`; E2E Edge 1/1 modela la persistencia en el fixture y verifica que la acción recargada coincida con el aviso de éxito en 320/390/768/1024 CSS px. Capturas inspeccionadas en `reports/qa/ux-asistencias-audit-current-20261104/`. |
| REQ-010 | Caption, relaciones de encabezados de columna, etiquetas completas de abreviaturas y leyenda | `apps/frontend/tests/seccionAsistencias.test.tsx` | Implementado; prueba focal verifica caption/nombre de tabla y `scope="col"` con etiquetas completas para cada columna |
| REQ-011 | Errores de escritura con título contextual, resultado incierto y recuperación de sesión | `apps/frontend/tests/seccionAsistencias.test.tsx` | `seccionAsistencias.test.tsx` 17/17 PASS: creación fallida no expone «Network Error» ni recomienda repetir sin verificar; un `401` en reglas ofrece acción persistente para cerrar sesión. Typecheck, build docente, ESLint global, guard WCAG 71/71 y SDD PASS |
| REQ-012 | Región de tabla desplazable, con nombre, descripción y foco por teclado | `apps/frontend/tests/seccionAsistencias.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: unit test verifica región `role="region"`, nombre, `tabIndex=0`, descripción e instrucción; E2E Edge 1/1 confirma ArrowRight desplaza la tabla a 320 px y revisa la instrucción en 320/390/768/1024 CSS px, con datos ficticios. Capturas inspeccionadas en `reports/qa/ux-asistencias-keyboard-verified-20261103/`. Manual de lector de pantalla pendiente. |
| REQ-013 | Recordatorio persistente con copy según sección, una fila compacta fuera de Asistencias y acciones táctiles | `apps/frontend/tests/appDocente.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: texto contextual 20/20, contrato CSS focal 2/2; E2E Edge valida en Entrega 320 px y Materias 320/390 px la fila compacta, ausencia de overflow, dos objetivos 44 × 44 y el mensaje completo al entrar a Asistencias. Build docente, ESLint focal, WCAG 81/81, SDD y diff-check PASS. Capturas claro/oscuro en `reports/qa/ux-recordatorio-entrega-banner-20261103/`. |
| REQ-014 | Copy preciso en encabezado, pasos y ficha de sesión; sin promesas de un clic/estado activo ni icono redundante junto al título | `apps/frontend/tests/seccionAsistencias.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Prueba focal comprueba copy, ausencia del icono en el título y navegación Home/End; E2E sintético verifica el encabezado a 320/390/768/1024 CSS px. Sin cambios de acciones, cálculo o estado. |

## Revalidación del pase móvil y navegación desktop (2026-10-29)

- **Hallazgos visuales/interactivos:** los cuatro controles de estado se encimaban en cada fila de alumno a 320 CSS px. En 1024 px, el tooltip informativo de la navegación podía interceptar el clic sobre la pestaña Asistencias, dejando activa Materias.
- **Cambios:** los controles del pase envuelven a una nueva fila en pantallas de hasta 760 px. El tooltip global ya no recibe eventos del puntero porque solo presenta información; la prueba lo muestra con hover antes de activar Asistencias con clic.
- **Validación:** el E2E de Asistencias pasó 1/1 en 320/390/768/1024 px; cubre ambos temas en móvil, error/reintento, lista y reglas. Añade comprobación geométrica de que los cuatro botones de cada alumno no se enciman ni exceden su grupo. Se inspeccionó la captura recortada de la lista a 320 px tras el cambio.

## Reflow interno de reglas a 320 CSS px (2026-10-30)

- Hallazgo visual y geométrico: aunque el documento no mostraba desplazamiento horizontal, la cuadrícula de reglas imponía un mínimo de 260 px dentro de un panel más estrecho y la tarjeta rebasaba su borde interno en 65 px. La cuadrícula de configuración también imponía 240 px y sacaba campos y botón del ancho disponible.
- Cambio: ambas cuadrículas limitan su mínimo al ancho disponible. La etiqueta visible del selector conserva su nombre completo y la tarjeta de regla deja visible la equivalencia completa de retardos.
- Validación: `seccionAsistencias.test.tsx` 14/14 PASS; E2E `audita visualmente Asistencias con resumen, sesión y regla ficticios` 1/1 PASS en Edge a 320/390/768/1024 CSS px; ambos temas en móvil. Aserciones geométricas para controles de configuración, tarjeta de regla, texto de equivalencia y etiqueta del selector a 320 px. Build docente, lint del frontend, WCAG 59/59 pares, auditoría SDD y `git diff --check` PASS. Captura clara de Reglas inspeccionada en `reports/qa/ux-asistencias-20261030-layout-fixed/`.
- Límite: viewport y datos ficticios; runtime instalado, zoom real al 200 %, lector de pantalla y revisión manual completa siguen pendientes.
- **Límite:** solo se usaron datos sintéticos interceptados. Runtime instalado, zoom al 200 %, recorrido manual completo y lector de pantalla siguen pendientes; REQ-006 permanece parcial.

## Evidencia de Implementación

- Conteos rápidos ahora derivan de alumnos activos del periodo seleccionado.
- Resumen, sesiones, reglas y lectura de registros distinguen carga/error/datos; se limpian datos previos y se descartan respuestas obsoletas. El resumen ofrece reintento y la lista no puede guardarse si falla la lectura de registros.
- Pestañas con roles, selección, asociaciones y navegación por flechas/Home/End; el estado Presente inicial sigue intacto y se explica antes de guardar.
- Los iconos de Asistencias usan el catálogo Lucide compartido; los estados y reglas conservan etiquetas textuales claras y las opciones de dominio no dependen de emoji/glifos. Esto no reemplaza la inspección visual responsive pendiente.
- La guía contextual usa iconos del catálogo compartido; la instrucción de «Todos presentes» explica que aplica Presente a la lista completa, y muestra los cuatro estados de asistencia.
- La acción «Todos Presentes» conserva confirmación accesible junto a la lista para que la revisión y el guardado continúen en contexto.
- Los chips de grupo exponen su selección con `aria-pressed`, además del estilo visual; el test focal comprueba los estados inicial y seleccionado.
- El formulario de sesión restringe sus columnas y controles al ancho útil en móvil; el selector de grupo conserva espacio legible para la opción y el botón puede envolver su texto. Se sustituye el emoji CSS en select/tema por iconos Lucide decorativos; el selector de fecha conserva su control nativo. El placeholder de tema se acorta para que su ejemplo sea reconocible en pantallas estrechas.
- La lista de sesiones usa columnas flexibles bajo 650 px y permite que fecha/tema envuelvan texto; el E2E mide el borde de la tarjeta y su acción en 320 px para detectar recortes que el overflow global no revela.
- La captura móvil con datos detectó la unidad `%` repetida en el KPI, y etiquetas «Sin derecho»/«Con derecho» que describían una conclusión académica en vez del estado `bloqueadoExamen`. Se aclararon como «Asistencia promedio», «Examen bloqueado» y «Sin bloqueo», sin alterar valores ni reglas.
- La tabla del resumen permanece como tabla desplazable; en pantallas estrechas informa que puede deslizarse horizontalmente y el contenedor tiene nombre accesible y foco de teclado para poder recorrer sus columnas.

## Anuncios de KPI más breves (2026-10-29)

- **Hallazgo:** la cuadrícula completa de cuatro KPI estaba dentro de `aria-live="polite"`; al actualizar el resumen podía anunciar todos sus valores y etiquetas como un único bloque extenso.
- **Cambio:** se retiró la región viva de la cuadrícula y se añadió un mensaje `role="status"` breve que indica periodo, grupo y conteos principales. Los errores conservan sus alertas visibles. Se añadió la utilidad global `.sr-only`; no cambia el contenido visible, los cálculos ni las rutas.
- **Validación focal:** `npm -C apps/frontend test -- tests/seccionAsistencias.test.tsx` (14/14 PASS); `npm run sdd:audit` PASS; `npm run guard:wcag -- --skip-lint` PASS (54/54 pares); `npm -C apps/frontend run build:docente` PASS (TypeScript, ESLint, bundle docente y WCAG); `git -c core.fsmonitor=false diff --check` PASS para los archivos rastreados.
- **Límite:** runtime instalado, zoom al 200 % y lector de pantalla siguen pendientes; no se declara completada la revisión visual manual.
- Los cuatro botones de estado del pase se envuelven en pantallas estrechas; el E2E comprueba el ancho interno de cada grupo y que los botones no se encimen. La ayuda flotante global deja pasar los clics para que no bloquee la navegación por pestañas.
- Preview aislado con fixtures interceptadas, solo lectura: `audita visualmente Asistencias con resumen, sesión y regla ficticios` — 1/1 PASS. Resumen, Pase de lista y Reglas a 320/390 px en ambos temas y a 768/1024 px en oscuro. El fixture fuerza 500 en resumen hasta el clic explícito de reintento; verifica que no aparezca la tabla previa, captura el error y confirma recuperación. A 320 px comprueba límites internos del formulario, medida del texto seleccionado de grupo y tarjeta/acción de sesión; inspección visual de capturas viewport confirmó el reflow. Evidencia: `reports/qa/ux-audit-20261029-asistencias-dummy-current/`. No se guardaron sesiones ni reglas.
- La captura de 320 px encontró desborde interno de 36 px pese a que el documento ocultaba overflow horizontal. Se ajustaron el grid del formulario, los selectores de grupo/tema y la cuadrícula de sesiones para que control y acción quepan en móvil; el E2E focal volvió a pasar después de la corrección.
- Revalidación focal: `tests/seccionAsistencias.test.tsx` y `tests/guiaAsistenciasVisual.test.tsx` — 14/14 PASS; ESLint focal PASS; `npm -C apps/frontend run build:docente` PASS con typecheck, bundle guard y WCAG 39/39 PASS.
- Prueba focal final: `npm -C apps/frontend test -- tests/seccionAsistencias.test.tsx` — 13/13 PASS; lint frontend, typecheck, build docente y guard WCAG — 33/33 pares — PASS. La prueba focal agregada al final valida el reintento de resumen; el código de producción no cambió después del build/typecheck.
- Recorrido E2E con pantallas operativas: 4/4 PASS a 1920 × 1080, 1024 × 768,
  768 × 1024 y 390 × 844 CSS px. La captura muestra la vista inicial sin materia; no
  verifica un pase real, ambos temas, 320 px, zoom, teclado manual o lector de pantalla.
  Evidencia: `reports/qa/ux-wave1/docente-asistencias-temarios-classroom-visual-audit-20261028.md`.

## Contexto explícito del KPI de alumnos (2026-10-31)

- **Hallazgo:** el KPI mostraba el total de alumnos activos del periodo y todos sus grupos, pero el tooltip decía que la cifra era «en el grupo». Sin periodo, el número se ocultaba y la ayuda seguía describiendo un grupo.
- **Cambio:** la etiqueta visible ahora dice «Alumnos · todos los grupos» o «Alumnos · grupo {grupo}», según el filtro; la ayuda explica el periodo y el conjunto contado. Sin periodo, el KPI muestra una instrucción para seleccionar uno. No cambia el conteo, el filtrado ni la API.
- **Validación focal:** `npm -C apps/frontend test -- tests/seccionAsistencias.test.tsx` — 15/15 PASS; ESLint focal PASS; typecheck frontend PASS; guard WCAG sin lint PASS (65/65 pares); E2E sintético `audita visualmente Asistencias con resumen, sesión y regla ficticios` — 1/1 PASS en 320/390/768/1024 CSS px; se inspeccionaron capturas de resumen móvil a 320 px en ambos temas en `reports/qa/ux-asistencias-kpi-20261031/`; auditoría SDD PASS.
- **Gate bloqueado:** `npm -C apps/frontend run build:docente` compiló el bundle y pasó `docente-bundle-guard`, pero devolvió error cuando su guard WCAG ejecutó ESLint para todo el frontend: límite `max-lines` en `SeccionCalificaciones.tsx` y advertencia `react-hooks/exhaustive-deps` en `ClassroomEnCalificaciones.tsx`. No corresponde al cambio de Asistencias; no se declara aprobado el build docente.
- **Límite:** la captura usa fixtures sintéticos; el runtime instalado sigue cerrado. Zoom 200 %, recorrido manual completo y lector de pantalla siguen pendientes.

## Revalidación del build docente (2026-10-31)

### Progreso de guardado de reglas (2026-11-03)

- Hallazgo: durante `POST /asistencias/reglas`, el botón seguía activo y permitía repetir la misma escritura con un doble clic.
- Cambio: un bloqueo inmediato evita una segunda llamada incluso antes del siguiente render; el botón pasa a «Guardando regla…», activa el spinner/`aria-busy` y queda deshabilitado hasta completar. El resultado contextual final y el contrato de API permanecen iguales.
- Validación focal: `seccionAsistencias.test.tsx` 16/16 PASS, incluido doble clic en el mismo lote de eventos; E2E Edge responsive con datos sintéticos 1/1 PASS en 320/390/768/1024 CSS px y medición/captura del progreso a 320 px oscuro; typecheck, ESLint focal, SDD, build docente y `git diff --check` PASS.

### Mensajes de error en operaciones de Asistencias (2026-11-03)

- Hallazgo estático: crear sesión, guardar el pase, guardar reglas y autorizar excepciones usaban el título genérico «Error» y descartaban la causa normalizada. El fallback no indicaba cómo verificar una escritura cuyo resultado fuera incierto.
- Cambio: cada toast identifica la acción y orienta a comprobar el estado antes de repetirla. Los errores remotos usan mensajes normalizados; un `401` conserva la acción persistente para cerrar sesión.
- Validación: `seccionAsistencias.test.tsx` 17/17 PASS; typecheck, build docente, ESLint global, guard WCAG (71/71 pares), SDD y `git diff --check` PASS.
- Contratos: no cambian payloads, endpoint, autorización ni resultado de las operaciones.
- Límite: prueba sintética; runtime autenticado y verificación visual de estos errores pendientes.
- El primer intento E2E usó el puerto 4173 y fue rechazado porque estaba ocupado por la aplicación del usuario. Se repitió en el puerto aislado 4373; Playwright Chromium no estaba instalado y la prueba pasó usando Microsoft Edge disponible. No se tocó la instalación activa.

- Para desbloquear el build de la oleada GUI, se extrajo el encabezado de KPI de Calificaciones a `CalificacionesHeaderKpis.tsx` con la misma presentación/valores, reduciendo el tamaño de `SeccionCalificaciones.tsx`. En Classroom, el contador de reintento de evidencias pasó a ser dependencia explícita del efecto que carga evidencias; conserva el GET-only y las protecciones de solicitud vigente.
- `seccionCalificaciones.routing.test.tsx` y `classroomEnCalificaciones.test.tsx`: 48/48 PASS; typecheck frontend y ESLint focal PASS; E2E sintético de Resultados de Calificaciones 1/1 PASS con fixtures dummy y 320/390 px; `build:docente` PASS con bundle guard y WCAG 65/65.
- Esta evidencia no valida la instalación local, zoom 200 % ni lector de pantalla; las capturas son sintéticas.

## Prioridad móvil de la guía rápida (2026-10-29)

- La captura sintética reciente a 320 CSS px mostró que la guía de tres pasos ocupaba una
  sección extensa antes de filtros y acciones de pase de lista, desplazando el trabajo principal.
- En viewports de hasta 767 CSS px la guía inicia plegada si no hay preferencia guardada; el
  docente puede abrirla y el valor explícito guardado sigue prevaleciendo sobre el valor inicial.
  Un solo control mantiene el foco al alternar, expone `aria-expanded` y apunta al panel real
  mediante `aria-controls`.
- Validación focal: `guiaAsistenciasVisual.test.tsx` (1/1 PASS), ESLint focal y E2E de Asistencias
  (1/1 PASS) a 320/390/768/1024 CSS px; la guía se abre y cierra con Enter/Espacio, conserva el
  foco y queda abierta por defecto desde 768 px. El E2E cubre el tema claro/oscuro móvil.
  Evidencia revisada: `reports/qa/ux-asistencias-20261029-mobile-guide-final/`.
- Las capturas full-page de lista a 320 px reducen su altura de 3683 a 2502 px (−1181 px,
  aproximadamente 32 %) al plegar la guía inicial; filtros y acciones quedan antes en el recorrido.
- El cambio aplica el patrón Disclosure de WAI-ARIA APG y la recomendación de NN/g de diferir
  contenido secundario en móvil; la guía continúa disponible a demanda y respeta la preferencia guardada.
- Límite: viewport sintético con APIs interceptadas; runtime instalado, zoom real al 200 %,
  lector de pantalla y recorrido manual de todos los controles siguen pendientes.

## Revalidación focal actual (2026-10-29)

- Playwright Edge `audita visualmente Asistencias con resumen, sesión y regla ficticios`:
  1/1 PASS a 320, 390, 768 y 1024 CSS px, con APIs interceptadas y datos ficticios. Verifica
  el error inicial del resumen, ausencia de datos previos, reintento y recuperación.
- Inspeccioné la captura actual `ux-audit-asistencias-error-dummy-320-dark.png` en
  `reports/qa/ux-asistencias-20261029-continuation/`; el error identifica la indisponibilidad
  de elegibilidad y conserva el botón de reintento visible.
- La instancia canónica no respondió en `localhost:4173` ni en `127.0.0.1:4000`; no se
  inspeccionó ni modificó la instalación. Siguen pendientes zoom real, lector de pantalla y
  recorrido manual completo.

## Claridad de la regla de retardos y acción al superar el límite (2026-10-29)

- Hallazgo visual en claro a 320 CSS px: el texto largo de la opción «Bloquear examen» quedaba
  cortado dentro del selector; la nota «desactivado por defecto» se comprimía junto al nombre de
  la casilla para contar retardos.
- Cambio: las opciones del selector ahora usan etiquetas breves y su efecto se explica en una
  descripción dinámica asociada con `aria-describedby`. La nota de la casilla pasa a una segunda
  línea alineada con su texto y el control queda alineado con la primera línea. No cambian valores,
  reglas, permisos ni payloads.
- Validación focal: `seccionAsistencias.test.tsx` 14/14 PASS; E2E `audita visualmente Asistencias
  con resumen, sesión y regla ficticios` 1/1 PASS a 320/390/768/1024 CSS px y ambos temas móviles;
  la prueba verifica descripción accesible dinámica, alineación y ancho útil. Captura 320 px clara
  inspeccionada en `reports/qa/ux-asistencias-20261029-final-readable/`.
- Límite: datos ficticios en preview; zoom 200 %, lector de pantalla y runtime instalado pendientes.

## Revisión visual sintética actual (2026-10-30)

- Reejecución de `audita visualmente Asistencias con resumen, sesión y regla ficticios`:
  1/1 PASS en Edge, con APIs interceptadas y respuestas ficticias. Recorrió Resumen General,
  Pase de Lista y Reglas a 320/390/768/1024 CSS px; tema claro/oscuro en móvil y oscuro en
  los viewports mayores.
- La fixture inicia con fallo HTTP 500 para el resumen; la vista muestra el error junto a su
  acción «Reintentar resumen», oculta la tabla y recupera las cifras tras el clic. Se
  inspeccionaron capturas de error, resumen, lista y reglas a 320 px en
  `reports/qa/ux-asistencias-current-continuation/`.
- El E2E vuelve a comprobar reflow, límites internos, controles del pase sin solapamiento,
  nombres/estados accesibles de pestañas y recuperación; no apareció un defecto nuevo que
  requiriera edición en esta revisión.
- Límite: preview automatizado con datos ficticios. El runtime instalado, zoom real al 200 %,
  lector de pantalla y recorrido manual completo continúan pendientes.

## Reflow de la etiqueta del periodo a 320 CSS px (2026-10-30)

- **Hallazgo:** en el tema claro, «Materia o Periodo Académico» se cortaba dentro del panel en 320 CSS px aunque el documento no reportaba overflow horizontal.
- **Cambio:** el mínimo de la columna de filtros ahora se limita al ancho disponible en móvil; el texto de la etiqueta puede envolver. No cambian el selector, sus opciones, valores ni el flujo de datos.
- **Regresión cubierta:** el E2E comprueba `scrollWidth`, los límites de la columna contra el contenido del panel y los rectángulos renderizados de cada línea de texto en 320 px, en ambos temas.
- **Validación focal:** `seccionAsistencias.test.tsx` 14/14; `audita visualmente Asistencias con resumen, sesión y regla ficticios` 1/1; build docente con verificación de bundle, lint y WCAG 61/61; `git diff --check` PASS.
- **Evidencia:** `reports/qa/ux-asistencias-label-wrap-20261030-final/audit.md` y capturas antes/después. Solo preview con respuestas dummy; no representa la instalación local.
- **Límite:** zoom real al 200 %, recorrido manual completo y lector de pantalla siguen pendientes.

## Contexto explícito del KPI de alumnos (2026-10-31)

- **Hallazgo:** el tooltip del KPI siempre decía «Total de alumnos en el grupo», aunque sin grupo seleccionado la cifra corresponde a todos los grupos del periodo.
- **Cambio:** la etiqueta del KPI identifica el grupo seleccionado o el total del periodo con todos sus grupos; sin periodo, el mensaje pide seleccionar uno. La explicación de apoyo mantiene el mismo contexto. Los cálculos y filtros no cambian.
- **Validación focal:** `seccionAsistencias.test.tsx` verifica los tres contextos; E2E responsive comprueba que el texto siga dentro de los límites en 320/390/768/1024 CSS px y ambos temas móviles.
- **Límite:** datos dummy en preview; runtime instalado, zoom real al 200 % y lector de pantalla pendientes.

### Encabezados accesibles del resumen (2026-11-03)

- Hallazgo estático: la tabla resumía P/F/R/J y `% Asist.` con encabezados compactos; `title` solo no proporcionaba un nombre fiable fuera del hover.
- Cambio: caption contextual, `scope="col"`, nombres completos para tecnología de asistencia y leyenda visible de abreviaturas; sin cambios de cálculo o datos.
- Validación añadida: la prueba de sección comprueba el nombre de la tabla y el alcance/etiqueta de sus diez encabezados.

## Recordatorio contextual de pase de lista (2026-11-03)

- Hallazgo visual a 320 CSS px: el recordatorio de asistencia repetía su explicación completa también en Materias y otras secciones; junto con el botón y el cierre, desplazaba el trabajo principal.
- Cambio: fuera de Asistencias, el mensaje se resume a «Pase de lista pendiente hoy.»; al entrar en Asistencias vuelve a la explicación completa. Se conserva `role="status"`, el acceso «Pasar lista», el cierre y los objetivos táctiles de 44 px.
- E2E Edge con datos ficticios: 1/1 PASS en Materias a 320/390 CSS px; comprueba el texto breve, la reducción real de altura a 320 px, ambos objetivos táctiles y el texto completo al cambiar a Asistencias. Capturas actuales en `reports/qa/ux-recordatorio-contextual-20261103/`.
- `appDocente.test.tsx` 20/20 PASS; typecheck, ESLint focal, WCAG guard, `sdd:audit` y `git diff --check` PASS.
- Límite: preview sintético; instalación local, zoom real al 200 % y lector de pantalla pendientes.

### Revalidación visual del recordatorio (2026-11-05)

- E2E Edge focal `audita Materias activas y archivadas con catálogo ficticio`: 1/1 PASS con API y perfil ficticios. A 320/390 CSS px verifica el copy breve fuera de Asistencias, altura compacta, objetivos táctiles de acción/cierre de 44 × 44 px, ausencia de solapamiento/overflow y el copy completo al cambiar a Asistencias.
- Captura actual a 320 px, tema claro: `reports/qa/ux-asistencias-banner-20261105/ux-recordatorio-asistencias-320-light-viewport.png`.
- Esta evidencia actualiza el recorrido E2E visual que figuraba pendiente en las notas del 2026-10-31; sigue siendo preview sintético, no instalación empaquetada ni revisión con lector de pantalla o zoom real al 200 %.

### Icono consistente y verificación en Entrega (2026-11-03)

- El botón «Cerrar recordatorio» sustituye el glifo `×` por el icono vectorial Lucide `X`, decorativo y oculto a tecnologías de asistencia. Se conservan nombre accesible y destino de la acción.
- El E2E de Entrega comprueba el mensaje breve fuera de Asistencias, los dos controles de al menos 44 × 44 CSS px y la presencia del icono; capturas actuales a 320 px en ambos temas: `reports/qa/ux-recordatorio-contextual-20261103/`.
- Sin cambios a persistencia, navegación, cálculo o permisos.
