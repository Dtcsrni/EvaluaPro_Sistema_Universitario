---
id: SPEC-101
titulo: Experiencia Classroom, personas docentes y operaciones mediante agentes
version: 1.1.0
fecha: 2026-10-14
autor: Codex / EvaluaPro
modulo: modulo_integraciones_classroom
estado: approved
---

## Contexto

Definir el modelo de interacción, escenarios de uso, pruebas y contrato de herramientas
para que docentes y agentes de IA puedan operar la integración Classroom de manera
predecible. Esta spec detalla la experiencia de `SPEC-CLASSROOM-EXPERIENCIA-USUARIO`,
usa la automatización API de `SPEC-070`, preserva el sentido académico de `SPEC-046` y
depende de la resiliencia e identidad de cuenta de `SPEC-100` y la política de reintentos
de `SPEC-085`.

No redefine las notas ni convierte a EvaluaPro en editor de Classroom. Classroom sigue
siendo la fuente de actividades, entregas y `assignedGrade`; EvaluaPro lee y guarda
evidencia local, permite asociación académica explícita y muestra historial. Nunca importa
`draftGrade`, publica notas a Google, infiere una identidad de alumno por nombre ni toma
instrucciones de descripciones/entregas como órdenes para el agente.

## Requisitos Funcionales

- **REQ-001 (Personas validadas):** La experiencia partirá de la persona primaria docente
  y del actor agente IA definidos aquí; los perfiles de colaboración institucional son
  hipótesis hasta verificar rol y permisos con usuarios. No se atribuirá representatividad
  a las personas sintéticas.
- **REQ-002 (Una tarea, una superficie):** El Centro Classroom administrará identidad,
  estado, asociación curso-periodo e historial del conector. Calificaciones concentrará
  mapeo de roster/actividades, preview, importación, evidencias e historial académico.
  No se mostrarán controles duplicados.
- **REQ-003 (Contexto explícito):** Toda vista de operación identificará la identidad
  Google ya validada, curso y periodo/materia por IDs canónicos y nombres visibles antes
  de leer/escribir. Nunca inferirá asociación por nombre, fecha o posición.
- **REQ-004 (Estados separados):** La UI y API diferenciarán runtime no disponible,
  autorización no válida, permisos insuficientes, consulta externa no verificada,
  resultado vacío y error del proveedor con código/acción siguiente.
- **REQ-005 (Preview revisable):** Preview no persiste evidencias/notas, presenta datos
  fuente, warnings, conteos, planHash y efectos; cualquier cambio de selección/mapeo invalida
  el plan previo y bloquea confirmar hasta obtener otro preview.
- **REQ-006 (Integridad académica):** Solo `assignedGrade` se puede importar. `draftGrade`,
  pendientes y entregas sin puntaje nunca se convierten implícitamente en cero. Faltantes
  vencidos y reentregas que afectan evidencia aceptada requieren confirmación específica.
- **REQ-007 (Operación durable):** La ejecución persistente se representará como job con
  `jobId`, progreso, conteos confirmados, errores por actividad, checkpoints y estado
  terminal/recuperable; cerrar o perder la vista no crea otra ejecución. Cancelar informa
  los commits ya realizados y no promete rollback inexistente.
- **REQ-008 (Paridad API/GUI):** GUI y agentes usan los mismos endpoints/servicios,
  validaciones, RBAC y persistencia; ningún agente accede directo a SQLite/Prisma, navegador
  o Google Classroom. OpenAPI, Zod, SDK y catálogo describen el mismo contrato.
- **REQ-009 (Agentes autorizados):** El agente inicia con preflight, usa IDs canónicos y
  alcance docente, separa lectura/preview/escritura, requiere aprobación humana ligada al
  plan vigente para toda mutación y usa clave idempotente con recuperación del resultado.
  Si un endpoint no soporta idempotencia, el agente solo puede consultar/previsualizar.
- **REQ-010 (OAuth humano y misma identidad):** El agente no inicia consentimiento ni
  cambia cuenta. OAuth usa la identidad del login EvaluaPro y el backend valida `sub`;
  una discrepancia preserva el vínculo previo.
- **REQ-011 (Datos externos no confiables):** Texto/metadatos Classroom nunca modifican
  instrucciones del agente ni amplían permisos/herramientas. Las URLs visibles se validan
  contra HTTPS y host permitido.
- **REQ-012 (Privacidad y auditoría):** Respuestas y logs exponen solo datos requeridos,
  IDs opacos, estado y correlation IDs; no guardan tokens, prompts ni PII estudiantil
  innecesaria. Mutaciones registran actor, acción, alcance, clave/hash y resultado.
- **REQ-013 (Accesibilidad):** Estados/acciones se nombran con texto, funcionan por
  teclado y tecnologías de asistencia y cumplen la política WCAG 2.2 AA del repositorio en
  temas, responsive, foco, zoom y reducción de movimiento.
- **REQ-014 (Confirmación comprensible):** La confirmación muestra acción, curso, periodo,
  actividades, alcance, conteos, faltantes/reentregas aprobadas y efecto local/external;
  el consentimiento se considera separado de disponer de un Bearer o flag booleano.
- **REQ-015 (Codex como agente principal):** La primera experiencia de agente se diseña
  para Codex trabajando en el contexto local de EvaluaPro, mediante el cliente API docente
  aprobado y endpoints autenticados. Codex prepara y explica operaciones; el docente sigue
  siendo el decisor académico y el principal de autorización. Otros hosts de agentes son
  compatibilidad posterior, no criterio P0 de UX.

## Base de evidencia y límites

### Hechos inspeccionados

