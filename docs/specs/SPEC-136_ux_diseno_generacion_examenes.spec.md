---
id: SPEC-136
titulo: UX e iconografía de Diseño y Generación de Exámenes
version: 1.2.28
fecha: 2026-11-05
autor: Codex / EvaluaPro Team
modulo: frontend_docente_plantillas_ux
estado: approved
---

## Contexto

La superficie docente de Diseño de Exámenes concentra el diseño de plantillas, la
generación individual o por lote y el historial/custodia. `SPEC-034` ya define el flujo
operativo y sus contratos. En el análisis estático actual de
`PlantillasFormulario.tsx`, `PlantillasConsolaGeneracion.tsx`,
`PlantillasHistorialLotes.tsx`, `PlantillasListado.tsx` y las guías contextuales se
encontraron emojis en acciones, mensajes y estados de lista vacía. El flujo de custodia
también incluye `PlantillasOmrWorkflow.tsx`, que concentra revisión y recuperación de
trabajos OMR y debe quedar dentro de esta sección auditada. La pictografía depende de la
fuente/plataforma y recarga etiquetas largas; el catálogo Lucide compartido ya está
disponible para iconos decorativos junto a texto claro.

El componente `PlantillasTabNavigation.tsx` ya implementa `tablist`/`tab`/`tabpanel`, un
solo tab stop y navegación con flechas/Home/End. La activación es manual: las flechas
mueven foco y Enter/Espacio cambia de panel. Esto evita cargar el historial mientras se
explora la navegación, pues la selección puede iniciar consultas; hay cobertura focal en
`plantillas.refactor.test.tsx`. Se debe conservar esta distinción entre pestaña enfocada
y seleccionada.

Las instrucciones OMR ilustran marcas de círculos llenos, parciales, tachados y dobles.
Esos caracteres son ejemplos de contenido impreso, no iconos de interfaz: quedan fuera
de la sustitución iconográfica para no perder precisión en las reglas de llenado.

No hubo captura de runtime en esta revisión. No se afirma ningún defecto de apariencia
visual observado; el alcance propone mejorar la legibilidad y consistencia demostrables
por el código y verificar la presentación cuando la superficie esté disponible.

## Fuentes de diseño y accesibilidad

