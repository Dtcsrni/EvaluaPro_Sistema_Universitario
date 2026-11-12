---
id: SPEC-127
titulo: Mejora UX de acceso docente
version: 1.0.26
fecha: 2026-11-05
autor: Codex
modulo: frontend_docente_autenticacion_ux
estado: implemented
---

## Contexto

La revalidación del guard WCAG localizó ocho colores crudos nuevos en la paleta clara del acceso docente. La revisión del showcase mostró además un badge translúcido: para estabilizar su lectura, el badge claro usará tokens semánticos y una superficie opaca, y el texto de apoyo usará tokens de contenido con mayor contraste.

El usuario amplió la auditoría UX/UI para incluir la pantalla de login. La inspección del 2026-10-28 se hizo en una pestaña lateral nueva con Vite aislado y una API ficticia; el runtime de `localhost:4173` permaneció intacto. Se usaron únicamente la cuenta `docente.e2e@example.invalid` y datos de prueba.

Hallazgos observados: a 390 × 844 CSS px la pantalla antepone el bloque de presentación y las ventajas del producto, por lo que el formulario de acceso queda fuera de la primera vista; los campos vacíos muestran placeholders con aspecto de credenciales ya capturadas; y, cuando el API ficticio declara Google deshabilitado, la pantalla muestra ese estado junto con una acción prominente para reintentar. Esta última combinación puede confundir el estado real de la integración. La revisión incluyó tema oscuro y tamaño móvil; tema claro, errores de credenciales y el recorrido de foco quedan pendientes. En la revisión estática actual, los errores de ingresar, registrar y recuperar se anuncian en el mensaje ligado al formulario y también como toasts con el mismo detalle.

## Fuentes de diseño y accesibilidad

