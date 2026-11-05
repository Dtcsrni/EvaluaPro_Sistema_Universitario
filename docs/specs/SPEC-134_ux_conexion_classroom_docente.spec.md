---
id: SPEC-134
titulo: UX de conexión docente con Google Classroom
version: 1.0.10
fecha: 2026-11-03
autor: Codex / EvaluaPro Team
modulo: frontend_classroom_conexion_ux
estado: approved
---

## Contexto

La pantalla activa de Classroom en `SeccionClassroomSync.tsx` se limita a conexión,
estado y enlace a Calificaciones, en línea con la separación de tareas aprobada por
SPEC-101. La revisión estática encontró que el botón solicita una URL de OAuth de forma
asíncrona y luego ejecuta `window.open`; el navegador puede bloquear esa ventana porque
la apertura no ocurre directamente en el gesto de usuario. Tampoco se presenta estado de
carga en la acción de conexión ni una alternativa accionable si no se puede abrir la
ventana. Esta spec aborda esa recuperación manteniendo la API y el contrato OAuth.

La propuesta será un flujo explícito en dos pasos: solicitar la URL y, al recibirla,
mostrar un enlace real con destino nuevo, `rel="noopener noreferrer"` y un nombre que
explique que continúa la autorización en Google. Así, la navegación se activa mediante
un segundo gesto directo y no deja ventanas vacías abiertas durante la consulta.

## Referencias de UX y accesibilidad

