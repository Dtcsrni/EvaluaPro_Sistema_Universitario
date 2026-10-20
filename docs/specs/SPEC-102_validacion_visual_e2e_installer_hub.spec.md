---
id: SPEC-102
titulo: Validación visual de E2E de GUI y release docente-local
version: 1.0.0
fecha: 2026-10-14
autor: Codex
modulo: installer_hub_ci
estado: approved
---

## Contexto

Los recorridos GUI de EvaluaPro, el Installer Hub y la Web docente instalada necesitan verificar la experiencia visible del usuario. La matriz responsive actual ya captura algunas pantallas y comprueba overflow o nombres accesibles, pero la existencia de PNG por sí sola no demuestra que la captura corresponda al estado esperado ni que jerarquía, contenido y controles se vean correctamente. Para evaluar 1.2.8 como candidata estable, cada E2E de interfaz debe validar y conservar evidencia visual del mismo SHA, sin crear tag ni publicar una release. Los E2E exclusivamente API mantienen sus contratos funcionales; no se les atribuye validación visual de una interfaz inexistente.

## Requisitos Funcionales

El run #38680577429 generó un PNG válido cuyo contenido aún era el fallback `Cargando EvaluaPro…`; el contrato anterior comprobaba integridad de imagen, pero no esperaba que la aplicación docente terminara de cargar antes de capturarla. La captura web debe esperar que desaparezca el estado de carga y que el encabezado accesible `Plataforma Docente` esté visible.

- **REQ-001:** El E2E del Installer Hub validará las capturas PNG de cada etapa visual: formato legible, dimensiones no vacías, contenido distinto de una imagen en blanco/monocroma y correspondencia con el tamaño de ventana declarado. Un archivo faltante, corrupto, vacío o tomado de otra etapa hará fallar el E2E.
- **REQ-002:** En la GUI del Installer Hub, cada etapa conservará evidencia asociada a su nombre de etapa y validará por UI Automation que la ventana está visible, contiene el estado/título esperado y expone su acción principal dentro del área visible y habilitada cuando corresponda. El manifiesto registrará nombre, ruta relativa, dimensiones, tamaño y SHA-256 de cada imagen.
- **REQ-003:** El E2E del runtime docente abrirá la aplicación instalada y, para vistas de 1280×720 y 1280×820, comprobará HTTP 200, contenido principal visible, ausencia de desbordamiento horizontal, controles principales dentro del viewport y elementos interactivos con nombre accesible. Guardará capturas inspeccionables por tamaño.
- **REQ-004:** La ejecución de aceptación de 1.2.8 ejecutará el gate existente de UX visual del frontend (`npm run test:ux-visual:ci`) además del E2E de instalación, upgrade, reparación, desinstalación y preservación de datos. La falla del gate visual bloqueará el resultado exitoso.
- **REQ-005:** La evidencia se publicará como artefacto de CI en el flujo de aceptación sin tag y sin crear/publicar una release. Se conservarán manifiestos legibles por máquina y un tutorial/índice para revisión visual humana; las imágenes y notas deben referirse a la ejecución actual.
- **REQ-006:** La revisión UX/UI se limitará a capturas obtenidas en la ejecución actual y registrará para cada paso estado general, problemas visibles de recorte, solapamiento, contraste aparente, jerarquía y affordances. Las capturas no bastan para declarar conformidad WCAG completa; se registrarán límites y se exigirán las pruebas automatizadas y manuales de accesibilidad aplicables.
- **REQ-007:** El E2E inicializará explícitamente el estado de propiedad del App Host antes de cualquier lectura bajo `Set-StrictMode`. Si el arranque falla antes de crear el proceso, la ruta de limpieza deberá terminar sin error secundario por variable no definida; si el runner sí inició el App Host, conservará la validación de identidad antes de cerrarlo.
- **REQ-008:** Todo E2E que recorra una interfaz de usuario (docente, alumno, administración, ciclo integral, banco/reactivos, plantilla/PDF e Installer Hub) capturará los estados visuales relevantes de cada pantalla/acción primaria y aplicará aserciones UX sobre el mismo estado: contenido principal y acción esperada visibles, controles nombrados, sin overflow horizontal ni solapamiento material, y viewport documentado. Ninguna ruta GUI E2E quedará cubierta solo por snapshots de componentes o capturas históricas.
- **REQ-009:** La evidencia visual de cada recorrido se asociará a etapa, superficie, estado y viewport; el gate validará integridad PNG, dimensiones declaradas, contenido no vacío y manifiesto con SHA-256. Una imagen faltante, corrupta o asociada a otro estado bloqueará el recorrido.
- **REQ-010:** La aceptación GUI de 1.2.8 ejecutará los E2E responsive de docente, alumno, administración, ciclo integral, banco/reactivos, PDF y el E2E real del Installer Hub. La auditoría UX/UI revisará capturas de la ejecución actual con criterios del usuario objetivo (jerarquía, legibilidad, contraste aparente, recorte, solapamiento, feedback y acción primaria); las pruebas automatizadas de accesibilidad seguirán siendo obligatorias y las capturas no se presentarán como conformidad WCAG completa.
- **REQ-011:** Cada captura web del Installer Hub declarará su superficie (`apphost` o `docente`) y aplicará el contrato visual de esa interfaz. `apphost` validará el título, la pestaña activa, controles accesibles y que los indicadores de estado no se compriman por debajo de su ancho legible; `docente` conservará su contrato de contenido principal y encabezado de plataforma. No se permitirá reutilizar aserciones de una superficie para la otra.
- **REQ-012:** La E2E del Installer Hub no declarará éxito únicamente por la respuesta del helper de instalación. Debe observar en UI Automation los tres textos de estado final satisfactorio y la etapa Resultado activa antes de capturar la pantalla final o continuar; la GUI cerrada o aún en Ejecución al recibirse una respuesta exitosa del helper no demuestra la experiencia visible completa.