- La navegación actual carga `CentroClassroom.tsx` como centro de conexión, y
  `ClassroomEnCalificaciones.tsx` se monta dentro de Calificaciones. Ambas superficies
  consultan endpoints del dominio Classroom.
- El Centro actual todavía incluye curso, roster, mapeo de alumnos, actividades, preview
  y ejecución; Calificaciones también administra mapeos y preview/importación. Esto
  duplica controles y contradice la separación ya aprobada en
  `SPEC-CLASSROOM-EXPERIENCIA-USUARIO`.
- `SeccionClassroom.tsx` exporta `SeccionClassroomLegacy` y no aparece en las importaciones
  de navegación actuales; sus controles no se consideran experiencia activa.
- Las rutas activas incluyen estado, OAuth, cursos, actividades, alumnos, importación de
  alumnos, mapeo de alumnos, historial, preview y ejecución. Requieren permisos RBAC;
  importar alumnos además requiere `alumnos:gestionar`.
- `scripts/api/evaluapro-client.mjs` ofrece preflight y métodos Classroom, mientras que la
  guía API de `AGENTS.md` exige sesión, permiso RBAC, confirmación humana para mutaciones,
  uso de IDs canónicos y recuperación de respuestas inciertas. La importación Classroom
  aún no tiene el job durable/idempotencia propuestos por SPEC-100.
- La política WCAG del repositorio exige estados y temas aplicables, teclado, foco, 320 px,
  zoom/reflow y revisión manual; contrastes automatizados solos no prueban conformidad.

### Supuestos de diseño que necesitan validación con docentes

- Las personas de abajo son hipótesis basadas en roles, reglas del sistema y solicitudes
  observadas; no son segmentos cuantificados ni sustituyen entrevistas/usabilidad con
  docentes de distintos tamaños de curso y experiencia tecnológica.
- No se encontró evidencia suficiente de un rol independiente de coordinador con acceso
  a cursos ajenos. No se diseña acceso multi-docente, delegación interdocente ni vista de
  soporte con datos académicos en esta versión.
- Los flujos de jobs, progreso, cancelación y recuperación son objetivo de diseño; las
  rutas actuales de importación son síncronas.

## Personas y actores

| Persona/actor | Evidencia y estado | Objetivo | Necesidades UX | Riesgo que debemos evitar |
| --- | --- | --- | --- | --- |
| **Docente titular — persona primaria** | Rol autenticado y permisos `classroom:conectar`/`classroom:pull` inspeccionados; decisiones docentes directas confirmadas en esta tarea | Consultar lo ya calificado en Classroom, asociarlo al periodo correcto y verificar qué entrará a EvaluaPro | Cuenta correcta visible, contexto curso-periodo persistente, preview legible, resultados reales y recuperación simple | Elegir cuenta/curso/periodo equivocado; confundir preview con escritura; ver éxito pese a parcialidad |
| **Docente que recupera una operación — modo de la persona primaria** | Reintentos, errores intermitentes, correcciones/reentregas y dudas sobre estado forman parte de los flujos observados | Saber si una importación terminó, continuarla o corregir una selección sin duplicar evidencia | `jobId`, estado recuperable, último checkpoint, conteos confirmados y acción siguiente | Repetir un POST tras timeout sin saber si el servidor ya persistió |
| **Codex en el checkout local — actor agente principal, no persona humana** | Este contexto usa Codex con acceso al checkout y `scripts/api/evaluapro-client.mjs`; SPEC-070 define la automatización docente por API | Resolver una solicitud del docente con lecturas verificables, preparar un plan revisable y ejecutar solo el alcance expresamente autorizado | Preflight API, rutas/helpers documentados, salida estructurada, IDs canónicos, incertidumbre explícita, preview reproducible, aprobación vinculada al plan y recuperación tras timeout | Confundir acceso al repositorio con permiso académico, leer/escribir fuera del alcance, copiar secretos al prompt/shell/logs, operar por UI cuando existe API o repetir una mutación incierta |
| **Otros hosts de agentes** | Necesidad futura no validada en este contexto | Reutilizar las mismas operaciones de dominio | Contrato OpenAPI estable y, si hay demanda, adaptador interoperable | Convertir compatibilidad multiproveedor en requisito P0 o crear lógica/permiso paralelo |
| **Asistente/coordinador institucional** | Rol y permisos efectivos no verificados | Posible consulta o colaboración entre docentes | No se habilita en este diseño hasta definir aislamiento y RBAC | Exponer cursos, alumnos o notas de otro docente |

Los alumnos no son persona directa de la pantalla docente de sincronización. Son sujetos
de datos y deben quedar protegidos; no se añade una vista estudiantil ni acceso del agente
a información fuera de la selección autorizada.

## Principios de experiencia

1. **Una sola casa para cada tarea.** Centro Classroom administra conexión, diagnóstico,
   curso↔periodo e historial del conector. Calificaciones concentra roster, vínculos,
   asignación de actividades al corte/destino, preview, importación y evidencias. El Centro
   enlaza a Calificaciones con el contexto ya seleccionado; no repite esos controles.
2. **Contexto siempre visible.** Antes de una lectura o escritura mostrar identidad Google,
   curso, periodo/materia y alcance de actividades. Los IDs son canónicos aunque la GUI
   presente nombres.
3. **Diferenciar autorización, disponibilidad y datos.** “Cuenta vinculada”, “grant
   vigente según última comprobación”, “API consultada ahora”, “cursos vacíos” y “API no
   disponible” son estados distintos; no mostrar un curso vacío cuando hubo error.
