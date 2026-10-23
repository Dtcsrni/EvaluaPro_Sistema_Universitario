---
id: SPEC-100
titulo: Resiliencia operativa de la integración Google Classroom
version: 1.2.0
fecha: 2026-10-22
autor: Codex / EvaluaPro
modulo: modulo_integraciones_classroom
estado: approved
---

## Contexto

La integración Classroom combina OAuth, renovación de credenciales, lecturas HTTP,
paginación, asociación de estudiantes, importación parcial y GUI. La auditoría verificó
una interacción riesgosa entre cliente y servidor: `clienteApi.enviar` usa 15 s por
defecto; el cliente común reintenta errores de red/timeout y HTTP 429/502/503/504 sin
distinguir método; y `sincronizarImportacionClassroom` procesa actividades y entregas en
serie, genera un `importacionId` nuevo por ejecución y persiste evidencia durante el
recorrido. Un timeout del navegador no garantiza cancelar el servidor, por lo que un
reintento puede iniciar otra importación mientras la primera continúa. El upsert de
evidencias mitiga duplicados de filas, pero no hace idempotente toda la operación ni los
eventos/snapshots asociados. Es un riesgo causal demostrable por código; no prueba que
haya duplicados en los datos reales.

El cliente renueva sesión al recibir 401; repetir una vez la solicitud con token nuevo
es distinto de reintentar ciegamente una mutación y debe conservarse con límites. El
servicio Google convierte respuestas HTTP no exitosas en errores genéricos, no establece
timeouts/reintentos acotados para lecturas y no protege todos los bucles de paginación
contra tokens repetidos. Una sesión de navegador observada el 2026-10-14 no mostraba
cursos activos ni archivados, así que no permite validar el curso/grant real. El runtime
docente local detenido observado durante la revisión es un bloqueo de disponibilidad
local separado de una falla de Google Classroom.

El cambio debe mejorar recuperación y diagnóstico sin publicar calificaciones en
Classroom, cambiar semántica académica ni ocultar resultados parciales. GUI y API usarán
los mismos servicios y persistencia. Las operaciones largas no dependerán de que una
petición HTTP permanezca abierta.

## Requisitos Funcionales

- **REQ-001 (Reintentos seguros por método):** El cliente común reintentará automáticamente
  `GET` solamente. No repetirá `POST`, `PUT` o `DELETE` por timeout, desconexión o 429/5xx
  si la operación no tiene contrato de idempotencia persistente. La renovación de sesión
  tras 401 podrá repetir una vez la petición original con el token actualizado, bajo el
  mismo límite y sin iniciar un ciclo de reintentos adicional. Alinea Classroom con
  `SPEC-085`; la política aplica al cliente compartido.
- **REQ-002 (Transporte Classroom acotado):** Cada llamada HTTP a Google tendrá timeout
  configurable y finito mediante `CLASSROOM_REQUEST_TIMEOUT_MS` (por defecto 15 000 ms,
  acotado entre 1 000 y 60 000 ms), distinto del presupuesto total de una importación. Lecturas
  idempotentes podrán reintentarse ante error de red/timeout, 429 `RESOURCE_EXHAUSTED` y
  5xx transitorios con límite estricto, espera exponencial truncada con jitter y respeto
  de `Retry-After` válido. 400, 401, 403 y 404 no se reintentarán a ciegas; errores 403
  se clasificarán por motivo. No se registrarán tokens, cabeceras ni cuerpos sensibles.
- **REQ-003 (Errores accionables):** El servicio conservará internamente clase de fallo
  (red, timeout, cuota, permisos, token inválido, recurso inexistente o proveedor), status
  HTTP y request ID cuando exista. La API devolverá códigos estables y mensajes seguros;
  se distinguirá una lista vacía válida de una consulta fallida.
- **REQ-004 (Renovación concurrente):** Solicitudes concurrentes del mismo docente
  compartirán una renovación de access token en proceso. Un grant revocado/inválido pedirá
  reconexión sin borrar refresh token ni reinterpretar el error como curso vacío.
- **REQ-005 (Paginación segura):** Cursos, actividades, roster y entregas rechazarán
  tokens de página repetidos y excederán el máximo configurable `CLASSROOM_MAX_PAGES`
  (por defecto 100, acotado entre 1 y 1 000) con error
  explícito. El límite se aplicará antes de acumular resultados ilimitados y las páginas
  conservarán filtros y parámetros.
