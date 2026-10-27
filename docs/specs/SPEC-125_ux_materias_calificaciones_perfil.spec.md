---
id: SPEC-125
titulo: Mejora UX de Materias, Calificaciones y Perfil Docente
version: 1.0.8
fecha: 2026-10-26
autor: Codex
modulo: frontend_docente_ux
estado: approved
---

## Contexto

Se abordará la GUI docente sección por sección, iniciando por Materias, Calificaciones y Cuenta (perfil docente). La fase debe reutilizar la dirección visual y los contratos ya aprobados en `SPEC-054` (identidad frontend), `SPEC-057` (Materias) y `SPEC-097` (Calificaciones), junto con el contrato funcional de Cuenta en `SPEC-049`; no crea otra identidad visual. Esta especificación coordina y acota la primera oleada a claridad, jerarquía, legibilidad, navegación, formularios, listas y estados de interfaz. No autoriza cambios de API, persistencia, permisos, cálculos de calificación ni reglas académicas.

La inspección visual de referencia se realizó en la instalación docente local y en el navegador integrado el 2026-10-25. Durante la primera implementación, el runtime dejó de responder; después se diagnosticó un rechazo del guard CSS, se corrigió el contrato de selectores, se ejecutó el procedimiento no destructivo documentado y API/UI volvieron a responder HTTP 200. Los builds experimentales se sincronizan con respaldo y verificación SHA-256.

El 2026-10-26, la vista Cuenta a 320 CSS px mostró contenido recortado: `cuenta-panel` tenía 237 px disponibles, pero su cabecera requería 285 px y el contenedor ocultaba el excedente. El ancho del documento no se desbordaba, por lo que el fallo no era detectable mirando solo la barra horizontal.

La reanudación de la auditoría capturó el runtime real en el navegador integrado el 2026-10-25 a 571 × 764 CSS px, en tema oscuro automático. Las capturas baseline de Materias, Calificaciones, Cuenta y Alumnos están en `reports/qa/gui-ux/2026-10-25/`. La navegación inicial mostraba solo parte de las secciones y exigía desplazamiento horizontal; REQ-005A sustituye esa tira por un selector accesible en pantallas estrechas.

La revisión detallada de Resultados por alumno encontró que la tabla de nueve columnas se comprimía y solapaba contenido a 571 px porque su presentación como fichas solo se activaba hasta 480 px. Se amplió el patrón a 700 px y el runtime mostró después una ficha por alumno con etiquetas de datos y acción en fila completa. La cuadrícula de las cinco vistas internas se conserva en dos columnas a 571 px; su regla de una columna solo aplica hasta 480 px. Evidencia antes/después y límites pendientes: `reports/qa/gui-ux/2026-10-25/review-notes.md`.

## Requisitos Funcionales

- **REQ-001 (Materias):** Revisar portada, catálogo activo/archivado, altas, edición, selectores, estados, ayudas y acciones de grupos. Ordenar visualmente el contenido para que el nombre de materia, grupo/contexto y acción principal se identifiquen con facilidad. Explicar los campos obligatorios/opcionales y exponer su semántica en alta y edición. Conservar contratos CRUD, portadas y navegación vigentes.
- **REQ-002 (Calificaciones):** Revisar vistas de resultados, extraordinarios, actas, operación OMR y Classroom, incluidos filtros, selectores, listas/tablas, estados y exportación. Hacer explícitos materia/periodo, estado de resultados y siguiente acción sin alterar cálculos, origen de datos, sincronización ni criterios de calificación. Cuando una búsqueda deje cero filas, explicar el estado y permitir limpiar esa búsqueda sin reiniciar filtros independientes. En captura OMR, explicar junto al campo Página que `0` intenta detectar el número con el QR y que la entrada manual usa el número impreso desde 1.
- **REQ-003 (Perfil/Cuenta):** Revisar datos del docente, institución/logos, preferencias y seguridad de cuenta. Agrupar campos por propósito, usar etiquetas e instrucciones claras y comunicar validación, guardado y errores sin modificar autenticación, seguridad ni persistencia. En anchos estrechos, todos los indicadores y el contenido de cada panel deben replegarse dentro del ancho disponible sin recorte horizontal.
- **REQ-004 (Sistema visual):** Reutilizar tokens, componentes e iconografía existentes. Mejorar jerarquía tipográfica, espaciado, contraste y densidad donde la captura lo justifique; mantener los temas claro/oscuro y evitar colores crudos, texto ambiguo y señales que dependan solo del color.
- **REQ-005 (Accesibilidad y estados):** Mantener operación por teclado, orden de foco, foco visible, nombres y etiquetas accesibles; revisar carga, vacío, error y éxito disponibles. Mantener composición responsive y `prefers-reduced-motion`.
- **REQ-005A (Navegación estrecha):** Hasta 1023 CSS px, exponer todas las secciones permitidas mediante un selector nativo con nombre accesible y valor sincronizado con la sección activa. Evitar que el docente deba desplazar horizontalmente la navegación para descubrir otras secciones. En escritorio se conserva la navegación agrupada actual y su teclado.
- **REQ-006 (Compatibilidad):** Mantener en español el contenido docente y preservar acciones, permisos, rutas, datos históricos, exportaciones y nombres accesibles existentes, salvo corrección expresamente documentada y aprobada.