- [W3C WCAG 2.2: Reflow (SC 1.4.10)](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): conservar la información y funcionalidad al reacomodar contenido en anchos estrechos.
- [W3C WCAG 2.2: Status Messages (SC 4.1.3)](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): exponer estados y errores dinámicos a tecnologías de asistencia sin mover el foco.
- [W3C WAI: Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/): identificar los campos obligatorios en las etiquetas y asociar instrucciones con sus controles.
- [W3C WAI: Validating Input](https://www.w3.org/WAI/tutorials/forms/validation/): comunicar el requisito en la etiqueta y con el atributo nativo `required`.
- [GOV.UK Design System: Text input](https://design-system.service.gov.uk/components/text-input/): conservar etiquetas visibles y evitar usar placeholders como etiquetas, ayudas o ejemplos esenciales.
- [GOV.UK Design System: Error message](https://design-system.service.gov.uk/components/error-message/): describir qué ocurrió con lenguaje claro y comunicar fallos de servicio de manera distinta de errores del usuario.
- [WAI-ARIA APG: Toolbar Example](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/): los botones de alternancia mutuamente excluyentes usan semántica de grupo para exponer que forman una sola elección.

## Alcance

Mejorar la pantalla de acceso docente y los estados de inicio de sesión que aparecen en ella. Incluye jerarquía responsive, campos, acceso por contraseña, disponibilidad de Google, estados de carga/error y recuperación. No cambia API, autenticación, seguridad, registro de cuentas, persistencia de sesión, credenciales, permisos, destinos OAuth ni contratos de backend.

## Requisitos Funcionales

- **REQ-001 (Acceso prioritario):** En móvil, presentar el inicio de sesión al comienzo del flujo y conservar el contenido informativo sin obligar a desplazarse por toda la presentación antes de encontrar los campos y la acción principal. En escritorio, mantener la identidad y el contexto institucional.
- **REQ-002 (Google):** El texto de estado y las acciones deben reflejar la misma condición. Distinguir una integración deshabilitada intencionalmente de una consulta temporalmente fallida; permitir reintentar solo cuando la consulta pueda recuperarse.
- **REQ-003 (Credenciales):** Mantener etiquetas visibles, `type`, `autocomplete`, el control para mostrar/ocultar contraseña y nombres accesibles. Identificar visualmente en la etiqueta y mediante `required` los campos obligatorios del inicio de sesión. Los campos vacíos no deben parecer previamente llenados; cualquier formato de ejemplo debe distinguirse del valor escrito.
- **REQ-004 (Feedback):** Presentar validación de credenciales y errores del servicio con texto claro, contraste, relación programática con el formulario y anuncio accesible. Permitir recuperar el foco y volver a intentar sin perder el correo capturado. No repetir en un toast un error que ya se conserva en el formulario; solo mostrar un toast adicional cuando incluya una acción distinta para recuperar una sesión y use un mensaje complementario.
- **REQ-005 (Calidad visual y accesibilidad):** Revisar tema claro/oscuro, foco visible, teclado, contraste, reflow y anchos de 320/390/576 CSS px; preservar `prefers-reduced-motion`.
- **REQ-006 (Compatibilidad):** Conservar inicio de sesión, registro, recuperación, acceso por contraseña cuando esté permitido, Google OAuth y persistencia de sesión; no alterar emisión/validación de token ni selección de proveedor.
- **REQ-007 (Espera al reintentar Google):** Durante la consulta de recuperación, Login sustituye temporalmente el mensaje de error anterior por un estado visible y cortés persistente; al terminar sin recuperar el proveedor, vuelve a mostrar el error actualizado. El botón comunica que está ocupado, el foco no se mueve y no cambian el callback, la autenticación ni el acceso alternativo por correo/contraseña.
- **REQ-008 (Contraste estable en acceso claro):** los títulos y el texto de apoyo usan tokens semánticos con contraste mínimo 4.5:1 sobre el tono más oscuro de la superficie clara. El badge del showcase claro usa fondo opaco, texto de al menos 4.5:1 y borde de al menos 3:1, según [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). No añadir colores crudos nuevos para esos elementos.
- **REQ-009 (Error recuperable de Google Desktop):** si Google Desktop no confirma la identidad o no puede iniciar, comunicar el resultado con semántica y estilo de error y ofrecer reintentar con Google desde el mismo control. Al iniciar Google, retirar errores pendientes del intento por contraseña para evitar mensajes simultáneos de intentos distintos. Mantener disponibles las alternativas de acceso que permita la instalación, sin cambiar OAuth ni la recuperación de contraseña.
- **REQ-010 (Claridad de recuperación):** nombrar la acción por el resultado («Restablecer contraseña») y explicar que requiere verificar con Google la cuenta vinculada; conservar la reautenticación y el cambio de contraseña existentes.
- **REQ-011 (Error OAuth web sin causa confirmada):** si Google Identity Services informa un fallo genérico, no atribuirlo a una causa técnica concreta ni exponer instrucciones de configuración de Google Cloud al docente. Presentar una única alerta comprensible, conservar el botón Google y ofrecer correo/contraseña como alternativa permitida. No cambiar OAuth ni sus callbacks.
- **REQ-012 (Medidor visual de contraseña):** durante el registro, mostrar el nivel con uno a cuatro segmentos activos y colores semánticos de alto contraste por tema. Mantener el texto que identifica el nivel como alternativa accesible y conservar los criterios actuales de evaluación de la contraseña.
- **REQ-013 (CTA en error Google móvil):** en anchos de 320 CSS px, tras un error recuperable de Google, conservar la alerta, el reintento, las alternativas de recuperación y el formulario; el botón principal de ingreso debe caber en el primer viewport. Para lograrlo, se puede ocultar solo la descripción introductoria redundante del formulario, sin reducir etiquetas, ayudas, controles ni áreas táctiles.
- **REQ-014 (Promesas de producto verificables):** el texto promocional de Login no atribuye velocidad o privacidad absoluta que no esté medida o demostrada. Describe OMR como apoyo para procesar y revisar hojas, e identifica SQLite como almacenamiento local sin afirmar que todos los datos permanezcan exclusivamente en el equipo.
- **REQ-015 (Contexto del selector de acceso):** los botones mutuamente excluyentes «Ingresar» y «Registrar» permanecen como botones toggle con `aria-pressed`; su contenedor usa un grupo con nombre accesible «Modo de acceso». La selección, el foco y las acciones actuales no cambian.
- **REQ-016 (Proveedor Google único por plataforma):** si Google Desktop y Google Web están disponibles simultáneamente, Registro muestra solo la acción de Google Desktop; si Desktop no está disponible, conserva Google Web. Evita dos acciones equivalentes en la misma vista sin modificar OAuth, credenciales ni el autollenado del perfil.
- **REQ-020 (Consecuencia de sesión recordada):** junto al checkbox que mantiene la sesión iniciada, mostrar la advertencia «Si el equipo es compartido, desactívala.» y asociarla programáticamente con el checkbox. La ayuda debe permanecer legible y no sacar el CTA principal del primer viewport a 320 CSS px. No cambiar el valor inicial, el mecanismo de almacenamiento, la duración, autenticación ni contratos.

## Criterios de Aceptación

1. A 320 y 390 CSS px, el formulario y su botón principal aparecen al inicio del recorrido sin que el bloque informativo los empuje fuera de la primera vista.
2. A 1024 y 1920 CSS px, se conserva una jerarquía legible sin superposición ni recorte.
3. Se distingue visual y textualmente el estado “Google deshabilitado” de un fallo temporal que sí puede reintentarse.
4. Correo y contraseña vacíos no parecen valores ya guardados; las etiquetas permanecen visibles y asociadas a cada campo, e indican que son obligatorios tanto visualmente como en HTML.
5. Con credenciales ficticias, el acceso exitoso conserva la navegación existente; con credenciales ficticias incorrectas, el mensaje identifica el problema y permite corregir/reintentar sin perder el correo.
6. Los estados dinámicos se exponen con roles apropiados; foco y operación por teclado se verifican en ambos temas.
7. Se mantienen los contratos de seguridad/autenticación; pasan pruebas focales de acceso, quality/visual, responsive, `npm run guard:wcag`, lint y typecheck.
8. Las capturas de referencia y posterior usan solo cuentas y datos ficticios; se registran los estados/temas/tamaños no comprobados.
9. Los errores de acceso, registro, recuperación y disponibilidad de Google se presentan una sola vez en el contexto del formulario; un toast de sesión solo aparece con acción de recuperación distinta y permanece disponible hasta usarla o cerrarla.
10. Al activar «Volver a consultar Google», el error anterior se sustituye por un estado `status` persistente de consulta mientras el botón indica `aria-busy="true"`; el foco permanece en el botón. Si la consulta no recupera el proveedor, reaparece el mensaje actualizado y el estado de espera queda vacío.
11. En el tema claro, `scripts/tests/ui-contrast-audit.mjs` verifica los pares de título, texto de apoyo, texto del badge y borde del badge contra sus fondos efectivos; el guard WCAG no reporta colores crudos del bloque.
12. Si falla la verificación de Google Desktop, el mensaje se presenta como error accesible y el control cambia a «Reintentar con Google»; correo/contraseña y recuperación conservan su disponibilidad.
13. Después de un error de credenciales, iniciar Google Desktop retira ese mensaje; al fallar Google, solo queda visible el error de la verificación actual. La acción de recuperación se llama «Restablecer contraseña» y explica que requiere una cuenta vinculada a Google.
14. Si el formulario de correo se fuerza visible porque Google no está disponible, no se presenta un control que diga que abrirá el formulario. Cuando el formulario es plegable, el control conserva sus etiquetas de abrir/cerrar.
15. Ante un callback OAuth web sin causa detallada, el error no afirma `origin_mismatch`, no muestra enlaces de configuración para Google Cloud, se anuncia una sola vez y permite abrir el acceso por correo/contraseña.
16. En el registro, el medidor activa exactamente uno, dos, tres o cuatro segmentos según su nivel; el color de esos segmentos supera 3:1 en claro y oscuro, y el nivel textual continúa visible y anunciado.
17. Con un error recuperable de Google a 320 CSS px, se mantiene visible el CTA principal en el primer viewport sin recortar el texto del error ni comprimir los campos o sus áreas táctiles.
18. La presentación del Login describe las funciones OMR y el almacenamiento SQLite sin prometer latencia, exactitud del 100 % ni privacidad exclusiva; el texto se mantiene claro y legible a 320 CSS px, incluida la ilustración de OMR.
19. Con Google Desktop y Web disponibles, Registro presenta una sola acción Google de escritorio y no monta el proveedor web; con solo Google Web disponible, el proveedor web sigue disponible.
20. La opción de sesión recordada incluye una advertencia visible y accesible para equipos compartidos, conserva su valor inicial y comportamiento, y el CTA principal permanece visible a 320 CSS px con error Google.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-005 | Orden responsive y acceso en viewport estrecho e intermedio | `tests/gui-responsive/responsive-docente.spec.ts`; `apps/frontend/tests/gui.responsive.contract.test.tsx` | Implementado; orden cubierto por contrato. E2E verifica título y acciones sin solapamiento a 320/360/390 CSS px y confirma encabezado de una línea, campos visibles y sin desbordamiento a 576 CSS px; captura `reports/qa/latest/gui-docente-login-tablet-lateral-576.png` |
| REQ-002 | Disponibilidad Google frente a reintento de recuperación | `apps/frontend/tests/seccionAutenticacion.test.tsx`; `apps/frontend/tests/appDocente.test.tsx` | Implementado y cubierto: carga, deshabilitado confirmado y fallo recuperable con consulta explícita |
| REQ-003, REQ-006 | Campos, login, registro y contratos de sesión | `apps/frontend/tests/seccionAutenticacion.test.tsx`; `apps/frontend/tests/appDocente.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; sin placeholders con aspecto de valores capturados; campos de login con etiqueta visible que identifica el requisito, nombre accesible y `required`; se conservan type, autocomplete y persistencia. Prueba focal actual de autenticación: 38/38; E2E de acceso en 320/390 CSS px: 2/2 |
| REQ-004 | Errores, anuncio, recuperación y toast no duplicado | `apps/frontend/tests/seccionAutenticacion.test.tsx`; `apps/frontend/tests/mensajeInline.test.ts`; `apps/frontend/tests/ux.quality.test.tsx` | 42/42 pruebas focales PASS: credenciales inválidas quedan solo en el formulario y conservan el correo; expiración de sesión se anuncia como error y permite una acción de recuperación persistente distinta |
| REQ-005 | Tema, foco, teclado, contraste y reflow | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `apps/frontend/tests/ux.visual.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Inspección lateral en temas oscuro/claro y tamaños 320/390/576/1024/1920 px; se verificó foco por teclado. En el rango 521–640 px, el encabezado mantiene título y subtítulo legibles en una línea. Captura 576 px en `reports/qa/latest/gui-docente-login-tablet-lateral-576.png`. Guard WCAG actualizado: 69/69; E2E Edge 2/2 a 320 y 1920 CSS px, ambos temas y controles reales de preferencia; capturas actuales en `reports/qa/ux-login-contrast-20261102/`. Iconos de alerta, enlace externo, correo, OMR y privacidad usan Lucide decorativo en lugar de glifos/emoji |
| REQ-007 | Espera accesible y recuperación del mensaje de error al reintentar disponibilidad de Google | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Implementado: prueba con callback diferido confirma retiro temporal del error anterior, anuncio `status`, botón ocupado, foco conservado y retorno del error actualizado. Prueba focal 1/1 PASS. |
| REQ-009 | Error de Google Desktop identificado y acción explícita de reintento | `apps/frontend/tests/seccionAutenticacion.test.tsx` | PASS: error anunciado como alerta, botón «Reintentar con Google» y alternativas conservadas. Prueba focal 1/1; el formulario de correo permanece visible sin mostrar un botón engañoso para abrirlo cuando Google está deshabilitado. |
| REQ-011 | Callback OAuth web con error genérico, una alerta y alternativa de correo | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Prueba focal confirma que no se atribuye `origin_mismatch`, no aparece el enlace de configuración de Google Cloud, se anuncia una sola alerta y se puede abrir el formulario de correo/contraseña. |
| REQ-010 | Contexto único de error entre intentos y claridad del restablecimiento | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Implementado: el inicio de Google limpia el error anterior de contraseña; restablecimiento nombra la acción y explica la verificación Google requerida. |
| REQ-008 | Contraste AA en tipografía y badge de la variante clara | `scripts/tests/ui-contrast-audit.mjs`; `npm run guard:wcag`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: 69/69 pares de contraste; E2E verifica estilos calculados del badge claro y el estado actual del control de tema a 320/1920 CSS px. El badge usa superficie blanca opaca, texto/borde teal; la captura confirma tema Claro con preferencia explícita. |
| REQ-012 | Progreso visible del medidor de contraseña con etiqueta accesible y colores con contraste AA no textual en ambos temas | `apps/frontend/tests/seccionAutenticacion.test.tsx`; `scripts/tests/ui-contrast-audit.mjs`; `tests/gui-responsive/responsive-docente.spec.ts` | PASS: 43/43 pruebas de autenticación; E2E Edge 1/1 en claro/oscuro a 320/390 px y medidor con cuatro niveles a 320 px; auditoría 81/81 pares de contraste. Capturas: `reports/qa/ux-login-password-meter-20261103/`. |
| REQ-013 | CTA de ingreso visible con error recuperable de Google a 320 CSS px | `tests/gui-responsive/responsive-docente.spec.ts` | PASS: E2E mide la posición renderizada del CTA a 320/390 px en ambos temas con recuperación OAuth ficticia; sin overflow. |
| REQ-014 | Descripción de funciones OMR y almacenamiento local sin afirmaciones absolutas o de velocidad no medidas | `apps/frontend/tests/seccionAutenticacion.test.tsx`; `apps/frontend/tests/ux.visual.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Copy e ilustración protegidos por prueba de componente; la captura sintética E2E comprueba legibilidad en 320/390 CSS px, claro y oscuro. |
| REQ-015 | El selector «Ingresar»/«Registrar» comunica nombre de grupo y estado toggle exclusivo | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Prueba focal verifica el nombre del grupo, los dos estados iniciales y la inversión correcta al cambiar a Registro. |
| REQ-016 | Evita acciones Google duplicadas cuando están disponibles las rutas Desktop y Web | `apps/frontend/tests/seccionAutenticacion.test.tsx` | La prueba focal usa ambos indicadores de disponibilidad y verifica que Registro muestre una sola acción Google Desktop, sin montar Google Web; el caso solo Web conserva su prueba existente. |
| REQ-020 | Advertencia visible y asociada para no conservar sesión en equipo compartido; CTA móvil sin recorte | `apps/frontend/tests/seccionAutenticacion.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Verificar nombre/ayuda accesible, copy visible, comportamiento intacto y primer viewport 320/390 CSS px en claro y oscuro. |

La alerta `origin_mismatch` usa iconos Lucide decorativos con `aria-hidden`, en lugar de emoji, manteniendo nombres y texto de las acciones.

## Revisión visual del error Google y densidad informativa (2026-11-03)

- El E2E sintético con OAuth interceptado se recapturó a 320 y 390 CSS px en claro y oscuro. En el error, la alerta, el reintento, restablecimiento y formulario de correo/contraseña permanecen claros y la acción de ingreso cabe en el primer viewport; no se usa cuenta real ni se comunica con Google.
- La revisión visual encontró tres repeticiones de la versión dentro de la pantalla. Se conserva el control superior que abre información de versión y se retira la repetición del badge de producto y del pie de privacidad. Se mantiene el mensaje sobre almacenamiento local.
- `seccionAutenticacion.test.tsx` 42/42 PASS; snapshot focal de `ux.visual.test.tsx` 1/1; E2E Edge 1/1. Typecheck y ESLint focal PASS.
- El E2E espera `document.fonts.ready` antes de medir la posición del CTA para evitar medir durante un reflujo tipográfico incompleto.
- La nueva E2E del error Google detectó que, a 320 px, el CTA quedaba fuera del primer viewport. Se redujo solo la densidad vertical de la tarjeta cuando hay error de Google, se amplió el botón a todo el ancho y se compactó el aviso sin recortar su texto. Reejecución Edge: 1/1 PASS; el CTA queda visible a 320 y 390 px en ambos temas. Capturas actuales: `login-google-desktop-error-{320,390}-{light,dark}.png` y `login-password-meter-320-{light,dark}.png`.
- La prueba de componente de Google Desktop ahora espera 3 s para el resultado del sondeo, cuyo intervalo de producción es de 1 s; la suite focal completa queda estable en 43/43.
- `npm run typecheck`, ESLint focal, `npm run guard:wcag` (incluye 81/81 contrastes), `npm run sdd:audit` y `git diff --check`: PASS.
- Límite: la captura usa frontend con API/OAuth ficticios. Runtime instalado, teclado manual integral, zoom real al 200 % y lector de pantalla siguen pendientes.

## Indicador de credenciales obligatorias (2026-10-31)

La auditoría de 320/390 CSS px encontró que la pantalla no identificaba junto a los campos que correo y contraseña son obligatorios. Se añadió ese texto a las etiquetas y `required` a ambos controles únicamente durante el inicio de sesión; el modo de registro mantiene su comportamiento previo. El marcador comparte línea con el rótulo cuando cabe y puede refluír en pantallas estrechas. Se preservan los nombres accesibles y no se introducen placeholders.

Evidencia sintética: prueba focal de autenticación 38/38 y E2E Edge 2/2; capturas de acceso a 320 px claro/oscuro y 390 px en `reports/qa/ux-login-current-audit-20261031/`. Referencia: W3C WAI recomienda identificar campos requeridos en el texto de etiqueta y usar `required` para comunicarlo programáticamente ([Form Instructions](https://www.w3.org/WAI/tutorials/forms/instructions/), [Validating Input](https://www.w3.org/WAI/tutorials/forms/validation/)). Esto no reemplaza una revisión manual con teclado, ampliación 200 %, lector de pantalla o runtime instalado.

## Revalidación de feedback de autenticación (2026-10-31)

- Los errores que ya aparecen junto al formulario no disparan un toast duplicado; se mantiene el correo capturado para reintentar.
- La expiración de sesión se clasifica y anuncia como error. Solo agrega un toast persistente cuando contiene la acción distinta «Cerrar sesión» y una explicación complementaria.
- `npm run test -- tests/seccionAutenticacion.test.tsx tests/mensajeInline.test.ts`: 42/42 PASS. ESLint focal y typecheck frontend PASS.
- La pestaña lateral no se pudo controlar en esta revisión (`browser.user is unavailable`); esta revalidación es de código y pruebas, no una captura visual de los estados.

## Revalidación focal del nivel de contraseña (2026-10-28)

- El indicador conserva sus barras decorativas, pero el nivel textual ahora está fuera de `aria-hidden` y se anuncia como estado cortés sin mover el foco. No se cambian los criterios de fortaleza ni validación de contraseña.
- `npm -C apps/frontend test -- tests/seccionAutenticacion.test.tsx`: 35/35 PASS; ESLint focal, typecheck, auditoría SDD y `git diff --check` PASS.

## Reflow del encabezado en móvil estrecho (2026-10-29)

- Capturas actuales a 320 CSS px mostraron que el distintivo de versión se superponía al
  título «Plataforma Docente» en temas claro y oscuro, aunque el documento no desbordaba.
- Hasta 360 px, las acciones de versión/tema pasan a una fila propia debajo de la marca; el
  formulario y su prioridad permanecen intactos.
- E2E `acceso estable en mobile` verifica que título y acciones no se crucen geométricamente
  a 320, 360 y 390 px. Resultado: 3/3 PASS. Capturas inspeccionadas en claro/oscuro a 320 px
  y tema oscuro a 360/390 px: `reports/qa/ux-login-20261029-current-turn-verified/`.
- Límite: esta recaptura no cubre el flujo real de Google OAuth, el lector de pantalla ni
  el runtime instalado.

## Encabezado legible en el navegador lateral (2026-11-02)

- Evidencia actual en la pestaña integrada, a 583 CSS px: «Plataforma Docente» ocupa dos
  líneas y el subtítulo también ocupa dos; ambas líneas compiten con los controles de versión
  y tema en la misma fila.
- Cambio: entre 521 y 640 CSS px, reducir tipográficamente el nombre y subtítulo usando las
  mismas escalas ya aplicadas al breakpoint móvil. No cambia orden, contenido ni controles.
- Verificación focal: el E2E de acceso a 576 CSS px exige ambos textos en una línea, campos
  visibles y ausencia de desbordamiento; captura el estado para inspección visual.
- Referencia: WCAG 2.2 SC 1.4.10 (Reflow) requiere presentar el contenido sin pérdida ni
  desplazamiento en dos direcciones al equivalente de 320 CSS px; esta corrección atiende
  legibilidad a un ancho intermedio observado, sin sustituir la validación de 320 px.

## Estado accesible durante reintento de disponibilidad de Google (2026-10-31)

- Hallazgo estático: durante el reintento, el botón anunciaba «Consultando Google…», pero el mensaje de error anterior seguía visible y no había una región de espera persistente.
- Cambio: al reintentar, el error contextual se sustituye por un mensaje `status` cortés persistente; al finalizar sin recuperar Google, vuelve el diagnóstico actualizado. El botón ocupado conserva foco.
- Fundamento: [WCAG 2.2 SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) indica que los estados de espera deben estar programáticamente disponibles sin requerir foco.
- Validación focal: `apps/frontend/tests/seccionAutenticacion.test.tsx -t "anuncia el reintento de Google"` 1/1 PASS; TypeScript, ESLint focal, guard WCAG, auditoría SDD y diff-check.

## Error recuperable de Google Desktop (2026-11-03)

- Hallazgo en la captura compartida: el fallo de verificación se mostraba como texto neutro y el botón conservaba «Acceder con Google», sin indicar que iniciaba un nuevo intento.
- Cambio: el resultado usa el estilo y rol `alert`; el botón ofrece «Reintentar con Google». Se conserva el método de correo/contraseña y el flujo de recuperación disponibles.
- Validación focal: `seccionAutenticacion.test.tsx -t "presenta el fallo de Google Desktop como error y ofrece reintentar"` 1/1 PASS; E2E Edge con API/proveedor simulados 1/1 PASS a 320/390 CSS px en tema claro y oscuro; typecheck, ESLint focal, SDD y diff-check PASS. Capturas inspeccionadas en `reports/qa/ux-login-google-error-final-20261103/`.
- Límite: no inicia sesión con Google ni valida lector de pantalla, zoom real al 200 % o runtime instalado.

## Mensajes coherentes entre métodos de acceso (2026-11-03)

- La inspección AX del login actual mostró un error de credenciales y un error OAuth simultáneos. Google Desktop conservaba el mensaje global del intento anterior mientras mostraba el error de su propio flujo.
- Al comenzar Google Desktop, se limpia ese mensaje anterior. El resultado solo anuncia el estado vigente del intento.
- La acción «Recuperar contraseña con Google» se renombró «Restablecer contraseña» y su explicación indica que se necesita verificar la cuenta vinculada; el flujo de reautenticación no cambia.
- Prueba de regresión: credenciales dummy fallidas seguidas de un fallo OAuth dummy dejan una sola alerta, con el correo intacto.

## Alternativa de correo cuando Google no está disponible (2026-11-03)

- Hallazgo: si Google web estaba deshabilitado o el backend no lo reportaba disponible, el formulario de correo se mostraba de forma obligatoria como alternativa. El botón seguía diciendo «Ingresar con correo y contraseña» porque dependía de una preferencia de visibilidad distinta, aunque el formulario ya estuviera abierto.
- Cambio: se omite ese control de alternancia solo cuando el formulario de ingreso permanece visible por disponibilidad de Google; se conserva el acceso por contraseña y la acción de restablecimiento.
- Validación focal: `apps/frontend/tests/seccionAutenticacion.test.tsx` comprueba el caso con Google Desktop disponible y Google web deshabilitado. No cambia OAuth, permisos, callbacks ni contrato de autenticación.
- Validación ejecutada: suite focal de autenticación 41/41 PASS, typecheck PASS, ESLint de los dos archivos modificados PASS, `sdd:audit` PASS, `guard:wcag` 71/71 pares PASS y `git diff --check` PASS.
- Límite: no se capturó una imagen posterior en el runtime; la captura previa documenta el estado inicial, no prueba el resultado visual del cambio.

## Error genérico del proveedor web Google (2026-11-03)

- Hallazgo estático: el callback genérico de Google se interpretaba como `origin_mismatch`, con instrucciones para administrar Google Cloud. También se repetía en el feedback global del formulario.
- Cambio: la alerta ahora dice que el acceso no pudo completarse, recomienda reintentar o usar correo/contraseña y no muestra una causa no confirmada ni un enlace de configuración. El error aparece una sola vez.
- Validación focal actual: `seccionAutenticacion.test.tsx` 42/42 PASS; la expectativa antigua que exigía `origin_mismatch` y un enlace a Google Cloud quedó reemplazada por aserciones del contrato vigente, incluida la copia de diagnóstico sin credenciales. ESLint del archivo y `git diff --check` PASS.
- Contratos: no cambia OAuth, API, permisos ni recuperación.
- Revalidación visual actual (2026-11-03): Playwright Edge con proveedor OAuth simulado pasó 1/1 en 320/390 CSS px, tema claro/oscuro. Confirma una sola alerta, acción «Reintentar con Google», formulario de correo/contraseña visible, recuperación «Restablecer contraseña» y botón principal completamente dentro del primer viewport; no detecta overflow. Capturas actuales en `reports/qa/ux-login-google-error-final-20261103/`.
- Límite: fixture aislado, no Google real ni runtime instalado; lector de pantalla y zoom real al 200 % siguen pendientes.

## Sincronización del bundle de Login servido localmente (2026-11-04)

- La pantalla de `127.0.0.1:4173` aún mostraba «Recuperar contraseña con Google» y un error genérico porque el proceso servía un bundle instalado del 2026-10-31. La fuente ya cumplía REQ-009/010; el problema era un artefacto local atrasado.
- Se compiló el frontend docente vigente y se respaldó el bundle instalado completo antes de sincronizar los 38 archivos. Los assets se copiaron antes de `index.html`; no se borraron assets previos. SHA-256 de los 38 archivos coincide con `apps/frontend/dist-docente`; `verify-docente-bundle` PASS. Se preservaron backend, configuración y SQLite; la versión de la aplicación sigue en 1.2.10.
- Playwright Edge abrió el servidor local actualizado con API y OAuth ficticios. A 320/390 CSS px en tema claro/oscuro confirmó la alerta específica, «Reintentar con Google», «Restablecer contraseña», ausencia del rótulo obsoleto y sin overflow. Capturas inspeccionadas en `reports/qa/ux-login-runtime-fixed-20261104/`.
- No se inició sesión ni se contactó Google real. El runtime local ahora sirve el bundle correcto; una pestaña que ya tenía cargado el anterior necesita recargarse. Lector de pantalla y zoom manual al 200 % siguen pendientes.

## Error Google y CTA móvil en el primer viewport (2026-11-04)

- La revalidación del E2E actual encontró una regresión: a 320 CSS px, el botón «Ingresar» terminaba aproximadamente 27 px debajo del viewport con el error OAuth visible. Los campos y el mensaje no se desbordaban.
- Se conserva el mensaje y todos los controles; bajo 360 px se retira solo la descripción introductoria del formulario durante ese estado de error, para mantener el CTA visible sin comprimir los controles.
- Validación focal: `tests/gui-responsive/responsive-docente.spec.ts` 1/1 PASS; comprueba la posición renderizada del CTA a 320/390 px, ambos temas y recuperación OAuth ficticia. `npm run guard:wcag` 91/91 y `npm run sdd:audit` PASS; `git diff --check` sin errores.

## Copy de producto verificable en Login (2026-11-04)

- Hallazgo en capturas móvil: la presentación prometía OMR «instantánea», procesamiento «en segundos» y «privacidad local total»/datos «100% locales», afirmaciones absolutas no respaldadas por una medición o por el alcance de la integración.
- Cambio: se describe OMR como procesamiento y revisión por lotes; SQLite queda identificado como base local, sin asegurar que todas las operaciones/datos sean exclusivamente locales. Se acortó el texto introductorio.
- Validación: prueba focal de autenticación y snapshot protegen el copy; E2E sintético Edge 1/1 recaptura error/reintento y verifica viewport/legibilidad a 320/390 CSS px en ambos temas.
- OAuth real, latencia real y privacidad operacional no se infieren de la vista de Login.

## Estado anunciado por el control de correo plegable (2026-11-05)

- Hallazgo estático: el control para mostrar/ocultar el formulario cambiaba su texto, pero no exponía su estado a tecnologías de asistencia.
- Criterio: el patrón Disclosure de WAI-ARIA APG establece `aria-expanded="true"` cuando el contenido está visible y `false` cuando está oculto; `aria-controls` es opcional ([W3C WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)).
- Cambio: el control comunica `aria-expanded` a partir del mismo estado React que gobierna su visibilidad.
- Validación focal: `seccionAutenticacion.test.tsx` cubre los estados colapsado → expandido → colapsado → expandido y la visibilidad de los campos (1/1 PASS). TypeScript, ESLint de los dos archivos, guard WCAG (102/102 pares), auditoría SDD y `git diff --check` PASS.
- Entrega local: ambos bundles se recompilaron y sincronizaron; SHA-256 árbol coincide (39 archivos docente, 23 alumno). Respaldo previo: `%LOCALAPPDATA%\\EvaluaPro\\logs\\gui-bundle-backups\\20261105-030412`. Los 95 archivos de datos (284182428 bytes) y los cinco archivos protegidos permanecen intactos.
- Contratos: sin cambios en autenticación, OAuth, recuperación, persistencia ni API.

## Selector de modo de acceso con nombre de grupo (2026-11-05)

- Hallazgo estático: «Ingresar» y «Registrar» exponían `aria-pressed` pero no el contexto de que son opciones del selector de modo de acceso.
- Cambio: el contenedor se nombra «Modo de acceso» con `role="group"`; conserva los botones toggle, la selección inicial, el comportamiento de foco y los flujos existentes.
- Criterio: WAI-ARIA APG explica que los controles de alternancia mutuamente excluyentes forman un grupo de selección ([Toolbar Example](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/)).
- Validación focal: la prueba de `seccionAutenticacion.test.tsx` verifica nombre de grupo y `aria-pressed` antes/después de seleccionar Registro.
- Contratos: no cambia el acceso, registro, OAuth, recuperación, API ni persistencia.

## Registro · proveedor Google único por plataforma (2026-11-05)

- Hallazgo estático: Ingresar ya oculta Google Web cuando Google Desktop está disponible; Registro montaba ambos proveedores y podía mostrar dos acciones equivalentes.
- Cambio: Registro usa Google Desktop como única acción cuando está disponible y conserva Google Web en instalaciones sin el proveedor Desktop.
- Validación: `npm -C apps/frontend run test -- --run tests/seccionAutenticacion.test.tsx` (46/46 PASS), typecheck, ESLint focal, `npm run guard:wcag` (102/102 pares), auditoría SDD y `git diff --check` PASS.
- Límite: la pestaña lateral estaba en Login y no se recapturó visualmente el estado Registro; el test de componente valida los indicadores de disponibilidad y que el proveedor web no se monte.
- Contratos: no cambia OAuth, credenciales, permisos, autollenado ni API.

## Ilustración OMR sin promesas de velocidad o exactitud (2026-11-05)

- Hallazgo en la captura actual del navegador lateral: el texto introductorio ya describía OMR como apoyo para revisar, pero el mockup todavía afirmaba «Calificación precisa en < 1 seg» y mostraba tres porcentajes «100 %». La prueba de copy cubría el texto general, no la ilustración marcada `aria-hidden`.
- Cambio: se describe la lectura como apoyo para procesar hojas y revisar resultados; las filas señalan «Leída» sin atribuir exactitud total. El icono de rayo se sustituyó por el símbolo de lectura `ScanLine`.
- Validación: prueba focal de `seccionAutenticacion.test.tsx` y E2E de error recuperable Google comprueban que mockup y filas no vuelvan a contener promesas de velocidad o 100 %.
- Fundamento: REQ-014 de esta spec; la ilustración visible forma parte del texto promocional y también debe cumplirlo.
- Límite: la API local no está activa en la previsualización; el estado de disponibilidad queda en carga y no se evalúa como comportamiento del servicio autenticado.