4. **Preview antes de guardar.** Una vista previa identifica lo que cambiaría y lo que
   queda pendiente. Editar selección, vínculo, destino, corte, faltantes o reentregas
   invalida el preview vigente. No se confirma un plan desactualizado.
5. **Importación es entrante y auditable.** Escribir localmente solo `assignedGrade` y
   evidencias permitidas. No editar Classroom. Aclarar que cancelar un job parcial no
   revierte lo ya confirmado en EvaluaPro; conserva el checkpoint y ofrece reanudar.
6. **No automatizar ambigüedades académicas.** El match sugerido solo se aplica de forma
   automática si la regla determinista existente produce una coincidencia única segura.
   Ambiguos/no emparejados, faltantes vencidos y reentregas que cambiarían evidencia
   aceptada requieren decisión docente visible.
7. **La GUI y el agente hablan con el mismo servicio.** No hay lógica académica paralela,
   acceso directo a SQLite/Prisma ni llamada directa de agentes a Google Classroom.

## Modelo de navegación propuesto

### A. Centro Classroom — conexión y estado

- Mostrar la identidad Google del login EvaluaPro y la identidad Classroom vinculada; la
  UI debe indicar “coincide” solo cuando el backend validó `sub`, no por igualdad de correo.
- Si falta conexión, ofrecer “Conectar cuenta de EvaluaPro”. `login_hint` sugiere esa
  identidad; una identidad Google distinta se rechaza sin reemplazar la conexión existente.
- Si la sesión local no tiene `googleSub`, explicar que primero se debe iniciar sesión con
  la cuenta Google correcta. Cancelar OAuth vuelve al estado anterior sin error alarmante.
- Separar salud local/API, estado del grant y última lectura externa. Ofrecer reintentar
  consultas ante fallos de red; un error 401 invita a reconectar; un 403 explica permiso o
  acceso del usuario; un 429 informa demora/cuota y cuándo reintentar si se conoce.
- Mostrar botón para seleccionar curso y materia/periodo de forma explícita, sin inferir
  vínculo por nombre. Cambiar una asociación requiere confirmación y conserva el historial.
- Historial reciente presenta fecha, persona solicitante, curso/periodo, estado y enlace a
  resultado. No incluye emails estudiantiles ni payloads.
- Desconectar requiere confirmación y explica que revoca acceso de integración; los datos
  locales/evidencias existentes se conservan según la política de dominio.

### B. Calificaciones → Classroom — asociación, revisión y sincronización

Presentar flujo con secciones numeradas y retomables:

1. **Contexto:** curso Classroom ↔ materia/periodo EvaluaPro; estado de conexión verificado.
2. **Alumnos:** total, vinculados, sugerencias únicas, sin coincidencia y ambiguos. Acciones
   de resolver/guardar se diferencian de importar alumnos nuevos; el alta exige permiso,
   conteo y confirmación aparte.
3. **Actividades:** actividades existentes, estado, puntaje posible, fecha, corte/destino
   local y participación en cálculo. No editar actividad en Classroom ni inferir corte por
   título. Actividad excluida debe ser visible con su razón.
4. **Revisión previa:** resumen global y por actividad/alumno de calificadas, pendientes,
   drafts ignorados, sin match, altas/actualizaciones potenciales, reentregas y faltantes.
   Mostrar fórmula y escala local cuando la importación impacte proyección académica.
5. **Confirmación:** antes de importar, mostrar curso, periodo, IDs/nombres de actividades,
   estudiantes afectados, conteos estimados, faltas/reentregas que se aprobaron y la
   advertencia de que la acción guarda evidencia local. El botón expresa acción: “Importar
   N evidencias a [materia]”.
6. **Ejecución durable:** aceptación rápida devuelve referencia del job. Vista de progreso
   muestra actividad/página completada, avance y hora de última señal; la UI puede cerrar
   y consultar/reanudar por `jobId` sin iniciar otra ejecución.
7. **Resultado:** `completa`, `completa con elementos omitidos`, `parcial`, `fallida`,
   `cancelada con cambios parciales` o `resultado por confirmar`. Mostrar conteos
   confirmados separados de potenciales; errores por actividad con acción reparable.
8. **Evidencias e historial:** tabla de solo lectura con filtros por alumno, actividad,
   nota/estado y origen; enlace seguro de Classroom; eventos/snapshots paginados. La fuente
   de la calificación y fecha de lectura son explícitas.

### D. Flujo conversacional principal con Codex

1. Interpretar la solicitud dentro del alcance EvaluaPro; distinguir lectura, preparación y
   escritura. El acceso al repositorio o la sesión de Codex no equivale a permiso académico.
2. Ejecutar preflight y consultas de solo lectura con `scripts/api/evaluapro-client.mjs`;
   verificar runtime, docente autenticado, permisos, IDs, curso/periodo, estado y frescura.
   No abrir la GUI ni consultar la base de datos si hay una operación API equivalente.
3. Presentar los hechos recuperados, fuente, límites y ambigüedades. Preguntar solo por una
   decisión académica que no pueda derivarse de una regla aprobada; no inventar datos.
4. Preparar preview contra IDs canónicos y mostrar alcance, filas/conteos, exclusiones,
   cambios locales, errores y `planHash`. El docente puede corregir el plan.
5. Antes de escribir, solicitar aprobación directa para ese plan exacto salvo que el
   mensaje vigente del docente ya autorice explícitamente la misma mutación y alcance. La
   aprobación debe quedar ligada a `planHash`, curso/periodo, destino y conteos.
