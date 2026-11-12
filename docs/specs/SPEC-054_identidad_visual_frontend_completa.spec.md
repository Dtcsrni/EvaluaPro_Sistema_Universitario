---
id: SPEC-054
titulo: Evolucion integral de identidad visual, UX/UI y rendimiento del frontend
version: 1.6.15
fecha: 2026-10-30
autor: EvaluaPro Team
modulo: frontend_experiencia_completa
estado: approved
---

## Contexto

El frontend de EvaluaPro expone superficies para docente, alumno y administración
de negocio. La funcionalidad está cubierta por módulos y pruebas, pero la presentación
acumula clases, tokens, superficies y layouts históricos. La evolución debe conservar
los contratos funcionales y establecer una identidad única, legible, responsive y
eficiente.

## Dirección aprobada

La identidad es **Petróleo Prismático** con glass operativo: el vidrio expresa jerarquía
de superficie mediante transparencia, blur, borde, reflejo y sombra controlados, pero
ningún texto crítico depende de la transparencia. Se adopta la estrategia recomendada:
glass marcado de densidad media, navegación docente agrupada por dominio, migración
progresiva desde foundations hacia las aplicaciones cubiertas y radios de 8 px para controles,
12 px para tarjetas y 16 px para shells principales. La iconografía se mantiene vectorial,
policromática y semántica, con colores funcionales visibles por dominio sin depender de
duotono, raster ni glifos monocromáticos.
En escritorio amplio, el encabezado conserva identidad, contrato OMR, tema y salida en
una sola línea; el wrapping queda reservado para anchos menores, sin desplazar ni ocultar
la acción primaria.

## Alcance

**Alcance vigente de esta ejecución:** flavors Docente y Alumno. Incluye la revisión de
las pantallas del portal Alumno y una experiencia mejorada para compartir calificaciones
desde el flujo docente, incluido el reporte para OneDrive y el acceso individual por
matrícula con código al correo. Administración del negocio queda fuera. El bundle
distribuible docente continúa siendo independiente del Portal Alumno; las fuentes y los
builds separados se conservan.

- Fundaciones de color, tipografía, espaciado, radios, capas, sombras, motion y focus.
- Primitivas reutilizables para superficies, botones, campos, tabs, badges, mensajes,
  tablas/listas, diálogos, estados vacíos y toasts.
- Iconografía vectorial policromática de alta nitidez y control de cuenta docente con
  identidad, rol, estados de interacción y área táctil accesible.
- Shell y navegación de docente y alumno.
- Pantallas docentes: autenticación, materias, alumnos, asistencias, temarios, banco,
  plantillas, entrega, escaneo, calificaciones, evaluaciones, Classroom, sincronización,
  rehidratación y cuenta.
- Pantallas de alumno: acceso, resumen, materias, agenda, avisos, historial, resultados,
  detalle, revisión, conformidad y PDF.
- Rendimiento de carga inicial, carga diferida por destino/módulo, CSS y procesamiento
  de imágenes.

## Requisitos Funcionales

- REQ-001: Los colores de pantalla deben consumirse desde tokens semánticos de la
  identidad canónica; los nuevos módulos no pueden introducir hexadecimales locales.
- REQ-002: Las superficies deben usar variantes compartidas y fallback opaco equivalente.
- REQ-003: Los controles deben tener estados default, hover, active, focus-visible,
  disabled, loading y error cuando aplique.
- REQ-004: Texto normal debe conservar contraste mínimo 4.5:1 y texto grande 3:1 en
  claro y oscuro; el estado no debe depender solo del color.
- REQ-005: La navegación debe exponer contexto, ubicación actual y acción primaria sin
  obligar a recorrer una tira horizontal extensa en desktop.
- REQ-006: Formularios, guías y detalles avanzados deben usar revelación progresiva sin
  ocultar errores ni cambios sin guardar.
- REQ-007: Las pantallas deben conservar semántica HTML, orden de teclado, landmarks,
  nombres accesibles y soporte para reduced motion.
- REQ-008: La carga inicial no debe importar módulos pesados de otros destinos; OCR,
  QR y pantallas complejas deben cargarse bajo demanda.