- MDN, [Window.open()](https://developer.mozilla.org/en-US/docs/Web/API/Window/open):
  los navegadores limitan la apertura de ventanas a gestos de usuario y pueden aplicar
  bloqueadores de ventanas emergentes.
- W3C WAI, [WCAG 2.2 SC 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  los cambios de estado que no reciben foco deben exponerse a tecnologías de asistencia.
- W3C WAI, [WCAG 2.2 SC 3.3.1 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification):
  los errores detectados deben identificarse y describirse en texto.

## Requisitos Funcionales

- **REQ-134-001 Preparación de OAuth:** al activar «Conectar Google Classroom», mostrar
  carga y evitar solicitudes duplicadas. La interfaz solicita la URL con el endpoint
  vigente; tras recibirla presenta una acción explícita «Continuar con Google» como enlace
  externo. No abre una ventana en blanco ni cambia la ventana actual antes de esa acción.
- **REQ-134-002 Fallos recuperables:** si la consulta falla o no devuelve URL, explicar
  el problema en texto, conservar el estado de conexión ya verificado y permitir volver a
  solicitar autorización. Limpiar el error previo al iniciar un reintento. Al preparar
  OAuth, indicar que la solicitud vence a los 10 minutos y cómo pedir un enlace nuevo si
  vence o se cancela.
- **REQ-134-003 Estado de conexión:** diferenciar consulta inicial, conectado, no
  conectado, integración no disponible, permiso insuficiente y consulta fallida. La
  pantalla no presenta una falla de consulta como desconexión confirmada ni un estado
  vacío como error.
- **REQ-134-004 Identidad:** presentar la identidad devuelta por el backend. Solo expresar
  coincidencia cuando `identidadCoincidente` lo confirme; no inferir identidad por correo,
  nombre o cuenta seleccionada en el navegador.
- **REQ-134-005 Desconexión:** conservar confirmación previa, estado de carga y mensajes de
  error; comunicar que se desconecta la autorización sin prometer eliminación de datos
  locales. Mantener la acción deshabilitada mientras se procesa.
- **REQ-134-006 Accesibilidad:** estados de carga y resultados usan la semántica existente
  de `InlineMensaje`; enlace, botones, permisos y destino externo tienen nombres claros,
  foco visible y operación por teclado. Respetar temas, reflow, zoom y movimiento reducido
  definidos en `docs/WCAG_UI_POLICY.md`.
- **REQ-134-007 Contratos:** no cambiar endpoints, payloads, permisos, identidad OAuth,
  reglas de vinculación/desconexión, datos persistidos ni responsabilidad de Calificaciones
  para cursos y evidencias. El panel conserva su vínculo a Calificaciones.
- **REQ-134-008 Contraste de acciones principales:** los botones «Conectar Google
  Classroom», «Continuar con Google» y «Revisar en Calificaciones» usan una superficie
  sólida y conservan contraste de texto mínimo 4.5:1 en reposo y hover en ambos temas.
- **REQ-134-009 Lectura de identidad:** el correo de inicio se presenta completo y legible
  en pantallas estrechas, sin partir palabras en ubicaciones arbitrarias ni provocar
  desbordamiento horizontal.
- **REQ-134-010 Guía de conexión:** explicar los datos que EvaluaPro consulta y que las
  vinculaciones se asignan y guardan manualmente por periodo, sin atribuir algoritmos de
  cifrado o métodos de inicio de sesión no aplicables a todos los entornos. Los iconos de
  cierre y ayuda reutilizan el sistema compartido.

## Criterios de Aceptación

1. La URL OAuth se prepara con una solicitud protegida contra doble activación y se abre
   únicamente cuando la persona activa el enlace «Continuar con Google».
2. La carga, éxito de preparación y errores se entienden visualmente y se anuncian sin
   mover el foco; la solicitud comunica el vencimiento a los 10 minutos y la recuperación
   para generar otro enlace.
3. Los estados de integración, autorización y consulta no se confunden entre sí. Si la consulta
   inicial falla, la pantalla dice que no hay un estado confirmado, nombra la acción para reintentar
   y no afirma que la cuenta esté desconectada.
4. La identidad visible proviene de la respuesta del backend y nunca se compara solo en
   el cliente.
5. Confirmar una desconexión sigue siendo requisito y el proceso muestra su carga/error.
6. No se modifican contratos de backend ni se duplican flujos de cursos, roster o notas.
7. La matriz no declara terminada la revisión visual sin capturas actuales del runtime.
8. En la consulta inicial, la conexión muestra un estado de carga antes de mostrar un estado
   vacío o de verificación fallida.
9. Las tres acciones principales mantienen superficie sólida y texto con contraste mínimo
   4.5:1 en reposo y hover, en claro y oscuro.
10. A 320 CSS px, el correo de inicio conserva su contenido y se ajusta sin cortes internos
    innecesarios ni overflow horizontal.

## Validación focal prevista

- `apps/frontend/tests/seccionClassroom.test.tsx`: carga del estado, doble activación,
  recuperación de URL, apertura explícita del enlace, identidad, disponibilidad y
  desconexión.
- `apps/frontend/tests/ux.quality.test.tsx` solo si cambian contratos compartidos de
  accesibilidad o copy.
- ESLint de componente y prueba, typecheck frontend, `npm run guard:wcag` y
  `git diff --check`.
- No ejecutar suites ajenas al componente. Capturas actuales en tema claro/oscuro y 320 CSS px;
  recorrido completo de teclado, zoom 200 % y lector de pantalla siguen pendientes.

Validación ejecutada: `npm -C apps/frontend test -- tests/seccionClassroom.test.tsx`
(1 archivo, 12/12 PASS; incluye navegación con Tab y activación con Enter del enlace OAuth,
además de conservar el último estado confirmado ante
fallo de actualización y reintentar); ESLint focal PASS; typecheck frontend PASS;
`npm run guard:wcag -- --skip-lint` (39/39 pares PASS); `npm -C apps/frontend run
build:docente` PASS (typecheck, compilación, guard del bundle, lint frontend y contraste
39/39); auditoría SDD PASS y `git diff --check` PASS. La revisión visual en runtime sigue pendiente; la spec permanece
`approved` hasta cerrar ese criterio.

## Matriz de Trazabilidad

| ID Requisito | Descripción | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-134-001 | Preparación, bloqueo de activaciones duplicadas y apertura explícita de OAuth | `apps/frontend/tests/seccionClassroom.test.tsx` | Implementado; 9/9 pruebas focales PASS |
| REQ-134-002, REQ-134-003 | Errores recuperables, vigencia, disponibilidad y estados de conexión | `apps/frontend/tests/seccionClassroom.test.tsx` | Implementado; 12/12 pruebas focales PASS. Los fallos de consulta conservan el último estado confirmado o lo declaran no confirmado, ofrecen reintento y descartan respuestas tardías |
| REQ-134-004 | Identidad validada por backend; destino OAuth HTTPS permitido | `apps/frontend/tests/seccionClassroom.test.tsx` | Implementado; prueba focal PASS |
| REQ-134-005, REQ-134-006 | Desconexión, roles status/alert, enlace visible y operación con teclado | `apps/frontend/tests/seccionClassroom.test.tsx`; `tests/gui-responsive/responsive-docente.spec.ts` | Prueba focal valida Tab hasta el enlace OAuth y Enter para activarlo; captura sintética en ambos temas a 320/390 px; recorrido manual completo/zoom/lector de pantalla pendientes |
| REQ-134-007 | Conservación de rutas, permisos y responsabilidades | `apps/frontend/tests/seccionClassroom.test.tsx` | Verificado estáticamente; contratos sin cambios |
| REQ-134-008 | Contraste de acciones principales en ambos temas | `tests/gui-responsive/responsive-docente.spec.ts`; `scripts/tests/ui-contrast-audit.mjs` | Implementado; aserciones de superficie sólida y contraste en reposo/hover, ambos temas; guard 71/71 PASS |
| REQ-134-009 | Lectura completa del correo en viewport estrecho | `tests/gui-responsive/responsive-docente.spec.ts` | Implementado; Edge E2E 1/1, texto completo, oportunidades de corte normales y sin overflow a 320/390 CSS px |
| REQ-134-010 | La guía explica el alcance de consulta y la asignación manual por periodo, sin reclamos criptográficos imprecisos; iconografía compartida | `apps/frontend/tests/seccionClassroom.test.tsx` | Prueba focal verifica cursos, temas, alumnos, actividades, vínculo manual y guardado por periodo; bloquea «autovinculación instantánea»/«Auto-match 1 Clic», ausencia de claims AES/SSO, icono decorativo y botón de cierre accesible. |

### Corrección de la consulta inicial (2026-10-31)

- Hallazgo: el componente comenzaba con `cargandoEstado=false`; antes del efecto inicial podía presentar «No se pudo verificar la conexión» aunque aún no hubiera ocurrido ninguna consulta.
- Cambio: la carga inicial refleja directamente si la persona tiene permiso para consultar Classroom; el estado de error/desconexión solo aparece tras un resultado real.
- Validación focal: `apps/frontend/tests/seccionClassroom.test.tsx` protege el estado inicial pendiente con respuesta diferida. El runtime OAuth y las pruebas manuales de teclado, lector de pantalla y zoom siguen pendientes.

### Captura visual focal (2026-10-28)

- El recorrido E2E de pantallas operativas pasa 4/4 a 1920 × 1080, 1024 × 768,
  768 × 1024 y 390 × 844 CSS px. La captura documenta el estado de integración y
  conexión no disponibles en la fixture; no ejercita la preparación OAuth ni su enlace.
- Evidencia y límites: `reports/qa/ux-wave1/docente-asistencias-temarios-classroom-visual-audit-20261028.md`.
- Temas controlados, 320 px, zoom 200 %, teclado manual, lector de pantalla y flujo OAuth
  disponible permanecen pendientes; la captura del preview no acredita el runtime instalado.

### Revisión visual responsive y claridad del acceso (2026-10-29)

- Captura actual del preview aislado con perfil, correo y enlace OAuth ficticios a 320 px y 390 px, en tema claro y oscuro. Se verificaron el estado desconectado, preparación del enlace, vigencia, destino Google, navegación por Calificaciones y límites del panel.
- Hallazgo: el texto de identidad y la descripción inicial ocupaban demasiadas líneas en móvil; el correo quedaba mezclado dentro del párrafo.
- Cambio: se acortó la descripción, se separó el correo bajo la etiqueta «Cuenta de inicio en EvaluaPro» y el estado OAuth ahora comunica vencimiento y reintento con menos texto. Endpoint, permiso, destino OAuth, identidad y reglas de vinculación no cambian.
- Validación focal: `tests/seccionClassroom.test.tsx` (9/9 PASS); Playwright sintético `audita conexión Classroom con fixture ficticia en móvil y ambos temas` (1/1 PASS); ESLint focal PASS. Capturas inspeccionadas en `reports/qa/ux-classroom-20261029-synthetic/`.
- Límite: evidencia del preview con API interceptada; no verifica Google OAuth real, runtime instalado, zoom 200 %, navegación manual por teclado ni lector de pantalla.

### Jerarquía del enlace OAuth preparado (2026-10-29)

- Hallazgo en captura sintética actual a 320 CSS px: después de preparar el enlace se
  mostraban dos botones primarios con acciones distintas, «Conectar Google Classroom» y
  «Continuar con Google»; el primero no explicaba que reemplazaba el enlace vigente.
- Cambio: «Continuar con Google» conserva la acción primaria; el control de recuperación
  pasa a secundario y se etiqueta «Solicitar otro enlace». El aviso de vencimiento/cancelación
  ahora usa el mismo lenguaje. El enlace se sigue generando por el endpoint existente.
- Validación focal: `seccionClassroom.test.tsx` 9/9 PASS; Playwright con fixture sintético `audita conexión Classroom con fixture ficticia en móvil y ambos temas` 1/1 PASS; ESLint focal, typecheck frontend, guard WCAG (59/59 pares), `sdd:audit` y `git diff --check` PASS. Captura actual inspeccionada a 320 px en `reports/qa/ux-classroom-20261029-current-turn-final/classroom-320-light-oauth-ready.png`.
- Límite: OAuth real, instalación local, zoom 200 %, teclado manual y lector de pantalla no se verificaron. La spec sigue `approved` porque esos criterios no tienen evidencia.

### Contraste de acciones principales (2026-11-03)

- Hallazgo: una regla global con degradado y `!important` prevalecía sobre los tokens de
  Classroom y reducía la legibilidad del texto blanco en los CTA.
- Cambio: se excluyeron las acciones de Classroom de esa pintura global; ahora usan la
  superficie primaria sólida y estados hover de los tokens de tema. El hover oscuro se
  ajustó para mantener contraste AA.
- Validación: prueba de `seccionClassroom.test.tsx` (10/10 PASS), E2E con datos ficticios
  (1/1 PASS), auditoría de contraste (71/71 PASS), `guard:wcag` y `git diff --check` PASS.
  Capturas inspeccionadas a 320 y 390 CSS px en claro/oscuro en
  `reports/qa/ux-audit-classroom-contrast-20261103/`.
- Límite: el flujo OAuth real, runtime instalado, teclado manual, zoom y lector de pantalla
  no se verificaron; la spec permanece `approved` hasta contar con esa evidencia.

### Navegación focal de OAuth con teclado (2026-11-03)

- La prueba recorre con Tab el botón de preparación y el enlace OAuth que aparece después;
  Enter activa el enlace sin invocar `window.open` ni enviar otra solicitud.
- Validación focal: `seccionClassroom.test.tsx` 11/11 PASS; typecheck frontend, ESLint
  focal, `sdd:audit` y `git diff --check` PASS.
- Límite: valida semántica y activación nativa en pruebas de componente; no sustituye
  recorrido manual, zoom 200 %, lector de pantalla ni OAuth real.

### Contraste y jerarquía al renovar OAuth (2026-11-03)

- Hallazgo: «Solicitar otro enlace» heredaba la superficie secundaria translúcida con
  texto blanco; en tema claro ambos colores quedaban casi iguales. Además, la acción
  competía visualmente con el enlace principal para continuar en Google.
- Cambio: conserva la variante secundaria, pero usa una superficie opaca y texto
  contrastante por tema, incluidos los estados hover. No cambian endpoints, permisos,
  vigencia ni navegación OAuth.
- Validación: E2E focal `audita conexión Classroom con fixture ficticia en móvil y
  ambos temas` (1/1 PASS); cubre contraste de texto/fondo en claro, oscuro y hover, y
  reflow a 320/390 CSS px. `seccionClassroom.test.tsx` 11/11 PASS, typecheck y ESLint
  focal PASS, `guard:wcag` 71/71 pares PASS, `sdd:audit` y `git diff --check` PASS.
  Capturas inspeccionadas en `reports/qa/ux-classroom-connection-final-20261103/`.
- Límite: fixtures sintéticas; OAuth real, runtime instalado, zoom 200 %, recorrido
  manual de teclado y lector de pantalla siguen pendientes.

### Claridad del fallo de consulta inicial (2026-11-03)

- Hallazgo estático: tras fallar la consulta inicial, el texto sugería revisar «el servicio» y
  no dejaba claro si la cuenta estaba desconectada ni cómo recuperar el estado.
- Cambio: el aviso informa que todavía no existe un estado confirmado y remite al botón
  «Reintentar». La prueba cubre fallo inicial y recuperación a «Cuenta Classroom no conectada»;
  no se altera endpoint, identidad ni operación OAuth.
- Validación focal: `npm test -- seccionClassroom.test.tsx` (12/12 PASS), ESLint focal,
  `git diff --check` y auditoría SDD PASS.

### Ajuste de línea de la identidad de inicio (2026-11-03)

- Hallazgo visual: el correo de la persona docente se partía dentro del dominio en móvil,
  aunque cabía completo sin cortes cuando se usaban puntos de ruptura normales.
- Cambio: se retiró `overflow-wrap: anywhere` y se conservó el ajuste natural; texto, identidad
  recibida y flujo OAuth no cambian.
- Validación: E2E Edge `audita conexión Classroom con fixture ficticia en móvil y ambos temas`
  1/1 PASS; confirma el correo íntegro, las reglas CSS de ajuste, reflow/overflow y capturas
  sintéticas en `reports/qa/ux-classroom-audit-fixed-20261103/`.
- Límite: fixture sintética; OAuth real, zoom 200 %, recorrido manual y lector de pantalla
  permanecen pendientes.

### Claridad de la guía de conexión (2026-11-03)

- Hallazgo estático: la guía prometía cifrado AES-256 y presentaba OAuth como «Google SSO», aunque los tokens nuevos se protegen con DPAPI de Windows para el usuario actual; AES-256 solo participa en migración heredada.
- Hallazgo adicional: describía el vínculo de alumnos como instantáneo, aunque la interfaz solicita asignar los registros y guardar la relación para el periodo.
- Cambio: la guía describe las categorías de datos consultados según los scopes vigentes y el paso manual de vinculación, sin fijar un algoritmo ni confundir OAuth con inicio de sesión de EvaluaPro. Ayuda y cierre usan iconos compartidos.
- Validación focal: `apps/frontend/tests/seccionClassroom.test.tsx`; no cambian scopes, endpoints, permisos ni protección de tokens.