## Criterios de Aceptación

- Una imagen vacía, corrupta, monocroma, con tamaño incorrecto o sin etapa coincidente produce un fallo accionable.
- Una ventana ausente, fuera del área visible, sin el control esperado o sin el estado esperado bloquea el E2E.
- En los viewports web probados no existe overflow horizontal y el título principal y la acción primaria son visibles; los hallazgos se adjuntan a sus capturas.
- El E2E documenta instalación/upgrade, arranque, salud web/API, reparación, desinstalación, preservación de datos y validaciones visuales.
- El gate `test:ux-visual:ci` pasa para el SHA candidato y su reporte queda como evidencia del mismo proceso de aceptación.
- Un escenario donde todavía no existe App Host podrá entrar y salir de la limpieza sin error de variable indefinida; un escenario con App Host iniciado continuará verificando su identidad y cierre controlado.
- Cada E2E GUI configurado tiene estados capturados y validados mediante assertions de UX/layout en su propio recorrido. Esto abarca `tests/gui-responsive/` (docente, alumno, administración, ciclo integral, banco/reactivos y PDF) y `scripts/tests/installer-hub-e2e-docente.ps1` (Installer Hub y runtime instalado).
- El manifiesto de evidencia enlaza capturas legibles con etapa, estado, viewport y SHA candidato; capturas de ejecuciones previas no satisfacen el gate.
- Los E2E API-only conservan sus contratos y se reportan con alcance explícito, sin simular que una captura prueba su funcionamiento.
- Artefacto de CI y auditoría visual provienen del SHA candidato y no dependen de capturas históricas o de release previa.
- Las capturas del dashboard App Host y Web docente usan contratos independientes, y los indicadores de estado del dashboard mantienen un ancho legible en el viewport de aceptación.
- La respuesta positiva del helper no sustituye el estado final visible del Installer Hub; la captura de resultado muestra la etapa Resultado y el mensaje final de éxito.
- La matriz de trazabilidad queda actualizada y `npm run sdd:audit` pasa antes de considerar implementada esta spec.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-007, REQ-009 | Contrato de capturas Installer Hub, inicialización App Host, validación de imagen y UI Automation | `scripts/tests/installer-upgrade-e2e-contract.test.mjs`; `scripts/tests/gui-visual-e2e-contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | En implementación |
| REQ-003 | Captura de Web docente espera el fin del estado de carga y un encabezado accesible visible | `scripts/tests/capture-installer-web.mjs`; `scripts/tests/installer-hub-contract.test.mjs` | En implementación |
| REQ-004, REQ-005 | Flujo CI ejecuta y conserva el gate UX visual junto con la E2E del bundle; el flujo comprueba el respaldo ZIP privado y preservación SQLite | `scripts/tests/installer-upgrade-e2e-contract.test.mjs`; `scripts/tests/gui-visual-e2e-contract.test.mjs`; `scripts/tests/installer-hub-contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | En implementación |
| REQ-006, REQ-010 | Capturas y auditoría UX/UI actuales, con límites WCAG explícitos | Artefactos `installer-hub-e2e`, resultados Playwright responsive y auditoría visual del run | En implementación |
| REQ-011 | Perfil explícito apphost/docente con layout responsive inspeccionable | `scripts/tests/capture-installer-web.mjs`; `scripts/tests/gui-visual-e2e-contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | En implementación |
| REQ-012 | Éxito visible terminal previo a captura y continuación del flujo | `scripts/tests/installer-hub-contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | En implementación |
| REQ-007 | Primer uso, arranque fallido y limpieza bajo `Set-StrictMode` sin excepción secundaria; propiedad de App Host preservada | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | En implementación |
| REQ-008 | Recorridos GUI validan estados visuales, límites responsive y controles interactivos, y capturan estados asíncronos solo tras verificar el estado terminal visible | `scripts/tests/gui-visual-e2e-contract.test.mjs`; `tests/gui-responsive/visual-fixtures.ts`; `tests/gui-responsive/responsive-docente.spec.ts`; `tests/gui-responsive/responsive-alumno.spec.ts`; `tests/gui-responsive/responsive-admin.spec.ts`; `tests/gui-responsive/ciclo-completo.spec.ts`; `tests/gui-responsive/banco-reactivos.spec.ts`; `tests/gui-responsive/plantillas-pdf-edge.spec.ts`; `tests/gui-responsive/journey-docente-integral.spec.ts` | En implementación |