- **REQ-006 (Importación durable e idempotente):** La importación será pull-only y no
  escribirá en Classroom. Se iniciará como operación durable local con `clientRequestId`
  estable, `planHash` de la vista previa aprobada y respuesta de aceptación con `jobId`.
  Antes de escribir, el backend vuelve a calcular la vista previa y rechaza el job si la
  huella ya no coincide. Mismo id y payload recuperan el mismo job/resultado; mismo id con
  payload distinto devuelve conflicto. El servidor guarda estado y progreso por actividad.
  Tras reinicio vuelve a ejecutar el mismo job con el mismo `importacionId`; las escrituras
  locales deben ser idempotentes y eventos/snapshots deduplicados. No se promete omitir la
  relectura de actividades ya procesadas. Un lease o
  restricción existente impide dos importaciones equivalentes activas para docente y
  periodo. El inicio solo es reintentable bajo este contrato. Cada actividad informa
  estado `completa`, `parcial` o `fallida`, conteos confirmados y error seguro. API y GUI
  consultan el mismo job y resultado.
- **REQ-007 (Resultado parcial en GUI/API):** La pantalla muestra éxito solo sin errores
  por actividad; de lo contrario anuncia “finalizada con errores”, conteos reales y
  errores individuales. La recarga de evidencias se informa aparte y no borra el estado
  de la importación.
- **REQ-008 (Observabilidad sanitizada):** Cada operación genera correlation ID y logs
  estructurados con ruta normalizada, intento, latencia, status del proveedor, páginas y
  conteos. Se excluyen nombres, correos, submissions, contenido de tareas, tokens y
  payloads completos.
- **REQ-009 (Compatibilidad GUI/API):** Se conserva contrato compatible o se versiona
  explícitamente. Cliente API, GUI e historial usan los mismos servicios; no crean
  caminos alternos de persistencia.
- **REQ-010 (Identidad Google coincidente):** La cuenta que autoriza Classroom debe ser
  la identidad Google del login EvaluaPro. El backend toma `Docente.googleSub` y correo de
  la sesión; OAuth envía `login_hint` del correo para sugerir la sesión correcta. El
  callback valida el `state` y compara el `sub` autorizado con la identidad esperada. Un
  refresh token previo solo se puede reutilizar si su `googleSub` coincide con la identidad
  esperada; las renovaciones posteriores también comparan la identidad del vínculo con
  `Docente.googleSub` antes de usarlo. Vínculos legados sin identidad o con `sub` distinto
  fallan cerrados y requieren reconexión; no basta con que la GUI muestre desconectado.
  Si la identidad autorizada no coincide, se conserva el vínculo previo sin utilizarlo.
  El correo es hint/etiqueta, no clave de identidad.
- **REQ-011 (Una cuenta activa y cambio seguro):** Cada docente tiene una conexión activa
  a la misma identidad Google de EvaluaPro y puede reconectarla. La interfaz muestra la
  cuenta coincidente y no ofrece otras cuentas del navegador como opciones válidas. La
  sustitución es atómica tras validar OAuth y `sub`; cancelación, mismatch o error conserva
  el vínculo anterior. Sin `googleSub` verificable no inicia el vínculo y explica cómo
  autenticar la cuenta correcta.
- **REQ-012 (Promoción estable con Classroom verificado):** Una promoción a estable de
  EvaluaPro debe incluir evidencia E2E real de Classroom, además de los gates automatizados.
  La evidencia debe validar configuración OAuth, identidad docente, lectura de curso,
  roster y actividad, preview, importación persistente, reimportación idempotente e
  historial; la plantilla o una prueba con fixtures/mock no satisface este gate. La
  evidencia se valida con `release:check:classroom-e2e` y el resultado forma parte de la
  decisión `Go/No-Go` del gate estable. Ausencia o evidencia incompleta produce `No-Go`.

## Diagnóstico Verificado

