---
id: SPEC-132
titulo: UX y accesibilidad del Banco de reactivos
version: 1.0.39
fecha: 2026-11-04
autor: Codex / EvaluaPro Team
modulo: frontend_docente_banco_reactivos_ux
estado: approved
---

## Contexto y evidencia

La inspección de código cubrió `SeccionBanco.tsx` y sus componentes de captura, temas,
ajustes, listado e importación. El navegador integrado no tiene una pestaña disponible;
esta revisión no formula hallazgos de apariencia o comportamiento visual observados.

Hallazgos estáticos verificables:

- `BancoFormularioPregunta.tsx` usa `role="status"` para el mensaje tanto cuando su clase
  indica error como cuando indica éxito. El error se comunica como una actualización cortés.
- `BancoImportacionReactivos.tsx` coloca mensajes de error, éxito y proceso en un único
  `role="status"`; además, el resultado completo del preview y la cola con controles
  interactivos quedan dentro de regiones `aria-live="polite"`.
- Los pasos de importación son `span` visuales y no exponen lista ordenada ni paso actual
  mediante `aria-current`.
- `BancoListadoPreguntas.tsx` usa un emoji para identificar apoyo visual de reactivos,
  aunque el repositorio prescribe iconos coherentes y texto para estados funcionales.
- `BancoAjustePreguntas.tsx` presenta abreviaturas de estimación (`pag.`, `pt`) y varias
  acciones masivas que deben exponer con claridad su alcance, selección y resultado.

Los contratos de banco/importación/versionado están definidos por SPEC-041, SPEC-061 y
SPEC-070; esta spec limita el cambio a presentación, instrucciones, accesibilidad,
recuperación y estados del frontend.

## Referencias de diseño y accesibilidad