6. Ejecutar mediante el cliente autenticado con `clientRequestId` persistente; consultar el
   mismo job tras desconexión/timeout. Nunca crear otra clave para reintentar un resultado
   incierto.
7. Verificar el resultado mediante API/historial y reportar qué se confirmó, qué quedó
   parcial o incierto, con IDs de operación y evidencia; no afirmar éxito por el código de
   salida de una llamada aislada.

El primer entregable de agente es una interfaz CLI/SDK apta para invocación por Codex,
respaldada por OpenAPI y el cliente aprobado. No se presupone un plugin MCP de Codex ni una
capacidad especial de aprobación automática. La autorización y la confirmación se validan
en servidor/cliente determinista, fuera del razonamiento libre del modelo.

### C. Estados interactivos obligatorios

| Estado | Mensaje/acción esperados |
| --- | --- |
| Sin permisos | Explicar el permiso requerido y ocultar/deshabilitar la acción; API debe responder 403 estable |
| Integración no configurada | “Classroom no está configurado en este runtime”; incluir diagnóstico seguro, no CTA de reconexión inútil |
| Sin conexión | CTA de conexión con identidad objetivo visible |
| OAuth cancelado | Mantener estado y permitir continuar sin perder selecciones previas |
| OAuth identidad distinta | Rechazo explícito; preservar vínculo actual y dirigir a cambiar cuenta de Google activa del login EvaluaPro |
| Conectada, no verificada recientemente | Mostrar fecha de última lectura; al consultar, actualizar separado de la autorización |
| Sin cursos / sin actividades | Estado vacío con filtros/curso/periodo y explicación; no usar texto de error |
| Curso archivado | Etiqueta permanente “Archivado”; no reactivar automáticamente; permitir solo lectura/sync permitida por dominio |
| Actividad sin `assignedGrade` | “Pendiente; no se importará como nota”; `draftGrade` nunca visible como calificación |
| Falta vencida posible | Solo marcada como cero después de confirmación individual o en lote visible; actualizar preview después de cambios |
| Reentrega posterior | Mantener evidencia aceptada y solicitar autorización explícita para sustituir/registrar nueva observación |
| Preview obsoleto | Invalidar y deshabilitar confirmar; recuperar preview actual antes de escribir |
| Job en cola/en curso | Progreso, `jobId`, consultar estado y cancelar si es seguro; bloquear duplicado equivalente |
| Job parcial/error | Guardar conteos reales y checkpoint; acciones “Reintentar fallidas” o “Reanudar” conservan la operación original |
| Resultado incierto del cliente | Consultar job con `clientRequestId` primero; no volver a crear job ni afirmar éxito/fallo |
| Rate limit/5xx | Reintento acotado y después estado recuperable; nunca 5xx transformado en “sin cursos” |
| Desconexión durante job | Explicar si el servidor sigue procesando; al volver, recuperar estado desde API |

## Casos de uso

| ID | Actor | Escenario | Resultado correcto |
| --- | --- | --- | --- |
| UC-01 | Docente | Abre centro con runtime/API local apagado | Distingue runtime no disponible de grant Google; conserva contexto y no muestra vacío falso |
| UC-02 | Docente | Conecta por primera vez con varias sesiones Google abiertas | `login_hint` apunta al login EvaluaPro; callback compara `sub`; mismatch no conecta |
| UC-03 | Docente | Reautoriza por grant vencido/revocado | Recupera OAuth sin borrar estado/local evidence; indica éxito solo tras callback válido |
| UC-04 | Docente | Cancela OAuth, popup bloqueado o callback duplicado | No pierde vínculo; error accionable y flujo reentrante protegido |
| UC-05 | Docente | Consulta estado sin `googleSub` o sin permiso `classroom:conectar` | Se bloquea solo la acción que requiere identidad/permisos y se explica el prerrequisito |
| UC-06 | Docente/agente | Consulta cursos con cuenta válida, vacío legítimo, 401, 403, 429 o 5xx | Estados separados; reintentos solo para lecturas transitorias y dentro del límite |
| UC-07 | Docente | Selecciona curso y periodo/materia | Guarda vínculo explícito por IDs; no empareja por texto ni cambia de materia silenciosamente |
| UC-08 | Docente | Consulta curso archivado/histórico | Se etiqueta archived y no se reactiva; se respetan reglas de alumnos del periodo archivado |
| UC-09 | Docente | Revisa roster con coincidencias únicas, parciales, ambiguas, duplicadas y ausentes | Sugiere solo coincidencia segura; resuelve conflicto manual; ningún alumno se crea por preview |
| UC-10 | Docente | Decide importar alumnos | Muestra número y datos mínimos; permiso `alumnos:gestionar`; confirmación aparte; resultado auditado |
| UC-11 | Docente | Mapea actividad existente a corte/destino local | Selección explícita; sin creación/edición externa; selección cambia invalida preview |
| UC-12 | Docente | Preview contiene `assignedGrade`, solo `draftGrade`, sin nota, entrega pendiente o puntos faltantes | Solo assignedGrade importa; drafts se omiten; pendientes no se vuelven cero automáticamente |
| UC-13 | Docente | Confirma falta vencida | Se registra selección docente explícita, se recalcula preview y efecto; no se asume por fecha/título |
| UC-14 | Docente | Classroom informa reentrega tras evidencia aceptada | Conserva aceptada hasta confirmación docente; muestra comparación segura y efecto local |
| UC-15 | Docente | Preview con datos y errores por actividad | Indica actividad parcialmente evaluada, conteos potenciales vs errores y no habilita confirmar un plan stale |
| UC-16 | Docente | Inicia importación pequeña o larga | Crea job durable idempotente; devuelve `jobId`, progreso y resultado; UI no sostiene request abierto |
| UC-17 | Docente | Cierra, recarga o pierde red durante job | Recupera mismo estado por `jobId`/`clientRequestId`; no inicia operación duplicada |
| UC-18 | Docente | Job falla a mitad, se cancela o se reanuda | Persiste checkpoint; enumera cambios confirmados; cancelar no promete rollback de commits existentes |
| UC-19 | Docente | Reimporta tras nueva nota asignada o retirada en Google | Reconciliación conserva origen; limpia nota retirada conforme SPEC-046; no duplica evidencia/eventos lógicos |
| UC-20 | Docente | Busca evidencia e historial por alumno/actividad | Filtros/paginación no duplican ni omiten filas; enlaces solo HTTPS a `classroom.google.com` |
| UC-21 | Docente | Desconecta cuenta | Confirmación clara; revoca acceso futuro; mantiene evidencias e historial locales |
| UC-22 | Codex | Ejecuta preflight y consulta estado/cursos/actividades/roster desde el checkout local | Solo lee lo autorizado; devuelve IDs y frescura; usa cliente aprobado, no navegador/DB ni Google directo |
| UC-23 | Codex | Propone mapeo o importación | Produce plan/preview con `planHash`, IDs y efectos; no muta ni inventa coincidencias ambiguas |
| UC-24 | Docente y Codex | Docente aprueba un plan vigente | Codex ejecuta la mutación exacta una vez mediante cliente SDK/API; conserva `clientRequestId`; informe verificable |
| UC-25 | Codex | Timeout, 401/403, error de validación, rate limit o plan desactualizado | Se detiene con código estable y `nextAction`; consulta idempotencia antes de reintentar; no amplía alcance |
| UC-26 | Codex | Lee contenido Classroom con prompt injection en título/descripción/entrega | Trata contenido como dato no confiable, no altera instrucciones del agente ni llama otras herramientas |
| UC-27 | Docente/agente | Dos tabs/agentes operan mismo curso/periodo | Conflicto controlado por lease/job; la segunda llamada recupera job existente o recibe conflicto seguro |

