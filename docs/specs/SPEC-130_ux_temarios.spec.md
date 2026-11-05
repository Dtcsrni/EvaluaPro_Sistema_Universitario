---
id: SPEC-130
titulo: UX de Temarios
version: 1.0.18
fecha: 2026-11-05
autor: Codex / EvaluaPro Team
modulo: modulo_temarios
estado: approved
---

## Contexto

La pantalla de Temarios combina selección de periodo, consulta y seguimiento de programas, importación PDF, captura manual y cambios de estado por nodo. La revisión estática de `SeccionTemarios.tsx` identificó estados de error silenciosos, métricas mostradas sin contexto suficiente, controles simulados sin semántica accesible completa y formularios que dependían de placeholders. Las capturas actuales del árbol y la carga PDF se obtuvieron en un preview aislado con APIs y archivos ficticios; no equivalen a verificar el runtime instalado ni tecnologías de asistencia, que siguen pendientes.

Personas beneficiadas: docentes que cargan o actualizan el temario y registran el avance durante el curso, también con teclado, lector de pantalla, zoom y pantallas estrechas.

La implementación conservará contratos HTTP, permisos, cálculos y reglas de persistencia de `SPEC-040` y `SPEC-070`. No cambiará la secuencia de estados ni las reglas de auditoría del dominio.

## Requisitos Funcionales

- **REQ-130-001 (Contexto y estados de consulta):** Indicar con precisión periodo/materia seleccionado. Diferenciar espera, lista vacía, error y éxito; al cambiar periodo no presentar como actuales datos previos. Los errores de lectura y actualización deben comunicar qué falló y permitir reintentar sin perder el contexto.
- **REQ-130-002 (Métricas comprensibles):** No presentar ceros como resultado definitivo antes de seleccionar y cargar un periodo. Explicar el alcance de cada indicador; “temas cubiertos” debe identificarse como conteo del temario abierto si su fuente sigue siendo el árbol actual. Mantener los cálculos existentes.
- **REQ-130-003 (Navegación):** Las vistas Lista, Cargar y Árbol tendrán semántica accesible de pestañas, estado seleccionado, panel asociado y navegación por teclado según el patrón WAI-ARIA APG. Mantener nombres que distingan claramente la acción y la materia/temario activo.
- **REQ-130-004 (Lista y árbol):** Las tarjetas y nodos interactivos serán controles semánticos operables con teclado. El estado de cada nodo (Pendiente, En progreso o Cubierto) y la acción para cambiarlo se expondrán como texto/nombre accesible, no solo mediante color o emoji. Los indicadores porcentuales tendrán valor y nombre accesibles.
- **REQ-130-005 (Formularios y PDF):** Nombre, contenido y motivo tendrán etiquetas visibles asociadas, instrucciones y errores vinculados al campo. La carga PDF y la captura manual serán formularios semánticos que se puedan enviar con Enter; `noValidate` conservará la validación existente. El selector PDF será identificable y operable sin arrastrar; se informarán archivo seleccionado, progreso, éxito y error. Los mensajes conservarán información accionable y una vía de recuperación, presentados una sola vez junto al flujo que los produjo.
- **REQ-130-005A (Detección de archivo PDF):** El selector no rechazará un nombre con extensión `.pdf` únicamente porque `File.type` esté vacío o el navegador reporte otro MIME. Si el tipo no es `application/pdf`, pero el nombre termina en `.pdf`, la carga multipart conservará bytes y nombre y declarará el MIME esperado por el contrato. La extensión no se considerará prueba del contenido: el parser PDF existente del servidor seguirá validando el contenido y solo guardará un temario cuando extraiga estructura válida.
- **REQ-130-005B (Selector PDF legible):** La acción para seleccionar/cambiar PDF se mostrará como control de botón accesible, operable por teclado y asociada con instrucciones y estado. El estado vacío y el nombre completo del archivo seleccionado se mostrarán sin depender del texto nativo recortable del navegador; nombre y tamaño coincidirán en todas las representaciones visibles.
- **REQ-130-006 (Claridad visual y responsive):** Reducir redundancia y tecnicismos en la guía, títulos, textos de ayuda, vacíos y acciones; el encabezado de sección no repetirá junto al nombre el icono que ya aparece en el emblema principal. Priorizar la selección de periodo, la tarea principal y el avance. Reutilizar tokens semánticos existentes. Verificar tema claro/oscuro, foco, contraste, movimiento reducido, reflow a 320/360 px y zoom al 200 %, evitando pérdida de contenido o acciones.
- **REQ-130-006A (Límite accesible de la zona de carga):** El área de arrastre PDF usa el token semántico de advertencia para su límite y el lienzo de tema para el fondo, con contraste no textual mínimo 3:1 en claro y oscuro, también al arrastrar.
- **REQ-130-006B (Selección de materia sin recorte móvil):** La tarjeta de selección rápida del estado vacío debe adaptarse al ancho disponible hasta 320 CSS px, sin desbordamiento ni texto fragmentado carácter por carácter.