- REQ-009: La migración visual no debe cambiar APIs, persistencia, permisos ni reglas
  de negocio.
- REQ-010: Cada oleada debe incluir prueba contractual, prueba responsive, contraste y
  captura visual autenticada de sus estados principal, loading, empty, error y success.
- REQ-011: Los comandos frontend que cargan Vite/Vitest deben usar un cargador de
  configuración compatible con Windows sin depender de escritura temporal en
  `node_modules/.vite-temp`.
- REQ-012: Los íconos de navegación y acciones deben conservar nitidez vectorial,
  diferenciación cromática por función, reconocimiento visual a tamaños pequeños y
  etiquetas accesibles; el control de cuenta docente debe ser operable, legible y
  diferenciable de versión, tema y salida.
- REQ-013: En anchos de escritorio amplio el encabezado docente debe mantener sus
  acciones principales en una sola fila; en anchos menores debe replegarse de forma
  determinista sin overflow horizontal ni pérdida de contexto.
- REQ-014: Cada página nueva o modificada debe evaluar e incorporar iconos vectoriales
  del catálogo compartido donde mejoren reconocimiento y lectura. Los estados y acciones
  no universales conservan texto visible y nombre accesible; las fuentes externas deben
  tener licencia verificada y su aviso completo preservado.
- REQ-015: El build del flavor docente debe emitir únicamente módulos de destino docente
  y dependencias compartidas necesarias para sus capacidades. No incluir chunks de
  Alumno o Administración del negocio ni artefactos obsoletos de builds anteriores. La
  selección de destino debe seguir funcionando en desarrollo; los módulos fuente y sus
  builds independientes no se eliminan. Esto mantiene el Portal Alumno como destino
  independiente dentro del alcance de UX vigente.
- REQ-016: En Sincronización, los cuatro KPI del encabezado se muestran con anchos y
  filas equilibrados en pantallas móviles, manteniendo nombre, valor, color funcional y
  textos accesibles; el layout de escritorio conserva la distribución disponible.
- REQ-017: En los flavors Docente y Alumno, el foco visible identifica el control enfocado;
  los contenedores ancestros no dibujan anillos redundantes. Solo los wrappers de un control
  compuesto muestran un indicador propio y localizado. Administración queda fuera de alcance.

## Oleadas de implementación

1. Foundations, primitivas y contrato de layout.
2. Shell, navegación y autenticación.
3. Docente: materias, alumnos, asistencias y temarios.
4. Docente: banco, plantillas, entrega, escaneo y calificaciones.
5. Docente: evaluaciones, Classroom, sincronización, rehidratación y cuenta.
6. Alumno completo.
7. Admin negocio queda fuera del alcance vigente.
8. Rendimiento, accesibilidad, responsive y auditoría visual final.

## Criterios de Aceptación

- Las aplicaciones Docente y Alumno usan los mismos tokens y primitivas, con acento
  semántico por dominio.
- No hay superficies principales con contraste insuficiente o texto ilegible sobre glass.
- La navegación docente es operable con teclado y no requiere scroll horizontal para
  encontrar acciones primarias en desktop.
- La interfaz funciona en 360, 768, 1024 y 1440 px sin solapamientos críticos.
- En 1366 px o más, las acciones del encabezado docente permanecen en una sola fila;
  en 390 px el encabezado y la navegación siguen siendo legibles y accionables.
- En Entrega, los cuatro KPI se distribuyen en una cuadrícula equilibrada de dos columnas
  hasta 720 px; no queda una tarjeta aislada debajo de una fila de tres.
- En Sincronización, los cuatro KPI del encabezado usan dos columnas hasta 720 px y
  mantienen celdas de igual ancho, sin truncar las etiquetas.
- `prefers-reduced-motion`, foco, labels y mensajes de error tienen cobertura automática.
- En Docente y Alumno, un control enfocado no ilumina a la vez todas las tarjetas y paneles
  que lo contienen; los selectores compuestos conservan su anillo localizado. Administración
  conserva el estilo previo.
- Navegación, acciones, categorías, estados y ayudas usan iconografía consistente cuando
  aporta comprensión, con texto y alternativa accesible según corresponda.