## Criterios de Aceptación

1. Se inspecciona y documenta cada pantalla de las tres secciones en ejecución, con capturas de referencia y verificación posterior. Una pantalla no disponible en el runtime se registra como pendiente; un error de arranque no cuenta como evidencia de esa pantalla.
2. Cada cambio visual queda vinculado a un hallazgo concreto de captura o a un riesgo comprobable de interacción/accesibilidad.
3. Materias conserva alta, edición, apertura de grupo, gestión de portadas, descarga y archivo/restauración que existan en la versión objetivo; nombre y fechas se identifican como obligatorios y grupos/portada como opcionales.
4. Calificaciones conserva sus filtros, navegación interna, consulta/exportación y estados Classroom/OMR; no cambia fórmulas, registros, publicación ni sincronización. Una búsqueda sin coincidencias comunica el vacío y ofrece limpiar únicamente la búsqueda. La captura OMR mantiene el valor predeterminado `0`, lo explica como detección por QR y comunica que el número manual empieza en 1.
5. Cuenta conserva perfil, configuración institucional, seguridad de sesión y preferencias; no cambia credenciales ni semántica de guardado. A 320 CSS px el resumen y los paneles se ajustan al ancho disponible sin ocultar texto o controles.
6. Los cambios mantienen contraste registrado en claro/oscuro, foco y teclado, nombres accesibles, y comportamiento responsive/movimiento reducido conforme a la política UI del repositorio.
7. Las pruebas focales y gates exigidos por `AGENTS.md` se ejecutan tras la aprobación de esta especificación y cualquier limitación queda reportada con su resultado exacto.
8. A 320, 390, 571 y 1023 CSS px, cada sección permitida se puede alcanzar desde el selector visible; cambiar la opción cambia la vista actual sin recargar ni alterar permisos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Edición, portada, catálogo y semántica de campos requeridos de materias | `apps/frontend/tests/seccionPeriodos.edit.test.tsx`; `apps/frontend/tests/seccionPeriodos.portada.test.tsx`; `apps/frontend/tests/seccionPeriodos.listasInstitucionales.test.tsx`; `apps/frontend/tests/seccionPeriodosArchivados.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx` | Parcial: alta y edición anuncian campos obligatorios/opcionales y exponen `required`; el panel activo y archivado refluye a 320/390/571 px; el archivo presenta conteos etiquetados con iconos consistentes; nombres visibles y etiquetas accesibles de grupo/portada omiten el ID técnico; faltan recorridos completos de teclado, demás acciones/estados y tema claro |
| REQ-002 | Rutas, resumen, selector manual, captura OMR y aclaración de página automática | `apps/frontend/tests/seccionCalificaciones.routing.test.tsx`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx`; `apps/frontend/tests/escaneo.refactor.test.tsx`; `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx` | Parcial: búsqueda tipada como `search` y estado sin coincidencias con acción que limpia solo la búsqueda; prueba sintética comprueba recuperación de filas; OMR explica detección QR y numeración manual desde 1; Actas y Revisión OMR refluyen a 320 px; faltan recorridos de otras acciones, exportaciones, tema/teclado en toda la sección y validación final runtime |
| REQ-003 | Perfil, preferencias e institución, incluido reflow a 320 CSS px | `apps/frontend/tests/seccionCuenta.test.tsx`; `apps/frontend/tests/sincronizacion.behavior.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx` | Parcial: perfil, preferencias y sincronización mejorados; panel refluye a 320/390/571/1023 px; los indicadores usan mínimo de 8 rem en móvil/tablet y se verifican visualmente en distribución 3+2 a 571 px; faltan estados, teclado y tema claro en el recorrido completo |
| REQ-004 | Contrato visual y calidad UX | `apps/frontend/tests/ux.visual.test.tsx`; `apps/frontend/tests/ux.quality.test.tsx`; `apps/frontend/tests/seccionCuenta.test.tsx` | Parcial: Cuenta reemplaza emojis de ayuda y búsqueda por los iconos accesibles compartidos; quedan por completar la auditoría global de consistencia visual y todos los recorridos de pantalla |
| REQ-005 | Navegación responsive y controles accesibles, incluidos objetivos táctiles de al menos 24 × 24 CSS px | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `apps/frontend/tests/ux.quality.test.tsx` | Parcial: selector móvil y cierre del recordatorio cumplen el tamaño mínimo; faltan recorridos completos de teclado, temas y estados |
| REQ-006 | Compatibilidad funcional de las secciones | Archivos de pruebas indicados en REQ-001 a REQ-003 | Pendiente |
| REQ-005A | Navegación de todas las secciones en pantallas estrechas | `apps/frontend/tests/appDocente.secciones.test.tsx`; `apps/frontend/tests/gui.responsive.contract.test.tsx`; recorrido runtime | Parcial: selector presente y viewport sin overflow a 320/390/571/1023 px; falta completar teclado y rutas de todas las secciones |