| Evidencia inspeccionada | Efecto/riesgo | Límite de la conclusión |
| --- | --- | --- |
| `clienteApi.enviar` tiene timeout por defecto de 15 s y `clienteApi` configura 4 reintentos (hasta 5 intentos totales); `fetchConManejoErrores` reintenta red/timeout y 429/502/503/504 sin revisar método | El POST de importación puede repetirse después de respuesta incierta | Riesgo comprobado por código; no demuestra que hubiera duplicados reales |
| Importador procesa actividades/submissions en serie, persiste durante el bucle y genera `randomUUID()` por ejecución; backend usa SQLite/Prisma local | Puede exceder el timeout de GUI y ejecuciones paralelas no comparten identidad; la misma base permite persistir jobs/checkpoints sin cola externa | Falta medir duración con curso representativo y diseñar recuperación/transacciones con el esquema actual |
| Existe upsert de evidencias, mientras eventos/snapshots son por ejecución/importación | Mitiga duplicado de algunas filas, pero no garantiza idempotencia lógica completa | Probar fallos entre evidencia, evento y snapshot |
| Servicio Google pierde clasificación/motivo HTTP y carece de límites completos de transporte/paginación | Reduce capacidad de diagnóstico y puede dejar loops sin límite | Los logs sanitizados no atribuyen causa concreta de cada error histórico |
| Logs del runtime instalado registran OAuth 503, 401, un 502 de cursos y 500 de listado, junto a seis importaciones exitosas | Hubo errores intermitentes y éxitos anteriores | No distingue por sí solo Google, permisos, cuota, red o runtime |
| Runtime local no disponible y Classroom en navegador sin cursos en revisión | Impidió validar curso/grant en vivo | Bloqueo de esa sesión, no diagnóstico del proveedor |

## Alternativas Evaluadas

| Alternativa | Beneficio | Riesgo/costo | Dictamen |
| --- | --- | --- | --- |
| Mantener importación síncrona y aumentar timeout | Cambio inicial menor | Continúan petición larga, resultados inciertos y workers HTTP ocupados; reinicio y segundo intento siguen siendo problemáticos | No recomendada como solución estable |
| Job durable local con estado, progreso y consulta/polling | Sobrevive a timeout/cierre/reinicio, mantiene progreso y permite recuperar respuesta; reutiliza almacenamiento local | Requiere ciclo de vida de jobs, migración compatible, exclusión concurrente y recuperación al arrancar; tras reinicio reejecuta la selección completa | Recomendada para EvaluaPro local |
| Cola/worker externo | Útil para despliegue multi-nodo/alto volumen | Añade servicio, costo y nuevos modos de falla a app local de un docente | No justificada sin evidencia de escala |

Se recomienda un diseño híbrido: lecturas y previews cortos siguen síncronos con límites
seguros; importaciones persistentes usan jobs durables locales. No se promete “exactly
once” de extremo a extremo. La garantía implementada es recuperar el mismo job y repetir
la importación con un identificador estable, con efectos locales idempotentes y eventos/
snapshots deduplicados; tras reinicio se vuelven a consultar actividades ya completadas.

## Criterios de Aceptación

- Un GET reintenta 429 con `Retry-After` de forma acotada; un POST sin idempotencia no se
  repite; una respuesta 403 no se reintenta ciegamente.
- Timeout/error de red acaba dentro del presupuesto por intento y produce código
  accionable sin credenciales ni datos sensibles.
- Paginación normal conserva resultados; token repetido o máximo de páginas produce
  error explícito sin loop ni crecimiento ilimitado.
- Renovaciones concurrentes por docente comparten una llamada OAuth; docentes distintos
  mantienen aislamiento.
- Inicio de importación devuelve `jobId` antes del timeout ordinario de interfaz; puede
  consultarse después de recargar/cerrar la vista y se recupera tras reinicio local.
- La ejecución se vincula al `planHash` mostrado en preview; si `assignedGrade`, roster,
  entregas o estado relevante cambia antes de escribir, se rechaza y se exige preview nuevo.
- Inicios concurrentes con el mismo `clientRequestId` y payload recuperan el mismo job;
  id repetido con payload distinto devuelve conflicto.
- Repetir tras fallas no duplica evidencias, eventos lógicos ni snapshots; la ejecución
  posterior al reinicio puede volver a leer actividades ya procesadas y reporta el
  resultado del job con errores parciales por actividad.
- GUI distingue resultado íntegro, parcial y fallido; error al recargar no oculta el
  resultado de la importación.
- Logs y mensajes no contienen access/refresh tokens, correos de estudiantes ni cuerpos
  completos de Classroom.
- OAuth usa `login_hint` de la sesión; cualquier `sub` distinto de `Docente.googleSub`
  falla sin reemplazar/desactivar el vínculo vigente.
- GUI y API concuerdan; no se modifica Classroom.
- La promoción estable falla si falta la evidencia E2E real o si su versión no coincide
  con la versión candidata; el gate no acepta evidencia generada solo con fixtures.

## Matriz de Trazabilidad