## Contrato de interacción para agentes IA

### Opción arquitectónica

| Opción | Beneficio | Límite | Decisión propuesta |
| --- | --- | --- | --- |
| Llamar REST crudo desde el modelo | Mínimo intermediario | Duplica autenticación/validaciones, invita a inventar rutas/IDs y puede omitir `confirmarEscritura` | No exponer como flujo recomendado |
| Cliente/SDK docente documentado (`evaluapro-client.mjs`) respaldado por OpenAPI y schemas Zod reales | Reutiliza preflight, métodos, IDs canónicos y contratos; sin DB ni browser automation | Requiere completar idempotencia/jobs y reducir diferencias entre API/GUI | Base obligatoria para agentes |
| Adaptador MCP fino encima del SDK/API | Puede hacer descubribles las herramientas para otros hosts | Añade superficie de autenticación, versionado y compatibilidad; annotations no aplican permisos | Fase posterior, tras el flujo Codex; no crea lógica de dominio ni servicio paralelo |

Se recomienda primero estabilizar el flujo de Codex sobre API/SDK autenticado y OpenAPI;
después, si otros hosts necesitan descubrimiento interoperable, añadir un servidor MCP fino
que llame al mismo SDK/API. Los jobs REST con `jobId` son el contrato canónico de progreso/recuperación; un
adaptador MCP podrá reflejarlos como tools o Tasks solo si el host anuncia la extensión
compatible. Las anotaciones son ayudas de interfaz: backend, RBAC y host imponen
autorización y confirmación deterministas; una anotación no es control de seguridad.

### Herramientas lógicas sugeridas

Los nombres siguientes describen herramientas de agente, no rutas actuales garantizadas:

| Herramienta | Tipo | Efecto | Permiso | Confirmación |
| --- | --- | --- | --- | --- |
| `classroom_preflight` | consulta | Runtime, sesión, permisos, lease/contexto y estado sin llamada externa implícita | autenticación | no |
| `classroom_get_connection` | consulta | Identidad vinculada y estado de grant, ocultando secretos | `classroom:pull` | no |
| `classroom_list_courses` | consulta externa acotada | Cursos del docente vinculado | `classroom:pull` | no |
| `classroom_list_activities` | consulta externa | Actividades del curso por ID | `classroom:pull` | no |
| `classroom_list_roster` | consulta externa | Roster mínimo para mapear curso/periodo | `classroom:pull` | no |
| `classroom_get_mappings` | consulta local | Asociaciones actuales curso-alumno/actividad | `classroom:pull` | no |
| `classroom_preview_import` | simulación/preview | Resultado calculado, `planHash`, warnings y conteos; no persiste evidencias/notas | `classroom:pull` | no; visible al docente antes de ejecución |
| `classroom_save_mapping` | mutación local | Vínculos por IDs exactos, `clientRequestId` estable y versión esperada | `classroom:pull` | sí; plan revisado |
| `classroom_import_students` | mutación académica | Alta/actualización acotada del padrón con idempotency key | `classroom:pull` + `alumnos:gestionar` | sí; cantidad/filas aprobadas |
| `classroom_start_import` | job mutante local | Importa solo plan preview vigente | `classroom:pull` | sí; `planHash` y resumen coincidentes |
| `classroom_get_job` | consulta local | Estado/progreso/checkpoint/resultado del job | dueño del job + `classroom:pull` | no |
| `classroom_resume_job` | mutación del job | Reanuda únicamente IDs fallidos/checkpoint con misma clave | `classroom:pull` | aprobación previa acotada al plan; si cambia alcance pedir nueva |
| `classroom_get_history` | consulta local | Importaciones/evidencias/historial paginado | `classroom:pull` | no |
| `classroom_disconnect` | mutación de cuenta | Revoca/desconecta grant | `classroom:conectar` | sí, siempre interactiva |