- W3C WCAG 2.2, [3.3.1 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification): identificar y describir errores detectados en texto.
- W3C WCAG 2.2, [3.3.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions): identificar entradas y explicar formatos/reglas cuando sean necesarios.
- W3C WAI Forms, [Labels](https://www.w3.org/WAI/tutorials/forms/labels/): asociar nombres descriptivos que permitan reconocer el propósito de cada control.
- W3C WCAG 2.2, [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): exponer cambios de estado sin obligar a mover el foco.
- W3C WAI Forms, [User Notification](https://www.w3.org/WAI/tutorials/forms/notifications/): explicar el error con instrucciones sencillas para corregirlo y ubicarlo junto al control relacionado.
- Nielsen Norman Group, [Defer Secondary Content When Writing for Mobile Users](https://www.nngroup.com/articles/defer-secondary-content-for-mobile/): priorizar la tarea principal en pantallas pequeñas y dejar el contenido secundario disponible bajo demanda.
- W3C WAI-ARIA APG, [Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): control con semántica de botón, estado `aria-expanded`, relación opcional `aria-controls` y operación con Enter/Espacio.
- W3C WAI-ARIA APG, [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/): una parada de Tab para la barra, navegación interna con flechas y retorno por Tab al siguiente control externo.
- W3C, [WAI-ARIA 1.2: rol progressbar](https://www.w3.org/TR/wai-aria/#progressbar) y [comunicación de valores y límites](https://www.w3.org/WAI/ARIA/apg/practices/range-related-properties/): comunicar un valor y sus límites cuando se representa progreso; no tratar una estimación de paginación como un proceso en curso.

## Requisitos Funcionales

- **REQ-132-001 Mensajes por severidad:** separar el texto del estado semántico. Los éxitos
  y avances usan `status`; errores usan `alert` cuando no hay cambio de contexto. No inferir
  severidad a partir de palabras del mensaje.
- **REQ-132-002 Regiones de anuncios acotadas:** anunciar el resultado resumido y las
  transiciones del flujo, sin colocar listas grandes o controles interactivos dentro de
  regiones vivas que puedan volver a anunciar contenido completo.
- **REQ-132-003 Pasos de importación:** expresar el flujo con estructura ordenada y hacer
  identificable el paso actual y los completados para lector de pantalla, manteniendo el
  texto visible y sin cambiar el orden ni el proceso de preview, confirmación, revisión y
  publicación. Mantener legible el estado del selector de archivo (sin archivo o nombre
  seleccionado) incluso en pantallas estrechas y anunciar los cambios sin mover el foco.
- **REQ-132-004 Formularios claros:** mantener etiquetas visibles; agrupar las cinco
  opciones de respuesta con una leyenda e instrucciones; mostrar validación junto al
  formulario y asociarla semánticamente, conservando datos ingresados al fallar. La barra
  de formato del editor enriquecido tiene una sola parada de Tab, navegación por flechas y
  comandos Home/End, según el patrón APG de toolbar.
- **REQ-132-005 Estados y recuperación:** hacer distinguibles carga, vacío, error, éxito y
  reintento para preguntas, temas, operaciones del banco e historial de importación. La
  lectura inicial o actualización fallida del banco no debe presentarse como lista vacía;
  ofrecer reintento y conservar preguntas previas si existen. En el historial de importación,
  un reintento fallido conserva los resultados ya cargados de la materia actual y los identifica
  como datos anteriores a la consulta fallida; no debe anunciar un vacío confirmado. Las acciones de
  lista filtrada y selección masiva indicarán el alcance y permitirán recuperar/limpiar. Si
  cambia la materia y el tema filtrado ya no está disponible, limpiar ese filtro para que el
  selector y los resultados representen el mismo contexto.
- **REQ-132-006 Claridad de métricas:** presentar conteos y estimaciones con unidad y
  contexto completos; evitar que una región viva extensa anuncie KPIs ajenos a la acción.
  Los conteos de preguntas por tema no se presentan como cero mientras la consulta inicial
  carga o falla sin datos previos; los valores conservados durante actualización/error se
  identifican como provenientes de la última carga.
  En el encabezado del Banco, mantener los valores con el color primario semántico en ambos
  temas; el texto de las etiquetas y los iconos pueden distinguir la categoría sin depender
  únicamente del color del número.
- **REQ-132-007 Iconografía y lectura:** sustituir emojis funcionales por texto e iconos
  semánticos existentes cuando aporten comprensión; mantener una lectura breve y
  diferenciable en filas, estados y acciones.
- **REQ-132-008 Responsive y movimiento:** conservar lectura, orden, operación por teclado,
  foco visible, reflow a 320 CSS px y zoom de texto al 200 %; respetar movimiento reducido.
- **REQ-132-009 Contratos:** conservar permisos, endpoints, payloads, claves de idempotencia,
  versionado, preview/hash, reglas de revisión/publicación y estimaciones/cálculos.
- **REQ-132-010 Acceso entre tareas:** ofrecer enlaces de salto a captura, importación,
  temas y listado desde el encabezado del banco. Los destinos deben tener nombre accesible
  y recibir el foco al navegar; mantener los paneles montados para conservar borradores,
  filtros, preview y estado de importación.
- **REQ-132-016 Nombres contextuales de acciones:** las acciones repetidas en cada reactivo
  incluyen en su nombre accesible el tipo de acción, un resumen del enunciado, tema e ID
  visible de la tarjeta. Los rótulos visibles, permisos y confirmaciones no cambian.
- **REQ-132-017 Orientación por permisos:** cuando el perfil puede consultar el Banco, pero
  no gestionar preguntas o temas, explicar cerca de las tareas cuáles acciones requieren
  gestión y cómo solicitar ese permiso. Mantener las restricciones nativas y todos los
  permisos individuales vigentes.
- **REQ-132-018 Ayuda por acción deshabilitada:** si falta permiso de publicación para
  retirar un reactivo o permiso de archivo para eliminar un registro heredado, explicar el
  requisito en la lista y asociar la instrucción al control correspondiente. Mostrarla solo
  cuando el filtro deja visible un registro afectado; mantener el botón nativo `disabled`.
- **REQ-132-019 Texto auxiliar del editor:** el placeholder y la indicación de formato de las
  opciones mantienen contraste mínimo 4.5:1 y tamaño legible en ambos temas, sin reemplazar
  las etiquetas ni las instrucciones visibles.
- **REQ-132-020 Selector de imagen responsive:** el disparador visible para elegir/cambiar la
  imagen de apoyo permanece dentro del campo y conserva un área táctil mínima de 44 CSS px
  a 320/390 CSS px; su nombre accesible, el input nativo oculto y el flujo de captura se conservan.
- **REQ-132-021 Guía ante formato de importación inválido:** cuando la API rechaza el preview
  con `REACTIVOS_PAYLOAD_INVALIDO`, indicar en español claro y breve que el formato no es compatible,
  indicar la plantilla o esquema como referencia y cómo volver a validar. Distinguir el error
  visualmente con el componente semántico compartido, un icono y tokens de error con contraste
  suficiente en ambos temas. Conservar el archivo elegido y el paso activo; no confirmar ni modificar datos.
- **REQ-132-022 Actualización fallida de temas:** si falla la recarga de temas de la misma materia después de haber obtenido datos, conservar la lista anterior e identificarla como última consulta no verificada. Mantener el error y la acción de reintento; al cambiar de materia, limpiar los datos de la materia anterior como hasta ahora.

## Criterios de Aceptación

1. Errores de alta/edición/importación y fallos de lectura se anuncian como errores; éxitos
   y avances se anuncian como estados, comprobados por roles y textos.
2. El preview y el historial no generan anuncios repetidos de listas completas al actualizar
   su mensaje resumido; los botones permanecen fuera de la región viva.
3. El paso vigente de importación se identifica programáticamente y la estructura visual
   conserva el flujo vigente.
4. Las cinco opciones se perciben como un único grupo con instrucción; los errores de
   validación no borran el texto redactado y ofrecen acción de corrección/reintento.
5. Conteos de filtros, selección masiva, estimaciones y tamaños de archivo incluyen contexto,
   unidad apropiada y precisión legible.
6. No cambia ningún contrato o cálculo cubierto por REQ-132-009.
7. El modo sin permiso de gestión conserva los controles deshabilitados y presenta una
   orientación única, accesible y visible junto a la navegación de tareas.
8. La matriz solo declarará comprobada la vista visual tras capturas actuales en tema claro
   y oscuro a 320/390 CSS px; el reporte debe distinguir capturas sintéticas de runtime real.
9. Los enlaces de salto funcionan con teclado, llevan a los cuatro destinos visibles y no
   descartan el estado de los paneles.
10. En móvil, la guía secundaria inicia plegada si no hay preferencia guardada; el control
   conserva el foco, expone estado y destino accesibles, y respeta una preferencia explícita.
11. En 320 CSS px, todos los controles de la barra del editor enriquecido permanecen dentro
    del ancho visible; por teclado, una sola parada de Tab entra a la barra, las flechas
    recorren sus controles y Home/End llevan al primero/último.
12. Los errores de conectividad no exponen direcciones técnicas; muestran una explicación y
    un siguiente paso comprensible, conservando el archivo para reintentar.
13. Captura, edición y eliminación anuncian cada resultado una sola vez en su mensaje
    contextual; solo se emite un toast adicional cuando presenta una acción de recuperación
    distinta, como restaurar la sesión.
14. Al cambiar los reactivos disponibles y desaparecer el tema seleccionado, el filtro vuelve
    a «Todos los temas», las opciones y resultados quedan sincronizados y no se muestra un
    estado vacío causado por un tema obsoleto.
15. Los nombres de tema se comparan sin espacios externos, igual que se presentan en las
    opciones, para que un dato con espacios accidentales no produzca cero coincidencias.
16. Si el tema equivalente sigue disponible con otra capitalización, conservar el filtro y
    sincronizar su valor con la opción visible.
17. En una lista con varias preguntas, las acciones repetidas se distinguen por sus nombres
    accesibles con enunciado, tema e ID; no se altera el texto visible, permiso ni confirmación.
18. El botón «Seleccionar imagen del equipo» queda dentro del área útil del campo a 320/390 CSS px,
    ambos temas, sin cambiar su input, nombre accesible ni comportamiento.
19. A 320 CSS px, el error de formato inválido comunica en pocas líneas la causa, la referencia
    para corregirlo (plantilla o esquema) y la acción de volver a validar.
23. Si falla una recarga de temas de la misma materia, se conservan y se identifican los temas de la última consulta; el fallo inicial sigue mostrando error recuperable sin presentarse como lista vacía.
17. Los botones de retirar/eliminar deshabilitados muestran el permiso requerido y cómo
    solicitarlo; su instrucción se relaciona mediante `aria-describedby` y aparece solo si
    la lista filtrada contiene el tipo de reactivo afectado.
18. El placeholder del editor de opciones y su ayuda tienen contraste mínimo 4.5:1 en ambos
    temas; la ayuda no baja de 12 CSS px.
19. La lista distingue consulta en curso, fallo recuperable y vacío confirmado; muestra el
    mensaje de error y un reintento GET-only, conserva los resultados anteriores si la
    actualización falla y no presenta conteos vacíos durante carga o error.
20. Los errores y resultados de validar el archivo aparecen junto al selector y su acción;
    un error conserva el archivo y el paso activo, con reintento disponible en 320/390 CSS px.
21. Para `REACTIVOS_PAYLOAD_INVALIDO`, el mensaje nombra el problema y orienta a usar la
    plantilla o el esquema, corregir/seleccionar el archivo y volver a validar. El archivo y
    el paso se conservan y no se confirma la importación; la alerta incluye icono, superficie
    de error y contraste de texto mínimo 4.5:1 en ambos temas.
22. El encabezado de Captura muestra el emblema de sección una sola vez; «Banco de preguntas»
    queda como nombre textual sin un segundo icono junto al título.

## Revalidación visual responsive (2026-10-31)

- Capturas E2E actuales con API interceptada y datos ficticios en Edge, a 320/390 CSS px,
  tema claro/oscuro, para Capturar, Importar, Gestionar temas y Consultar reactivos.
- Hallazgos confirmados en las capturas de 320 px: los saltos entre tareas usaban clases
  ajenas al sistema de diseño y aparecían subrayados; el botón de guardar y la tarjeta de
  reactivo excedían el ancho disponible.
- Corrección: los saltos usan `boton secundario` y omiten subrayado; en móvil, el CTA ocupa
  el ancho disponible y la lista permite reducir sus tarjetas sin recorte.
- E2E actualizado para comprobar decoración de navegación y límites geométricos del CTA y
  la tarjeta. Resultado: 1/1 PASS a 320/390 px y en ambos temas; ESLint focal, typecheck
  frontend, auditoría SDD y `git diff --check` PASS. Capturas en
  `reports/qa/ux-audit-banco-responsive-fixes-20261031/`.
- Contraste: 61/61 pares registrados PASS. `npm run guard:wcag -- --skip-lint` no pasa por
  colores sin comentario WCAG AA preexistentes en `apps/frontend/src/styles/screens.css`
  (bloque de Temarios, líneas 6445–6517); no pertenecen a este cambio.
- Siguen pendientes la instalación/runtime real, zoom al 200 %, lector de pantalla y la
  revisión exhaustiva de todos los estados de filtros y operaciones.

## Validación focal prevista

- Tests de `banco.refactor`, `bancoImportacionReactivos`, `bancoGestionTemas` y pruebas que
  cubran `BancoFormularioPregunta`, según las rutas/estados efectivamente modificados.
- ESLint focal de componentes y pruebas afectadas, typecheck frontend y `git -c core.fsmonitor=false diff --check`.
- `guard:wcag` si se modifica frontend/estilos, según `docs/WCAG_UI_POLICY.md`.
- Capturas actuales y revisión en tema claro/oscuro, 320 CSS px y zoom 200 %; el navegador
  disponible actualmente no ofrece pestaña enlazable, por lo que esta verificación sigue
  pendiente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-132-001 | Etiquetas, nombres accesibles y representación de captura/listado | `apps/frontend/tests/banco.refactor.test.tsx`; `apps/frontend/tests/bancoImportacionReactivos.test.tsx` | 20/20 pruebas focales PASS |
| REQ-132-002, REQ-132-003, criterio 20 | Error y recuperación de preview junto al selector, con archivo y paso preservados | `apps/frontend/tests/bancoImportacionReactivos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge focal a 320/390 CSS px y ambos temas valida proximidad del mensaje, retención del archivo y paso activo; recuperación muestra preview ficticio sin confirmar importación. |
| REQ-132-004, REQ-132-005 | Ajustes por tema y gestión con estados claros | `apps/frontend/tests/banco.refactor.test.tsx`; `apps/frontend/tests/bancoGestionTemas.test.tsx` | 20/20 pruebas focales PASS |
| REQ-132-006, REQ-132-007 | Conteos con unidades, traducción de enums, selector y guía | `apps/frontend/tests/banco.estimadores.test.tsx`; `apps/frontend/tests/bancoImportacionReactivos.test.tsx`; `apps/frontend/tests/guiaBancoVisual.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Métricas, guía y estados visuales claros/oscuros comprobados en Edge a 320/390 CSS px; selector completo a 320 px |
| REQ-132-016 | Nombres accesibles únicos para Editar, Versiones, Retirar y Eliminar por pregunta | `apps/frontend/tests/bancoListadoPreguntas.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Componente 4/4 PASS; Playwright Edge 1/1 PASS en Capturar, Importar, Temas y Consultar reactivos a 320/390 CSS px, claro/oscuro; 20 capturas en `reports/qa/ux-banco-current-goal-20261103-after/` |
| REQ-132-017 | Explicación de permisos de gestión con controles nativos deshabilitados | `apps/frontend/tests/banco.refactor.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Componente 8/8 PASS; Playwright Edge 1/1 con API/perfil ficticios a 320 CSS px en claro/oscuro; confirma aviso, controles deshabilitados, reflow y capturas inspeccionadas en `reports/qa/ux-banco-permissions-20261103/`. ESLint E2E, typecheck frontend, WCAG 73/73, SDD audit y diff-check PASS. |
| REQ-132-018 | Motivo contextual para permisos de publicación/archivo faltantes por acción | `apps/frontend/tests/bancoListadoPreguntas.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Componente 5/5 PASS para controles canónicos/heredados; Playwright Edge 1/1 PASS con datos dummy: comprueba permiso de publicación ausente y, en un perfil separado con gestión/publicación habilitadas pero sin archivo, una fila heredada con ayuda enlazada al botón deshabilitado. Capturas de ambos temas a 320 CSS px inspeccionadas en `reports/qa/ux-banco-permissions-20261103/`. |
| REQ-132-019 | Contraste y legibilidad de placeholder/ayuda del editor enriquecido | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge 1/1 mide contraste sobre fondos compuestos para placeholder y ayuda, ambos temas, a 320/390 CSS px; ayuda mínima de 12 CSS px. Capturas en `reports/qa/ux-banco-audit-contrast-20261103/`. |
| REQ-132-020 | Disparador de imagen dentro del campo en móvil | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: Playwright Edge sintético mide límites del botón respecto del área útil del campo a 320/390 CSS px, ambos temas; capturas en `reports/qa/ux-audit-banco-picker-fixed-20261104/`. |
| REQ-132-021 | Mensaje breve, claro y recuperación ante contrato de importación inválido | `apps/frontend/tests/bancoImportacionReactivos.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: bancoImportacionReactivos 12/12 y E2E Edge 1/1 a 320/390 CSS px, ambos temas; verifica causa, referencia a plantilla/esquema, siguiente acción, archivo/paso conservados y que no se publica. Capturas revisadas en `reports/qa/ux-banco-audit-current-20261104/`. |
| REQ-132-022 / criterio 23 | Recarga fallida de temas conserva los datos de la última consulta y los identifica | `apps/frontend/tests/banco.refactor.test.tsx`; `apps/frontend/tests/bancoGestionTemas.test.tsx` | Cubierto por prueba de componente/integración con respuesta inicial ficticia exitosa, recarga fallida, lista preservada, nota de vigencia y ausencia de vacío falso. |
| REQ-132-005 | Carga, error recuperable y vacío confirmado de la lista de preguntas | `apps/frontend/tests/recursosAcademicos.hooks.test.tsx`; `apps/frontend/tests/bancoListadoPreguntas.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Hook y vista: 15/15 pruebas focales PASS; Playwright Edge captura error inicial y recuperación GET-only a 320 px claro/oscuro, no muestra un vacío confirmado y vuelve a cargar los reactivos ficticios. |
| REQ-132-005 | Fallo al refrescar el historial conserva resultados previos de la materia, los identifica y evita el vacío falso | `apps/frontend/tests/bancoImportacionReactivos.test.tsx` | 12/12 pruebas focales PASS; fixtures de dos materias, cambio de materia, error recuperable y reintento fallido |
| REQ-132-006 | Conteos por tema distinguen carga, dato anterior y valor no disponible | `apps/frontend/tests/bancoGestionTemas.test.tsx` | 3/3 PASS; no presenta cero sin consulta confirmada |
| REQ-132-005 | Error recuperable al consultar temas, con estado vacío oculto y retorno al selector tras reintentar | `tests/gui-responsive/responsive-docente.spec.ts` | E2E Edge 1/1 con servicios ficticios: 503 de temas, estado de error, enlace desde captura, contraste claro/oscuro y recuperación por Enter verificada en el selector/lista |

## Nombres contextuales de las acciones de reactivos (2026-11-03)

- Hallazgo: capturas actuales de la lista a 320 CSS px muestran varios reactivos; el árbol accesible exponía «Editar», «Versiones» y «Retirar» repetidos sin identificar la tarjeta asociada.
- Cambio: los nombres accesibles de Editar, Versiones, Retirar y Eliminar agregan un resumen del enunciado, tema e ID corto que ya aparece en la tarjeta. Se conserva el texto visible y la confirmación existente.
- Validación focal: `bancoListadoPreguntas.test.tsx` (4/4 PASS); Playwright Edge sintético (1/1) a 320/390 CSS px, ambos temas; TypeScript, ESLint focal, build docente, WCAG (69/69), `sdd:audit` y `git diff --check` PASS.
- Capturas actuales: `reports/qa/ux-banco-current-goal-20261103-after/`; API interceptada, fixtures dummy, sin operaciones de escritura.
- Referencia: W3C WAI Forms, etiquetas descriptivas para reconocer el propósito del control.
| REQ-132-008, REQ-132-009 | Reflow, selector de archivo, barra del editor y conservación de contratos | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts`; `apps/frontend/tests/banco.refactor.test.tsx` | E2E sintético 320/390 px, ambos temas: PASS; selector dentro de tarjeta y barra sin controles recortados; contratos preservados |
| REQ-132-010 | Enlaces de salto accesibles con paneles montados | `apps/frontend/tests/banco.refactor.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | E2E en Edge a 320/390 px, ambos temas: Enter, foco del destino y borrador preservado PASS |
| REQ-132-004, criterios 9-10 | Plegado móvil de guía, preferencia persistente, foco y geometría/navegación de teclado del editor | `apps/frontend/tests/guiaBancoVisual.test.tsx`; `apps/frontend/tests/richTextEditor.keyboard.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Toolbar: una parada de Tab, flechas con retorno, Home/End, nombre/estado del panel LaTeX; prueba focal 1/1 PASS. E2E Edge 1/1 conserva verificaciones previas de estado/foco y límites de botones |
| Criterio 12 | Evitar duplicar mensajes contextuales de captura/edición/eliminación en el sistema Toast | `apps/frontend/tests/banco.refactor.test.tsx` | 6/6 pruebas focales PASS; alerta contextual confirmada y toast duplicado ausente |
| REQ-132-005, criterio 1 | El fallo al consultar versiones queda visible con reintento contextual y sin exponer el detalle de conexión | `apps/frontend/tests/banco.refactor.test.tsx` | 7/7 pruebas del archivo PASS; el error del historial se conserva y el botón reintenta la lectura sin emitir un toast duplicado |
| REQ-132-005, criterios 13-15 | Al cambiar la materia, limpiar el filtro obsoleto, normalizar espacios y conservar/sincronizar un tema que sigue disponible | `apps/frontend/tests/bancoListadoPreguntas.test.tsx` | 3/3 PASS: cambio a tema distinto, espacios externos y tema equivalente con distinta capitalización |
| AC-022 | Encabezado de Captura con un emblema y nombre de sección textual | `apps/frontend/tests/banco.refactor.test.tsx` | Verifica que el h2 tenga el nombre accesible «Banco de preguntas» sin SVG y que el orb conserve su icono. |

Validación ejecutada: `npm test -- tests/banco.refactor.test.tsx tests/bancoImportacionReactivos.test.tsx tests/bancoGestionTemas.test.tsx tests/banco.estimadores.test.tsx tests/guiaBancoVisual.test.tsx` (5 archivos, 20/20 PASS); `npm run typecheck` (PASS); ESLint focal sobre guía, formulario, listado y prueba (PASS); `npm run guard:wcag
-- --skip-lint` (33/33 pares de contraste PASS y guard PASS); `git -c core.fsmonitor=false diff --check`
(PASS). La pestaña del navegador integrado no está disponible, así que no se registran
capturas en aquella ejecución. La revalidación responsive sintética del 2026-10-29 se registra
a continuación; runtime instalado, zoom y tecnologías de asistencia siguen pendientes.

## Revalidación focal de la etapa de preview (2026-10-28)

- Hallazgo: después de seleccionar un archivo o fallar la validación, el indicador regresaba a “Selecciona archivo”, aunque el archivo se conservaba y la siguiente acción era validarlo/corregirlo.
- Cambio: el paso de validación queda activo cuando hay archivo, preview o procesamiento; un flujo pendiente de revisión/publicación conserva prioridad como paso 3.
- Validación focal: `bancoImportacionReactivos.test.tsx`: 8/8 PASS; ESLint focal, typecheck, build docente aislado y verificador del bundle PASS; guard WCAG (39/39 pares), auditoría SDD y `git diff --check` PASS. La prueba comprueba el paso 2 antes de validar y tras un error, y que el archivo se conserva.
- No cambia el flujo de preview/confirmación/publicación ni payloads.

## Revalidación responsive y selector de archivo (2026-10-29)

- **Hallazgo visual:** las capturas sintéticas de Banco a 320 px mostraron que el selector nativo de archivo sobresalía de su tarjeta aunque la página no tuviera desbordamiento horizontal. La regla previa `max-width: 100%` no anulaba su ancho intrínseco mínimo.
- **Cambio:** el selector usa `box-sizing: border-box`, `width: 100%` y `min-width: 0`. El E2E compara el borde real del selector con su tarjeta y recorre formularios, filtros, temas, importación y reactivo reciente a 320/390 px en tema claro y oscuro.
- **Validación:** Playwright focal 1/1 PASS; 3 archivos de pruebas del Banco, 16/16 PASS; typecheck frontend PASS; guard WCAG/ESLint PASS (46/46 pares de contraste); auditoría SDD y `git diff --check` PASS. Capturas sintéticas inspeccionadas en `%TEMP%\evaluapro-ux-banco-20261029`.
- **Límite:** el E2E usa API interceptada y datos ficticios; zoom de texto al 200 %, tecnologías de asistencia y runtime instalado no se validaron en este ciclo. La spec se mantiene `approved` hasta completar esas comprobaciones manuales.

## Mensajes recuperables de conectividad en importación (2026-10-31)

- Hallazgo estático: la importación mostraba directamente `Error.message` en una alerta. Si
  el fallo era de conexión, podía exponer la dirección local y no explicaba cómo recuperar.
- Cambio: los errores de preview pasan por `mensajeDeError`, que usa el normalizador ya
  compartido por EvaluaPro; el archivo sigue seleccionado para reintentar.
- Validación focal: `npm -C apps/frontend test -- tests/bancoImportacionReactivos.test.tsx --reporter=dot`
  → 10/10 PASS; ESLint focal PASS; `npm -C apps/frontend run build:docente` PASS (TypeScript,
  lint frontend, bundle docente y WCAG); `npm run guard:wcag -- --skip-lint` → 61/61 pares
  PASS; `npm run sdd:audit` y `git diff --check` PASS.
- Sin captura visual aceptada en esta vuelta: el navegador lateral reportó
  `browser.user is unavailable`. La revisión de esta iteración es estática y el estado runtime,
  zoom y tecnologías de asistencia siguen pendientes.

- Ajuste adicional de REQ-132-006: los archivos de 1 MiB o más se muestran en MB con precisión
  de hasta dos decimales; los menores conservan B/KB. `bancoImportacionReactivos.test.tsx`
  confirma el formato para un archivo sintético de 2 MiB.

## Revalidación de acceso rápido entre tareas (2026-10-29)

- **Hallazgo:** a 320 px, los flujos de captura, importación, temas y consulta se apilan en una
  página extensa, por lo que encontrar una tarea exige recorrer secciones no relacionadas.
- **Cambio:** el encabezado ofrece enlaces nativos a cada tarea; los destinos admiten foco y
  desplazamiento. Los paneles permanecen montados para conservar formularios, filtros y previews.
- **Validación inicial:** `banco.refactor.test.tsx` 6/6 PASS; typecheck, ESLint focal, guard
  WCAG (54/54 pares) y auditoría SDD PASS.
- **Revalidación Edge:** el recorrido Playwright focal pasó 1/1 en 320/390 CSS px y temas
  claro/oscuro. Envía Enter a los cuatro enlaces, comprueba foco en cada destino y conserva
  un borrador de captura. Las cuatro capturas actuales están en
  `reports/qa/ux-banco-nav-20261029-edge/` y fueron inspeccionadas.
- **Pendiente:** zoom de texto al 200 % y tecnologías de asistencia. El E2E usa API
  interceptada y datos ficticios; no representa el runtime instalado.

## Revalidación móvil de guía y editor enriquecido (2026-10-29)

- **Hallazgo:** la guía de tres pasos ocupaba espacio antes de los controles principales en
  móviles; la barra del editor enriquecido se recortaba a 320 CSS px (clientWidth 164 px,
  scrollWidth 250 px; dos botones quedaban fuera de sus límites). Las capturas también
  mostraron el filtro «Todos los temas» truncado y dos metadatos del reactivo concatenados
  visualmente.
- **Cambio:** la guía inicia plegada hasta 767 CSS px cuando no existe preferencia guardada;
  su control único conserva foco al abrir/cerrar y publica `aria-expanded`/`aria-controls`.
  Una preferencia explícita guardada prevalece. La barra del editor permite envolver sus
  controles en pantallas de hasta 480 CSS px. El filtro conserva su etiqueta asociada
  «Filtrar por tema», conserva «Todos los temas» y ajusta la tipografía para que quepa
  completa en móvil, además de usar el token de texto claro del tema oscuro; los metadatos
  del reactivo muestran un separador explícito.
- **Validación:** `guiaBancoVisual.test.tsx` 1/1 PASS; Playwright focal de Banco 1/1 PASS
  en Edge a 320/390 CSS px, claro/oscuro, incluidos estado/foco del disclosure y límites
  geométricos de botones; `banco.refactor.test.tsx` cubre los textos corregidos; ESLint
  focal PASS. Las capturas finales tras limpiar los textos están en
  `reports/qa/ux-banco-20261029-text-cleanup/`. Altura de página ficticia a 320 px: 8042 →
  7071 px (−971 px, 12.1 %); es una medida de recorrido del fixture, no una métrica de
  usabilidad con participantes.
- **Límite:** fixture con API interceptada y datos ficticios. No prueba el runtime instalado,
  zoom al 200 %, lector de pantalla ni tecnologías de asistencia. La captura clara de
  consulta muestra el selector vacío y la de gestión de temas no muestra el contenido de
  la tarjeta, aunque el DOM conserva el texto, la geometría y estilos visibles; el filtro sí
  aparece en tema oscuro. Requiere reproducirlo en Edge visible/runtime y resolverlo antes
  de cerrar la revisión visual de Banco. La auditoría integral sigue abierta.

## Revalidación de captura y selector a 320 px (2026-10-29)

- Hallazgo: el test forzaba `data-theme` sin actualizar `documentElement.style.colorScheme`,
  distinto de `aplicarTemaDocumento()`. Además, capturaba inmediatamente después de
  `scrollIntoViewIfNeeded()`, antes de estabilizar el repintado de la sección.
- Cambio de prueba: sincronizar `data-theme` y `colorScheme` y esperar dos
  `requestAnimationFrame` después de cada desplazamiento antes de capturar. Las capturas de
  elementos aislados confirmaron que el contenido era visible; el defecto estaba en la
  captura de viewport.
- Hallazgo de UI: el filtro «Todos los temas» quedaba truncado en Edge a 320 CSS px por el
  padding izquierdo heredado para campos con icono, aunque este selector no tiene icono.
- Cambio de UI: hasta 400 px, el selector usa `0.75rem` de padding izquierdo y conserva
  `0.76rem` de tipografía. El texto completo aparece en la captura.
- Validación: Playwright Edge focal `audita Banco de reactivos con contenido ficticio a
  320/390 px y ambos temas`: 1/1 PASS. Capturas revisadas en
  `reports/qa/ux-banco-20261029-final-verified/`.
- Límite: capturas sintéticas con APIs interceptadas; siguen pendientes runtime instalado,
  zoom 200 % y revisión manual con teclado/tecnología asistiva.

## Ancho útil de los editores de opciones en móvil (2026-10-29)

- Hallazgo visual en Capturar: a 320 CSS px, cada tarjeta reservaba una columna lateral para la
  letra A–E; la barra y el área de redacción quedaban demasiado estrechas aunque no se desbordaran.
- Cambio: en móvil, la letra y el selector de opción correcta comparten la fila superior, y el
  editor ocupa una fila completa debajo. El E2E comprueba los cinco editores, un ancho mínimo de
  140 CSS px y que la barra completa siga dentro de cada editor. No cambian contenido, selección,
  valores persistidos ni contratos.
- Validación focal: Playwright Edge `audita Banco de reactivos con contenido ficticio a 320/390 px
  y ambos temas`: 1/1 PASS; capturas de las cuatro tareas a 320/390 px, ambos temas, e inspección
  del editor a 320 px en `reports/qa/ux-banco-20261029-wide-options/`.
- Límite: preview con respuestas dummy; runtime instalado, zoom al 200 % y lector de pantalla siguen
  pendientes.

## Revalidación actual de Banco (2026-10-30)

- Playwright en Edge `audita Banco de reactivos con contenido ficticio a 320/390 px y ambos temas`:
  1/1 PASS. Recorre Capturar, Importar, Gestionar temas y Consultar reactivos; verifica disclosure
  de guía con Enter/Espacio y foco retenido, preservación del borrador, selectores/acciones dentro
  de sus límites, texto completo del filtro y ausencia de desbordamiento horizontal.
- Revisé capturas actuales de Capturar a 320 px y Gestionar temas/Consultar reactivos a 320 px,
  incluyendo los temas claro y oscuro. Las capturas del ciclo están en
  `reports/qa/ux-banco-20261030-continuation/`.
- Los fixtures y las respuestas API son ficticios. No se inspeccionó la instalación local, ni se
  verificaron zoom de texto al 200 %, lector de pantalla o tecnología asistiva. La spec permanece
  `approved` hasta completar esas validaciones y cerrar toda la matriz.
- Repetición focal del mismo flujo en esta continuación: 1/1 PASS; se inspeccionaron las capturas
  de Capturar, Importar, Gestionar temas y Consultar reactivos a 320 px, en tema claro y oscuro
  donde aplica. Evidencia: `reports/qa/ux-temarios-banco-current-turn/`. No apareció un defecto
  nuevo ni una regresión que justificara otro cambio en Banco.

## Notificaciones redundantes en Captura y edición (2026-10-31)

- Hallazgo estático: Captura, edición y eliminación mostraban el mismo éxito/error en el mensaje
  contextual y en un toast global, duplicando la lectura visual y el anuncio para tecnologías
  asistivas.
- Cambio: el mensaje contextual queda como fuente primaria. Se suprimen los toasts duplicados;
  si el error de sesión permite una acción de recuperación, se conserva un toast distinto que
  explica recuperar el acceso y volver a intentar sin repetir el error.
- Validación focal: `apps/frontend/tests/banco.refactor.test.tsx` 6/6 PASS; ESLint focal PASS;
  build docente, guard del bundle y contraste WCAG 61/61 PASS; `npm run sdd:audit` PASS;
  `git diff --check` PASS.
- Alcance: no cambia el envío de datos, contratos ni el flujo de guardado. No se hizo una nueva
  auditoría visual del runtime en esta iteración.

## Recuperación del historial de versiones (2026-10-31)

- Hallazgo estático: el fallo de lectura solo aparecía en un toast temporal y no ofrecía una
  acción de reintento junto al historial afectado.
- Cambio: el error seguro queda persistente en contexto; el botón vuelve a consultar el mismo
  reactivo. Solo un error de sesión añade el toast distinto para recuperar acceso.
- Validación focal: `npm -C apps/frontend run test -- tests/banco.refactor.test.tsx` (7/7 PASS),
  ESLint focal, typecheck de frontend, `npm run guard:wcag -- --skip-lint` (65/65 pares PASS)
  y `git diff --check` PASS.
- Límite: esta iteración no tomó capturas nuevas de este estado de error ni revisó zoom 200 %,
  lector de pantalla o runtime instalado.

## Superficie y contraste de KPIs (2026-11-03)

- Hallazgo: la auditoría 69/69 de pares de texto pasaba, pero `guard:wcag` encontraba tres
  colores directos en el estilo claro de `.banco-mini-kpi`, lo que impedía validar el guard
  completo y no seguía los tokens del tema.
- Cambio: fondo, borde y sombra ahora usan `--surface-0`, `--surface-border-strong` y
  `--shadow-soft`. Los números del encabezado usan `--ui-text-primary` en ambos temas; los
  iconos y etiquetas mantienen el indicador de categoría, además del texto.
- Validación: E2E Playwright Edge con datos ficticios 1/1 en 320/390 CSS px y ambos temas;
  verifica los cinco valores KPI con el token de texto del tema. Guard WCAG 69/69 y
  `git diff --check` PASS. Capturas en `reports/qa/ux-banco-kpi-token-20261103-final/`.
- Referencias: WCAG 2.2 SC 1.4.3 (contraste mínimo) y SC 1.4.1 (uso del color),
  [W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) y
  [W3C 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
- Límite: las capturas usan datos sintéticos; no se verificaron runtime instalado, zoom real
  al 200 % ni lector de pantalla.

## Estado legible del selector de importación (2026-11-03)

- Hallazgo visual: a 320 CSS px, el selector nativo truncaba el texto de archivo vacío hasta
  dejar visible solo «N…», sin una alternativa legible.
- Cambio: un estado persistente y `role="status"` indica «Sin archivo seleccionado»;
  al elegirlo, muestra nombre y tamaño, permite partir nombres largos y no desplaza el foco.
  Se conserva el input nativo, los formatos aceptados y el envío existente.
- Validación focal: `bancoImportacionReactivos.test.tsx` y Playwright Edge de Banco verifican
  estado inicial, archivo seleccionado, anuncio semántico y límites del texto a 320/390 CSS px.
  Capturas actuales en `reports/qa/ux-banco-import-status-final-20261103/`.
- Referencia: WCAG 2.2 SC 4.1.3, [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- Límite: la prueba usa fixtures sintéticos; no se verificaron runtime instalado, zoom real al
  200 % ni lector de pantalla.

## Error de validación junto al selector de archivo (2026-11-03)

- Hallazgo visual: al fallar la vista previa, el mensaje contextual se renderizaba después del
  historial de importaciones, lejos del botón «Validar archivo». En una sección larga, el error
  podía quedar fuera de la zona visible tras activar la validación.
- Cambio: el mensaje de estado/error ahora aparece inmediatamente después del selector y su
  acción principal; conserva `role="alert"`/`status`, el archivo seleccionado y el paso activo.
- Validación: Playwright Edge focal prueba HTTP 422 ficticio y la recuperación a un preview de
  una fila, a 320/390 CSS px en ambos temas; mide que la alerta quede a menos de 80 CSS px del
  bloque de carga. No confirma ni escribe la importación. ESLint focal, `bancoListadoPreguntas`
  7/7, WCAG 73/73, SDD audit y diff-check PASS.
- Capturas inspeccionadas en `reports/qa/ux-banco-query-errors-20261103/`; runtime instalado,
  zoom real al 200 % y lector de pantalla siguen pendientes.

## Selectores de archivo sin texto nativo truncado (2026-11-03)

- Evidencia visual actual: en Captura, el control nativo de imagen pintaba una fila mínima con
  texto cortado junto al disparador; en Importación, la fila nativa también truncaba el estado
  vacío en anchos móviles.
- Cambio: ambos flujos conservan los inputs nativos, formatos aceptados y manejadores. Botones
  visibles con nombres accesibles abren los inputs; estos quedan fuera del árbol accesible y del
  orden de tabulación, evitando que el navegador pinte texto nativo truncado. El botón de
  importación describe formatos y estado actual; el nombre y tamaño siguen anunciándose con
  `role="status"`.
- Validación: Playwright Edge focal a 320/390 CSS px, claro/oscuro; abre ambos selectores, carga
  archivos ficticios y comprueba sus estados. `bancoImportacionReactivos.test.tsx` 11/11,
  typecheck, ESLint focal, `sdd:audit`, WCAG contraste 71/71 y `git diff --check` focal PASS.
  Capturas en `reports/qa/ux-banco-file-selectors-final-20261103/`.
- Referencias: WAI sobre [etiquetas asociadas](https://www.w3.org/WAI/tutorials/forms/labels/),
  WCAG 2.2 [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible/) y
  [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum/).
- Límite: pruebas con datos y archivos ficticios; no sustituyen la prueba con lector de pantalla
  ni la verificación del runtime instalado.

## Significado de la altura estimada en el ajuste masivo (2026-11-03)

- Hallazgo estático: el ajuste mostraba el total de altura en puntos tipográficos sin explicar
  qué describía esa unidad; podía confundirse con una medida de páginas definitivas.
- Cambio: la métrica ahora se denomina «altura aproximada» y una ayuda explica que estima el
  espacio impreso, la equivalencia de 72 pt por pulgada y el límite frente a la vista previa.
  El algoritmo de estimación y la paginación no cambian.
- Validación focal: `npm test -- banco.estimadores.test.tsx` (3/3 PASS), ESLint de los dos
  archivos TypeScript modificados y `git diff --check` focal PASS.

## Revisión visual del error de consulta del Banco (2026-11-03)

- Se amplió el E2E existente para simular un HTTP 503 al consultar preguntas, comprobar que la
  lista no anuncie un vacío confirmado, verificar el reintento de lectura y capturar el panel
  de error en ambos temas a 320 CSS px.
- La inspección de capturas no encontró recorte ni confusión entre fallo y lista vacía; el aviso
  da el siguiente paso y conserva el mensaje contextual. No fue necesario cambiar la GUI.
- `responsive-docente.spec.ts` (Banco) pasó 1/1 en Edge; consulta y recuperación son GET con
  respuestas interceptadas. El reporte usa solo datos ficticios y no incluye escrituras.
- Límite: el E2E espera el estado final tras la política existente de reintentos. No se verificó
  la instalación local, zoom real al 200 % ni lector de pantalla.

## Error al consultar temas desde el formulario de captura (2026-11-03)

- Hallazgo estático: si la consulta de temas fallaba, la sección «Temas» mostraba error y
  reintento, mientras el selector del formulario afirmaba «Primero crea un tema». Esa ayuda
  confundía un fallo de lectura con una lista vacía y podía inducir a crear duplicados.
- Cambio: el formulario distingue la carga fallida del estado vacío y enlaza a la sección
  «Temas», donde ya se muestran el error y su reintento. Cuando la consulta confirma una lista
  vacía, se conserva la instrucción actual para crear el primer tema.
- Contratos: no cambian consultas, escrituras, permisos ni reglas de captura.
- Validación: `banco.refactor.test.tsx` 8/8 PASS; TypeScript frontend, ESLint focal,
  WCAG contraste 73/73, auditoría SDD y `git diff --check` PASS. La cobertura usa estado de
  error simulado en componente; no se añadió E2E visual a esta ayuda de recuperación.

## Orientación del permiso de gestión (2026-11-03)

- Hallazgo estático: los campos de captura y temas quedaban `disabled` cuando faltaba el
  permiso `banco.gestionar`, sin una explicación visible; las acciones secundarias dependen
  de permisos individuales y podían seguir disponibles.
- Cambio: al conservar permiso de lectura, se muestra una nota única que explica que crear y
  editar requieren gestión y cómo solicitarla. El `disabled` nativo y los permisos de
  archivo/publicación se mantienen.
- Validación: `banco.refactor.test.tsx` 8/8 PASS; Playwright Edge focal 1/1 con API/perfil
  ficticios a 320 CSS px en tema claro y oscuro. Comprueba aviso, controles deshabilitados,
  cabeceras y overflow; capturas inspeccionadas en `reports/qa/ux-banco-permissions-20261103/`.
  ESLint E2E, TypeScript frontend, WCAG contraste 73/73, auditoría SDD y `git diff --check` PASS.
- Referencia: [W3C WAI, Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/),
  sobre instrucciones visibles y comprensibles para utilizar controles.

## Explicación de permisos de archivo y publicación por acción (2026-11-03)

- Hallazgo en captura sintética de solo lectura: «Retirar» quedaba deshabilitado sin decir
  que requiere permiso de publicación. El mismo comportamiento aplicaba a «Eliminar» en
  registros heredados sin permiso de archivo.
- Cambio: la lista muestra una instrucción única por tipo de acción afectada y la asocia a
  cada botón deshabilitado mediante `aria-describedby`. Solo aparece si el filtro incluye un
  registro afectado. Los controles y permisos existentes se conservan.
- Validación: `bancoListadoPreguntas.test.tsx` 5/5 PASS; Playwright Edge 1/1 PASS con datos dummy: comprueba permiso de publicación ausente y, en un perfil separado con gestión/publicación habilitadas pero sin archivo, una fila heredada con ayuda enlazada al botón deshabilitado. Capturas de ambos temas a 320 CSS px inspeccionadas en `reports/qa/ux-banco-permissions-20261103/`.

## Legibilidad de las instrucciones del editor enriquecido (2026-11-03)

- Hallazgo visual en capturas E2E: en tema claro, los placeholders «Texto de la opción» y la ayuda de formato usaban una tinta gris tenue que competía con el fondo del editor.
- Cambio: el placeholder utiliza `--ui-text-placeholder`; la ayuda usa `--ui-text-muted`, aumenta a 12 CSS px y mantiene altura de línea cómoda. El editor obtiene una superficie opaca estable en oscuro para que su contraste no dependa del vidrio circundante. No cambian contenido, entradas ni operaciones del editor.
- Validación: E2E Edge `audita Banco de reactivos con contenido ficticio a 320/390 px y ambos temas` 1/1 PASS; mide texto/fondo después de componer las superficies, exige 4.5:1 y verifica 12 CSS px. Capturas de Capturar, Importar, Gestionar temas y Consultar reactivos en `reports/qa/ux-banco-audit-contrast-20261103/`.
- Límite: datos ficticios; runtime instalado, zoom real al 200 % y lector de pantalla siguen pendientes.

## Conservación del historial ante una consulta fallida (2026-11-03)

- Hallazgo: el fallo de una consulta/reintento borraba del estado local el historial ya obtenido y ocultaba la referencia útil para recuperarse.
- Cambio: se mantienen los registros anteriores por materia durante la actualización y después de un fallo; una nota los identifica como resultados previamente cargados. El estado vacío solo se presenta tras una consulta exitosa sin registros.
- Validación: `npm -C apps/frontend run test -- tests/bancoImportacionReactivos.test.tsx` (12/12 PASS), ESLint focal, typecheck frontend y WCAG guard PASS (73/73 pares). Auditoría SDD y diff-check ejecutados después de registrar esta evidencia.
- Límite: prueba de componente con errores sintéticos; no modifica ni valida escrituras, contratos API o estado de instalación.

## Estado veraz de conteos por tema (2026-11-03)

- Hallazgo estático: las tarjetas de Temas presentaban `0` preguntas mientras la consulta inicial seguía cargando o había fallado sin datos previos.
- Cambio: el conteo muestra «Cargando…» o «No disponible» en esos estados; si hay preguntas previas durante una actualización/error, el número se etiqueta como «última carga». El cero se conserva tras una consulta exitosa.
- Validación: `npm -C apps/frontend run test -- tests/bancoGestionTemas.test.tsx` (3/3 PASS); ESLint focal, typecheck, WCAG guard (73/73 pares), auditoría SDD y diff-check PASS.
- Límite: prueba de componente con estados sintéticos; la UI/API local no respondieron durante la comprobación visual, así que no hay captura de runtime de esta sección.

## Navegación de teclado en la barra de formato (2026-11-03)

- Hallazgo estático: el editor declaraba `role="toolbar"`, pero cada botón tenía su propia parada de Tab y no existía navegación con flechas. Esto aumentaba las paradas en cada campo de respuesta e incumplía el patrón APG elegido para el grupo.
- Cambio: la barra usa `tabindex` itinerante, flechas izquierda/derecha con retorno, Home/End y orientación horizontal. El control LaTeX tiene nombre explícito, `aria-expanded` y `aria-controls`; su panel permanece en el DOM y queda oculto con `hidden` para mantener válida la relación.
- Validación: `richTextEditor.keyboard.test.tsx` 1/1 y `richTextEditor.test.ts` 5/5 PASS; el E2E Edge de Banco 1/1 PASS a 320/390 CSS px y ambos temas. Typecheck y guard WCAG (81/81 pares, lint incluido) PASS. Capturas actuales inspeccionadas en `reports/qa/ux-banco-toolbar-20261103/`.
- No cambian el contenido HTML permitido, la salida del editor, los formatos de reactivo ni los contratos de captura. No se validó con lector de pantalla ni con runtime instalado.

## Disparador de imagen dentro del campo móvil (2026-11-04)

- Hallazgo reproducido en captura sintética: a 320 CSS px, el botón «Seleccionar imagen del equipo» sobresalía 15 CSS px del campo.
- Cambio: en móviles el contenedor ocupa el ancho disponible y el botón permite reducir su ancho, mantiene texto ajustable y queda alineado al inicio; no cambian los atributos ni la acción del selector nativo.
- Validación focal: E2E Edge `audita Banco de reactivos con contenido ficticio a 320/390 px y ambos temas` 1/1 PASS con límites del botón medidos contra el área útil del campo; capturas posteriores en `reports/qa/ux-audit-banco-picker-fixed-20261104/`.
- Pendiente: teclado/lector de pantalla manual y runtime instalado; E2E usa fixtures sintéticos.

## Contraste de errores y recuperación de temas del Banco (2026-11-04)

- Hallazgo en la captura clara a 320 CSS px: el texto de los mensajes globales de error contrastaba 2.13:1 con la superficie compuesta.
- Cambio: los mensajes de error reutilizan los tokens `--peligroTexto` y `--peligroBg`, que tienen valores correspondientes a los temas claro/oscuro.
- Revisión de la rama de error recuperable de temas con servicio 503 sintético.
- El E2E espera a que termine la política de reintentos automáticos, confirma que el fallo no se presenta como lista vacía, y valida la ruta de retorno desde captura.
- «Reintentar carga de temas» recupera el tema de prueba con Enter; el E2E verifica contraste, presencia en el selector y la lista.
- No se modificaron contratos, operaciones ni datos. Runtime instalado y lector de pantalla siguen pendientes.