- La carga diferida se comprueba en el bundle y en una medición de navegación real.
- El bundle docente no contiene módulos de Alumno/Administración y la promoción de un
  build docente limpia artefactos ajenos anteriores de forma compatible con Windows.
- Se ejecutan los gates frontend aplicables y se documentan fallos preexistentes separados.

## Matriz de Trazabilidad

| Requisito | Evidencia | Estado |
| --- | --- | --- |
| REQ-001 a REQ-007 | `scripts/tests/ui-cards.contract.test.mjs`, `scripts/tests/ui-contrast-audit.mjs`, `apps/frontend/tests/ux.quality.test.tsx`, `apps/frontend/tests/appAdminNegocio.navigation.test.tsx`, `apps/frontend/tests/seccionSincronizacion.test.tsx`, `apps/frontend/tests/sincronizacion.behavior.test.tsx`, `apps/frontend/tests/seccionEntrega.test.tsx`, `apps/frontend/tests/plantillas.refactor.test.tsx`, `apps/frontend/tests/plantillasGenerados.test.tsx`, `apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx`, `apps/frontend/tests/seccionRehidratacionLotes.test.tsx`, `apps/frontend/tests/seccionCalificar.test.tsx` | Parcial; los tokens base definen radios de 8 px para controles, 12 px para tarjetas y 16 px para shells; la cascada final conserva 8 px en botones y campos. `ui-cards.contract.test.mjs` verifica esos valores. Entrega distingue error, lista vacía y búsqueda sin coincidencias; limpia datos al cambiar materia, aclara el alcance de conteos/progreso y evita anuncios vivos amplios. Los valores e iconos de sus cuatro KPI ahora conservan contraste de texto verificado en tema claro. Sincronización distingue error, historial vacío y filtro sin coincidencias, conserva el último historial al fallar una consulta, identifica el alcance de sus conteos y limita anuncios vivos al estado breve; Instantánea local conserva el nombre/checksum de la última operación completada juntos (8/8 pruebas de comportamiento PASS). Plantillas comunica errores, ofrece reintento y presenta selector, catálogo, edición, resultado e historial por título, materia, folio e identidad o fallback legible sin IDs opacos; sus tres pruebas focales pasan 29/29. Rehidratación distingue carga/vacío/error, expone el paquete seleccionado, evita anuncios KPI extensos, bloquea reconstrucciones no aptas, evita falsos éxitos, no afirma resultados prematuros y distingue verificación de reconstrucción; 16/16 pruebas focales PASS. Calificación manual evita IDs opacos y muestra etiquetas legibles; 4/4 pruebas PASS. La auditoría visual de todas las pantallas y estados continúa por terminar |
| REQ-006, REQ-007, REQ-009 | Claridad de modalidades y estados actuales en respaldos/sincronización | `apps/frontend/tests/seccionSincronizacion.test.tsx`; `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `apps/frontend/tests/seccionSincronizacionEquipos.test.tsx` | El paquete .ep-sync.json se diferencia de la instantánea completa .ep-snapshot; se retiran `.epbak`, ZIP y la promesa «Cero Pérdida». La guía usa Icono compartido. Sincronización entre equipos borra el reporte anterior al iniciar, identifica éxito/sin cambios/error por intento y serializa envío/recepción en la UI. Pruebas focales de esta pantalla: 6/6 |
| REQ-006, REQ-007, REQ-014 | Registro de entrega: asociación del bono, identidad y estado del lote | `apps/frontend/tests/seccionRegistroEntrega.test.tsx` | El control del bono deja de anidar etiquetas; el resumen de lote muestra nombre/matrícula, no IDs internos; estados y conteos expresan «Por confirmar»/errores; acciones de carga usan el catálogo compartido. Prueba focal: 1/1 |
| REQ-006, REQ-007, REQ-009, REQ-014 | Publicación y códigos del Portal Alumno: contexto de materia, resultado parcial, vacío/error y anuncios | `apps/frontend/tests/seccionPublicar.test.tsx` | Cambiar materia limpia código y lista anteriores; un código creado queda identificado como pendiente hasta publicarse; el fallo al cargar la lista no invalida la generación/publicación; la consulta vacía se distingue de no consultada; errores usan alerta accesible y selector/mensajes omiten IDs opacos. Pruebas focales: 9/9 |
| REQ-008 | `scripts/tests/frontend-performance.contract.test.mjs` y chunks de `npm -C apps/frontend run build` | Implementado; las secciones pesadas del docente y los destinos separados se compilan bajo demanda |
| REQ-009 | Suite funcional existente del frontend | Protegido |
| REQ-010 | `apps/frontend/tests/ux.visual.test.tsx`, `tests/gui-responsive/responsive-docente.spec.ts`, `tests/gui-responsive/responsive-alumno.spec.ts` y capturas de QA vinculadas | Parcial: recorrido sintético docente de 13 secciones a 320/360/390/768/1024/1366/1440 px; recorrido alumno de acceso/resultados/detalle a 320/360/390/768/1024/1440 px, con resultados claro/oscuro y tabla comparativa enfocada/desplazable. Se añade el HTML individual de calificaciones en `reports/qa/ux-reporte-html-20261030-current-audit/` (dos capturas inspeccionadas a 320 px y flujo offline 1/1 PASS) y Sincronización en `reports/qa/ux-sync-20261030-current-audit/` (navegación a cuatro destinos, tema claro/oscuro y contraste de KPI corregido; E2E 1/1 PASS). Capturas tablet/escritorio en `reports/qa/latest/`, y móvil en `reports/qa/ux-crossscreen-20261029-mobile/` y `reports/qa/ux-crossscreen-20261029-mobile-narrow/`. No sustituye estados completos por pantalla, zoom 200 %, lector de pantalla, OneDrive real ni la instalación local. |
| REQ-011 | `scripts/tests/frontend-performance.contract.test.mjs` y scripts de `apps/frontend/package.json` | Implementado en oleada 1 |
| REQ-012 | `apps/frontend/src/ui/iconos.tsx`, `apps/frontend/src/apps/app_docente/ShellDocente.tsx`, `scripts/tests/ui-cards.contract.test.mjs` | Implementado en oleada 2 |
| REQ-013 | `apps/frontend/src/styles/cards.css`, `apps/frontend/src/styles/screens.css`, `tests/gui-responsive/responsive-docente.spec.ts` y capturas `reports/qa/ux-wave1/screenshots/current-20261029/` | Implementado en oleada 3; Entrega alinea sus cuatro KPI en 2×2 en pantallas de hasta 720 px; el recorrido visual valida filas y columnas a 390 y 320 px. |
| REQ-014 | `docs/WCAG_UI_POLICY.md`, `apps/frontend/src/ui/iconos.tsx`, `apps/frontend/src/apps/app_docente/GuiaEntregaVisual.tsx` | Guía de entrega: iconos decorativos del catálogo, acciones legibles, etiquetas de ejemplo explícitas y estados sin glifos; `apps/frontend/tests/guiaEntregaVisual.test.tsx`; prueba focal 1/1 PASS. Auditoría visual runtime pendiente |
| REQ-015 | `apps/frontend/tests/app.selector.test.tsx`, `scripts/tests/docente-bundle-guard.test.mjs`, `scripts/tests/frontend-performance.contract.test.mjs`, build docente aislado y `scripts/verify-docente-bundle.mjs` | Implementado; build baseline emitía `AppAlumno` y `AppAdminNegocio`, mientras que el build aislado actualizado emite solo `AppDocente`; el guard rechaza los chunks ajenos y el build limpia artefactos obsoletos |
| REQ-016 | `tests/gui-responsive/responsive-docente.spec.ts`, `apps/frontend/src/styles/screens.css`, capturas `reports/qa/ux-crossscreen-20261029-mobile/` y `reports/qa/ux-crossscreen-20261029-mobile-narrow/` | Implementado; 13 secciones pasan el recorrido a 320/390 px, KPI de Sincronización en 2×2 con celdas iguales y sin overflow |
| REQ-017 | `tests/gui-responsive/responsive-docente.spec.ts`, `tests/gui-responsive/responsive-alumno.spec.ts`, `apps/frontend/src/styles/cards.css` | Entrega conserva el anillo del resumen enfocado sin dibujarlo en el panel ancestro (E2E Edge 1/1); Portal Alumno mantiene el foco en la región de comparación sin anillo en la tarjeta del folio (E2E Edge 8/8). Capturas en `reports/qa/ux-entrega-current-focus-20261031/` y `reports/qa/ux-entrega-current-focus-20261031/alumno-regression/`. |

### Revalidación parcial de interfaz (2026-10-30)

- En el HTML individual de calificaciones se mejoró el anuncio de éxito a «Resultado
  disponible para esta matrícula» y se corrigió la captura E2E para incluir toda la página
  después de enviar el formulario.
- Validación de alcance: generador HTML 8/8; panel de exportación 14/14; consulta offline en
  Edge a 320 CSS px 1/1; ESLint focal, auditoría SDD y `git diff --check` PASS.
- La evidencia usa alumnos ficticios y archivo local. No cierra la auditoría de cada estado
  y pantalla ni valida instalación, OneDrive, zoom al 200 % o lector de pantalla. El estado
  global de REQ-010 permanece parcial.
- Sincronización conserva foco y navegación accesible entre cuatro tareas a 320 px. En tema
  claro, sus KPI ahora usan tokens de texto con contraste verificado por el guard general;
  pruebas de pantalla/contrato responsive 32/32 y E2E 1/1 PASS. La evidencia usa fixture y
  no valida servicios o respaldos reales; la auditoría general continúa parcial.

### Revalidación de separación por flavor (2026-10-28)

- `node --test scripts/tests/docente-bundle-guard.test.mjs`: 4/4 PASS.
- `npm run test -- tests/app.selector.test.tsx`: 5/5 PASS para selección de destino,
  OAuth docente y las superficies alumno/admin en desarrollo.
- `npm run verify:docente:bundle`: PASS; el `dist-docente` actual contiene el módulo
  principal `AppDocente` y no emite chunks `AppAlumno` ni `AppAdminNegocio`.
- Build de Alumno con `VITE_APP_DESTINO=alumno` y salida temporal aislada: typecheck y
  compilación PASS; se emitió `AppAlumno` sin chunks de Docente ni Administración.
- La inspección inicial encontró que `dist-alumno` contenía 120 assets y cinco
  generaciones de chunks de cada destino. El listener 4173 corresponde al runtime
  instalado bajo `%LOCALAPPDATA%\EvaluaPro`, no a este worktree. Después,
  `npm run build:alumno` limpió y regeneró el directorio local: ahora tiene 9 assets y
  un solo chunk de aplicación, `AppAlumno`; la instalación no se modificó.
- La auditoría visual de runtime con datos dummy sigue pendiente; la sesión visible mostró
  nombres de alumnos y no se utilizó como evidencia.

## Foco visual localizado (2026-10-31)

- Hallazgo en las capturas sintéticas actuales de Entrega y Portal Alumno: al enfocar el
  resumen de conexión móvil o la tabla comparativa, el estilo compartido dibujaba anillos
  también en tarjetas ancestros, haciendo menos evidente dónde estaba el foco.
- Cambio: se retiró el `:focus-within` global de tarjetas/paneles para Docente y Alumno.
  Permanecen los anillos `:focus-visible` de controles y los wrappers explícitos para
  selectores compuestos como los de archivos. Administración conserva el selector anterior.
- Fundamento: WCAG 2.2 SC 2.4.7 exige que el foco de teclado sea visible para identificar
  el componente activo; 2.4.13 nivel AAA describe área y contraste del indicador. Fuentes
  W3C: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html y
  https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html.
- Los E2E focales de Entrega (1/1) y Portal Alumno (8/8) comprueban que el control conserva
  su contorno y la tarjeta ancestro no lo recibe. Se inspeccionaron capturas a 320/360 CSS px
  en `reports/qa/ux-entrega-current-focus-20261031/` y su subdirectorio `alumno-regression/`.
- Alcance de la evidencia: fixture con datos ficticios en Edge; no cubre la instalación,
  zoom manual al 200 %, lector de pantalla ni conexión real del teléfono.

## Fuera de alcance

- Cambios de API, modelo de datos, autenticación, permisos o lógica de evaluación.
- Dependencias nuevas de producción sin especificación y aprobación separadas.
- Cambios en Installer Hub nativo; se planifica después de cerrar las tres superficies web.
