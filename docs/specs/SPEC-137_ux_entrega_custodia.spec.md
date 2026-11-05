---
id: SPEC-137
titulo: UX y accesibilidad de Entrega y Custodia de exámenes
version: 1.2.14
fecha: 2026-11-05
autor: Codex / EvaluaPro Team
modulo: frontend_docente_entrega_ux
estado: approved
---

## Contexto

La vista Entrega agrupa la vinculación manual, lectura QR/cámara, importación por lote,
una mesa para revisar sugerencias OCR y la bitácora de entregas. El flujo de negocio está
definido por SPEC-043. La revisión estática de `SeccionEntregaInterna.tsx` y
`SeccionRegistroEntrega.tsx` encontró problemas de contexto y presentación que no cambian
ese contrato:

- Cambiar la materia limpia los resultados pero conserva la búsqueda previa; el filtro
  puede ocultar todos los folios de la materia nueva.
- La bitácora y los resultados por lote muestran `alumnoId`, un identificador interno,
  en lugar del nombre y matrícula disponibles.
- El control del bono usa un `<label>` exterior que contiene otro `<label>`, una
  asociación HTML no válida para controles.
- Los KPIs se calculan sobre los folios cargados y filtrados, pero «En lista» y
  «Recepción» no exponen esa limitación de paginación en su texto principal.

Fuentes de diseño accesible:

- [W3C WAI: Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/): cada
  control debe tener una etiqueta asociada que describa su propósito.
- [W3C WAI: Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/):
  comunicar formato e instrucciones relevantes junto a los controles.
- [W3C WCAG 2.2 SC 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast):
  el indicador de foco del autor debe contrastar con el color adyacente.