## Criterios de Aceptación

1. Antes de elegir periodo, la pantalla explica el siguiente paso y no muestra métricas de cero como si fueran datos cargados.
2. Cambiar de periodo limpia o marca como obsoletos los datos previos mientras carga; error, vacío y éxito se distinguen y los errores permiten recuperación.
3. Las métricas muestran un alcance inequívoco y coinciden con el conjunto de datos que describen; sus cálculos de dominio no cambian.
4. Las pestañas y sus paneles siguen el patrón de teclado y roles del WAI-ARIA APG; foco, panel activo y estado seleccionado son perceptibles y anunciables.
5. Lista, nodos y selector PDF son operables con teclado; los nodos anuncian texto y estado actuales y mantienen la secuencia de transición vigente.
6. Todos los campos tienen etiqueta asociada; validación y mensajes de estado indican problema y acción de recuperación sin depender solo de toast/color.
7. No se alteran rutas, payloads, permisos, cálculos de avance, versionado, confirmaciones ni auditoría de los contratos de Temarios.
8. Se verifican ambos temas, estados interactivos, teclado, zoom, reflow, movimiento reducido y contraste conforme a `docs/WCAG_UI_POLICY.md`; la revisión visual usa capturas actuales de la pantalla.
9. Un archivo `.pdf` dummy con MIME vacío puede seleccionarse y llegar al parser con su nombre/bytes; un archivo que no tenga MIME PDF ni extensión `.pdf` se sigue rechazando. Ningún archivo crea datos si el parser no logra extraer temas válidos.
10. A 320/390 CSS px, el disparador PDF queda dentro de su campo con objetivo táctil de al menos 44 CSS px; el estado vacío y el nombre completo seleccionado se muestran sin recorte, con tamaño coherente entre la ficha y el anuncio.
11. El encabezado muestra el emblema principal una vez y el nombre «Temarios» como texto, sin repetir otro icono junto al título.
12. El límite de la zona de carga PDF mantiene contraste no textual de al menos 3:1 frente a su fondo en temas claro y oscuro, incluidos los estados hover/arrastre.
13. A 320 CSS px, la tarjeta de selección rápida de materia queda íntegra dentro de Temarios y el nombre/grupos mantienen cortes por palabra legibles.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-130-001 / AC-001, AC-002 | Carga por periodo, estados loading/empty/error/success, cambio de periodo y reintento | `apps/frontend/tests/seccionTemarios.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado en código; 13/13 pruebas focales pasan. E2E sintético captura lista, árbol y carga PDF con fixture dummy a 320 CSS px; runtime instalado pendiente |
| REQ-130-002 / AC-003 | Contexto y alcance de métricas, sin alterar cálculos | `apps/frontend/tests/seccionTemarios.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Métricas sin periodo muestran “—” y “Cubiertos” indica el temario abierto; lista y árbol actuales capturados con métricas de fixture dummy |
| REQ-130-003 / AC-004 | Roles, selección y teclado de pestañas | `apps/frontend/tests/seccionTemarios.test.tsx` | Implementado: cada referencia `aria-controls` resuelve a un panel etiquetado, incluido el panel inactivo; flechas/Home/End cubiertos. Prueba focal 12/12 |
| REQ-130-004 / AC-005 | Teclado, estado accesible de tarjetas/nodos y valor de progreso | `apps/frontend/tests/seccionTemarios.test.tsx` | Implementado: botones nativos exponen estado en texto; iconos usan el catálogo Lucide sin emoji, y el valor de progreso es accesible |
| REQ-130-005 / AC-006 | Etiquetas, validación y recuperación para carga manual/PDF | `apps/frontend/tests/seccionTemarios.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Campos etiquetados, alertas locales sin toast duplicado y selección segura de archivo cubiertos; captura 320 px incluye formulario PDF y nombre del archivo dummy seleccionado. Envío remoto con runtime real no se ejecuta |
| REQ-130-006 / AC-008 | Layout, tokens y estados visuales accesibles | `apps/frontend/tests/ux.visual.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | E2E sintético con capturas claro/oscuro de árbol y carga a 320 px pasa sin desbordamiento horizontal; se comprueba ancho legible del título y que “Cubierto” no tache el contenido. La guía se pliega en móvil y conserva el foco al abrir/cerrar. Movimiento reducido verificado en Edge; zoom, lector de pantalla y runtime instalado pendientes |
| REQ-130-005A / AC-009 | Respaldo por extensión cuando falta MIME, preservando parser servidor | `apps/frontend/tests/seccionTemarios.test.tsx`; `apps/backend/tests/integracion/temario.pdf.test.ts` | PASS: prueba focal verifica selección y envío con nombre, MIME y bytes; la suite de Temarios pasa 18/18 y la integración PDF 6/6. Se conserva el rechazo de `.txt`; el parser de servidor rechaza contenido PDF inválido. El procesamiento de un PDF real válido queda pendiente |
| REQ-130-005B / AC-010 | Disparador y estado del archivo PDF sin recorte nativo | `apps/frontend/tests/seccionTemarios.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: prueba de componente y E2E Edge sintético confirman estado vacío, activación del input nativo, nombre completo, tamaño coherente y límites del botón a 320/390 CSS px; capturas claro/oscuro a 320 px en `reports/qa/ux-audit-temarios-current-20261104/`. |
| REQ-130-006 / AC-011 | Jerarquía sin icono duplicado junto al título de sección | `apps/frontend/tests/seccionTemarios.test.tsx` | El título conserva el nombre accesible «Temarios» y el emblema del encabezado permanece como su único icono. |
| REQ-130-006A / AC-012 | Contraste del límite de carga PDF en claro/oscuro y hover/arrastre | `tests/gui-responsive/responsive-docente.spec.ts`; `scripts/tests/ui-contrast-audit.mjs` | PASS: E2E Edge focal 1/1 verifica `--ui-accent-warning` en ambos temas, hover y arrastre; auditoría 102/102 pares WCAG. Capturas revisadas en `reports/qa/ux-temarios-upload-contrast-20261105/`. |
| REQ-130-006B / AC-013 | Tarjeta de selección rápida y texto legibles a 320 CSS px | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge focal 1/1 confirma que la tarjeta queda dentro del panel y la captura actual muestra el nombre/grupo legibles, sin recorte horizontal. |

## Movimiento reducido (2026-11-05)

- **Hallazgo estático:** Temarios usa animaciones compartidas de pulso, aparición, desplazamiento, brillo y hover; las reglas `prefers-reduced-motion` existentes no las cubrían dentro de esta sección.
- **Cambio:** cuando el sistema solicita movimiento reducido, se desactivan animaciones, transiciones y desplazamiento suave dentro de `.temarios-panel`; en la preferencia habitual el diseño no cambia.
- **Fundamento:** WCAG 2.2 SC 2.3.3 (AAA) indica que la animación no esencial activada por interacción debe poder desactivarse y reconoce `prefers-reduced-motion` como técnica suficiente ([W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)); la media query transmite la preferencia del sistema al CSS ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)).
- **Validación focal ejecutada:** PowerShell: `$env:GUI_RESPONSIVE_PORT='4175'; $env:E2E_BROWSER_CHANNEL='msedge'; npm run test:gui:responsive:e2e:docente -- --grep "Temarios muestra el contexto real del periodo en móvil con datos sintéticos"` → 1/1 PASS; la aserción emula `reducedMotion: reduce` y confirma que no queden animaciones ni transiciones activas dentro de la sección. `npx eslint tests/gui-responsive/responsive-docente.spec.ts` y `git diff --check` PASS.
- **Límite:** el E2E usa API, periodo, temario y archivo ficticios. No valida runtime instalado ni reemplaza la revisión con tecnologías de asistencia.

## Revalidación focal de iconografía (2026-10-28)

- La sección y su guía sustituyen emoji, caracteres usados como iconos y SVG dibujados localmente por componentes del catálogo Lucide compartido. El texto visible conserva el nombre y estado de cada acción/nodo; “syllabus” se reemplaza por “programa”. No cambian cálculos, rutas, payloads ni permisos.
- `npm -C apps/frontend test -- tests/seccionTemarios.test.tsx`: 10/10 PASS; ESLint focal y build docente temporal PASS; `guard:wcag -- --skip-lint`: 33/33 pares PASS.
- La captura y verificación visual manual siguen pendientes; la mejora no acredita por sí sola contraste de iconos, distribución ni foco en runtime.

## Revalidación focal de recuperación al abrir (2026-10-28)

- Si falla la carga de nodos desde la lista, el mensaje de error y el botón de reintento se presentan ahora junto al contexto que inició la acción. La prueba confirma que el reintento abre el temario y muestra su nodo.
- `npm -C apps/frontend test -- tests/seccionTemarios.test.tsx`: 11/11 PASS; ESLint focal y typecheck PASS. Captura visual actual pendiente.

## Revalidación focal de asociaciones de pestañas (2026-10-28)

- Hallazgo: solo se montaba el panel activo, aunque cada pestaña apuntaba a un ID de panel propio. Las asociaciones de las pestañas inactivas quedaban sin destino en el DOM.
- Cambio: se conservan paneles asociados etiquetados para las vistas inactivas mediante `hidden`; el panel activo sigue siendo el único visible y el estado/navegación no cambian.
- Validación: prueba focal 12/12 PASS; ESLint focal, typecheck, build docente aislado y verificador de bundle, `guard:wcag -- --skip-lint` (39/39 pares), auditoría SDD y `git diff --check` PASS. El caso comprueba referencias y etiquetas antes y después de abrir el árbol y volver a la lista.
- Límite: no se hizo recorrido visual/lector de pantalla; la comprobación del patrón en navegador continúa pendiente.

## Referencias

### Revalidación del guard WCAG (2026-10-31)

- Se reejecutó `npm run guard:wcag -- --skip-lint` sobre el estado actual: el guard terminó `OK`, con 65/65 pares de contraste y sin colores CSS nuevos sin comentario WCAG AA cercano.
- La nota anterior del registro de cobertura que señalaba una falla en `screens.css:6445–6517` no describe el estado actual; no se modificó CSS en esta revalidación.
- Esto valida el guard automático y los pares registrados; no cubre captura visual actual, zoom 200 %, lector de pantalla ni runtime instalado, pendientes según AC-008.

### Selección PDF con MIME indeterminado (2026-10-31)

- Hallazgo estático: `manejarArchivo()` solo aceptaba `File.type === 'application/pdf'`. La especificación W3C File API permite devolver el string vacío cuando el agente de usuario no puede determinar el MIME de un archivo local, por lo que un PDF con `.pdf` podía rechazarse antes del upload.
- Cambio aplicado: aceptar `application/pdf` o extensión `.pdf`; para el fallback de extensión, mantener los bytes/nombre y declarar `application/pdf` en FormData. El endpoint continúa enviando el contenido a `extraerTextoPdf()` y no crea el temario hasta obtener nodos válidos.
- Fuente primaria: W3C, [File API](https://www.w3.org/TR/FileAPI/), §3.2: `Blob.type` puede ser cadena vacía cuando no se determina el tipo.
- Validación ejecutada: `npm run test -- tests/seccionTemarios.test.tsx` (18/18 PASS), incluyendo MIME vacío, conservación de nombre/bytes y rechazo de `.txt`; `npm run test -- tests/integracion/temario.pdf.test.ts` (6/6 PASS), incluyendo rechazo del contenido PDF inválido; ESLint focal y typecheck frontend PASS. El procesamiento de un PDF real válido aún no se ha verificado.

### Revalidación focal del estado de periodo (2026-10-29)

- Hallazgo: el indicador superior afirmaba “Estructura Curricular Activa” y animaba un punto aun sin materia, durante la consulta y cuando fallaba; el texto contradecía el selector y los estados de la vista.
- Cambio: el indicador ahora anuncia “Elige una materia”, “Cargando temarios”, “No se pudo consultar” o “Periodo actualizado”, según el estado real, con `role="status"`. Su apariencia usa los tokens de chip claro/oscuro y el punto ya no pulsa continuamente.
- Hallazgo E2E a 320 px: el encabezado conservaba `min-width: 280px`, recortando el indicador; además las tarjetas de temario fijaban `minmax(320px, 1fr)` y se salían 95 px del panel. La guía también comprimía las muestras de texto.
- Cambio: se adapta el encabezado, las tarjetas y las muestras de guía a una columna con ancho disponible hasta 480 px; la rejilla conserva 320 px como mínimo cuando el espacio lo permite.
- Validación: `npm -C apps/frontend run test -- tests/seccionTemarios.test.tsx` (12/12); E2E sintético enfocado `Temarios muestra el contexto real del periodo en móvil con datos sintéticos` (1/1) en Edge, 320 px, sin sesión ni datos reales; capturas en `reports/qa/ux-temarios-20261029-synthetic/`. El recorrido comprueba estado inicial/lista cargada, ajuste del indicador y ausencia de overflow del panel; capturó claro y oscuro.
- Límite: esta evidencia sintética no sustituye la revisión manual de árbol real, PDF, teclado, zoom y lector de pantalla en el runtime instalado.

### Revalidación focal de prioridad móvil (2026-10-29)

- Hallazgo visual: a 320 CSS px el selector principal aparecía después de cuatro métricas; la tarea central quedaba debajo de una sección informativa extensa.
- Cambio: la cabecera usa áreas de grid para poner el selector después del título en móvil y antes de las métricas y la guía; las cuatro métricas pasan a una cuadrícula de dos columnas. En escritorio se mantienen título y métricas en la primera fila, con selector debajo.
- Validación: `tests/seccionTemarios.test.tsx` (12/12 PASS); Playwright focal con Edge instalado y datos sintéticos (1/1 PASS). El recorrido comprueba el selector antes de métricas y guía a 320 px, ausencia de overflow, y disposición de cabecera/selectores a 1024 px. ESLint focal y `git diff --check` PASS. Capturas claro/oscuro inspeccionadas en `reports/qa/ux-temarios-20261029-synthetic/temarios-320-{light,dark}.png`.
- Límite: no acredita el runtime instalado, zoom 200 %, revisión manual de teclado, importación PDF, árbol con datos dummy ni lector de pantalla.

### Captura visual focal (2026-10-28)

- `recorre pantallas operativas`: 4/4 PASS a 1920 × 1080, 1024 × 768, 768 × 1024 y
  390 × 844 CSS px. La captura confirma reflow de la vista inicial sin materia y métricas
  en estado “—”; no incluye importación ni árbol de nodos.

### Aislamiento de errores de carga (2026-10-29)

- Hallazgo estático: un único estado de error alimentaba las tarjetas de PDF y carga manual, por
  lo que un fallo se repetía en ambas como `alert`; también podía persistir al pasar de una tarea
  a otra.
- Cambio: errores de PDF, captura manual y actualización de nodo ahora tienen estados separados;
  cada tarea limpia o muestra su propio error, y al abrir otro árbol se descarta el error previo
  de nodo. PDF y captura manual usan formularios semánticos con nombre accesible y envío con
  Enter; `noValidate` conserva las validaciones existentes y una guarda evita doble envío.
  No cambian validación de dominio, endpoints ni payloads.
- Validación focal: `tests/seccionTemarios.test.tsx` 13/13 PASS, incluidas pruebas que comprueban
  envío con Enter en ambos formularios y una sola alerta en la tarea que falló; `build:docente`
  PASS (TypeScript, ESLint, bundle guard, WCAG 54/54). Captura actual de importación, árbol con
  datos ficticios y verificación manual de tecnología asistiva siguen pendientes.
- Evidencia y límites: `reports/qa/ux-wave1/docente-asistencias-temarios-classroom-visual-audit-20261028.md`.
- Permanecen pendientes el tema claro/oscuro controlado, 320 px, zoom al 200 %, foco y
  teclado manual, lector de pantalla y verificación del árbol con datos dummy.

### Prioridad móvil de la guía rápida (2026-10-29)

- Hallazgo visual actual a 320 CSS px: la guía de tres pasos ocupaba gran parte de la página
  antes de la lista de temarios, aunque la tarea principal es elegir una materia y abrir un temario.
- En viewports de hasta 767 CSS px la guía inicia plegada si no existe preferencia guardada;
  conserva la elección explícita del docente. Un solo botón de disclosure mantiene el foco al
  abrir/cerrar, anuncia `aria-expanded` y controla el panel real con `aria-controls`.
- Validación: E2E sintético Edge 1/1 con datos ficticios; a 320 px se prueba apertura/cierre por
  Enter/Espacio, nombre accesible, estado del control y foco estable. Las capturas claro/oscuro
  comprueban que el selector precede a métricas y guía; al recargar a 1024 px la guía aparece
  expandida por defecto. `tests/seccionTemarios.test.tsx` 13/13 PASS y ESLint focal PASS.
- Captura full-page de lista a 320 px: altura de 2915 px antes y 1794 px después (1121 px menos,
  aproximadamente 38 %). Evidencia: `reports/qa/ux-temarios-20261029-mobile-guide-clean/`.
- El cambio sigue la recomendación de [NN/g sobre priorizar contenido esencial en móvil](https://www.nngroup.com/articles/defer-secondary-content-for-mobile/)
  y el patrón [WAI-ARIA APG Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
- Límite: la evidencia usa preview y APIs interceptadas; lector de pantalla, zoom real 200 %,
  runtime instalado e importación/árbol con datos persistentes siguen pendientes.

### Revalidación visual del árbol y la carga PDF (2026-10-29)

- El recorrido focal con datos dummy descubrió 128 px de desbordamiento horizontal al seleccionar
  archivo PDF: la cuadrícula retenía una columna mínima de 360 px y los controles de formulario no
  podían encogerse. La pestaña del árbol también excedía el ancho disponible y los títulos de nodo
  se comprimían en flex.
- Cambio: el layout móvil usa columnas con ancho mínimo cero, distribuye las pestañas en dos columnas,
  permite que formularios y nombres de archivo hagan wrap, y presenta los nodos como cuadrícula con
  una columna de texto flexible. Se ajustó la sangría móvil. Se quitó el tachado de nodos cubiertos:
  el mismo estado permanece visible mediante etiqueta textual e indicador, sin cruzar el título.
- Validación: E2E focal Playwright 1/1 PASS en Edge instalado con viewport 320 CSS px; usa rutas API
  interceptadas y un PDF sintético. Comprueba selector, apertura de árbol, texto de nodo legible,
  etiqueta de estado sin tachado y ausencia de overflow mayor a 1 px; captura árbol claro/oscuro,
  formulario PDF y archivo dummy seleccionado. La prueba de componente pasa 13/13; ESLint focal,
  `npm run guard:wcag -- --skip-lint` (59/59 pares), `npm run build:docente` (exit 0) y
  `npm run sdd:audit` también pasan. Evidencia: `reports/qa/ux-temarios-20261029-tree-pdf-audit/`.
- Límite: la captura no prueba parsing PDF real, persistencia, instalación local, zoom al 200 % ni
  lector de pantalla.

- WAI-ARIA Authoring Practices Guide, [Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
- WAI-ARIA Authoring Practices Guide, [Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
- Nielsen Norman Group, [Defer Secondary Content When Writing for Mobile Users](https://www.nngroup.com/articles/defer-secondary-content-for-mobile/).
- W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/), criterios 1.4.3, 1.4.11, 2.4.7, 2.5.8, 3.3.1, 3.3.2 y 4.1.3.
- Contrato de dominio vigente: `docs/specs/SPEC-040_temarios_encuadre_firmas.spec.md` y `docs/specs/SPEC-070_api_first_automatizacion_docente.spec.md`.

### Revalidación visual móvil actual (2026-10-29)

- Playwright Edge `Temarios muestra el contexto real del periodo en móvil con datos
  sintéticos`: 1/1 PASS a 320 × 800 CSS px. Recorre estado inicial, selección de periodo,
  lista, árbol de contenidos, estados de nodos y archivo PDF ficticio; comprueba reflow y
  capturas en temas claro/oscuro.
- Captura actual del árbol en claro inspeccionada en
  `reports/qa/ux-temarios-20261029-continue/temarios-320-arbol-dummy-light.png`.
- Límite: preview y APIs interceptadas; runtime canónico no disponible. Zoom real, lector de
  pantalla, importación PDF real y guardado persistente siguen pendientes.

### Reflow de campos de nombre en carga de temarios (2026-10-29)

- Hallazgo visual: a 320 CSS px, los controles de «Nombre del temario» se componían como una fila
  dentro de una caja de entrada con icono; la etiqueta y el campo competían por el ancho y el área
  de escritura se reducía a unas pocas decenas de píxeles.
- Cambio: los formularios PDF y manual ahora presentan etiqueta visible sobre campo de ancho completo,
  usando el mismo nombre accesible que el texto visible. Se mantiene el orden, Enter para enviar,
  validación y contrato de carga.
- Validación focal: `seccionTemarios.test.tsx` 13/13 PASS; E2E `Temarios muestra el contexto real
  del periodo en móvil con datos sintéticos` 1/1 PASS a 320 × 800 CSS px. Comprueba que ambos campos
  de nombre conservan al menos 100 CSS px de ancho útil y captura formulario claro/oscuro en
  `reports/qa/ux-temarios-20261029-name-fields-final/`.
- Límite: preview y datos ficticios; importación/parsing PDF real, persistencia, zoom 200 %, lector
  de pantalla y runtime instalado siguen pendientes.

### Simplificación visual móvil y contraste del título (2026-10-30)

- Hallazgo: a 320 CSS px, el diagrama decorativo de tres pasos se comprimía hasta ser difícil de
  leer y duplicaba la guía accesible disponible bajo demanda. El título también usaba texto con
  degradado, de menor claridad visual que la tinta sólida del tema.
- Cambio: se oculta el diagrama redundante hasta 480 px y el título usa tinta sólida semántica
  para los temas claro y oscuro. No cambian cálculos, datos ni contratos.
- Validación focal: Playwright Edge `Temarios muestra el contexto real del periodo en móvil con
  datos sintéticos` 1/1 PASS a 320 × 800 CSS px; verifica el diagrama oculto, la tinta sólida en
  ambos temas, reflow y ausencia de desbordamiento. Capturas en
  `reports/qa/ux-temarios-mobile-cleanup-current/`.
- `npm run guard:wcag -- --skip-lint`: 61/61 pares de contraste PASS; título 17.85:1 en claro y
  9.58:1 en oscuro. ESLint focal de `tests/gui-responsive/responsive-docente.spec.ts` PASS.
- Límite: preview y fixture sintético. Instalación/runtime, zoom real al 200 %, lector de pantalla,
  parsing PDF real y persistencia continúan pendientes.

### Mensajes de error y selección de archivo sin estado obsoleto (2026-10-31)

- Hallazgo estático: los errores de validación/subida PDF, captura manual y actualización de nodo
  ya aparecían en una alerta contextual, pero también se repetían como toast. Además, seleccionar
  un archivo no PDF después de un PDF válido conservaba el archivo anterior habilitado para subir.
- Cambio: la alerta local queda como único anuncio de error en esos flujos, con indicaciones de
  recuperación; se quitaron los toasts redundantes. Los detalles de errores PDF/manual pasan por
  el normalizador de mensajes del cliente. Al elegir un archivo inválido se limpia la selección
  anterior y su nombre, evitando enviar el archivo equivocado. Los éxitos y la notificación de
  eliminación permanecen como estaban; no cambian rutas, payloads, permisos ni reglas.
- Base de accesibilidad: W3C WCAG 2.2 SC 3.3.1 requiere describir el error en texto; SC 4.1.3
  recomienda que el estado sea identificable sin interrumpir innecesariamente la tarea.
- Validación focal: `npm -C apps/frontend test -- tests/seccionTemarios.test.tsx --reporter=dot`
  → 15/15 PASS; ESLint focal PASS; `npm run guard:wcag -- --skip-lint` → 61/61 pares
  PASS; `npm run sdd:audit` PASS; `git diff --check` PASS. Build docente ya ejecutado en
  esta iteración antes de los ajustes exclusivos de pruebas y completó correctamente.
- Límites: no se ejecutó auditoría visual runtime en esta iteración. Zoom real, lector de
  pantalla, importación PDF real y guardado persistente siguen pendientes.

### Revisión de capturas sintéticas actuales (2026-10-31)

- Playwright Edge `Temarios muestra el contexto real del periodo en móvil con datos sintéticos`:
  1/1 PASS; capturas de estado sin materia, árbol cargado y selección de PDF, a 320 CSS px en
  tema claro/oscuro. Evidencia revisada en `reports/qa/ux-audit-temarios-current-goal-20261031/`.
- No se observó pérdida de contenido en árbol ni formularios. El selector nativo del periodo
  abrevia el nombre en claro a 320 px, pero el chip de contexto conserva el nombre completo;
  el nombre del PDF elegido se repite como texto bajo el selector nativo.
- Se documentaron las superficies decorativas y los pares de contraste de Temarios. La zona
  de carga usa bordes ámbar más oscuros en estado normal y hover para conservar su límite
  perceptible en tema claro. `node scripts/tests/ui-contrast-audit.mjs` y
  `node scripts/wcag-guard.mjs --skip-lint` pasan; 65/65 pares cumplen sus umbrales y el
  guard ya no detecta colores crudos sin comentario cercano. `git diff --check` pasa.
- Esto cierra el fallo estático del guard, pero no acredita por sí solo conformidad WCAG ni
  reemplaza una inspección visual actual de estos bordes en runtime.
- Pendientes: runtime instalado, zoom manual al 200 %, lector de pantalla, parsing PDF real y
  persistencia.

### Recuperación segura al eliminar un temario (2026-10-31)

- Hallazgo: el fallo de eliminación enviaba `error.message` directamente al toast, lo que podía
  exponer un detalle técnico y no ofrecía una acción para sesión vencida.
- Cambio: los errores `ErrorRemoto` usan el mensaje de usuario normalizado; errores desconocidos
  usan una explicación segura. Un 401 indica que venció la sesión y ofrece «Cerrar sesión».
  La operación, confirmación, motivo, endpoint y datos permanecen intactos.
- Validación focal: `tests/seccionTemarios.test.tsx` 17/17 PASS; ESLint de los dos archivos y
  `git diff --check` PASS. Los casos nuevos comprueban el fallback sin detalles internos y la
  recuperación ante 401.
- Límite: no se capturó el runtime en esta sesión; el comportamiento visual del toast y su
  anuncio con lector de pantalla siguen pendientes.

### Selector PDF legible a 320 CSS px (2026-11-04)

- Hallazgo visual: la fila nativa del selector PDF truncaba «No se ha seleccionado ningún archivo» a 320 CSS px. Tras seleccionar un archivo, el tamaño aparecía como «0.0 KB» en la zona de arrastre y «menos de 1 KB» en el estado.
- Cambio: el input nativo se conserva como mecanismo local, pero se presenta mediante un botón con nombre accesible, instrucciones y estado; el texto vacío/nombre completo queda legible y el tamaño usa una sola regla en la ficha y el estado. Rutas, MIME, bytes, parser y envío no cambian.
- Validación focal: `seccionTemarios.test.tsx` 18/18 PASS; E2E Edge sintético 1/1 PASS a 320/390 CSS px, comprueba el botón dentro del campo, objetivo táctil, foco visible, activación del input por Enter, estado vacío y nombre completo seleccionado. Capturas claro/oscuro a 320 px en `reports/qa/ux-audit-temarios-current-20261104/`.
- Pendiente: lector de pantalla, zoom manual 200 %, runtime instalado, PDF real válido y persistencia.

### Contraste persistente de la zona de carga PDF (2026-11-05)

- Hallazgo: `anim-card-hover` imponía un borde celeste con `!important` y anulaba el borde de aviso en hover; el estado base usaba color ámbar translúcido insuficiente como límite identificable.
- Cambio: la zona de carga usa `--ui-accent-warning` sobre `--ui-canvas` en ambos temas y deja de aplicar el hover global que anulaba ese token.
- Validación: E2E Edge focal 1/1 comprueba borde/fondo en claro y oscuro, hover y arrastre; la auditoría de contraste pasa 102/102 pares (4.90:1 claro y 12.57:1 oscuro para el límite). Capturas inspeccionadas en `reports/qa/ux-temarios-upload-contrast-20261105/`.
- Pendiente: runtime instalado, zoom manual al 200 %, lector de pantalla y parsing/persistencia con PDF real.