### Envelope y reglas de operación

- Toda llamada requiere sesión del docente local y autorización server-side por docente,
  recurso y RBAC. Agente y GUI consumen el mismo servicio y almacenamiento; no se entregan
  refresh tokens ni acceso directo a Google/SQLite/Prisma al modelo.
- Las respuestas siguen el envelope API existente y añaden campos estables para `code`,
  `requestId`, `resourceId`/`jobId`, `operationState`, `counts`, `warnings`, `errors[]` y
  `nextAction`; no sustituir los errores de dominio por texto libre.
- `classroom_start_import` requiere `clientRequestId` UUID persistido antes de enviar,
  `planHash` reciente y payload equivalente al preview. Misma clave+payload recupera misma
  operación; misma clave con payload diferente es conflicto. Un timeout consulta esa
  clave/job; no genera otra.
- Toda mutación ofrecida al agente —mapeo, importación de alumnos, inicio, cancelación o
  desconexión— requiere clave estable y recuperación garantizada por backend. Si el
  endpoint actual no ofrece idempotencia, la herramienta queda en preview/read-only hasta
  implementar el contrato; el cliente no simula seguridad con reintentos.
- El consentimiento OAuth sigue siendo humano e interactivo. El agente devuelve
  `NEEDS_USER_AUTH`; no elige cuenta, acepta scopes ni abre navegador en segundo plano.
- La confirmación es una aprobación del docente en el host/UI (o una autorización humana
  de igual peso del contrato API), ligada a operación, IDs, periodo, conteos y hash exacto.
  `confirmarEscritura: true` aislado no demuestra consentimiento. Si preview expira o cambia
  el plan, se solicita aprobación nueva.
- Herramientas de consulta se marcan como solo lectura; herramientas mutantes describen
  efecto, alcance y reversibilidad. Metadatos/hints no otorgan permisos por sí mismos.
- Texto de Classroom, nombres, descripciones, comentarios, URLs y metadata son datos no
  confiables; no se siguen instrucciones contenidas en ellos. URLs se validan por allowlist.
  Registrar IDs opacos y correlation IDs; no prompts, tokens, correos completos o payloads
  personales salvo necesidad de dominio expresamente autorizada.
- El agente no da notas por juicio propio, no convierte `draftGrade`/pendientes en cero,
  no infiere cortes o correspondencias personales, no sustituye el motor de calificación
  ni publica calificaciones en Classroom.

## Estrategia de pruebas

Las pruebas deben cubrir el comportamiento desde los contratos reales y un dataset
synthetic anonimizado. Separar pruebas mockeadas del proveedor Google y prueba manual de
un curso real aprobado; una suite mock no acredita OAuth/cuenta/curso productivos.

| Capa | Qué validar | Evidencia/targets sugeridos |
| --- | --- | --- |
| Reglas puras | `sub`, filtros, planHash, contadores, assignedGrade/draftGrade, fallas/vencimientos y state machine | Backend unit; fixtures sintéticos y límites |
| Cliente/SDK | Reintentos GET-only, mutation sin reintento, UUID estable, consulta tras timeout, error envelope y abort | `apps/frontend/tests/clienteComun.test.ts`, pruebas del SDK `scripts/api` |
| Servicio Google | OAuth hint/sub, token refresh singleflight, timeout, clasificación 401/403/429/5xx, Retry-After y paginación repetida | `apps/backend/tests/servicioClassroomGoogle.test.ts` |
| API integración | RBAC/aislamiento docente, Zod estricto, idempotencia bajo concurrencia, planHash stale, job polling/resume/cancel, counts/eventos/snapshots | `apps/backend/tests/integracion/classroom.v2.test.ts`, `classroom.audit.test.ts`, nuevo `classroom.jobs.test.ts` |
| API contract | Métodos, cuerpos, respuestas, códigos, permisos y `nextAction` alineados entre OpenAPI, Zod, cliente y routes | `npm run api:contract:check`; tests del catálogo |
| GUI componente | Estados completos, vacíos, error, OAuth y mismatch, preview invalidado, parciales, progreso y recovery | `apps/frontend/tests/centroClassroom.behavior.test.tsx`, `classroomEnCalificaciones.test.tsx` |
| Integración GUI/API | Una operación via API se observa igual en GUI e historial; mutaciones GUI usan mismas claves/jobs | pruebas integración con runtime de test aislado |
| E2E UX | Casos de uso completos de setup a evidencia, pérdida de red, reload y teclado | Playwright en runtime local de prueba; guardar trazas/capturas por estado |
| Accesibilidad | WCAG 2.2 AA política repo: nombre/rol/estado, teclado/foco, live regions, temas, contraste, reflow/zoom, reduced motion | `guard:wcag`, lint jsx-a11y, teclado/manual y lector de pantalla |
| Seguridad agente | IDOR/cross-docente, prompt injection en contenido Classroom, exfiltración, tool misuse, secret logging, permisos/revocación | mocks adversariales de contenido y cuentas/docentes separados |
| Google real | OAuth de la cuenta docente, cursos reales autorizados, preview/import y reconciliación en dataset controlado | procedimiento manual reproducible y datos explícitamente aprobados; nunca ejecutar en el curso real sin solicitud |

## Matriz de pruebas de aceptación

