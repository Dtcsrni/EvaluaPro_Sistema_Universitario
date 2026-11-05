---
id: SPEC-128
titulo: Mejora UX de Evaluaciones docentes
version: 1.0.17
fecha: 2026-11-04
autor: Codex
modulo: frontend_docente_evaluaciones_ux
estado: approved
---

## Contexto

La sección Evaluaciones concentra cuatro vistas —Política, Evidencias, Exámenes y Resumen— con selectores globales de periodo/alumno, formularios con ponderaciones, registros manuales y datos Classroom. La exploración estática del código encontró un contrato ARIA incompleto: el contenedor declara `role="tablist"`, pero sus hijos `Boton` se renderizan como botones comunes y no se asocian con paneles. La navegación conserva clic, pero no implementa el patrón de teclado de pestañas.

La captura de runtime de esta sección no pudo completarse el 2026-10-28: la pestaña lateral bloqueó la recarga del entorno local aislado con `ERR_CONNECTION_TIMED_OUT`. No se usó la instalación real ni datos reales. La propuesta mantiene pendiente la auditoría visual antes de definir cambios estéticos específicos.

## Fuentes de diseño y accesibilidad

- [W3C WAI-ARIA APG: Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): define `tablist`, `tab`, `tabpanel`, relaciones de nombre/selección y operación con flechas.
- [WCAG 2.2 SC 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): objetivo mínimo de 24 × 24 CSS px o separación equivalente para objetivos de puntero.
- [WCAG 2.2 SC 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): contraste de 4.5:1 para texto normal.
- [W3C WAI Forms Tutorial: Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/): explica cuándo indicar límites/requisitos en el campo y cómo asociar instrucciones con `aria-describedby`.
- [WCAG 2.2 SC 3.3.1: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html): cuando se detecta un valor no aceptado, identificar el control y describir el problema en texto.
- [WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): los estados de resultados y errores deben exponerse programáticamente sin obligar a mover el foco.
- [W3C WAI: Content Structure](https://www.w3.org/WAI/tutorials/page-structure/content/): usar listas semánticas cuando los elementos forman un grupo de puntos independientes.
- [GOV.UK Design System: Select](https://design-system.service.gov.uk/components/select/): etiquetas visibles y mensajes de error asociados a controles de selección.
- Política local obligatoria: `docs/WCAG_UI_POLICY.md` y `docs/DESIGN.md`.

## Alcance

Auditar y mejorar la sección docente Evaluaciones en sus cuatro vistas: Política, Evidencias, Exámenes y Resumen. Revisar jerarquía y copy, selectores de periodo/alumno, formularios, tablas/listas, estados de carga/vacío/error/éxito, ayudas, tema claro/oscuro, operación por teclado y responsive. Conservar reglas de cálculo, persistencia, API, permisos, origen de evidencias, auditoría, importación Classroom y semántica histórica.

La auditoría visual de runtime en el navegador lateral con datos ficticios y la captura de los estados revisados forman parte del trabajo. Si el navegador vuelve a bloquear la URL local, registrar el límite y no sustituirlo por otra superficie de navegación.

## Requisitos Funcionales

- **REQ-001 (Pestañas accesibles):** Si las cuatro vistas continúan siendo paneles con pestañas, cumplir el patrón WAI-ARIA APG: cada control tiene rol `tab`, estado seleccionado correcto, `aria-controls` al panel asociado y nombre accesible; cada panel tiene `role="tabpanel"` y `aria-labelledby`. Soportar flechas izquierda/derecha y entrada/salida lógica por Tab. Si la auditoría demuestra que un patrón de navegación distinto resulta más claro, documentarlo antes de aplicarlo.
- **REQ-002 (Contexto):** Mantener visible y comprensible qué periodo y alumno están seleccionados; expresar cuándo una vista no requiere alumno. No asociar ni guardar datos si falta el contexto obligatorio.
- **REQ-003 (Formularios):** Revisar etiquetas, instrucciones breves, unidades/rangos y relación de errores con los campos de política, evidencia y componentes de examen. Explicar los conceptos usados por cada control sin cambiar pesos, validación de dominio ni payloads.
- **REQ-003B (Parámetros de política):** La familia seleccionada debe explicar, en texto visible y asociado al control, los campos opcionales admitidos, sus rangos y que cada grupo de ponderaciones debe sumar 1. Cambiar la familia no transforma automáticamente el objeto JSON ni altera su contenido. El guardado conserva la validación autoritativa de API y el payload existente.
- **REQ-003C (Restricciones de título y motivo de evidencia):** El título debe comunicar el mínimo de 3 y máximo de 180 caracteres que valida el servidor cuando se proporciona; el campo vacío conserva el título predeterminado «Evidencia». Un título no vacío fuera del rango debe identificarse junto al control y evitar un envío que la API rechazará. Al editar, marcar el motivo de auditoría como obligatorio y explicar su rango de 3–400 caracteres mediante ayuda asociada al campo. No cambiar cálculos, permisos, rutas ni payloads válidos.
- **REQ-003E (Captura deliberada de evidencia nueva):** Una evidencia nueva inicia sin calificación ni ponderación precargadas. Ambos campos son obligatorios y explican sus rangos; los errores se anuncian al salir de un campo inválido o al intentar guardar. No se envía la solicitud hasta que ambos valores sean válidos. La edición sigue precargando los valores del registro seleccionado y se conserva que cero escrito explícitamente es válido.
- **REQ-003F (Captura deliberada de examen):** Una captura nueva de componente de examen inicia sin calificaciones precargadas. La calificación teórica es obligatoria y se explica junto al campo; prácticas puede quedar vacío. Un campo vacío al iniciar no se anuncia como error antes de interacción, pero bloquea el guardado hasta que la teoría tenga un valor explícito válido. Al cambiar de periodo o alumno, borrar las calificaciones de la captura para no trasladarlas al nuevo contexto. Cero sigue siendo válido y no cambian cálculos, permisos ni payloads.
- **REQ-003D (Búsqueda opcional del examen fuente):** En el corte Global, si la búsqueda termina correctamente sin coincidencias, la interfaz debe permitir guardar la captura sin referencia (`examenGeneradoId`) según el aviso existente. Distinguir ese resultado de un fallo de búsqueda y dejar disponible el reintento o quitar el folio para continuar sin vínculo. Al cambiar el folio, descartar el estado de búsqueda anterior.
- **REQ-003A (Envío por teclado de Evidencias y Exámenes):** Los formularios de captura/edición de evidencia y de componentes de examen deben permitir enviar con Enter y tener nombres accesibles. Usar `noValidate` para conservar la validación propia y evitar cambios de payload/dominio; impedir solicitudes duplicadas durante el guardado. Los botones secundarios —buscar folio y cancelar— no envían el formulario.
- **REQ-004 (Evidencias):** Diferenciar procedencia manual/Classroom y estados activa/archivada con texto claro; presentar carga, vacío, error y recuperación junto a la lista; conservar edición con motivo e historial auditado.
- **REQ-005 (Resumen):** Hacer escaneables resultado, corte, faltantes y estado de cálculo. Mantener la distinción entre cero, pendiente y dato faltante que devuelva la API; comunicar la ausencia en lenguaje dirigido al docente, sin exponer términos de implementación. No inferir elegibilidad ni modificar redondeo.
- **REQ-005A (Faltantes del resumen):** Presentar cada faltante como elemento separado de una lista semántica, conservar su explicación legible y los valores desconocidos devueltos por API, y anunciar cuántos datos requieren atención sin alterar el resumen ni sus cálculos.
- **REQ-005B (Jerarquía visual del resumen):** Presentar la calificación final redondeada con jerarquía visual clara y separar en grupos etiquetados los cortes de evaluación continua, cortes de examen, bloques y estado del cálculo. Asociar cada valor con su etiqueta en estructura semántica; conservar los valores cero, desconocidos, faltantes y la precisión actual que entrega/formatea la GUI. No modificar los cálculos, el redondeo, el orden de prioridad ni los datos recibidos.
- **REQ-006 (Sistema visual y responsive):** Reutilizar tokens/componentes/iconos existentes. Revisar reflow a 320, 390, 768 y 1024 CSS px, zoom 200 %, ambos temas, contraste, foco visible, controles táctiles y movimiento reducido. Evitar recortes, solapamientos y scroll horizontal accidental.
- **REQ-007 (Compatibilidad):** Conservar API, operaciones, permisos, versionado/auditoría, integraciones, datos y cálculos. Los cambios de presentación no deben crear ni persistir registros por sí mismos.
- **REQ-008 (Errores sin duplicación):** Cuando una operación ya presenta un error persistente junto al formulario o al resumen y ofrece recuperación en ese contexto, no emitir además un toast con el mismo fallo. Mantener mensajes globales para operaciones que carecen de una alerta contextual.

## Criterios de Aceptación

1. La revisión documenta cada vista y estado importante con capturas actuales de datos ficticios, o anota el bloqueo concreto del navegador lateral.
2. La navegación entre vistas tiene semántica y comportamiento de teclado coherentes y verificados mediante pruebas de componente y recorrido real.
3. Los selectores mantienen etiquetas visibles y comunican el contexto activo a lector de pantalla y vista visual.
4. Formularios y listas presentan instrucción, validación, origen y estados cerca del elemento afectado sin texto ambiguo.
5. El resumen permite distinguir calificación final, datos incompletos y cortes faltantes sin alterar la regla de cálculo.
6. No hay contenido recortado, solapamiento ni desbordamiento horizontal en los tamaños y temas establecidos; foco y contraste pasan los guardrails WCAG del repositorio.
7. Tests focales, lint, typecheck, build docente y validaciones UX/WCAG disponibles pasan.
8. La matriz de trazabilidad vincula cada requisito con pruebas existentes o nuevas verificables.
9. En Evidencias, los límites del título y del motivo de edición se explican y asocian a sus campos; los valores inválidos no generan solicitudes y un título vacío conserva el valor predeterminado existente.
10. La búsqueda sin coincidencias permite guardar la captura Global sin referencia; un fallo de red no se presenta como «sin coincidencias» y el cambio de folio limpia el resultado anterior.
11. Cada faltante del resumen se expone como elemento de lista independiente; el anuncio breve informa el total y conserva el orden y contenido devuelto por el mapeo actual.
12. Las faltas siguen distinguiendo cálculos incompletos de cero, ausencia de datos y valores desconocidos; no se agregan ni modifican reglas de evaluación.
13. Una evidencia nueva no propone una calificación o ponderación por defecto; al intentar guardarla vacía se identifican ambos campos, no se envía una solicitud y el guardado continúa admitiendo cero explícito y los payloads válidos existentes.
14. Una captura de examen nueva no propone 10 ni otro valor por defecto; teoría y prácticas empiezan vacías, la teoría se identifica como obligatoria, no hay error anunciado antes de interacción y el botón permanece bloqueado hasta una calificación teórica válida. El cambio de periodo/alumno limpia las calificaciones; cero explícito se conserva como válido.
15. En el resumen, la calificación final redondeada se identifica sin competir con el valor decimal; cada corte y bloque se asocia a su etiqueta en grupos distinguibles, con reflow a 320 CSS px y sin pérdida de ceros o valores desconocidos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Renderizado, selección y teclado de las cuatro pestañas | `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | 25/25 pruebas de componente pasan: `tab`/`tabpanel`, selección, asociaciones y flechas con activación manual. E2E sintético verificado en esta tanda: flecha derecha mueve el foco sin activar; Enter activa; Inicio/Fin mueven el foco; Espacio activa. La vista mantiene sus cuatro pestañas en 320/390/768/1024 px. Recorrido manual en navegador lateral y lector de pantalla pendientes |
| REQ-003C | Título válido/default y motivo de auditoría con límites anunciados | `apps/frontend/tests/seccionEvaluaciones.test.tsx` | 30/30 casos focales pasan; cubren límite, ayuda asociada, valor predeterminado y motivo inválido accesible |
| REQ-003D | Búsqueda opcional Global, cero coincidencias y error recuperable | `apps/frontend/tests/seccionEvaluaciones.test.tsx` | 30/30 casos focales pasan; cero coincidencias permite guardar sin ID fuente, error de consulta conserva recuperación y cambiar folio invalida el estado anterior |
| REQ-005A | Lista semántica y anuncio del conteo de datos faltantes | `apps/frontend/tests/seccionEvaluaciones.test.tsx` | Prueba focal de resumen verifica el total accesible, elementos de lista independientes y orden/mapeo de faltantes; 30/30 del archivo pasan |
| REQ-002, REQ-003 | Contexto periodo/alumno, ayuda de escala y errores de guardado en captura | `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | 24/24 pruebas focales pasan; errores de guardado se anuncian junto al formulario, JSON inválido queda asociado al textarea, versiones y escalas validan entradas, y se distinguen cero de ausencia. Cambiar periodo/alumno limpia el contexto de edición; payloads válidos conservan números. Capturas aisladas muestran periodo/alumno activos en las cuatro vistas y cuatro anchos. El cotejo visual en navegador lateral permanece pendiente |
| REQ-004, REQ-005 | Evidencias: carga/error/reintento/origen/estado; resumen: cero, dato ausente y cambio de alumno durante consulta | `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | El historial queda expuesto como región nombrada por su encabezado; la prueba focal también cubre carga/error/reintento. Respuestas tardías de otro alumno o periodo se descartan y un fallo al cargar configuración bloquea el guardado hasta reintentar. Los faltantes conocidos se explican en español y el texto desconocido se conserva. La ausencia de resumen se expresa sin términos internos de implementación. Las capturas incluyen evidencia ficticia y resumen; este ahora muestra el nombre de la política cuando está disponible, no su código. Inspección en navegador lateral pendiente |
| REQ-006 | Reflow, temas, foco y contraste | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `apps/frontend/tests/ux.quality.test.tsx`; `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts`; `scripts/tests/ui-contrast-audit.mjs` | Las cuatro vistas con datos ficticios pasan comprobaciones de encabezados y overflow a 320/390/768/1024 px en tema oscuro y a 390 px en tema claro. KPI de valores e iconos tienen contraste mínimo 4.5:1 sobre #eef4fa en claro, verificado en 390 y 320 CSS px; guard WCAG registra los tres pares. La guía inicia plegada en móvil y disclosure se recorre con Enter/Espacio. Falta zoom 200 %, lector de pantalla y recorrido manual completo de foco/controles |
| REQ-007 | Preservación de contratos de operación y permisos | `apps/frontend/tests/seccionEvaluaciones.test.tsx` | Sin cambios de API ni permisos; el flujo conserva `politicaVersion` numérica y cubre el guardado de versión vigente en pruebas focales |
| REQ-005B | Jerarquía de la calificación final y grupos etiquetados de resultados | `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado: los cortes se muestran como pares etiqueta/valor en grupos semánticos; la calificación redondeada destaca y el decimal conserva cuatro posiciones. Suite de sección 33/33 PASS; E2E 1/1 a 320/390/768/1024 px, ambos temas, teclado de pestañas, ausencia de colisiones/overflow y contraste renderizado ≥4.5:1 en tema claro/oscuro. Capturas inspeccionadas en `reports/qa/ux-evaluaciones-summary-verified-20261104/`; runtime instalado, lector de pantalla y zoom 200 % siguen pendientes |
| REQ-008 | Un único error anunciado para guardado/resumen; los fallos sin alerta contextual conservan toast | `apps/frontend/tests/seccionEvaluaciones.test.tsx` | Pruebas focales comprueban alertas inline y ausencia de toast duplicado para política, evidencia, examen y resumen |
| REQ-003B | Instrucciones para parámetros válidos según familia de cálculo | `apps/frontend/tests/seccionEvaluaciones.test.tsx` | 1 caso focal verifica campos/rangos/sumas visibles, asociación ARIA y que cambiar de familia no modifica el JSON. Suite focal actual: 29/29 PASS |
| REQ-003E | Evidencia nueva vacía, errores asociados y sin solicitud hasta capturar valores | `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | `seccionEvaluaciones.test.tsx` 33/33 PASS; verifica campos vacíos/requeridos, dos errores al enviar sin valores, cero llamadas API y payload válido con cero explícito. E2E 1/1 PASS con 20 capturas; fixtures sintéticos, sin enviar formularios |
| REQ-003F | Valores explícitos de examen y limpieza al cambiar alumno/periodo | `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: suite focal 33/33 verifica campos vacíos, requerido y mensaje tras blur; cambio de alumno borra entradas; cero sigue válido. E2E Edge 1/1 en 320/390/768/1024 CSS px confirma entradas vacías, botón bloqueado y ausencia de alerta prematura. Capturas revisadas en `reports/qa/ux-evaluaciones-audit-current-20261104/`. |

### Captura deliberada de evidencia nueva (2026-11-03)

- Hallazgo en las capturas Edge sintéticas a 320 px: el formulario de alta precargaba una calificación de `10` y una ponderación de `1`; el botón de guardado quedaba disponible aunque el docente no hubiera capturado esos valores.
- Cambio: ambos campos empiezan vacíos y se marcan como requeridos. Los errores se anuncian después de salir del campo o de intentar guardar, y el formulario no envía la solicitud mientras falte un valor válido. Editar una evidencia conserva los valores existentes; cero escrito explícitamente sigue siendo válido.
- Contrato: sin cambios en API, permisos, cálculos, persistencia ni estructura de payloads válidos.
- Verificación: prueba focal ampliada para valores iniciales vacíos, validación sin envío y captura explícita de `0`; E2E de las cuatro vistas con fixtures dummy genera capturas actuales en `reports/qa/ux-evaluaciones-current-goal-20261103-after/`.
- Validación final: `npm -C apps/frontend run test -- --reporter=dot tests/seccionEvaluaciones.test.tsx` (33/33 PASS); E2E Edge focal de las cuatro vistas 1/1 PASS, 320/390/768/1024 CSS px en tema oscuro y 390 px en tema claro; TypeScript, ESLint focal, `build:docente`, guard WCAG (69/69), `sdd:audit` y `git diff --check` PASS.
- Límite: el E2E usa API interceptada y datos ficticios. Lector de pantalla y zoom real al 200 % siguen pendientes; no se probó una cuenta autenticada instalada.

## Evidencia visual complementaria (2026-10-28)

- E2E aislado con Edge y APIs interceptadas, solo datos ficticios, 320 × 800, 390 × 844, 768 × 1024 y 1024 × 768 CSS px, tema oscuro: 1/1 PASS; capturó Política, Evidencias, Exámenes y Resumen en `reports/qa/ux-audit-20261028-evaluaciones-dummy/` y comprobó encabezados/overflow del documento.
- La captura reveló que la tira horizontal ocultaba una de las cuatro pestañas y que el resumen enseñaba el código técnico de la política. La navegación móvil ahora organiza las cuatro opciones en 2 × 2 y el resumen presenta el nombre legible cuando existe.
- La validación de esta sección ejecutó además `npm -C apps/frontend run test -- tests/seccionEvaluaciones.test.tsx` (24/24), ESLint focal, `npm -C apps/frontend run build:docente` (typecheck incluido), guard de bundle y WCAG 39/39 PASS.
- Esta evidencia aislada no reemplaza el requisito de revisar en el navegador lateral. No se accedió a la instalación activa ni a datos reales.

## Revalidación del acceso móvil a los formularios (2026-10-29)

- Hallazgo visual: a 390 CSS px, la guía de cuatro vistas se desplegaba antes de las pestañas,
  selectores y formulario, ocupando cerca de un tercio de la captura completa y duplicando las
  opciones de navegación que ya ofrece la sección.
- Cambio: en viewports de hasta 767 CSS px la guía inicia plegada cuando el docente no ha fijado
  preferencia. Se mantiene expandible y persiste la elección; `aria-expanded` y `aria-controls`
  describen el estado y la relación con el panel, que permanece en el DOM con `hidden`.
- Validación: `seccionEvaluaciones.test.tsx` (25/25 PASS); E2E con API y perfil ficticios (1/1
  PASS) en los cuatro anchos de tema oscuro y en las cuatro vistas a 390 px de tema claro; el E2E
  comprueba que Enter abre la guía, Espacio la cierra y que los formularios/contenido siguen
  accesibles, sin overflow ni encabezados recortados. Capturas revisadas en
  `reports/qa/ux-audit-20261029-evaluaciones-dummy-current/`.
- Navegación de escritorio: `recorre pantallas operativas en tablet` y `tablet-sm` (2/2 PASS),
  recorriendo las secciones mediante los botones reales de navegación.
- Patrón de implementación: [WAI-ARIA APG Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/),
  con botón, estado `aria-expanded`, relación `aria-controls` y activación Enter/Espacio.

### Contraste de indicadores en tema claro (2026-10-29)

- La captura móvil mostró que los acentos cyan y verde de los KPI heredaban colores claros
  para el fondo de las tarjetas. Se asignaron tonos oscuros a valores e iconos de los tres
  indicadores, únicamente en el tema claro.
- Se añadió comprobación automatizada a 390 y 320 CSS px y tres pares al guard WCAG. Los
  ratios son 7.87:1 (primario), 6.83:1 (información) y 6.94:1 (éxito), calculados sobre
  el fondo conservador #eef4fa.
- Recorrido Playwright con datos sintéticos: 2/2 pruebas PASS para navegación móvil y KPI

## Envío por teclado en Evidencias y Exámenes (2026-10-29)

- Hallazgo estático: las capturas de Evidencias y Exámenes estaban dentro de contenedores `div`
  y sus acciones principales eran botones `type="button"`; Enter no enviaba los datos.
- Cambio: formularios nombrados para captura/edición, con `noValidate` y guardas equivalentes a
  los estados deshabilitados existentes; folio y cancelar siguen siendo acciones secundarias.
  No cambian cálculo, payload, endpoint ni controles de dominio.
- Validación focal: `tests/seccionEvaluaciones.test.tsx` 25/25 PASS; E2E sintético de las cuatro
  vistas 1/1 PASS a 320/390/768/1024 CSS px y ambos temas móviles; `build:docente` PASS con
  TypeScript, ESLint, bundle guard y contraste WCAG 54/54. Revisión manual en runtime instalado,
  lector de pantalla y zoom 200 % continúan pendientes según los criterios generales.
  a 320 CSS px; capturas claras/oscuras de 390 y claro de 320 en
  `reports/qa/ux-wave1/screenshots/current-20261029/`. Build docente PASS, guard de bundle,
  ESLint y contraste 46/46 PASS; auditoría SDD PASS.
- El navegador integrado de esta sesión no tiene pestañas abiertas. Estas capturas provienen
  del preview aislado con Edge y datos dummy; la revisión en la pestaña integrada, zoom 200 %
  y lector de pantalla siguen pendientes.

## Navegación por teclado de pestañas en las cuatro vistas (2026-10-29)

- Se agregó al recorrido E2E la interacción con el patrón de activación manual: `ArrowRight`
  mueve el foco sin cambiar la vista; `Enter` activa la pestaña enfocada; `End` y `Home`
  recorren al último y primer tab; `Space` activa la vista enfocada.
- Resultado: `audita visualmente las cuatro vistas de Evaluaciones con datos ficticios` pasó
  1/1 en Edge automatizado, con APIs interceptadas y datos ficticios. El recorrido se ejecutó
  en 320, 390, 768 y 1024 CSS px con tema oscuro, y en las cuatro vistas a 390 px con tema
  claro. La activación fue solo de vistas de lectura/captura no enviada; no se persistieron datos.
- Evidencia: `reports/qa/ux-evaluaciones-20261029-keyboard/`.
- Límite: esta prueba automatizada no sustituye un recorrido manual en el navegador integrado
  ni una evaluación con lector de pantalla; zoom real al 200 % y uso manual de los controles
  de cada formulario siguen pendientes.

## Nombre accesible del historial de evidencias (2026-10-29)

- Hallazgo: el nombre accesible estaba asignado a un `div` genérico, que no expone una región
  de navegación fiable para localizar el historial con tecnología de asistencia.
- Cambio: se usó un elemento `section` etiquetado por el encabezado visible «Evidencias del alumno».
- Verificación focal: la prueba confirma que el historial aparece en el árbol accesible como
  región con ese nombre; no cambia la lista, sus acciones ni las rutas de datos.

## Concordancia en conteos de Evaluaciones (2026-10-29)

- Hallazgo en capturas actuales a 320 CSS px: una política y un alumno aparecían como
  «1 políticas activas», «1 Políticas» y «1 Alumnos».
- Cambio: el encabezado y las etiquetas KPI usan singular cuando el conteo es 1, y plural
  para 0 o más de 1. No cambia los conteos ni el conjunto de políticas/alumnos.
- Validación: `seccionEvaluaciones.test.tsx` 25/25 PASS, con singular y plural; el E2E de
  las cuatro vistas 1/1 PASS en 320/390/768/1024 CSS px y capturas actualizado en ambos
  temas móviles. Evidencia: `reports/qa/ux-evaluaciones-20261029-plurals-final/`.
- Límite: zoom 200 %, lector de pantalla y revisión manual en el navegador integrado
  continúan pendientes según REQ-006.

## Claridad del contexto conservado en Política (2026-10-29)

- Hallazgo en la captura sintética: al regresar a Política, el selector conserva al último alumno
  para facilitar el retorno a las demás vistas, pero el aviso solo indicaba que no era necesario
  seleccionarlo. No explicaba que ese valor no participa en la configuración de la política.
- Cambio: el aviso ahora dice que el alumno elegido se conserva para las otras vistas y no afecta
  la política del periodo. Se mantiene el estado del selector y no cambia ninguna consulta o payload.
- Validación focal: `apps/frontend/tests/seccionEvaluaciones.test.tsx` verifica el texto explícito;
  E2E sintético `audita visualmente las cuatro vistas de Evaluaciones con datos ficticios` PASS
  (1/1) a 320/390/768/1024 CSS px y en tema claro/oscuro donde aplica.
- Límite: capturas de preview con datos ficticios; revisión manual integrada, zoom 200 % y lector
  de pantalla siguen pendientes.

## Revisión visual sintética de las cuatro vistas (2026-10-30)

- Reejecución actual de `audita visualmente las cuatro vistas de Evaluaciones con datos
  ficticios`: 1/1 PASS en Edge, con APIs interceptadas. El recorrido cubrió Política,
  Evidencias, Exámenes y Resumen a 320/390/768/1024 CSS px en tema oscuro y a 390 px en
  tema claro; comprobó pestañas, navegación por teclado, formularios sin envío, datos y
  encabezados visibles, y ausencia de overflow horizontal.
- Las cuatro capturas de 320 CSS px se inspeccionaron y quedaron en
  `reports/qa/ux-evaluaciones-current-continuation/`. Los estados visibles mantienen
  contexto periodo/alumno, texto de ayuda y acciones en cada panel.
- No se detectó un defecto nuevo que justificara otro cambio de código en esta revisión.
  La pestaña lateral no fue accesible desde la automatización de navegador (`browser.user
  is unavailable`); la evidencia sigue siendo del preview aislado, con datos ficticios.
- Zoom real al 200 %, tecnología de asistencia y recorrido manual en la pestaña integrada
  continúan pendientes; esta prueba no los acredita.

## Errores contextuales sin toast duplicado (2026-10-31)

- Hallazgo estático: los fallos de guardado de política, definición, evidencia y examen, además
  de la consulta del resumen, mostraban una alerta persistente contextual y emitían un toast
  paralelo con el mensaje crudo del error. El duplicado podía distraer y exponer detalles
  técnicos sin aportar una vía adicional de recuperación.
- Cambio: se conserva el mensaje contextual y el reintento donde existe; se elimina el toast
  duplicado para esas cinco operaciones. Los fallos de archivo/restauración conservan el toast
  porque no tienen alerta inline.
- Validación focal: `npm -C apps/frontend run test -- tests/seccionEvaluaciones.test.tsx`
  (26/26 PASS); `npm run build:frontend:docente` (typecheck, build, lint, guard de bundle y
  WCAG 61/61 PASS); `npm run sdd:audit` PASS; `git diff --check` PASS.
- Límite: la pestaña lateral no se recorrió en esta tanda. Revisión integrada, zoom real al
  200 % y lector de pantalla continúan pendientes según REQ-006.

### Recuperación segura al archivar o restaurar (2026-10-31)

- Hallazgo: las dos operaciones conservaban su resultado de error solo como toast, pero
  interpolaban el mensaje técnico crudo y no ofrecían una salida clara para sesión vencida.
- Cambio: el toast ahora identifica el registro y la acción; ante resultado incierto pide
  actualizar y comprobar el estado antes de repetir, y ante 401 explica que venció la sesión y
  ofrece «Cerrar sesión». Los detalles técnicos no se muestran.
- Validación focal: `tests/seccionEvaluaciones.test.tsx` 28/28 PASS; ESLint focal, typecheck y
  `git diff --check` PASS. Los casos nuevos cubren el fallback seguro y la recuperación 401.
- Límite: auditoría visual en la pestaña integrada y lector de pantalla pendientes.

### Parámetros de política: instrucciones según la familia (2026-10-31)

- Hallazgo estático: el editor pedía un objeto JSON válido, pero no describía los campos tipados aceptados por cada familia ni los rangos y sumas de sus grupos. La API rechaza claves desconocidas, formas que no corresponden a la familia y grupos de pesos cuya suma no sea 1.
- Criterio: ofrecer instrucciones visibles y asociadas a Familia de cálculo y Parámetros JSON; no convertir automáticamente datos al cambiar de familia, ni alterar la validación o persistencia del servidor.
- Fundamento: WCAG 2.2 SC 3.3.2 indica que los formularios deben dar etiquetas o instrucciones suficientes para que se sepa qué dato ingresar y puede incluir reglas de formato. Fuente primaria: https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.
- Validación: `npm -C apps/frontend run test -- tests/seccionEvaluaciones.test.tsx` (29/29 PASS); el caso existente de definición de política conserva la prueba de payload. ESLint focal, typecheck y auditoría SDD anotados tras su ejecución.

### Límites e instrucciones para evidencias (2026-10-31)

- Hallazgo estático: los esquemas de API limitan el título a 3–180 caracteres y el motivo de edición a 3–400. La GUI no restringía el título ni explicaba el motivo obligatorio; ambos podían dejar intentos inválidos sin una explicación útil.
- Cambio: se asocia ayuda visible con cada campo; título no vacío menor a 3 caracteres y motivo fuera de rango se marcan como error, bloquean el envío y describen cómo corregirlos. El título vacío o compuesto por espacios conserva el valor predeterminado «Evidencia». Se preservan los valores válidos, las rutas y los payloads de dominio.
- Fundamento: W3C WAI Forms Tutorial recomienda indicar instrucciones y límites de entrada en el contexto del control y asociarlos mediante `aria-describedby`; WCAG 2.2 SC 3.3.1 requiere identificar y describir los errores detectados en texto.
- Validación: `npm -C apps/frontend run test -- tests/seccionEvaluaciones.test.tsx` (29/29 PASS); `npm -C apps/frontend run typecheck` PASS; ESLint focal PASS; `npm run guard:wcag` PASS (65/65 pares, lint incluido); `npm run sdd:audit` PASS; `git diff --check` PASS. Los casos cubren límite del título, ayuda asociada, default en campo vacío y motivo inválido accesible.
- Límite: verificación estática y pruebas de componente; no acredita zoom real, lector de pantalla ni revisión manual en el navegador integrado.

### Resultado de búsqueda del examen fuente Global (2026-10-31)

- Hallazgo estático: el mensaje de cero coincidencias permitía guardar sin vínculo, pero el botón seguía deshabilitado mientras el folio permaneciera escrito. Si la búsqueda fallaba, se mostraba el error técnico crudo y también quedaba bloqueado el guardado sin vínculo.
- Cambio: cero coincidencias ahora habilita el guardado y omite `examenGeneradoId`; un error de búsqueda conserva el folio, mantiene bloqueado ese guardado e indica reintentar o borrar el folio. Editar el folio invalida el resultado anterior. El estado de búsqueda permanece en una región `role="status"`.
- Fundamento: WCAG 2.2 SC 4.1.3 indica que mensajes de estado sobre resultados, espera o errores deben poder determinarse programáticamente y anunciarse sin cambio de foco.
- Validación focal final: `npm -C apps/frontend run test -- tests/seccionEvaluaciones.test.tsx` (30/30 PASS), `npm -C apps/frontend run typecheck` PASS, ESLint focal PASS, `npm run guard:wcag` PASS (65/65 pares, lint incluido), `npm run sdd:audit` PASS y `git diff --check` focal PASS.
- Límite: la prueba de componente valida los estados y la omisión del ID fuente; no reemplaza la verificación visual/tecnología de asistencia en runtime.

### Faltantes del resumen en lista semántica (2026-10-31)

- Hallazgo estático: los faltantes se unían con espacios en una sola oración, dificultando localizar cada acción pendiente al escanear el resumen.
- Cambio: cada faltante ahora se muestra en un elemento `li` con nombre de lista accesible. El estado dinámico anuncia el total; se mantiene el mismo orden, la misma traducción de códigos conocidos y el texto original de los desconocidos.
- Fundamento: W3C WAI recomienda usar listas HTML para grupos de puntos independientes, y WCAG 2.2 SC 1.3.1 exige conservar relaciones y estructura programáticamente.
- Validación focal: `npm -C apps/frontend run test -- tests/seccionEvaluaciones.test.tsx` (30/30 PASS); TypeScript PASS; ESLint focal PASS; `npm run guard:wcag` PASS (65/65 pares, lint incluido); `npm run sdd:audit` PASS; `git diff --check` focal PASS.
- Límite: prueba de componente y análisis estático; captura visual actual, zoom 200 % y lector de pantalla siguen pendientes.

### Mensaje de resumen sin términos internos (2026-11-03)

- Hallazgo estático: al recibir una respuesta válida sin resumen, la interfaz decía «La API no
  devolvió…», trasladando un detalle de implementación al docente.
- Cambio: el estado ahora indica «No hay un resumen disponible para este alumno y periodo.»;
  la distinción frente a un error de consulta y los estados cero/pendiente se mantienen.
- Validación focal: `npm test -- seccionEvaluaciones.test.tsx` (33/33 PASS), ESLint focal,
  `git diff --check` y auditoría SDD PASS.

### Revisión visual sintética de las cuatro vistas (2026-11-03)

- Recorrido aislado con Edge y fixtures ficticios: 1/1 PASS. Se generaron 20 capturas de Política, Evidencias, Exámenes y Resumen en 320/390/768/1024 CSS px y temas oscuro/claro, guardadas en `reports/qa/ux-evaluaciones-current-followup-20261103/`.
- Inspección visual de las cuatro vistas a 320 px y a 390 px en tema claro: contexto de periodo/alumno, formularios vacíos de nueva evidencia, resumen y navegación de cuatro opciones siguen legibles y sin recorte aparente. No surgió otro defecto visual concreto que ameritara cambiar cálculos o comportamiento en esta pasada.
- Límite: la pestaña local integrada no responde y la E2E captura un preview aislado con API ficticia. La verificación real instalada, zoom 200 %, lector de pantalla y recorrido manual de foco continúan pendientes; estas capturas no los sustituyen.

### Jerarquía del resumen académico (2026-11-04)

- Hallazgo visual: a 320 CSS px los cortes y bloques se concatenaban con separadores; una primera cuadrícula compacta de tres columnas provocó colisión entre etiquetas y cifras, detectada al inspeccionar la captura aunque la prueba genérica de overflow pasaba.
- Cambio: cada corte ahora aparece en una fila separada con etiqueta y valor; los grupos distinguen evaluación continua y exámenes, los bloques se separan y la calificación redondeada tiene mayor jerarquía que su equivalente decimal. Se mantiene el nombre/versionado de política, estado y lista de faltantes.
- Contratos: no se modificaron cálculos, redondeo, precisión, valores de cero/ausencia, API ni permisos.
- Validación: `seccionEvaluaciones.test.tsx` 33/33 PASS; E2E Edge 1/1 a 320/390/768/1024 CSS px, tema oscuro y 390 px claro, con teclado de pestañas, medición de contraste renderizado, colisiones y overflow; typecheck, ESLint focal, guard WCAG 91/91, auditoría SDD y diff-check PASS. Evidencia visual aceptada en `reports/qa/ux-evaluaciones-summary-verified-20261104/`.
- Límite: el recorrido usa preview aislado y fixtures ficticios. No acredita runtime instalado, lector de pantalla ni zoom real al 200 %.