| ID | Descripción | Test vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Reintento por método y resultado incierto | `apps/frontend/tests/clienteComun.test.ts` | Implementado; prueba focal pasa |
| REQ-002–REQ-003 | Timeout configurable, Retry-After, clasificación HTTP y sanitización | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/backend/tests/configuracion.entorno.test.ts` | Implementado; validación focal 19/19 y typecheck completado |
| REQ-004 | Renovación concurrente, revocación y aislamiento | `apps/backend/tests/servicioClassroomGoogle.test.ts` | Implementado; servicio Classroom 21/21, backend typecheck y lint pasan |
| REQ-005 | Paginación normal, repetida y límite configurable | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/backend/tests/configuracion.entorno.test.ts`; `apps/backend/tests/integracion/classroom.audit.test.ts` | Implementado; validación focal 19/19 |
| REQ-006 | Job, planHash, idempotencia, recuperación y parciales | `apps/backend/tests/integracion/classroom.v2.test.ts`; `scripts/tests/evaluapro-client.test.mjs` | Implementación y E2E focal pasan; reinicio repite la selección completa |
| REQ-007 | Progreso/errores parciales de interfaz | `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | Implementado; suite focal pasa |
| REQ-008 | Correlación, ruta normalizada, intento, latencia, status, página y sanitización | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/backend/tests/integracion/classroom.audit.test.ts` | Implementado; validación focal 19/19 |
| REQ-009 | GUI/API usan servicio y job común | `apps/backend/tests/integracion/classroom.v2.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` | Implementado; suites focales pasan |
| REQ-010 | OAuth y uso del token exigen el `sub` de login; refresh legado solo si se verificó el mismo sujeto | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/backend/tests/integracion/classroom.v2.test.ts` | Implementado; servicio Classroom 21/21, typecheck y lint backend pasan |
| REQ-011 | UI de identidad y reconexión | `apps/frontend/tests/seccionClassroom.test.tsx`; `apps/backend/tests/integracion/classroom.v2.test.ts`; `tests/gui-responsive/classroom-importacion.spec.ts` | Implementación local verificada: frontend 18/18 y E2E simulado 1/1; OAuth Google real pendiente |
| REQ-012 | La promoción estable exige evidencia real de Classroom correspondiente a la versión candidata | `scripts/tests/release-stable-promotion.test.mjs`; `scripts/tests/classroom-e2e-evidence.test.mjs` | Aprobado; pendiente de implementación y validación |

La cobertura global se intentó con concurrencia 1 y timeout de 20 min por lote; el
lote OMR `backend-integracion-n-z-04` excedió ese límite en el caso pesado
`omrJobsWorkflow.test.ts`. La prueba pasa en backend CI sin instrumentación (57/57
lotes); este timeout queda como limitación del gate global de cobertura, no como prueba
de cobertura exitosa.

## Decisiones Confirmadas y Dependencias

- El docente tendrá una cuenta Classroom activa por vínculo de EvaluaPro y podrá
  reconectarla. Debe ser la misma identidad Google del login EvaluaPro; `login_hint`
  sugiere esa cuenta y el backend rechaza otro `sub`.
- `SPEC-100` depende de la política común de `SPEC-085`; ambas están aprobadas para
  implementación por autorización explícita de la docente.
- Jobs usarán persistencia/runtime local existentes. No se incorpora una cola externa ni
  dependencia de producción sin línea base que demuestre necesidad.
- Fuera de alcance: publicar notas a Classroom; cambiar calificaciones; crear destinos
  del primer parcial; reparar cuentas/permisos/credenciales, runtime instalado o datos de
  curso.

## Fuentes Técnicas

- Google OAuth para servidores web documenta `login_hint` para prellenar correo o elegir
  la sesión adecuada con varias sesiones, y `prompt=select_account` para selección
  explícita. Se usa hint más validación server-side de identidad:
  <https://developers.google.com/identity/protocols/oauth2/web-server?hl=es-419>.
- OpenID Connect especifica `sub` como identificador estable; el correo puede cambiar y
  no debe ser clave primaria:
  <https://developers.google.com/identity/openid-connect/openid-connect?hl=es-419>.
- Classroom documenta `RESOURCE_EXHAUSTED`, errores estructurados y backoff exponencial
  truncado para rate limits; 403 requiere analizar el motivo:
  <https://developers.google.com/workspace/classroom/troubleshooting/common-errors>,
  <https://developers.google.com/workspace/classroom/troubleshooting/error-structure>,
  <https://developers.google.com/workspace/classroom/reference/limits>.