- [WCAG 2.2: Status Messages (SC 4.1.3)](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  los cambios de estado se pueden exponer sin mover el foco.
- [WCAG 2.2: Error Identification (SC 3.3.1)](https://www.w3.org/WAI/WCAG22/Understanding/error-identification):
  los errores detectados deben identificarse y describirse en texto.

## Alcance

Mejorar contexto, legibilidad y semántica accesible de la vista docente Entrega y de su
mesa de captura por lotes. Mantener rutas, payloads, cálculos, permisos, reglas contra
duplicados, asignación, reconocimiento QR/OCR, persistencia y confirmaciones de SPEC-043.
No recalcular porcentajes con folios aún no cargados ni afirmar que los datos paginados
representan la materia completa.

## Requisitos Funcionales

- **REQ-137-001 (Cambio de materia):** al cambiar materia, limpiar el filtro de búsqueda
  anterior junto con los resultados reemplazados. El estado vacío reflejará la materia
  nueva sin exigir una acción adicional para borrar un filtro ajeno.
- **REQ-137-002 (Identidad legible):** presentar nombre y matrícula cuando el alumno
  asignado exista en el catálogo cargado. Si no existe, mostrar un estado explícito como
  «Alumno no disponible»; no exponer el ID interno como texto de interfaz.
- **REQ-137-003 (Asociación de controles):** el checkbox del bono tendrá una etiqueta
  válida, única y operable sin etiquetas `<label>` anidadas. Conservar valor, cálculo y
  payload actuales.
- **REQ-137-004 (Alcance de métricas):** los conteos y el porcentaje describirán que se
  calculan sobre los exámenes cargados y los filtros activos; no presentarán una página
  parcial como total de la materia.
- **REQ-137-005 (Compatibilidad):** preservar vinculación, búsqueda, paginación, captura
  individual y por lote, navegación de la mesa, importación de imágenes, OCR/QR,
  recuperación de errores, permisos y flujos de confirmación.
- **REQ-137-006 (Adaptabilidad):** revisar los controles de captura y las dos listas en
  móvil, teclado, foco y temas claro/oscuro. Registrar cualquier revisión runtime que no
  pueda completarse por indisponibilidad del entorno; los tests no acreditan apariencia.
  Los selectores de imágenes mantienen nombres e instrucciones visibles, sin depender del
  texto nativo de estado del navegador que puede truncarse; el foco del control oculto debe
  seguir siendo visible sobre su tarjeta.
- **REQ-137-007 (Conexión móvil opcional):** presentar la conexión por QR de teléfono como
  divulgación nativa inicialmente plegada, con un resumen que explique su propósito opcional.
  Al abrirla, conservar QR, enlace manual, diagnóstico y entrada de host; operar con puntero,
  Enter y Espacio, y anunciar el estado sin cambiar el foco.
- **REQ-137-008 (Guía móvil bajo demanda):** iniciar plegada la guía secundaria en pantallas de
  hasta 767 CSS px, salvo que exista una preferencia guardada; en escritorio iniciar abierta si no
  hay preferencia. Exponer un único control de divulgación con `aria-expanded` y `aria-controls`,
  preservar el foco al alternar y mantener el contenido accesible bajo demanda.
- **REQ-137-011 (Frescura de datos):** ante un fallo de consulta con resultados previos,
  conservar las filas e indicar que reflejan la última consulta exitosa. Durante la consulta,
  anunciar la actualización sin mover el foco y deshabilitar el botón de refresco para evitar
  solicitudes simultáneas; después del fallo, habilitar de nuevo el reintento.
- **REQ-137-012 (Carpeta sin imágenes reconocidas):** no descartar en silencio una carpeta que
  no contiene archivos identificados como imagen. Los archivos con tipo MIME vacío pueden
  procesarse mediante el lector existente; si todos los archivos seleccionados tienen un tipo
  conocido no compatible, informar el motivo y ofrecer seleccionar imágenes manualmente. El
  mensaje de error móvil debe ser breve y dejar visible la causa y ambas opciones de recuperación.
- **REQ-137-013 (Asignación manual en la mesa):** cuando un folio reconocido no tenga alumno
  asignado, explicar junto al selector y en la descripción accesible del control por qué no se
  puede vincular. Al elegir alumno manualmente, retirar el aviso de bloqueo y actualizar el
  mensaje para pedir verificar la coincidencia antes de vincular. No cambiar el folio, el alumno,
  el contrato de vinculación ni las reglas del bono.
- **REQ-137-014 (Contexto de materia antes del registro):** presentar el selector de materia y
  una explicación breve antes de los formularios de recepción. Mantener una sola fuente de estado
  para la consulta, el filtrado y la vinculación de folios.
- **REQ-137-015 (Conteos sin duplicación visual):** presentar los conteos agregados en la cabecera;
  el bloque «Estado de entregas» conserva su contexto de resultados cargados/filtrados, sus listas
  y cantidades por lista, sin repetir en otra fila los mismos KPIs.

## Criterios de Aceptación

1. Tras cambiar materia no queda activo el texto de búsqueda anterior y los folios de la
   nueva materia se muestran de acuerdo con su propia lista.
2. Las tarjetas de bitácora y resumen por lote no presentan IDs internos de alumnos;
   cuando hay identidad disponible, muestran nombre y matrícula.
3. La etiqueta del checkbox del bono es válida en el árbol DOM, nombra el control y se
   puede operar con teclado y puntero.
4. Los indicadores aclaran que describen registros cargados/filtrados y mantienen los
   cálculos existentes.
5. Pruebas focales verifican cada comportamiento nuevo, paginación, vinculación y
   ausencia de regresiones en el formulario de bono.
6. Pasan ESLint focal, typecheck frontend, guard WCAG pertinente, auditoría SDD y
   `git diff --check`; no se ejecutan suites ajenas a este flujo.
7. No se declara revisión visual runtime si no se obtienen capturas actuales y recorrido
   con datos dummy.
8. La conexión móvil empieza plegada para reducir contenido secundario en la vista larga; el
   resumen tiene nombre claro y permite revelar el contenido con teclado, sin quitarlo del
   acceso ni interferir con los controles principales de captura.
9. La guía informativa inicia plegada en móvil cuando no hay una preferencia guardada. Su control
   comunica el estado, abre/cierra con Enter y Espacio, conserva el foco y no elimina el acceso a
   los tres pasos.
10. Los dos selectores de imágenes conservan nombre y descripción accesibles, muestran el
    propósito de cada opción en móvil y exponen un indicador de foco visible al navegar con teclado.
11. La vinculación manual anuncia éxito y error en su mensaje contextual sin repetirlos en un toast; un error de sesión puede mostrar un toast distinto que ofrece la acción de renovación.
12. La severidad accesible del mensaje de vinculación se deriva del resultado de la operación, no de inferirla buscando palabras en el texto del servidor.
13. Cuando falla una actualización con filas previas, el mensaje aclara que la lista conservada
    puede no reflejar el estado actual; mientras se consulta, el estado se anuncia y el botón
    Refrescar permanece ocupado y deshabilitado.
14. A 320 CSS px, el error de carpeta sin imágenes reconocidas comunica en pocas líneas que no
    se detectaron hojas de examen e indica elegir otra carpeta o seleccionar imágenes manualmente.
14. Al seleccionar una carpeta con una imagen cuyo tipo MIME está vacío, el flujo intenta
    procesarla; si la carpeta solo contiene archivos de tipos conocidos no compatibles, presenta
    un mensaje accesible que ofrece seleccionar varias imágenes manualmente.
15. En la mesa de lote, el estado sin alumno explica que la selección habilita la vinculación; el
    selector y el botón deshabilitado exponen esa ayuda como descripción accesible. Tras elegir
    alumno, el botón se habilita y el texto ya no pide seleccionar uno; en su lugar recuerda
    verificar la coincidencia con el folio.
16. En móvil y escritorio, el selector de materia aparece antes del registro de folios, comunica
    que define la lista y las asociaciones de alumno y conserva el mismo comportamiento de cambio
    de materia, filtros y recarga.
17. El encabezado de Entrega muestra el emblema de sección una sola vez; «Entrega de exámenes»
    queda como nombre textual sin un segundo icono junto al título.
18. La cabecera conserva los conteos agregados; «Estado de entregas» no repite esos mismos
    contadores y mantiene el aviso sobre resultados visibles/cargados y las cantidades por lista.

## Matriz de Trazabilidad

| ID Requisito | Descripción del caso | Archivo de test vinculado | Estado |
| --- | --- | --- | --- |
| REQ-137-001 | Cambio de materia limpia filtro y cursor | `apps/frontend/tests/seccionEntrega.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado y validado con datos dummy |
| REQ-137-002 | Identidad legible en bitácora y mesa de lote | `apps/frontend/tests/seccionEntrega.test.tsx`; `apps/frontend/tests/seccionRegistroEntrega.test.tsx` | Bitácora: archivo focal 9/9 PASS; cubre alumno conocido, sin asignar e ID asignado no disponible sin exponer el ID. Mesa de lote permanece cubierta por su prueba previa. |
| REQ-137-003 | Asociación válida del checkbox de bono | `apps/frontend/tests/seccionRegistroEntrega.test.tsx` | Implementado; prueba focal pasa |
| REQ-137-004 | Alcance visible de conteos y porcentaje paginados | `apps/frontend/tests/seccionEntrega.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado y validado con datos dummy |
| REQ-137-005 | Preservación de contratos y flujos | `apps/frontend/tests/seccionEntrega.test.tsx`; `apps/frontend/tests/seccionRegistroEntrega.test.tsx` | Pruebas focales pasan; sin cambios a API/payloads |
| REQ-137-006 | Adaptabilidad, temas, foco y recorrido visual sintético | `tests/gui-responsive/responsive-docente.spec.ts`; `reports/qa/ux-entrega-current-focus-20261031/` | Selectores de archivo y resumen de conexión conservan foco visible; el anillo no se propaga a tarjetas ancestro; captura actual a 320 px. Runtime instalado, zoom y lector de pantalla pendientes |
| REQ-137-007 | Divulgación accesible de conexión móvil opcional | `tests/gui-responsive/responsive-docente.spec.ts`; `reports/qa/ux-entrega-20261029-current-turn/` | Implementado: inicia plegada, conserva el resumen visible y abre/cierra con Enter/Espacio; foco visible y captura clara a 320 px comprobados |
| REQ-137-008 | Divulgación de guía móvil, preferencia y foco | `apps/frontend/tests/guiaEntregaVisual.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; unit 2/2 y E2E Edge 1/1, 320/390 px, ambos temas y teclado PASS |
| REQ-137-009 | Mensajes de vinculación manual y de la mesa por lote sin duplicación; recuperación de sesión independiente | `apps/frontend/tests/seccionRegistroEntrega.test.tsx` | 6/6 PASS: éxito/error de ambos flujos permanecen en contexto; solo el error de sesión añade el toast con acción de renovación. El resumen del lote conserva su aviso propio |
| REQ-137-010 | Severidad explícita de errores de vinculación manual y por lote | `apps/frontend/tests/seccionRegistroEntrega.test.tsx` | PASS: errores de ambos recorridos se exponen como `alert`, incluidos errores sin prefijo típico |
| REQ-137-011 | Frescura de datos durante consulta/error y refresco sin duplicación | `apps/frontend/tests/seccionEntrega.test.tsx` | Implementado y validado con consulta diferida y datos dummy |
| REQ-137-012 | Procesamiento de imágenes con MIME vacío y recuperación de carpeta sin imágenes, con copy breve | `apps/frontend/tests/seccionRegistroEntrega.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: seccionRegistroEntrega 6/6; E2E Edge 1/1 verifica mensaje y reflow en 320/390 CSS px, ambos temas, con carpeta dummy. Captura clara de 320 px inspeccionada en `reports/qa/ux-entrega-audit-current-20261104/`. |
| REQ-137-013 | Motivo accesible del bloqueo de vinculación y actualización del estado tras elegir alumno | `apps/frontend/tests/seccionRegistroEntrega.test.tsx` | Implementado; prueba focal comprueba la descripción del selector y del botón, su habilitación y el retiro del mensaje obsoleto |
| REQ-137-014 | Contexto de materia visible antes del registro de folios | `apps/frontend/tests/seccionEntrega.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Prueba de componente y E2E verifican orden, ayuda accesible y selección de materia con fixtures dummy |
| REQ-137-015 | Conteos agregados sin repetición en la bitácora | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge focal 1/1 con datos ficticios, sin chips redundantes en la bitácora; cabecera, alcance y cantidades por lista se conservan. Captura revisada en `reports/qa/ux-entrega-counts-20261105/entrega-320-light-loaded.png`. |
| AC-017 | Encabezado con emblema único y nombre de sección textual | `apps/frontend/tests/seccionEntrega.test.tsx` | Verifica el nombre accesible del h2, ausencia de SVG dentro del título y permanencia del icono del orb. |

## Revalidación 2026-10-29

- `npm -C apps/frontend run test -- tests/seccionEntrega.test.tsx tests/seccionRegistroEntrega.test.tsx`: 2 archivos, 8 pruebas aprobadas.
- `GUI_RESPONSIVE_PORT=4185`, `E2E_BROWSER_CHANNEL=msedge`, `E2E_SCREENSHOT_DIR=reports/qa/ux-entrega-20261029-synthetic`; Playwright focal: 1 prueba aprobada. Datos y credenciales sintéticos.
- Las capturas documentan la vista completa; la página requiere desplazamiento vertical considerable por sus flujos de recepción/captura. No se declara inspección en la instalación local, zoom 200 %, teclado ni lector de pantalla.
- La revisión cubre los textos, estados y orden responsivo observables. No se modificaron endpoints, permisos, cálculos ni payloads.

## Notas de revisión

- 2026-10-29: implementación y verificación focal documentadas en v1.0.1. La aprobación del alcance proviene de la instrucción explícita de completar los ciclos de GUI sin solicitar confirmaciones rutinarias. Las validaciones manuales listadas siguen pendientes.

## Contexto de materia antes del registro (2026-11-03)

- Hallazgo en las capturas sintéticas a 320 CSS px: el selector de materia estaba en la bitácora,
  después de la captura QR, el registro manual y la carga por lote. La materia activa determina la
  lista de folios y la asociación detectada con alumnos, pero no era visible antes de comenzar.
- Cambio: se movió el mismo selector encima de los formularios de recepción y se asoció una ayuda
  que explica su efecto. La bitácora conserva el campo de búsqueda; la selección sigue usando el
  mismo estado, filtro, consulta, limpieza y recarga.
- E2E Edge con fixtures ficticios: 1/1 PASS a 320/390 CSS px, claro/oscuro; comprueba orden del
  selector, descripción accesible, teclado/foco, cambio de materia y limpieza de búsqueda. Capturas
  inspeccionadas en `reports/qa/ux-entrega-followup-20261103/`.
- `seccionEntrega.test.tsx` 9/9 PASS, typecheck frontend, ESLint focal, WCAG 73/73,
  `sdd:audit` y `git diff --check` PASS.
- Límite: las capturas usan el preview y datos sintéticos. El navegador lateral no permitió
  conectar la automatización (`browser.user is unavailable`); no se verificaron runtime instalado,
  zoom manual al 200 % ni lector de pantalla.

## Conexión móvil opcional en pantalla estrecha (2026-10-29)

- Hallazgo en captura actual a 320 CSS px: el panel QR secundario añadía explicación, estado de conexión y host manual antes de captura digital y manual; el flujo de recepción quedaba muy extenso antes de llegar a acciones y listas.
- Cambio: el acceso móvil ahora es un `<details>/<summary>` nativo inicialmente plegado, rotulado como opcional y con una descripción breve. QR, enlace manual, diagnóstico y host permanecen al expandir; el foco de teclado conserva un contorno visible.
- E2E focal en Edge, con datos ficticios: `GUI_RESPONSIVE_PORT=4190 E2E_BROWSER_CHANNEL=msedge E2E_SCREENSHOT_DIR=reports/qa/ux-entrega-20261029-current-turn npm run test:gui:responsive:e2e:docente -- --grep "audita Entrega con datos sintéticos y reinicia la búsqueda al cambiar materia"` → 1/1 PASS. Enter abre y Espacio cierra el disclosure sin afectar el cambio de materia ni la búsqueda.
- Compatibilidad focal: `npm run test -- tests/seccionEntrega.test.tsx tests/seccionRegistroEntrega.test.tsx` → 2 archivos, 8/8 PASS; ESLint focal PASS; auditoría de contraste 59/59 PASS; `sdd:audit` PASS; `git diff --check` PASS.
- Capturas actuales a 320 CSS px, en `reports/qa/ux-entrega-20261029-current-turn/`: conexión abierta y vista compacta cerrada. La captura completa bajó de 5 499 a 4 900 px de alto (599 px menos); las acciones y registros siguen visibles al desplazarse.
- Para auditar solo controles visibles, el helper de fixtures ignora descendientes ocultos de `details` cerrados y conserva el `summary`. Límite: no se verificó en instalación local, zoom 200 % ni lector de pantalla.

## Resumen de entregas sin conteo duplicado (2026-10-29)

- Hallazgo en capturas móviles actuales: el total filtrado aparecía dos veces en la misma cabecera, como «N exámenes» y en el KPI «En lista». Ambos leían `resumenEntrega.total`, por lo que no aportaban contextos distintos.
- Cambio: se retiró la etiqueta redundante; se conserva el KPI «En lista» con su ayuda sobre filtros y paginación, y los conteos locales del bloque «Estado de entregas».
- Prueba de regresión añadida a `apps/frontend/tests/seccionEntrega.test.tsx`: exige que el KPI permanezca y el duplicado desaparezca.
- No cambia cálculo, permisos, requests, paginación ni registros.

## Entrega · resumen móvil sin chips repetidos (2026-11-05)

- Hallazgo visual: a 320 CSS px se repetían los conteos de En lista, Entregados y Pendientes en la cabecera y otra vez sobre la bitácora; las listas ya vuelven a mostrar sus cantidades.
- Cambio: se retiró la fila de tres chips duplicados. La cabecera mantiene el resumen, el aviso explica resultados visibles/cargados y el posible resto paginado, y cada lista conserva su cantidad.
- Validación PASS: E2E Edge focal 1/1 en `GUI_RESPONSIVE_PORT=4177`, 320 CSS px y datos ficticios; comprueba ausencia de chips repetidos, conteos agregados, contexto de registros cargados/filtrados y cantidades por lista. Captura inspeccionada en `reports/qa/ux-entrega-counts-20261105/entrega-320-light-loaded.png`.
- Contratos y cálculos: sin cambios.

## Reflow progresivo de la ayuda en móvil (2026-10-30)

- Hallazgo visual en captura sintética: la vista Entrega llegaba a 4 867 CSS px de altura a
  320 px; la guía de tres pasos estaba abierta antes de captura, búsqueda y listas. La guía es
  apoyo contextual y no debe desplazar la tarea principal cuando el ancho es reducido.
- Cambio aprobado por la petición general de mejorar la usabilidad de toda la GUI: la guía
  inicia plegada hasta 767 CSS px si no hay preferencia guardada, mantiene la preferencia
  explícita y ofrece un único disclosure con estado y destino accesibles. En escritorio continúa
  abierta inicialmente.
- Validación: `guiaEntregaVisual.test.tsx` (2/2 PASS); E2E Edge de Entrega (1/1 PASS) a
  320/390 CSS px, ambos temas, apertura con Enter, cierre con Espacio y foco retenido. El fixture
  se redujo de 4 867 a 3 850 CSS px de altura (−1 017 px, 20.9 %); es una medida de página
  sintética, no de resultados con participantes. Capturas en
  `reports/qa/ux-entrega-20261030-guide/`.
- Build docente, lint frontend y guard WCAG 59/59 PASS; auditoría SDD y `git diff --check` PASS.
- No se altera el flujo de recepción, captura, QR, paginación, cálculos, permisos ni API.
- Runtime instalado, zoom manual al 200 % y lector de pantalla siguen pendientes.

## Selectores de imagen legibles y foco visible (2026-10-31)

- Hallazgo en capturas claras/oscuras de 320/390 px: el control nativo mostraba su botón junto al estado de selección en un ancho insuficiente; el texto localizado «ningún archivo seleccionado» aparecía truncado.
- Cambio: se ocultó solo la representación visual nativa, manteniendo los inputs `file` accesibles y vinculados a sus tarjetas. Las tarjetas muestran acciones e instrucciones estables; `:focus-within` aplica un contorno de 3 px con el color primario del tema. No cambian selección, procesamiento por lote, rutas ni datos.
- WCAG: contra superficies de tema representativas, ayuda `--textoSuave` tiene 13.61:1 en claro (#1e293b sobre #f4f7fa) y 15.54:1 en oscuro (#e2e8f0 sobre #060e24). El indicador primario de foco tiene 4.12:1 en claro (#0f8b8d sobre blanco) y 6.91:1 en oscuro (#0ea5e9 sobre #060e24).
- Regresión cubierta: el E2E verifica nombre, descripción, límites del texto dentro de tarjeta y color del foco en ambos temas; la prueba de captura por lote conserva la selección de archivos.
- W3C: se conserva el nombre accesible del control y su instrucción con `aria-label`/`aria-describedby`; se mantiene visible el foco del teclado con suficiente contraste contra superficies adyacentes.
- Límite: pruebas y capturas son preview con datos sintéticos; no validan selector nativo en teléfonos físicos, lector de pantalla ni instalación local.

## Revalidación estática y de componentes (2026-10-31)

- Contraste del código actual: al cambiar materia se limpia el filtro y la página cargada;
  las listas describen resultados visibles frente a registros cargados y advierten cuando
  hay más páginas. Los fallbacks de alumno muestran nombre/matrícula o «Alumno no disponible»,
  sin presentar el ID interno. El bono usa una etiqueta separada y válida; los selectores de
  imágenes conservan nombre, ayuda y foco en tarjeta.
- Validación focal: `npm -C apps/frontend test -- tests/seccionEntrega.test.tsx
  tests/seccionRegistroEntrega.test.tsx tests/guiaEntregaVisual.test.tsx --reporter=dot`
  → 3 archivos, 10/10 PASS. No hubo cambios de código en esta revalidación.
- No se obtuvieron capturas actuales: el navegador lateral permite ver el tab de EvaluaPro,
  pero el acceso de automatización falla con `browser.user is unavailable`. No se presenta
  como evidencia visual nueva. Runtime instalado, zoom 200 % y lector de pantalla pendientes.

## Mensajes de vinculación manual (2026-10-31)

- Hallazgo estático: el éxito y el error de vinculación aparecían en el mensaje contextual y en un toast con el mismo contenido. Además, el formulario infería la severidad mirando el texto; un error sin prefijo común podía exponerse como éxito.
- Cambio: el mensaje accesible del formulario es el anuncio principal; un toast solo acompaña errores de sesión con una acción distinta para renovar el acceso. La severidad ahora procede de un estado explícito de la operación. Las notificaciones del escaneo QR y del resumen por lotes, que no tienen equivalente contextual, se conservan.
- Validación focal: `apps/frontend/tests/seccionRegistroEntrega.test.tsx` 3/3 PASS; ESLint focal PASS; build docente, bundle guard y WCAG 61/61 PASS; auditoría SDD y diff-check PASS.
- Límites: no cambia rutas, permisos, datos ni payloads; runtime instalado, zoom 200 % y lector de pantalla siguen pendientes.

## Foco de teclado localizado (2026-10-31)

- Hallazgo en la captura sintética de Entrega a 320 CSS px: al enfocar el resumen de
  conexión móvil aparecían contornos simultáneos en varias tarjetas/paneles contenedores.
- Cambio: el sistema compartido ya no propaga `:focus-within` a todas las superficies de
  Docente/Alumno; el `<summary>` conserva su anillo y la tarjeta de archivos conserva su
  wrapper específico. El estilo previo de Administración se mantiene.
- Fundamento: WCAG 2.2 SC 2.4.7 exige foco visible para identificar el control activo; W3C
  explica que el indicador debe facilitar distinguir dónde se operará con teclado. Fuentes:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html y
  https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html.
- E2E sintético con datos ficticios en Edge: 1/1 PASS (revalidado el 2026-10-31); verifica contorno del `<summary>`,
  ausencia del contorno en el panel ancestro, apertura con Enter, cierre con Espacio y
  cambio de materia. Guard WCAG 65/65, ESLint focal, typecheck y `sdd:audit` PASS.
- La regresión compartida se comprobó también en Portal Alumno: 8/8 E2E PASS a 320/360/390 CSS px y escritorio/tablet; capturas de la comparación en `reports/qa/ux-entrega-current-focus-20261031/alumno-regression/`.
- Capturas de los pasos de conexión plegada/abierta y notas: `reports/qa/ux-entrega-current-focus-20261031/`.
- No valida runtime instalado, zoom 200 %, lector de pantalla ni conexión física por red local.

## Frescura y reintento de la bitácora (2026-11-02)

- Hallazgo estático: al fallar «Refrescar» o cargar otra página, el error aparecía junto a filas anteriores sin aclarar que procedían de la última consulta exitosa. Además, el botón Refrescar aceptaba nuevas solicitudes mientras había una petición en curso.
- Cambio: la consulta anuncia cuando conserva resultados durante la actualización; el error indica que la lista visible puede estar desactualizada, y el botón Refrescar expone estado ocupado y se deshabilita durante la petición.
- Contrato: se conservan filas, filtros, paginación, búsqueda, cálculos y rutas; no cambian permisos ni mutaciones.
- Validación focal: `seccionEntrega.test.tsx` usa una consulta diferida y datos dummy para comprobar el anuncio, el bloqueo de una segunda solicitud y la retención contextualizada de resultados al fallar el refresco.

## Recuperación del selector de carpeta (2026-11-03)

- Hallazgo estático: la selección de carpeta filtraba por `File.type` y descartaba silenciosamente todos los archivos cuando el navegador devolvía MIME vacío, incluso si los nombres tenían extensiones de imagen. Tampoco explicaba el caso de carpeta sin imágenes reconocidas.
- Cambio: se pasan los archivos con MIME vacío al lector de imagen existente; cuando hay archivos seleccionados pero ninguno tiene tipo compatible, se muestra un mensaje `status` con dos opciones de recuperación: elegir una carpeta con hojas o seleccionar imágenes manualmente.
- Validación focal: `npm run test -- tests/seccionRegistroEntrega.test.tsx` → 4/4 PASS; ESLint focal y typecheck frontend PASS; `npm run sdd:audit` y `git diff --check` PASS.
- Límite: no altera datos, permisos, API ni payloads; no valida las variantes de MIME que devuelvan otros navegadores.

## Ayuda accesible al asignar alumno en la mesa de lote (2026-11-03)

- Hallazgo estático: si QR/OCR reconocía el folio pero no asignaba alumno, el botón de vinculación quedaba deshabilitado y el mensaje «Selecciona alumno manualmente» no estaba asociado al selector ni al botón. Después de elegir alumno, ese mismo texto permanecía visible y contradecía el estado del formulario.
- Cambio: el estado explica que elegir un alumno habilita «Vincular y continuar»; selector y botón exponen la explicación como descripción. Al seleccionar una persona, el estado cambia a una indicación para verificar la coincidencia con el folio.
- Validación focal: `seccionRegistroEntrega.test.tsx` verifica bloqueo y descripciones accesibles antes de elegir, habilitación y texto actualizado después.
- Contratos: no cambia detección QR/OCR, asignación, folio, payload, vinculación ni cálculo del bono.

## Fallback de identidad en bitácora (2026-11-03)

- Hallazgo: la bitácora usaba «Sin alumno» tanto cuando el examen no tenía `alumnoId` como cuando sí tenía un ID asignado que no estaba en el catálogo cargado.
- Cambio: una asignación ausente se muestra como «Sin alumno asignado»; un ID asignado sin coincidencia en el padrón se muestra como «Alumno no disponible». El ID interno no se representa.
- Validación focal: `seccionEntrega.test.tsx` cubre las listas de entregados y pendientes, los dos estados de identidad y que el ID interno no aparezca.
- Contrato: sin cambios a payload, vínculo, búsqueda, permiso o persistencia.