- W3C WAI-ARIA APG, [Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
  semántica de `tablist`/`tab`/`tabpanel`, estado seleccionado y navegación con flechas,
  Home y End. Recomienda activación automática solo si el panel aparece sin latencia
  perceptible; el patrón manual con Enter/Espacio es válido para paneles que disparan
  carga. La navegación actual es manual y los paneles se obtienen al seleccionar.
- W3C WAI-ARIA APG, [Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/):
  los controles de mostrar/ocultar exponen `aria-expanded`; Enter y Espacio activan el
  control, y `aria-controls` es opcional.
- W3C WCAG 2.2, [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html):
  la información no debe depender únicamente del color; los estados mantienen texto
  explícito.
- W3C WCAG 2.2, [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html):
  verificar los controles compactos en pantalla táctil; el tamaño mínimo AA es 24 × 24
  CSS px o se satisface una excepción de espaciado. La política local pide objetivos más
  amplios cuando el layout lo permita.
- W3C WCAG 2.2, [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html):
  el contenido vertical debe reflow a 320 CSS px sin perder información ni funcionalidad
  ni exigir desplazamiento bidimensional.
- W3C WCAG 2.2, [3.3.1 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html):
  los errores detectados se describen en texto para que la persona entienda qué ocurrió.
- Política local: `docs/WCAG_UI_POLICY.md`, iconografía funcional con nombre/estado en
  texto, iconos decorativos ocultos a tecnologías asistivas, temas y reflow.
- W3C WCAG 2.2, [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): los mensajes de estado representan resultados, espera, progreso o errores que aparecen sin cambio de contexto; una explicación permanente no es una actualización de estado.
- W3C WAI-ARIA 1.2, [note role](https://www.w3.org/TR/wai-aria-1.2/#note) y [status role](https://www.w3.org/TR/wai-aria-1.2/#status): `note` representa contenido ancillary, mientras `status` designa una región viva de información de estado.
- Sistema visual: `docs/DESIGN.md`, reutilización de tokens y del catálogo de iconos
  compartido.

## Requisitos Funcionales

- **REQ-136-001 Iconografía:** en diseño, generación, historial/custodia, revisión OMR y
  guías, reemplazar emojis usados como icono de acción/estado por el catálogo compartido
  donde aporte comprensión. Los iconos decorativos serán ignorados por tecnologías
  asistivas; los estados y acciones conservarán texto explícito. Preservar como caracteres
  los ejemplos didácticos de marcas OMR impresas y los signos matemáticos/de formato.
- **REQ-136-002 Claridad de operación:** revisar etiquetas de acciones, guías, mensajes de
  progreso, éxito, error, advertencia y confirmación para indicar qué sucede, el objeto
  afectado (plantilla, folio, lote o trabajo OMR) y el siguiente paso disponible. En la
  interfaz, usar título, materia, folio e identidad legible del alumno cuando estén
  disponibles, no IDs internos opacos en selector, catálogo, edición, último resultado o
  historial. Expresar en español los términos técnicos que tengan equivalentes claros y
  mantener el nombre de folio en las acciones de artefactos. Mantener significado de estados
  de lote/OMR y acciones existentes, sin prometer resultados no garantizados; no sustituir
  lenguaje por emojis. En la revisión OMR, explicar que la confianza resume la señal de
  lectura y que la calificación automática también considera calidad de imagen, cobertura
  detectada y respuestas ambiguas; cuando no sea calificable, indicar que se compare con la
  captura antes de continuar, sin publicar umbrales ni presentar la confianza como probabilidad.
- **REQ-136-003 Formularios y vista previa:** mejorar etiquetas, instrucciones y
  representación de la plantilla/OMR para que la opción seleccionada y su efecto se
  entiendan sin depender de una marca gráfica. Los selectores de archivo indican con un
  control compacto qué se puede cargar y el estado/nombre del archivo seleccionado sin
  depender del recorte nativo del navegador. En la selección de ingesta OMR, presentar el
  tamaño de cada archivo y el tamaño total con unidades legibles, evitando que un archivo
  menor de 1 KB aparezca como 0 MiB; conservar los límites de tamaño existentes. Mantener
  tipos de archivo, valores de configuración y comportamiento de previsualización definidos
  por SPEC-034.
- **REQ-136-004 Historial y recuperación:** mantener diferenciables estados vacíos,
  cargando, error y con resultados en generación, lotes archivados y flujo OMR. Las
  opciones no disponibles se explicarán con el estado vacío sin mostrar selectores
  deshabilitados redundantes. Las
  operaciones de descarga, regeneración, archivo/eliminación y reintento identificarán el
  objeto al que aplican; una descarga sin artefacto disponible expresará el estado en texto
  visible. La falta de alumnos activos con grupo para generar un lote se comunicará como
  estado informativo con el siguiente paso, no como error. Preservar confirmaciones,
  idempotencia, custodia y contratos.
  Cuando el historial esté paginado, se aclarará el límite visible y la regeneración reunirá
  todas las páginas activas del lote antes de confirmar el total y ejecutar cambios.
- **REQ-136-005 Responsive y acceso por teclado:** conservar navegación APG con un solo
  tab stop; flechas/Home/End cambian foco y Enter/Espacio activa la pestaña enfocada.
  Mantener `aria-selected` atado al panel visible y `aria-controls`/`aria-labelledby`
  enlazados. Verificar nombres de controles, foco, ambos temas, objetivo táctil, reflow a
  320 CSS px, zoom de texto al 200 % y movimiento reducido; no afirmar cumplimiento a
  partir solo del JSX o una captura.
- **REQ-136-006 Compatibilidad:** no cambiar endpoints, payloads, permisos, cálculos,
  folios, generación PDF/ZIP, persistencia, manejo OMR ni reglas de custodia.
- **REQ-136-007 Guías expandibles:** las guías rápidas activas en Generación e Historial comunican su estado visible con
  `aria-expanded`, conservan el foco en su control de mostrar/ocultar tras cada cambio y
  persisten la preferencia actual. No emiten un toast redundante para el mismo cambio.
- **REQ-136-008 Guía estática de autoajuste:** la explicación permanente del ajuste tipográfico y de página se expone como nota, no como región viva; los avisos siguen reservados para cambios y errores que necesitan anuncio.
- **REQ-136-009 Anuncios OMR acotados:** el cambio de estado del trabajo OMR se anuncia en una región `status` pequeña; las métricas del resumen permanecen fuera de esa región para no repetirlas en cada actualización.
- **REQ-136-010 Confirmación junto a la revisión OMR:** la acción para confirmar o guardar cambios de revisión aparece después de la comparación visual de respuestas, junto a su estado pendiente/confirmado, para que pueda accionarse al terminar de revisar sin volver al inicio de la mesa. Se conserva una sola acción de confirmación y su comportamiento actual.
- **REQ-136-011 Contraste de iconografía:** el emblema decorativo de Plantillas usa tokens semánticos y conserva al menos 3:1 sobre la superficie clara conservadora registrada en la auditoría.

## Criterios de Aceptación

1. Las vistas y guías dentro del alcance no usan emojis o glifos como sustitutos de iconos
   funcionales; las acciones y estados continúan identificándose por texto.
2. Los iconos decorativos no añaden anuncios redundantes y los controles solo con icono,
   si existen, tienen nombre accesible. Sus colores usan tokens semánticos y conservan
   contraste mínimo de 3:1 sobre la superficie efectiva.
3. Los mensajes de operación distinguen progreso, resultado y recuperación, con texto
   coherente con la acción real. La ausencia de grupos/alumnos para un lote es un estado
   informativo, no un error, e indica cómo habilitar la generación.
4. Formulario, formato OMR, vista previa e historial conservan sus datos y acciones según
   SPEC-034; no se alteran contratos.
5. Las pestañas mantienen roles APG, foco itinerante y activación manual por teclado; el
   panel visible siempre coincide con `aria-selected`.
6. La matriz registra por separado las pruebas automatizadas y la revisión visual
   runtime; no declara verificados temas/reflow/zoom sin evidencia actual.
7. La búsqueda estática de emojis permite excepciones documentadas únicamente para
   contenido didáctico OMR y caracteres de datos/formato; ninguna acción depende de un
   emoji para identificarse.
8. La tarjeta de calificación manual muestra folio y nombre cuando existen; si faltan,
   presenta una etiqueta legible en lugar de exponer IDs internos del examen o alumno.
9. El selector, catálogo, edición y último resultado de plantillas/exámenes priorizan
   título, materia y folio; no muestran IDs opacos como contexto visible cuando esos datos
   legibles están disponibles.
10. El historial no presenta `loteId` interno en texto ni nombres accesibles. La regeneración
    consulta todas las páginas del lote antes de confirmar su total y aborta si no obtiene el
    historial completo.
11. Las guías activas de Generación e Historial exponen `aria-expanded` acorde al contenido,
    devuelven el foco al control equivalente al mostrar/ocultar y no emiten un toast que repita
    el estado ya indicado por el control y el contenido.
12. El historial reciente de OMR no presenta IDs internos; cuando falta el folio, muestra una
    etiqueta legible y fecha, y cada acción «Reabrir revisión» expone contexto por folio o
    fecha en su nombre accesible.
13. En la mesa OMR, paginación y restablecimiento permanecen antes de la comparación; una
    única acción para confirmar/guardar cambios y el estado correspondiente quedan después
    de la comparación visual, sin cambiar la lógica de confirmación.
13. A 320 CSS px, las acciones del paquete permanecen dentro de su tarjeta; los CTA primarios
    de descarga tienen superficie sólida y contraste mínimo 4.5:1 en reposo y hover, en ambos temas.
14. En el detalle de custodia OMR, el conteo de paquetes tiene una etiqueta en español y un
    valor explícito cuando falta; las descargas usan nombres en español, identifican el folio
    y muestran «no disponible» cuando el artefacto correspondiente no tiene URL.
15. Un job OMR fallido comunica la consecuencia y el siguiente paso en lenguaje claro; los
    códigos técnicos quedan dentro de un disclosure nativo, con teclado, y la alerta sigue
    presente aunque el servicio no devuelva códigos. Si no hay código, la alerta no pide
    compartir un detalle inexistente: indica que falta el código y orienta a compartir el
    folio legible del examen con soporte; si tampoco existe folio, orienta a indicar cuándo
    ocurrió el trabajo.
16. El resumen OMR muestra «No disponible» cuando falta una métrica y conserva `0` cuando
    el servicio sí reporta cero; la ausencia no se interpreta como un resultado numérico.
17. La explicación estática del ajuste automático se expone como nota y no usa `role="status"` ni `aria-live`; conserva su lugar en el orden normal de lectura.
18. En el resumen del trabajo OMR, el anuncio del estado no incluye las métricas asociadas; los valores y cálculos del resumen permanecen visibles sin ser repetidos en cada anuncio.
18. Mientras se carga el historial de exámenes generados, el mensaje visible se expone como estado accesible; un lector de pantalla puede identificar la espera sin cambiar el foco.
19. En la revisión OMR, el título, los reactivos y el identificador del alumno usan español claro; las señales conocidas se traducen y los códigos de excepción se conservan en un detalle plegable para soporte.
20. En Generación, el nombre completo de la materia y de la plantilla activa permanece visible aunque el selector nativo recorte su opción en pantallas estrechas.
21. En una ingesta OMR fallida, la acción de recuperación cabe por completo en móvil y no aparecen acciones inactivas de finalización.
22. Si el historial OMR está vacío, el estado informativo indica cómo iniciar un trabajo desde Generación.
23. Una ingesta PDF en cola o en proceso muestra una barra de progreso accesible y el conteo de páginas; si el total aún no está disponible, expresa espera indeterminada sin inventar porcentaje.
24. La ingesta PDF solo ofrece guardar resoluciones en páginas «Requiere revisión»; las páginas aceptadas o rechazadas se presentan como detalle de solo lectura y las omitidas explican por qué no admiten resolución.
25. Una página OMR omitida por ser reverso vacío no muestra confianza del análisis como si fuera un resultado calificable.
26. Si una página ya tiene examen y número de página asociados, la guía de comparación identifica la página concreta que se puede cargar.
27. Si falla un job sin código técnico, el texto de alerta informa esa ausencia y ofrece un
    siguiente paso que la persona puede realizar usando el folio disponible, sin mostrar
    identificadores internos.
28. En OMR, a 320 y 390 CSS px, los nombres de las pestañas conservan palabras completas,
    los botones de artefactos y sus etiquetas permanecen dentro de su grupo sin recorte, y
    la alerta de error usa el ancho de lectura disponible de la tarjeta en ambos temas.
29. Los selectores de capturas y PDF de referencia del trabajo OMR usan controles visibles,
    nombres accesibles e instrucciones compactas; informan en una región de estado los nombres
    seleccionados o que no hay archivos, sin depender del control nativo truncado del navegador.
30. Los estados de selección OMR muestran un tamaño legible por archivo y el total de la carga;
    un archivo de menos de 1 KB no se presenta como 0 MiB y se mantienen los límites actuales.
31. El panel fijo oscuro «Ajuste de página» conserva texto con contraste mínimo de 4.5:1
    cuando el tema claro está explícito y cuando la raíz usa el tema claro predeterminado sin
    atributo `data-theme`.
32. En Generación a 320 CSS px, el selector de formato del lote aprovecha el ancho interior
    de la tarjeta de modalidad; las opciones ZIP/PDF conservan sus etiquetas completas dentro
    de controles táctiles de al menos 44 CSS px de alto, sin cambiar formato seleccionado ni
    comportamiento de generación/descarga.
33. El icono decorativo del encabezado de Plantillas usa el token semántico de peligro en tema
    claro y mantiene al menos 3:1 de contraste contra el tinte claro conservador registrado.

## Restricción de implementación

Mantener las derivaciones de datos de plantilla y la agrupación de lotes OMR archivados
en helpers puros del feature, separados de la pantalla coordinadora. La extracción no
debe cambiar filtrado, normalización de temas, orden, conteos ni etiquetas legibles; la
pantalla debe respetar el límite configurado de ESLint para `max-lines`.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-136-001, REQ-136-002 | Etiquetas, estados, identidad legible, iconografía, ortografía y excepciones de caracteres OMR | `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/frontend/tests/plantillasGenerados.test.tsx`; `apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `apps/frontend/tests/escaneo.refactor.test.tsx`; `apps/frontend/tests/seccionCalificar.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | OMR muestra folio, nombre y matrícula cuando están disponibles y estado legible si falta el alumno; selector, catálogo y edición de plantillas y el último examen usan materia/título/folio legibles sin IDs; el historial individual y el historial reciente omiten IDs internos y contextualizan «Reabrir revisión», también cuando falta folio. El filtro explica título/tema y se elimina `preguntasIds` de la etiqueta visible; se corrigen tildes de Título, exámenes y último. El estado vacío sin materia usa un icono del catálogo, no un carácter numérico. El conteo de paquetes muestra valor o «No disponible», el vocabulario de artefactos está en español y los nombres de descarga incluyen el folio. La falla OMR prioriza su mensaje, traduce las señales conocidas y conserva códigos en disclosure; las métricas distinguen ausencia de cero real. La confianza de lectura se explica como señal y se aclara que la decisión automática evalúa más criterios; si la página requiere revisión, se indica verificar respuestas contra la captura, sin presentar el porcentaje como probabilidad ni publicar umbrales. `plantillasOmrWorkflow.test.tsx` 18/18 PASS tras la aclaración; E2E 1/1 PASS con estados de revisión, aceptada, rechazada y reverso omitido, 320/390 CSS px y ambos temas; solo lecturas dummy y cero escrituras. La tarjeta de calificación evita IDs internos y usa «Revisión y calificación». |
| REQ-136-003, REQ-136-006, REQ-136-008, criterios 29–30 | Formulario, vista previa, semántica de instrucciones estáticas, selectores de archivos y contratos de generación | `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `apps/frontend/tests/plantillas.omrResumen.test.ts`; `apps/frontend/tests/datosPlantilla.test.ts`; `tests/gui-responsive/responsive-docente.spec.ts` | Los selectores de imagen, PDF de referencia y archivos del job OMR usan botones accesibles, ayuda asociada y estado/nombre visible; el selector de archivos del job anuncia cantidad, nombres y tamaños legibles, además del total, y el control nativo truncado queda oculto fuera del orden de foco. Vitest OMR focal y E2E 1/1 PASS a 320/390 CSS px, ambos temas, con nombres largos y verificación de ajuste de texto. Capturas actuales en `reports/qa/ux-audit-examenes-after-20261103/`. |
| REQ-136-004, criterios 18, 21–26 | Estados vacíos, carga accesible, errores recuperables y contexto en generación, historial y OMR | `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/frontend/tests/plantillasGenerados.test.tsx`; `apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx`; `apps/frontend/tests/plantillas.historialLotes.test.ts`; `apps/frontend/tests/plantillasExtraordinarioArchivado.test.tsx`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `apps/frontend/tests/escaneo.refactor.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | El estado vacío del historial OMR orienta a Generación; el estado sin lotes para cotejo conserva el aviso y omite el selector deshabilitado duplicado. Los estados en cola/proceso muestran conteo y progreso nativo, incluido progreso indeterminado sin total; ambos tienen aserciones focales. En ingesta PDF, solo las páginas que requieren revisión permiten guardar; aceptadas/rechazadas muestran detalle sin CTA y los reversos omitidos no exponen confianza de análisis ni ofrecen resolución. La página de referencia ya asociada se identifica por su número. El indicador de carga del historial usa `role=status`; el faltante de grupos se comunica como información y orienta a Alumnos; los estados sin IDs, la custodia archivada y la paginación conservan recuperación. En ingesta OMR fallida, el mensaje y el botón de reproceso se revisan a 320/390 CSS px en ambos temas; las acciones caben dentro de su grupo y no aparece la finalización inactiva. Vitest OMR y E2E focal PASS; cero escrituras. |
| REQ-136-007 | Guías expandibles anuncian estado, conservan foco y evitan toast redundante | `apps/frontend/tests/plantillas.refactor.test.tsx` | 31/31 PASS: los controles conservan foco, actualizan `aria-expanded`, persisten el estado en localStorage y no emiten toast redundante |
| REQ-136-009 | El estado del trabajo OMR se anuncia sin repetir métricas | `apps/frontend/tests/plantillasOmrWorkflow.test.tsx` | Prueba focal 18/18 PASS: la región viva anuncia solo el estado y las métricas siguen visibles fuera de ella. Typecheck, ESLint focal, WCAG 73/73, auditoría SDD y diff-check PASS. Sin auditoría de lector de pantalla/runtime instalado. |
| REQ-136-011, criterio 33 | El icono de Plantillas en tema claro usa el token `--ui-accent-danger`; el par conservador #b4233e/#f8e8f0 verifica 5.47:1 | `scripts/tests/ui-contrast-audit.mjs` | Guard de contraste y aserción de uso del token PASS; no cambia operaciones ni contratos. |

### Contraste semántico del emblema de Plantillas (2026-11-05)

- El guard detectó un color hexadecimal local sin par WCAG registrado en el emblema claro.
- Se sustituyó por `--ui-accent-danger`; la combinación conservadora #b4233e sobre #f8e8f0 alcanza 5.47:1. El guard ahora comprueba el par y que el CSS use el token documentado.
- Solo cambia el color del icono decorativo; no se alteran contenido, acciones ni contratos.
| REQ-136-002, criterios 15, 27 y 28 | Fallo OMR sin código y reflujo móvil: describir el siguiente paso, mantener pestañas y artefactos legibles dentro de la tarjeta | `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; validación E2E verifica texto y límites en folio ficticio a 320/390 CSS px y ambos temas; solo lecturas dummy, cero escrituras. |
| REQ-136-005, REQ-136-010 | Navegación APG por teclado, foco, responsive, contraste y proximidad de confirmación OMR | `apps/frontend/tests/escaneo.refactor.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: Vitest Escaneo 17/17; E2E focal 1/1 con datos OMR sintéticos, 320/390 CSS px, temas claro/oscuro, orden DOM de la acción, contraste AA, desbordamiento y encabezados. El test confirma que no se llamó al endpoint de calificación. Capturas actuales revisadas en `reports/qa/ux-confirmacion-omr-20261103/`. Typecheck, ESLint focal y diff-check PASS. Runtime instalado, zoom manual 200 % y lector de pantalla pendientes |
| Criterio 31 | El panel oscuro de Ajuste de página conserva contraste AA en tema claro explícito y predeterminado | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge 1/1 verifica el contraste mínimo de 4.5:1 con `data-theme="light"` y con atributo ausente; flujo sintético con escrituras bloqueadas. Captura de 320 CSS px inspeccionada; detalle en `reports/qa/ux-plantillas-formato-contrast-default-20261104/`. |
| Criterio 32 | El selector ZIP/PDF usa el ancho útil de su tarjeta a 320 CSS px y mantiene legibles las etiquetas | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E Edge focal 1/1 con datos sintéticos; a 320 CSS px ambos botones ocupan el ancho del grupo, miden al menos 44 px y sus etiquetas caben completas. Sin escrituras API. Capturas claro/oscuro en `reports/qa/ux-plantillas-output-format-20261105/`. |

## Validación ejecutada y pendiente

- Pruebas focales ejecutadas: 8 archivos (`plantillas.refactor`, `plantillasGenerados`,
  `plantillasHistorialLotes.archivo`, `plantillasExtraordinarioArchivado`,
  `plantillasOmrWorkflow`, `escaneo.refactor`, `plantillas.omrResumen` y
  `gui.responsive.contract`), 80/80 PASS.
- En la primera ejecución, `build:docente` se detuvo en `wcag-guard`: ESLint reportó
  `max-lines` en `SeccionPlantillas.tsx` y `SeccionCalificaciones.tsx`. La extracción
  posterior del panel de exportación de calificaciones y de derivaciones de plantillas
  resolvió ambos reportes; la revalidación completa consta abajo. En esa primera pasada,
  ESLint focal, typecheck de frontend, `guard:wcag -- --skip-lint` (39/39 pares),
  `sdd:audit` y `git diff --check` PASS.
- Barrido estático Unicode de componentes incluidos: sin pictogramas.
- Revisión runtime con datos ficticios: tres pestañas, estados de generación/historial,
  tema claro y oscuro, operación por teclado, 320 CSS px y zoom 200 % cuando el navegador
  lateral esté disponible.
- Comparar datos y requests antes/después para confirmar que se mantienen los contratos
  de SPEC-034.
- La auditoría visual manual se reportará como pendiente mientras no haya una pestaña
  integrada con el runtime y datos ficticios; no se crearán/cambiarán datos reales para
  obtener capturas.

### Selector accesible de archivos en el detalle OMR (2026-11-03)

- Captura E2E fresca del flujo OMR fallido en móvil detectó dos `<input type="file">` nativos cuyo nombre de archivo quedaba truncado y no tenía un estado compacto legible.
- Los controles ahora usan botones nativos con nombre accesible y ayuda asociada; el input de plataforma sale del orden de foco y los nombres seleccionados se anuncian en un estado contextual con ajuste de línea.
- `plantillasOmrWorkflow.test.tsx` 19/19 PASS; E2E Edge 1/1 PASS con archivos sintéticos, 320/390 CSS px, ambos temas, nombres largos, ajuste de texto y bloqueo de escrituras API. Typecheck y ESLint focal PASS.
- Evidencia capturada e inspeccionada en `reports/qa/ux-audit-examenes-after-20261103/`. La pestaña lateral continúa inaccesible; esto es preview con fixtures, no verificación del runtime instalado. Zoom manual 200 % y lector de pantalla siguen pendientes.

### Historial de trabajos OMR sin identificadores internos (2026-11-03)

- Hallazgo estático: «Trabajos OMR recientes» mostraba `jobId` y, si no había folio,
  `assessmentId`; todas las acciones se llamaban «Reabrir revisión» sin contexto accesible.
- Cambio: el historial muestra folio o «Trabajo OMR sin folio», conserva la fecha visible,
  oculta ambos identificadores y añade el folio/fecha al nombre accesible de la acción.
- Validación focal: `plantillasOmrWorkflow.test.tsx` 11/11 PASS, typecheck frontend,
  ESLint focal y validación aislada de esta spec PASS; no cambian los datos que recibe el
  callback ni los contratos. Revisión visual con runtime pendiente.
- Límite de runtime en esta revisión: la UI instalada devolvió HTTP 200, pero el health
  check directo de API en `127.0.0.1:4000` no conectó; no se inspeccionó la pestaña.

### Acciones de paquete en móvil y contraste (2026-11-03)

- Hallazgo en captura sintética: a 320 CSS px, el ancho mínimo heredado del grupo de acciones
  rebasaba la tarjeta 6.5 px; el CTA primario heredaba un gradiente con contraste insuficiente
  en tema oscuro.
- Cambio: las acciones del paquete se apilan con ancho limitado por la tarjeta en móvil; el CTA
  primario usa los tokens sólidos y hover del tema.
- Validación: `responsive-docente.spec.ts` E2E focal 1/1 PASS a 320/390 CSS px y ambos temas;
  mide límites de cada acción y verifica superficie sólida/contraste AA en reposo y hover.
  Capturas inspeccionadas en `reports/qa/ux-audit-plantillas-omr-context-20261103/`.
- Límite: la captura usa datos ficticios; la UI instalada no se revisó porque la API local no
  respondió a la solicitud directa de salud.

### Revalidación de tamaño de sección (2026-10-28)

- La agrupación de lotes OMR archivados y las derivaciones de disponibilidad por periodo/
  tema viven en `features/plantillas/datosPlantilla.ts`; la lectura inicial de pestaña se
  consolidó con el estado de sesión. Se preservaron agrupación, nombres, orden y conteos.
- `tests/datosPlantilla.test.ts`, `tests/plantillas.refactor.test.tsx` y
  `tests/plantillas.omrResumen.test.ts`: 27/27 PASS; typecheck PASS.
- `npm run build:docente`: PASS (compilación de 2078 módulos, verificador del bundle,
  ESLint global sin advertencias y WCAG 39/39 pares). ESLint focal y `git diff --check`
  también PASS. La sección ya no excede `max-lines` y el bundle docente incluye los
  cambios de Diseño/Generación.
- La revisión runtime con datos ficticios en tres pestañas, estados, teclado, ambos temas,
  reflow y zoom permanece pendiente; no se afirma como verificada.

### Verificación de cierre (2026-10-28)

- `npm -C apps/frontend run test -- tests/plantillas.refactor.test.tsx tests/plantillasGenerados.test.tsx tests/plantillasHistorialLotes.archivo.test.tsx tests/plantillasExtraordinarioArchivado.test.tsx tests/plantillasOmrWorkflow.test.tsx tests/escaneo.refactor.test.tsx tests/plantillas.omrResumen.test.ts tests/gui.responsive.contract.test.tsx tests/datosPlantilla.test.ts`: 9 archivos, 83/83 PASS (revalidación 2026-10-29).
- `npm -C apps/frontend run build:docente`: PASS; 2079 módulos, bundle docente verificado, ESLint sin errores y guarda de contraste global 46/46 PASS (revalidación 2026-10-29).
- `npm run sdd:audit` y `git diff --check`: PASS.
- Barrido de `Extended_Pictographic` en los 24 componentes TypeScript incluidos: cero coincidencias.
- Se revisaron capturas con datos ficticios de Diseño en escritorio (1920 px) y móvil (390 px). Es evidencia limitada al panel de diseño y esos anchos; siguen pendientes la inspección runtime de generación, historial y OMR, ambos temas, 320 CSS px y zoom 200 %. Los contratos se preservan por inspección de alcance y pruebas frontend; no se hizo captura de red contra una API runtime.

### Corrección de historial de lotes (2026-10-28)

- La lista reciente puede contener solo una parte de un lote. La regeneración ahora consulta
  todas las páginas activas (cursor, hasta 200 por página), filtra por lote, presenta su
  cantidad y folios antes de confirmar y no inicia cambios si falla la lectura completa.
- Las tarjetas, botones y confirmaciones de Custodia omiten IDs internos y usan folios,
  cantidad de exámenes/páginas y estado de archivo; la vista aclara que el listado muestra
  los 50 exámenes más recientes y que las acciones de paquete cubren el lote completo.
- Validación focal: `plantillas.historialLotes.test.ts` y
  `plantillasHistorialLotes.archivo.test.tsx`, 7/7 PASS; frontend typecheck PASS;
  `guard:wcag` PASS (ESLint y contraste 39/39); `build:docente` PASS (2079 módulos y
  bundle verificado); `sdd:audit` y `git diff --check` PASS.
- No se capturó runtime visual en esta pasada; la auditoría visual de generación, historial
  y OMR continúa pendiente.

### Claridad de actualización del catálogo (2026-10-29)

- El botón genérico «Actualizar» no indicaba qué dato volvería a cargar. La acción ahora se
  etiqueta «Recargar catálogo» y conserva el mensaje de progreso con el mismo objeto.
- Se agregó una aserción de nombre accesible a `plantillas.refactor.test.tsx`; no cambian
  la llamada de refresco, permisos ni contratos. `plantillas.refactor.test.tsx` pasó 23/23;
  ESLint focal, typecheck frontend, `sdd:audit` y `git diff --check` PASS.

### Revisión visual de captura individual OMR (2026-10-30)

- En la selección de una imagen, la tarjeta no identificaba el archivo elegido y mantenía
  el texto de carga inicial. Ahora muestra su nombre, ofrece «Elegir otra imagen» y permite
  que nombres largos se ajusten sin desbordar en móvil; la advertencia de calidad y el
  bloqueo de análisis se conservan.
- Evidencia runtime con PNG sintético de baja calidad, a 320 CSS px en tema claro:
  `reports/qa/ux-audit-omr-current-turn-selected-file/ux-audit-calificaciones-omr-captura-calidad-no-apta-320-light.png`.
  Se inspeccionó la captura; el nombre y las instrucciones de recuperación permanecen
  legibles, el botón de análisis sigue deshabilitado y no hay overflow horizontal.
- `escaneo.refactor.test.tsx`: 15/15 PASS; recorrido Playwright docente focal: 1/1 PASS;
  ESLint focal PASS; `guard:wcag --skip-lint`: 59/59 pares PASS. El análisis de la imagen,
  la revisión de respuestas y el guardado no se ejecutaron.
- La evidencia solo cubre el estado de selección con calidad no apta en móvil claro; la
  captura aceptada y los límites de verificación no sustituyen la revisión runtime de los
  estados restantes, el tema oscuro, generación e historial.

### Revisión responsive de Diseño, Generación e Historial (2026-10-30)

- La navegación nombraba Diseño y Generación, pero no Historial; el nombre accesible ahora
  incluye las tres etapas. Las guías de Generación e Historial inician compactas y conservan
  el control explícito para revelarlas. Los selectores de modalidad/formato se apilan en
  ancho móvil, las acciones usan el ancho disponible, la superficie clara asegura contraste
  de texto y las cantidades muestran singular o plural correctamente.
- Se revisaron capturas actuales de las tres pestañas a 320 y 390 CSS px, tema claro y
  oscuro. El recorrido Playwright usa únicamente respuestas GET ficticias; bloquea y comprueba
  que no ocurra ninguna escritura. No se generó ni modificó ningún examen real.
- `plantillas.refactor.test.tsx`: 23/23 PASS; auditoría Playwright focal: 1/1 PASS. La
  inspección visual confirmó que los controles no se desbordan y que el CTA de generación
  cabe en 320 px tras apilar las acciones. Una aserción runtime mide texto de títulos/ayudas
  a 4.5:1 o más en las tarjetas del tema claro.
- Evidencia y notas: `reports/qa/ux-audit-plantillas-current-turn/`. Este recorrido no cubre
  zoom 200 %, lectores de pantalla, navegador distinto de Edge ni el comportamiento del
  servicio real; esos estados quedan fuera de la afirmación de esta pasada.

### Contraste del formato y ajuste responsive del Historial (2026-10-31)

- Capturas actuales con datos sintéticos en Diseño, Generación e Historial, a 320 y 390 CSS
  px y en ambos temas: `reports/qa/ux-audit-plantillas-current-goal-20261031/`. Se
  inspeccionaron las 12 capturas. El recorrido navega Diseño → Generación con flecha y
  Enter, abre Historial y bloquea las escrituras.
- En el panel «Ajuste de página», reglas globales de `.nota`/`.ayuda` anulaban el contraste
  esperado en tema claro. Se fijaron colores legibles con especificidad local. La aserción
  calcula contraste contra ambos extremos de la superficie oscura declarada; las
  combinaciones resultantes son 9.85:1 o más (WCAG AA exige 4.5:1 para texto normal).
- En el catálogo claro, metadatos y chips usaban texto pálido sobre superficies claras.
  Las nuevas superficies y colores se verifican con estilos calculados: metadatos 6.92:1,
  densidad 6.49:1 y tema 5.17:1.
- En Historial a 320 CSS px, el `tabpanel` conservaba un ancho mínimo intrínseco y excedía
  4 px el viewport; el documento ocultaba el desbordamiento. Se limita el panel al ancho
  disponible en móvil. La aserción ahora comprueba los límites del panel y los rectángulos
  de texto, no solo `document.scrollWidth`.
- La etiqueta larga del formato OMR tampoco ajustaba línea en móvil; ahora envuelve su
  texto y el E2E comprueba que las etiquetas queden dentro del panel y no estén truncadas.
- E2E focal Playwright: 1/1 PASS, 12 capturas inspeccionadas, solo GET ficticios y cero
  escrituras. Quedan fuera zoom real al 200 %, lector de pantalla, runtime instalado, API
  autenticada y los estados interactivos del flujo OMR.

### Etiquetas comprensibles para los estados OMR (2026-11-03)

- Diseño, historial y revisión muestran etiquetas en español para los estados conocidos de
  trabajo (`En cola`, `En proceso`, `Completado`, `Fallido`, `Finalizado`, `Revisión pendiente`)
  y página (`Aceptada`, `Requiere revisión`, `Rechazada`, `Omitida`). Los valores originales
  permanecen intactos para condiciones y payloads; estados desconocidos conservan su texto.
- «Auto» se reemplaza por «Calificables automáticamente» y el detalle por «Calificable
  automáticamente», junto con la nota de que el proceso no guarda ni modifica calificaciones.
- Los selectores móviles pueden truncar su valor nativo; se muestra debajo el nombre completo
  de la modalidad de examen y de la plantilla OMR seleccionadas para conservar su legibilidad.
- Validación focal posterior: Plantillas 54/54 PASS (3 archivos), typecheck PASS, ESLint focal
  PASS, `guard:wcag` 69/69 pares PASS, `sdd:audit` y `git diff --check` PASS. La navegación visual
  sintética de las tres pestañas tuvo 1/1 PASS y sus 12 capturas a 320/390 px en claro/oscuro se
  inspeccionaron; no contiene un job abierto, por lo que el nuevo estado OMR se validó en pruebas
  de componente. Sin runtime instalado ni lector de pantalla.

### Etiquetas y disponibilidad de artefactos de custodia OMR (2026-11-03)

- El conteo de paquetes se etiqueta en español y, cuando falta el valor, muestra «No
  disponible» en vez de dejar el rótulo vacío.
- Cuadernillo, hoja OMR, clave de respuestas, manifiesto y paquete ZIP tienen etiquetas
  españolas; el nombre accesible identifica el folio. Si falta la URL, el control sigue
  deshabilitado y expresa «no disponible» en el texto visible.
- Se conservaron URLs, nombres de archivo, endpoints y acciones existentes.
- `plantillasOmrWorkflow.test.tsx` 11/11 PASS; typecheck y ESLint focal PASS.
- No hubo inspección visual de runtime en esta actualización.

### Mensaje accionable al fallar el procesamiento OMR (2026-11-03)

- Hallazgo: la alerta exponía solo códigos de máquina, sin explicar que la ingesta podía reprocesarse desde los originales.
- Cambio: el error ahora describe el resultado y la recuperación disponible; los códigos se conservan en un disclosure nativo para soporte. La alerta se muestra incluso cuando falta el código.
- Validación: `plantillasOmrWorkflow.test.tsx` (13/13), typecheck, ESLint focal, build docente, guard WCAG (71/71 pares), auditoría SDD y `git diff --check` PASS.
- Contratos: no cambia el job, los archivos fuente, el reprocesamiento ni sus endpoints/payloads.
- Límite: verificación de componente; no se capturó runtime ni se inspeccionó manualmente el estado OMR instalado.

### Métricas ausentes en el resumen OMR (2026-11-03)

- Hallazgo estático: la respuesta tipa `summary` y `averageScore` como opcionales, pero el componente convertía su ausencia en cero.
- Cambio: cada métrica ausente muestra «No disponible» y los valores numéricos `0` siguen visibles como cero real.
- Validación focal: `plantillasOmrWorkflow.test.tsx` cubre resumen ausente y ceros explícitos; la suite, build docente, typecheck, ESLint focal, guard WCAG, auditoría SDD y diff-check PASS.
- Contratos: sin cambios en cálculos ni datos de origen.
- Límite: validación de componente; runtime visual pendiente.

### Claridad del estado de revisión OMR (2026-11-03)

- Capturas actuales del recorrido real de UI con perfil y datos ficticios revelaron que el detalle destacaba `LOW_CONFIDENCE`, `bajo_contraste` y `doble_marca` como texto técnico, y que el encabezado y campo de identidad estaban en inglés.
- El detalle ahora prioriza el mensaje legible, conserva el código dentro de un disclosure accesible y traduce las señales conocidas. El título y las etiquetas del análisis usan español; no cambia el identificador enviado ni el flujo de resolución.
- `plantillasOmrWorkflow.test.tsx` y E2E focal de Diseño/Generación/Historial + revisión OMR validan el texto, el código plegado y la vista a 320/390 CSS px en ambos temas. El E2E usa solo GET ficticios y bloquea todas las escrituras.
- Las capturas actuales se guardan en `reports/qa/ux-audit-plantillas-current-20261103/`; runtime instalado, lector de pantalla, zoom manual al 200 % y API autenticada siguen pendientes.

### Identificación de plantilla activa en móvil (2026-11-03)

- En la captura oscura de Generación a 320/390 CSS px, el selector nativo truncaba la opción y la ayuda solo describía la estructura, sin identificar materia ni plantilla activa.
- Se muestra materia y título seleccionados como texto de apoyo legible bajo el selector; selección, generación y datos no cambian.
- El E2E sintético focal comprueba el nombre completo seleccionado a 320/390 CSS px, en ambos temas, sin enviar escrituras.

### Recuperación de ingesta OMR fallida en móvil (2026-11-03)

- La captura a 320 CSS px mostró el botón «Reprocesar desde originales» cortado dentro del grupo de acciones aunque la página no tenía desbordamiento horizontal.
- El grupo de finalización OMR ahora distribuye los botones con una cuadrícula adaptable; en ingestas solo se muestra la acción válida de reproceso, y el encabezado usa «Trabajo OMR».
- El E2E mide los límites de ambos botones en su contenedor y verifica mensaje, disponibilidad del reproceso y ausencia de la acción inactiva; captura el estado a 320/390 CSS px en ambos temas, con cero escrituras.

### Icono del estado vacío de temas (2026-11-03)

- Hallazgo estático: al no haber materia seleccionada, el icono decorativo mostraba `2`, que podía leerse como un conteo o paso del flujo.
- Cambio: el estado usa un icono de libro del catálogo; «Aún no hay temas disponibles» conserva su icono de alerta.
- Validación focal: `plantillas.refactor.test.tsx` comprueba el SVG decorativo en el estado vacío y que no aparezca el carácter numérico.
- No cambian la selección, los temas, las preguntas ni los datos de plantilla.

### Semántica de la guía fija de autoajuste (2026-11-03)

- Hallazgo estático: la explicación constante sobre autoajuste se anunciaba como `status` aunque no informaba de un cambio.
- Cambio: ahora se presenta como nota estática en el orden normal de lectura; los mensajes dinámicos conservan su semántica de estado o alerta.
- Validación focal: `plantillas.refactor.test.tsx` confirma que el bloque usa `role="note"` y no `aria-live`.
- No cambia el contenido ni el comportamiento del motor de generación.

### Estado de generación cuando no hay grupos activos (2026-11-03)

- Hallazgo estático: la falta de alumnos activos con grupo se presentaba con `role="alert"`,
  aunque describe una condición de datos y no un error de operación; tampoco indicaba dónde
  resolverla.
- Cambio: el mensaje ahora es un estado informativo y orienta a registrar alumnos o asignarles
  grupo en Alumnos. El grupo sigue deshabilitado y no cambia la selección ni la generación.
- Validación focal: `npm test -- plantillas.refactor.test.tsx` (32/32 PASS), ESLint focal,
  `git diff --check` y auditoría SDD PASS.

### Anuncio accesible de carga del historial (2026-11-03)

- Hallazgo estático: el texto «Cargando historial de exámenes generados…» se mostraba durante la consulta, pero no estaba expuesto como mensaje de estado.
- Cambio: el indicador del historial usa `role="status"`; no se mueve el foco ni se modifica la consulta.
- Validación focal: `plantillasHistorialLotes.archivo.test.tsx` verifica el mensaje en el rol `status`.
- Sin cambios de datos, paginación, permisos, custodia ni flujo OMR.

### Anuncio accesible de carga incremental de paquetes archivados (2026-11-03)

- Hallazgo estático: al paginar los paquetes archivados, el progreso solo se mostraba visualmente y no se anunciaba a tecnologías de asistencia.
- Hallazgo adicional: el número del encabezado refleja los paquetes cargados hasta el momento; con paginación disponible podía confundirse con el total.
- Cambio: el mensaje «Cargando paquetes archivados…» usa `role="status"` y el encabezado indica «Paquetes archivados visibles», sin mover el foco ni cambiar la paginación.
- Validación focal: `plantillasHistorialLotes.archivo.test.tsx` verifica el mensaje con el rol `status` y el rótulo del conteo visible.
- Sin cambios de datos, permisos, custodia ni flujo OMR.

### Región viva acotada al estado del trabajo OMR (2026-11-03)

- Hallazgo: la región `role="status"` incluía el estado y todas las métricas. WAI-ARIA 1.2 asigna a `status` anuncio cortés y atomicidad implícitos, por lo que cada cambio podía volver a anunciar el resumen completo.
- Cambio: el elemento de estado contiene solo la etiqueta actual; las métricas siguen visibles fuera de la región viva, sin alterar valores ni cálculos.
- Validación focal: `plantillasOmrWorkflow.test.tsx` (18/18), typecheck frontend, ESLint focal, WCAG 73/73, auditoría SDD y `git diff --check` PASS.
- Sin cambios de contratos, permisos, consultas ni persistencia.

### Reflujo móvil en pestañas y custodia OMR (2026-11-03)

- La captura completa sintética a 320 CSS px mostró etiquetas de pestaña partidas carácter por carácter y botones de artefactos más anchos que su tarjeta; el mensaje de fallo también tenía un ancho de lectura menor al disponible.
- Las pestañas ahora conservan palabras completas y a 360 px o menos usan filas legibles; el grupo de artefactos distribuye botones de ancho completo y ajusta sus etiquetas. La alerta de fallo aprovecha el ancho de contenido de la tarjeta.
- Se añadió el criterio 28 y cobertura E2E de anchos, líneas de texto y límites de botones a 320/390 CSS px en ambos temas; el folio del escenario es ficticio y las rutas API de prueba solo responden lecturas.
- Evidencia visual inspeccionada en `reports/qa/ux-omr-no-code-20261103/`, incluyendo pantalla completa clara y oscura.
- `PlantillasOmrWorkflow.test.tsx` 18/18, E2E Playwright Edge 1/1, typecheck frontend, ESLint focal, WCAG contraste 73/73, SDD audit y `git diff --check` PASS. No se verificó la instalación local; el runtime API en localhost no respondió. Zoom manual 200 % y lector de pantalla siguen pendientes.

### Contraste en tema claro predeterminado (2026-11-04)

- El recorrido móvil general quitaba `data-theme` para comprobar el tema claro predeterminado. Las reglas locales del panel oscuro solo aplicaban cuando el atributo existía, por lo que el color global se imponía sobre «Ajuste de página» y reducía el contraste a 1.08:1.
- Las reglas se fijaron a nivel de raíz sin depender de la presencia del atributo; el panel oscuro mantiene texto legible con `data-theme="light"` y en el tema claro predeterminado. No cambian el estado ni los valores de los controles.
- El E2E de Diseño/Generación/Historial vuelve a comprobar el panel sin el atributo y captura el estado a 320 CSS px; usa respuestas sintéticas y bloquea escrituras.

### Ancho y legibilidad del selector de formato de lote (2026-11-05)

- El E2E detectó que a 320 CSS px una segunda tarjeta anidada reducía el grupo ZIP/PDF a 82 px, frente a 132 px en modalidad, partiendo las etiquetas.
- Se sustituyó la tarjeta anidada por un bloque interior sin padding lateral adicional; título, descripción, opciones y estado seleccionado permanecen iguales.
- E2E Edge focal 1/1 PASS con datos sintéticos y escrituras API bloqueadas. Comprueba ancho, ajuste íntegro de texto y botones de al menos 44 px; se inspeccionaron capturas en ambos temas.
- Los contratos, selección por defecto y acciones de generación/descarga no cambian.