| Caso | Entrada/condición | Oráculo verificable | Prioridad |
| --- | --- | --- | --- |
| T-01 identidad OAuth | varias sesiones; `login_hint` del login; callback mismo `sub` | conecta esa identidad; UI muestra cuenta verificada | P0 |
| T-02 mismatch OAuth | callback con otro `sub` y conexión existente | 4xx/código estable; vínculo anterior intacto; sin tokens en log | P0 |
| T-03 readiness | API local caída, grant revocado, permiso 403 | UI/API no confunden runtime, auth, permisos ni cursos vacíos | P0 |
| T-04 estado vacío | cuenta válida sin cursos/actividades | empty state correcto sin error falso | P1 |
| T-05 RBAC | sin `classroom:pull`, sin `classroom:conectar`, sin `alumnos:gestionar` | acción API prohibida; UI explica; ningún side effect | P0 |
| T-06 ID canónico | cursos/periodos con nombres similares | solo asociación de IDs seleccionados; nunca por índice/nombre | P0 |
| T-07 roster exacto | match unívoco vs ambiguo/duplicado/no match | solo match seguro se sugiere; colisiones se bloquean/revisan | P0 |
| T-08 importación de alumnos | payload con selección y permiso | preview no crea; confirmación crea solo seleccionados y reporta altas/actualizaciones | P1 |
| T-09 nota fuente | assignedGrade, draftGrade solo, puntos nulos, falta pendiente | solo assignedGrade produce nota; pendiente no se convierte a cero | P0 |
| T-10 falta vencida | entrega vencida seleccionada para cero | preview muestra cambio; confirmar guarda decisión explícita y auditoría | P0 |
| T-11 reentrega | evidencia aceptada y submission más reciente | accepted evidence no cambia antes de confirmación docente | P0 |
| T-12 invalidación preview | cambiar cualquier selección/mapa/corte/falta tras preview | confirmación bloqueada hasta nuevo planHash | P0 |
| T-13 resultado job normal | curso con N submissions | estados y conteos finales coinciden con lectura de evidencia persistida | P0 |
| T-14 parcial | error de página/actividad después de algunas escrituras | job `parcial`; conteos confirmados/checkpoint correctos; UI no dice éxito total | P0 |
| T-15 timeout incierto | servidor creó job pero cliente perdió respuesta | `clientRequestId` recupera mismo job; no se crea job segundo | P0 |
| T-16 idempotencia de payload | clave repetida con mismo/diferente payload | mismo retorna resultado previo; distinto da conflicto | P0 |
| T-17 concurrencia | dos comienzos equivalentes simultáneos | solo un job activo; ambos obtienen mismo estado o conflicto estable | P0 |
| T-18 caída/reinicio | apagar worker después de checkpoint y reiniciar | job recuperable; sin duplicar evidence/event/snapshot lógico | P0 |
| T-19 cancelar/reanudar | cancelar después de commit parcial | muestra lo ya persistido; reanuda desde checkpoint; no afirma rollback | P1 |
| T-20 error Google | 401/403 con reason, 429 Retry-After, 500/503 | recuperación solo para transitorios; reason accionable; límites respetados | P0 |
| T-21 paginación | nextPageToken repetido/muchas páginas | error explícito antes de loop o acumulación ilimitada | P0 |
| T-22 reconciliación | assignedGrade actualizado y luego retirado en Google | reimportar actualiza/limpia según SPEC-046; historial conserva eventos | P0 |
| T-23 fuente/link | enlace malicioso HTTP, host externo o datos corruptos | se bloquea link; no se navega ni ejecuta contenido | P0 |
| T-24 paridad | inicio/consulta GUI y SDK bajo misma sesión | mismos recursos/estados/conteos/historial; no hay persistencia paralela | P0 |
| T-25 Codex preflight/lectura | Codex inicia en checkout con API disponible/no disponible, docente/permisos válidos/insuficientes | usa cliente aprobado; identifica contexto/frescura; no recurre a GUI/DB ni oculta errores | P0 |
| T-26 aprobación exacta | preview vigente; aprobación/rechazo/ausencia; hash cambiado; alcance distinto | solo la aprobación directa del plan exacto permite escritura; otros casos no tienen side effects | P0 |
| T-27 respuesta incierta Codex | servidor acepta job, cliente pierde respuesta/timeout | Codex consulta el mismo `clientRequestId`/`jobId`; no emite nueva mutación ni declara éxito o fallo prematuro | P0 |
| T-28 prompt injection/secretos | contenido Classroom malicioso; token/dato sensible presente en respuestas de error | se trata como dato; no ejecuta instrucciones ni filtra token, prompt o PII a logs/salida innecesarios | P0 |
| T-29 accesibilidad | todos los estados críticos en móvil/claro/oscuro | teclado y AT alcanzan acción/estado; foco y live announcements útiles; sin overflow 320px | P1 |
| T-30 operabilidad | curso grande con cuotas/fallos transitorios | presupuesto total medido, progreso visible y retry no amplifica carga | P1 |

## Métricas y validación con docentes

- **Seguridad/integridad:** cero jobs duplicados por retry/concurrencia; cero calificaciones
  persistidas desde `draftGrade` o faltantes no confirmados; cero acciones entre docentes;
  cero mensaje de éxito total con errores.
- **Recuperación:** porcentaje de jobs inciertos que se recuperan por idempotency key;
  tiempo hasta terminal; porcentaje reanudado sin duplicados; errores por clase (runtime,
  OAuth, cuota, permiso, proveedor y validación).
- **Usabilidad:** éxito por tarea, errores críticos, abandono por paso, tiempo por paso,
  confianza docente sobre cuenta/contexto/conteos y comprensión de preview vs importación.
  Se establece línea base en sesiones moderadas antes de definir objetivos numéricos.
- Ejecutar pruebas guiadas con docentes que representen conexión por primera vez, cuentas
  Google múltiples, curso sin actividades, roster con excepciones y recuperación de job.
  Registrar fricciones sin datos personales reales; ajustar perfiles después de observación.

## Criterios de aprobación

- Un único diseño de responsabilidad para Centro Classroom y Calificaciones sin preview/
  importación duplicados; reconciliar con SPEC-CLASSROOM-EXPERIENCIA-USUARIO.
- Personas y necesidades permanecen marcadas como hipótesis hasta validación con usuarios.
- Los 27 casos de uso tienen estado/acción definida en UI y contrato de agente.
- Los criterios P0 de integridad, identidad, autorización, idempotencia y recuperación
  pasan en pruebas backend/API/UI antes de habilitar importación por agente.
- API/OpenAPI/Zod/SDK/gui comparten IDs, permisos, respuesta, errores y operaciones.
- Codex local es el primer cliente de agente P0: completa preflight, preview, aprobación
  exacta, ejecución idempotente y verificación API sin depender de MCP. Otros hosts son P1.
- No se habilita MCP remoto hasta que autenticación, aislamiento por docente, aprobación
  de mutaciones y cancelación/recovery del job estén verificados en el backend.
- WCAG guardrails automáticos y revisión humana de estados/teclado se documentan por
  separado; no se declara conformidad solo con screenshots o tests de contraste.

## Criterios de Aceptación

- Ninguna superficie activa repite mapeo/preview/importación; el Centro enlaza a la vista
  canónica de Calificaciones con el contexto preservado.
- Los estados de T-01–T-30 tienen oráculo comprobable, y todos los P0 de identidad,
  permisos, fuente de nota, idempotencia, recuperación, aislamiento y confirmación pasan.
- El mismo `clientRequestId`/payload siempre recupera el mismo job; uno distinto con clave
  reutilizada conflictúa; retry/concurrencia produce cero jobs o eventos lógicos duplicados.
- Un prompt o dato malicioso de Classroom no provoca acción fuera del plan aprobado,
  exfiltración ni cambio de instrucciones.
- Una consulta, preview, importación por GUI y operación SDK reflejan los mismos IDs,
  estados, resultados y auditoría; preview no crea evidencia académica.
- La UI nunca muestra cero por `draftGrade`/entrega pendiente ni “éxito total” con errores;
  el agente no ejecuta mutaciones ante permiso ausente, confirmación denegada/obsoleta o
  endpoint no idempotente.
- La revisión de accesibilidad y usabilidad incluye todos los estados principales en
  móvil y escritorio, pero no se declara WCAG ni facilidad de uso por el solo resultado de
  tests automáticos.
- Las personas permanecen como hipótesis hasta realizar sesiones de validación con
  docentes y ajustar el modelo a sus tareas observadas.

## Matriz de Trazabilidad

| Requisitos | Casos | Archivos/pruebas | Estado |
| --- | --- | --- | --- |
| Personas, separación de superficies, casos UC-01–UC-21 | T-01–T-24, T-29 | `apps/frontend/tests/centroClassroom.behavior.test.tsx`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `apps/backend/tests/integracion/classroom.v2.test.ts` | Propuesto |
| Flujo Codex local, read-only, aprobación mutante y recuperación, UC-22–UC-27 | T-25–T-28 | `scripts/api/evaluapro-client.mjs` contract tests; `scripts/api/openapi.json` contract check; pruebas de integración de job y sesiones Codex; conformance de otros hosts como P1 posterior | Propuesto |
| Idempotencia/job y reintentos | T-12–T-21, T-30 | `apps/backend/tests/integracion/classroom.jobs.test.ts` (nuevo); `apps/frontend/tests/clienteComun.test.ts`; `apps/backend/tests/servicioClassroomGoogle.test.ts` | Propuesto; depende SPEC-100/SPEC-085 |
| Accesibilidad | estados de T-01–T-24 | `npm run guard:wcag`, lint, pruebas de componente, recorrido manual/AT | Propuesto |
| Google real | T-01, T-06, T-09, T-22 | procedimiento manual de `SPEC-CLASSROOM-EXPERIENCIA-USUARIO` y runtime local verificado | Pendiente de acceso/ejecución controlada |

## Fuentes normativas/técnicas

- Política interna de automatización, confirmaciones y API: `AGENTS.md`,
  `SPEC-070_api_first_automatizacion_docente.spec.md`.
- Diseño UX Classroom ya aprobado: `SPEC-CLASSROOM-EXPERIENCIA-USUARIO`.
- La especificación OpenAPI declara una interfaz HTTP que humanos y herramientas pueden
  descubrir; por ello rutas, seguridad, respuestas y errores deben ser explícitos:
  <https://spec.openapis.org/oas/v3.1.2>.
- MCP distingue recursos de contexto y tools ejecutables, recomienda control humano y
  define extensiones opcionales para operaciones largas; las hints no reemplazan
  autorización ni controles de backend:
  <https://modelcontextprotocol.io/specification/2026-07-28> y
  <https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/>.
- Google Classroom describe errores HTTP y reason, y recomienda backoff truncado con
  jitter para `RESOURCE_EXHAUSTED`; la política debe conservar el motivo para UX/API:
  <https://developers.google.com/workspace/classroom/troubleshooting/error-structure>,
  <https://developers.google.com/workspace/classroom/troubleshooting/common-errors>.
