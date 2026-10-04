---
id: SPEC-070
titulo: Operación docente automatizable por API con correspondencia en GUI
version: 1.23.10
fecha: 2026-10-04
autor: Codex / EvaluaPro Team
modulo: api_docente_automatizacion
estado: approved
---

## Contexto

Los hilos recientes de EvaluaPro incluyen banco y clasificación de reactivos,
generación y preparación de exámenes, OMR, calificación, Classroom y listas
académicas. Aunque el backend ya ofrece rutas para esos dominios, una sesión de
extremo a extremo aún requiere orientación operativa y comprobaciones manuales de
la GUI. En un hilo de preparación de globales el usuario precisó que la separación
y clasificación de archivos debe suceder dentro de EvaluaPro y que el primer
control compara el examen fuente con el lote generado y el motor OMR.

La meta de esta propuesta es hacer que los flujos docentes soportados se puedan
descubrir, autenticar, ejecutar y verificar por HTTP, sin automatización de
navegador. La GUI seguirá siendo una vista manual del mismo estado local y de las
mismas reglas de dominio. La autorización RBAC, la sesión, el lease de escritura
si está configurado, las confirmaciones docentes y las reglas de calificación
vigentes no se pueden eludir mediante API.

El alcance propuesto es un flujo API-first desde los reactivos hasta la consulta de
resultados: preflight y sesión, banco/taxonomía, diseño y preview, generación de
exámenes individuales o por lote, ingreso/prevalidación de capturas, jobs OMR,
resolución manual de excepciones, vinculación, calificación, importación de
Classroom y lista académica. La automatización de organización de PDFs/capturas
debe ocurrir en EvaluaPro; herramientas externas de IA no serán fuente de verdad
ni sustituirán el motor OMR. La GUI debe permitir inspeccionar y continuar
manualmente esos mismos registros y artefactos.

La vinculación inicial de una cuenta Google puede requerir OAuth interactivo; no
se promete eliminar ese paso de consentimiento ni habilitar acceso externo no
autorizado. Publicar calificaciones a Classroom, borrar/purgar datos, ejecutar
impresión física o modificar una lista real requiere un permiso y flujo explícito;
la automatización no debe inferir autorización por disponer de token API.

## Requisitos Funcionales

- **REQ-001:** Publicar un contrato machine-readable OpenAPI para todas las rutas
  de los routers montados en el API backend, incluyendo CRUD y acciones de dominio
  disponibles para alumnos/periodos, reactivos y temas, plantillas/exámenes/lotes,
  entregas, OMR, calificaciones, Classroom, asistencia, temarios, analíticas,
  sincronización, administración y demás módulos montados. Debe declarar método,
  ruta, autenticación, permiso, validador de entrada, respuesta y errores; los
  schemas de payload se precisan con base en el validador real. No se inventarán
  rutas CRUD para recursos que no tengan endpoint backend.
- **REQ-002:** Proveer una operación de preflight que permita a un cliente detectar
  por API la versión/protocolo, sesión y permisos efectivos, lease de escritura,
  periodo disponible y estado de Classroom. Las comprobaciones deben distinguir
  indisponibilidad, falta de autorización y falta de configuración, sin devolver
  tokens, secretos ni datos de alumnos. `GET /api/preflight` informa el estado
  local autenticado; la conectividad remota de Classroom se reporta como no
  verificada, ya que el preflight no debe iniciar llamadas externas.
- **REQ-003:** Permitir completar las operaciones de este alcance con solicitudes
  HTTP autenticadas mediante las credenciales/API de sesión ya soportadas; el flujo
  normal no debe depender de leer cookies del navegador, automatizar GUI ni abrir
  una sesión de navegador. Para cuentas Google, el SDK intercambia una credencial
  obtenida interactivamente por Google Identity Services mediante la ruta existente
  `/autenticacion/google`; la credencial no se registra ni persiste. El consentimiento
  OAuth inicial sigue siendo un paso interactivo y explícito.
- **REQ-004:** Exponer IDs estables y contexto suficiente para seleccionar periodo,
  materia/grupo, tema/reactivo, plantilla/examen, lote/hoja, alumno, curso Classroom
  y actividad sin emparejar entidades por nombre ni depender del orden de las
  respuestas. Cada operación debe declarar qué IDs consume y qué registros crea.
- **REQ-005:** Mantener semántica inequívoca y verificable entre preview y ejecución
  para importación, hidratación, diseño/generación y prevalidación OMR. Cada preview
  debe declarar si produce artefactos temporales o eventos de auditoría, y no debe
  crear evidencias/calificaciones ni ejecutar la operación final. Las ejecuciones
  conservan validación estricta, permisos, confirmaciones y auditabilidad.
- **REQ-006:** Hacer seguros los reintentos frente a timeout/respuesta perdida en
  operaciones de importación, generación por lote, creación/finalización de jobs
  OMR y calificación: documentar la clave de idempotencia o identidad natural que
  evita duplicados, y devolver el resultado persistido vigente. Nunca inferir que
  un timeout significa que una mutación falló. La publicación externa de notas,
  eliminación/purga e impresión física quedan fuera de la ejecución automática
  predeterminada.
- **REQ-007:** Banco, taxonomía y asignación de reactivos deben conservar los
  mismos contratos y filtros que usa la GUI. El diseño de examen debe referenciar
  los mismos reactivos, plantilla, configuración y versión/fingerprint que ve la
  GUI; la salida PDF debe poder localizarse por ID/lote/folio y descargarse por
  API sin automatizar navegador.
- **REQ-008:** PDF e imágenes fuente deben poder ingresarse, dividirse/prepararse y
  clasificarse dentro de EvaluaPro mediante API, con formatos y límites declarados.
  Cuando QR/folio encuentre un examen generado, la respuesta debe distinguir una
  coincidencia verificada de una sugerencia; metadatos ambiguos de curso, materia,
  parcial, docente, alumno o grupo requieren resolución explícita. La clasificación
  y cualquier corrección manual deben conservar el archivo fuente, el resultado,
  la procedencia y la relación con el lote de examen.
- **REQ-009:** El job OMR debe exponer estado, progreso, hojas aceptadas y
  excepciones por serial; una corrección manual de excepción debe persistir con
  actor y motivo cuando corresponda, y la finalización debe ser explícita. No
  convertir predicción, QR no leído o ausencia de marca en dato confirmado.
- **REQ-010:** La consulta API de lista académica debe usar la misma agregación y
  reglas que la GUI y las exportaciones aplicables. Ausencia de nota, entrega
  pendiente, calificación publicada de cero y falta confirmada por el docente
  deben seguir siendo estados diferentes; una nota ausente no se convierte en
  cero automáticamente, conforme a SPEC-060.
- **REQ-011:** Una mutación hecha mediante API debe persistir en la misma base local
  y servicios de dominio que usa la GUI. Después de recargar la vista, la GUI debe
  mostrar el estado actualizado, y una lectura API posterior debe devolver el
  estado que la GUI presenta; no se crearán almacenes paralelos ni rutas de dominio
  duplicadas.
- **REQ-012:** Los errores conservan el envelope documentado del API y deben
  incluir código estable, estado HTTP y `requestId` correlacionable cuando exista.
  Los errores de validación deben identificar el campo; las respuestas y logs no
  exponen secretos ni información personal innecesaria.
- **REQ-013:** Documentar ejemplos reproducibles de sesión API que no incluyan
  contraseñas en argumentos de proceso, tokens en archivos del repositorio,
  encabezados de autorización en logs ni credenciales reales. No añadir
  dependencias de producción para un cliente de automatización.
- **REQ-014:** Los cambios de recurso deben usar la operación de dominio existente
  y respetar su ciclo de vida: nuevas versiones y revisión/publicación de reactivos;
  edición/archivo de plantillas; regeneración/archivo y recuperación de lotes;
  resolución/finalización OMR; corrección/calificación académica. Las acciones
  destructivas, publicaciones externas y escrituras de nota deben conservar
  permisos y confirmación. La API debe identificar de manera explícita los recursos
  para los que solo existe lectura o acción limitada, en vez de sugerir CRUD pleno.
- **REQ-015:** Para cada recurso propiedad de EvaluaPro cuyo ciclo de vida permita
  CRUD sin romper su integridad, exponer lectura, alta, modificación y baja lógica
  o física conforme a su dominio, RBAC y correspondencia GUI. Si un recurso es
  inmutable, append-only, externo, histórico o solo admite acciones especializadas,
  declarar el límite y ofrecer las operaciones seguras existentes. El catálogo debe
  permitir identificar gaps de CRUD y rutas legacy bloqueadas; no añadir bajas que
  invaliden exámenes o calificaciones históricos.
- **REQ-016:** El recurso canónico `Reactivo` debe ofrecer listado y lectura de su
  versión actual por API, con filtros por periodo, tema y estado, paginación
  acotada, contenido vigente y asignaciones canónicas. Toda consulta debe estar
  delimitada al docente autenticado; IDs ajenos se responden como no encontrados.
  La lectura debe conservar la distinción entre `versionActual` (número) y el
  contenido de esa versión, y no incluir los assets binarios en listados. La
  publicación debe ser recuperable ante reintentos secuenciales o concurrentes:
  una transición ya completada devuelve la misma referencia legada sin crear otra
  `VersionPregunta`; una inconsistencia entre estado y referencia produce conflicto
  explícito. Retirar conserva la identidad y bloquea la publicación posterior.
- **REQ-017:** Una ingesta OMR PDF debe permitir resolver por API una página sin QR
  al examen y página generados de su mismo lote, y editar respuestas detectadas en
  páginas que requieren revisión. La resolución conserva el original y su hash,
  registra motivo y procedencia, regenera el paquete/manifiesto y mantiene la página
  en revisión; asociar o corregir una hoja no escribe calificaciones. Para rescatar
  un QR con rotación, el backend conserva la orientación fuente para analizar
  burbujas y no reutiliza un bitmap rotado solo para QR como entrada OMR.
- **REQ-020:** Los códigos de acceso de calificaciones deben poder consultarse
  por periodo/estado y por ID, limitados al docente y con cursor estable. El secreto
  se muestra únicamente al generarlo y nunca en lecturas. La generación acepta un
  `clientRequestId` UUID que permite recuperar la misma respuesta en un reintento;
  una clave reutilizada para otro periodo se rechaza y solo se generan códigos para
  periodos propios. Expirar localmente un
  código es una acción confirmada; la sincronización al portal sigue separada y no
  debe declararse revocada la copia remota hasta verificar su invalidación. La GUI
  permite consultar esos metadatos y expirar el mismo recurso con aviso de publicación.
- **REQ-021:** La lista de exámenes generados debe validar filtros por periodo,
  alumno, plantilla y tipo de examen (`parcial`, `global`, `extraordinario`), limitar
  el tamaño de cada respuesta y exponer un cursor estable ordenado por `generadoEn` e ID. La
  respuesta debe mantener el filtro por docente y devolver 
extCursor` explícito;
  el cliente API y la GUI deben poder continuar la consulta sin perder ni repetir
  exámenes entre páginas. El resumen no debe transferir claves, mapas OMR ni
  artefactos; su detalle completo se consulta por ID o por la ruta de descarga.
- **REQ-022:** La generación individual de examen acepta una clave UUID opcional para
  automatización y conserva el contrato de la GUI que no la envía. Si el cliente
  reintenta con la misma clave y plantilla, la API devuelve el examen persistido sin
  generar una variante nueva; reutilizarla con otra plantilla o docente produce 409.
  La clave se conserva como ID canónico del examen, por lo que no requiere una tabla
  alterna de idempotencia y el detalle/descarga existentes permiten recuperar el
  resultado. El cliente de automatización debe exigir y persistir la clave antes de
  enviar el POST.
- **REQ-023:** La API permite enumerar paquetes de examen consolidados por docente
  y plantilla, con cursor estable, límite acotado y metadatos suficientes para
  consultar progreso/descargar el PDF por API. La lista solo incluye lotes con
  artefacto consolidado; los lotes parciales conocidos por el cliente se consultan
  por el `loteId` estable en el recurso de progreso. No expone rutas de filesystem.
- **REQ-024:** La lista de evidencias de evaluación valida filtros por periodo/alumno,
  aplica paginación keyset por fecha, creación e ID, mantiene aislamiento por docente
  y entrega 
extCursor` explícito. El SDK puede recorrer todas las páginas sin
  duplicar evidencias. Detalle, actualización de evidencia manual con concurrencia
  optimista y motivo, archivo/restauración lógica mantienen actor e historial. Una
  evidencia Classroom no se modifica por CRUD genérico; la lectura no escribe ni
  publica calificaciones.
- **REQ-025:** Las políticas propias de calificación tienen alta, lectura, versionado
  y baja lógica por docente. Una versión publicada es inmutable; PUT crea la siguiente
  versión y DELETE publica una versión archivada, sin destruir referencias históricas.
  Solo las familias de fórmula soportadas por EvaluaPro se aceptan y sus pesos/umbral
  deben validarse. Las mutaciones requieren `clientRequestId` UUID y archivo requiere
  además motivo/confirmación. Cada alta, versión y archivo escribe el evento
  append-only con actor, hash y valores before/after en la misma transacción; la API
  ofrece auditoría paginada por docente/código. Configurar un periodo requiere la versión activa más reciente; los
  cálculos resuelven código+versión exactos, aplican los parámetros persistidos y
  guardan ID, versión y parámetros en auditoría. El listado y la GUI muestran las
  mismas definiciones. Los reintentos usan `clientRequestId` estable. La migración
  no reconstruye eventos históricos: la auditoría comienza con las mutaciones hechas
  después de instalarla; las versiones anteriores siguen consultables como políticas.
- **REQ-026:** La evidencia manual tiene ciclo de alta/lectura/edición/archivo/restauración
  por API y GUI. Las ediciones requieren `expectedUpdatedAt` (control de concurrencia
  optimista), motivo y confirmación; cada cambio registra actor, instante, motivo y
  valores antes/después. El archivo no borra la fila, la excluye de los cálculos y
  puede revertirse con motivo. Las evidencias de Classroom solo se corrigen por su
  flujo de sincronización. La migración SQLite es aditiva y conserva respaldo.
- **REQ-027:** Los artefactos PDF consolidados de examen son inmutables. Reanudar un lote
  conserva `loteId` y exige compatibilidad del payload; cambiar plantilla, reactivos,
  versiones o cohorte requiere una nueva generación con otro ID. El API no expone
  archivo/restauración del registro `ExamenLoteArtefactoPdf`; hasta definir una acción
  auditable compatible con OMR, entregas y exámenes relacionados, los clientes no deben
  imitar esa baja archivando recursos relacionados. El gap debe permanecer visible en el
  catálogo y la correspondencia GUI/API se comprobará cuando se cierre.
- **REQ-028:** El ciclo del temario debe ofrecer detalle, alta no destructiva, edición
  concurrentemente segura, consulta de auditoría paginada y baja confirmada por API y
  GUI. La edición conserva el avance y notas de los nodos con el mismo número y rechaza
  quitar nodos vinculados a avance, notas o asistencia. La baja física requiere versión
  actual, confirmación y motivo; solo se permite sin historial y deja un evento
  append-only accesible después de eliminar el temario. La carga PDF de GUI debe usar el
  endpoint multipart real del backend.
- **REQ-029:** El inventario CRUD debe cubrir todos los modelos declarados en el schema
  Prisma. Cada modelo se asigna a un recurso y ciclo de vida, incluso si es de seguridad,
  append-only, externo o solo admite acciones especializadas. `api:contract:check` debe
  fallar si hay modelos omitidos o nombres que no existan en el schema.
- **REQ-030:** El artefacto PDF consolidado tendrá lectura, archivo, restauración y
  auditoría por lote mediante API y GUI. Archivar/restaurar será atómico para el artefacto
  y los exámenes asociados, conservará entregas, calificaciones, hojas/ingestas OMR y
  referencias históricas, y usará `clientRequestId` idempotente por docente/lote/acción.
  Restaurar verificará existencia, SHA-256 y estructura PDF antes de habilitar descargas;
  un lote archivado no podrá regenerarse bajo el mismo ID.
- **REQ-031:** Las mutaciones CRUD de `TemaBanco` actualizarán el tema y sus
  referencias en preguntas/plantillas dentro de una transacción, registrarán
  auditoría before/after append-only y aceptarán `clientRequestId` para recuperar
  respuestas perdidas; el SDK y la GUI usarán las mismas rutas y servicios.
- **REQ-032:** El flujo de registro de Global, evaluación continua basada en
  Classroom y bono extracurricular debe conservar una fuente y un resultado únicos
  en EvaluaPro, disponibles por GUI y API sobre los mismos servicios. El Global
  podrá registrarse manualmente como componente `global` por alumno, con escala
  validada, vínculo al examen fuente cuando exista y procedencia manual/OMR
  diferenciada. Las actividades Classroom calificadas podrán asociarse
  explícitamente a materia, alumno y corte 3; la normalización conservará la nota
  original, puntos posibles y asignados, y los faltantes seguirán distintos de
  cero. El bono se mantendrá como un solo valor por alumno, auditable y aplicado
  una sola vez, primero al Global o evaluación continua del tercer parcial,
  después al segundo y finalmente al primero. Dentro de cada parcial se prioriza
  evaluación continua y luego examen. Se omiten componentes no capturados; los
  componentes resultantes y cada parcial quedan limitados a sus escalas y nunca
  superan 10 por parcial. Si la calificación final base ponderada ya es 10, el
  bono no se aplica. La GUI muestra una vista previa antes de guardar y una sola
  columna enlazada mediante fórmulas en el XLSX. API y GUI exponen el desglose
  numérico de la asignación en los seis destinos, en el orden Continua/Examen
  de Global/C3, P2 y P1; el preview no muta. El guardado es versionado con
  `clientRequestId` e idempotencia. No se publicarán
  notas a Classroom como parte de este flujo.
- **REQ-033:** La generación por lote admite el tipo fijo `extraordinario` con
  una lista explícita de alumnos activos del periodo de la plantilla. Los exámenes
  conservan el tipo y vínculo por alumno en historial y resultado. Su calificación
  se persiste separada y no alimenta componentes ni agregados de parcial/global.
  Reintentos con el mismo lote deben coincidir en tipo y cohorte; una selección
  distinta requiere un `loteId` nuevo.
- **REQ-019:** Las entregas deben poder listarse y consultarse por ID desde API,
  con filtros por examen, alumno, periodo, lote y estado, paginación acotada y
  cursor estable. Cada respuesta debe limitarse al docente autenticado y omitir
  datos personales no requeridos; vincular o deshacer entrega conserva la acción
  y bitácora del dominio, sin edición genérica de la fila histórica.
- **REQ-018:** Los jobs de escaneo e ingesta OMR deben poder listarse por docente,
  con filtro por examen/estado, límite acotado y cursor estable. El listado no
  incluirá respuestas ni datos personales por defecto; detalle completo se obtiene
  por el ID del job y conserva aislamiento del docente autenticado.

- **REQ-033:** Las portadas opcionales de materias se administran mediante
  `GET/PUT/DELETE /periodos/{periodoId}/portada` con sesión, permisos y aislamiento
  por docente. La carga multipart acepta JPG/JPEG, PNG y WebP hasta 20 MiB y
  20 megapíxeles; el recurso se normaliza a WebP y no se incluye como bytes en el
  listado. La GUI presenta la misma portada o el fallback genérico conforme a
  `SPEC-073`.

## Criterios de Aceptación

- **AC-001:** Un validador de contrato verifica el OpenAPI y detecta divergencias
  de las rutas, permisos, campos y envelopes cubiertos por el alcance.
- **AC-002:** Un cliente sin GUI puede comprobar preflight y autenticarse; crear y
  consultar tema/reactivos; previsualizar/generar examen; cargar y prevalidar
  capturas; crear/consultar/resolver/finalizar un job OMR; calificar; listar
  cursos/actividades/alumnos Classroom y consultar la lista académica usando IDs
  explícitos. Una ausencia de permiso/configuración se informa sin reintentos
  engañosos.
- **AC-003:** Previews no crean evidencias/calificaciones ni finalizan trabajos;
  respuestas declaran cualquier registro de auditoría/artefacto temporal. Ejecución
  persiste solo la operación solicitada y un reintento no crea duplicados.
- **AC-004:** Un flujo con respuesta HTTP perdida y repetición de la misma operación
  obtiene el mismo resultado persistido, sin duplicar reactivos, artefactos/lotes,
  evidencias, hojas procesadas ni calificaciones.
- **AC-005:** Una entrada PDF de varias páginas puede procesarse por API dentro de
  los límites publicados; las páginas con QR/folio coincidente quedan relacionadas
  al examen generado correcto, y las ambiguas quedan en una cola de resolución
  manual sin asignación inventada. Las correcciones aparecen en GUI y en lectura
  API posterior.
- **AC-006:** El conjunto de estados de notas pendientes, nota cero publicada,
  nota ausente y falta confirmada conserva el significado descrito en SPEC-060
  tanto en API como en GUI/lista académica.
- **AC-007:** Una prueba de integración ejecuta los flujos principales por API y
  verifica la lectura posterior en los contratos que consume la GUI; pruebas de
  componente verifican que la GUI representa los mismos datos y estados. No se
  requiere navegador real para automatizar operaciones que el API documenta.
- **AC-008:** Las solicitudes sin bearer válido, permiso o lease requerido se
  rechazan de forma consistente y no producen escrituras. Los payloads
  desconocidos/malformados devuelven error de validación con campo identificable.
- **AC-009:** El preflight, el contrato y los ejemplos no contienen secretos, tokens,
  correos o nombres reales de alumnos. El contrato es compatible con el backend
  local documentado y distingue capacidades no disponibles de errores transitorios.
- **AC-010:** `api:contract:check` detecta desviaciones entre el inventario OpenAPI
  y todas las declaraciones de rutas montadas; cada operación expone fuente,
  permisos y validadores Zod disponibles. Para recursos con mutaciones, se
  documentan las acciones reales (crear, actualizar, archivar/restaurar, eliminar,
  generar/regenerar, confirmar, resolver u otras), sin convertir acciones de
  dominio en CRUD ficticio.
- **AC-011:** El catálogo diferencia CRUD existente, ciclo especializado, recurso
  administrado externamente y gaps de API. Cada gap dentro del alcance se
  implementa con el mismo servicio/datos que consume la GUI o se documenta como
  pendiente con su motivo de integridad o seguridad. Los wrappers mutantes del
  cliente requieren confirmación explícita antes de enviar escrituras; las bajas
  destructivas usan una confirmación diferenciada.
- **AC-012:** `GET /banco-preguntas/reactivos` permite filtrar por periodo, tema y
  estado; pagina entre 1 y 100 elementos por cursor y devuelve la versión vigente
  y sus opciones. `GET /banco-preguntas/reactivos/{reactivoId}` devuelve el
  contenido vigente completo. Un docente no puede consultar el reactivo de otro;
  un cursor inválido devuelve error de validación sin filtrar existencia ajena. Dos
  publicaciones concurrentes del mismo reactivo revisado generan una sola versión
  legada y ambas recuperan la misma referencia; volver a publicar el recurso vigente
  no añade otra versión. Un estado publicado sin representación legada activa devuelve
  conflicto explícito, y un reactivo retirado no puede publicarse.

- **AC-013:** Una integración sube un PDF que contiene una página sin QR, la asocia
  al examen/página correcta de su lote por API, conserva bytes/hash del original,
  actualiza paquete y manifiesto, y mantiene 
eeds_review`/`autoGradable=false`
  sin crear ni modificar calificaciones. Una página ya asociada permite guardar
  respuestas revisadas con motivo y continúa sin publicar notas.
- **AC-014:** El listado paginado de jobs devuelve jobs del docente y permite
  filtrar por examen y estado. Cada fila es resumida, el cursor inválido se rechaza
  y otro docente no puede leer los jobs listados ni sus detalles.
- **AC-015:** Calificar con `clientRequestId` persiste una sola nota para esa clave;
  repetir el mismo payload devuelve el ID y la nota existentes; otro payload con
  esa clave devuelve 409 sin insertar otra nota ni archivar capturas duplicadas.
- **AC-016:** Alumnos, plantillas y temas de banco pueden leerse individualmente
  por ID canónico; el dueño recibe su recurso y otro docente recibe 404. La prueba
  de paridad en componentes GUI debe verificar la presentación de esos mismos
  campos.

- **AC-018:** La API lista códigos de acceso por periodo/estado y permite
  consultar un código propio por ID; otro docente recibe lista vacía/404, los
  parámetros inválidos se rechazan y ninguna lectura devuelve el secreto. Repetir
  la generación con el mismo `clientRequestId` y mismo periodo devuelve ID, código
  y expiración idénticos sin crear otra fila; reutilizarlo con otro periodo produce
  409, y el periodo de otro docente produce 404. La alta no envía a destinatarios
  fijos. Expirar localmente exige confirmación y no se confunde
  con revocar la copia remota, cuya actualización requiere publicación separada.
  La GUI docente consulta los mismos metadatos y confirma la expiración local.
- **AC-019:** Con más registros que el límite solicitado, las páginas de exámenes
  generados cubren todos los IDs propios exactamente una vez; ordenar por fecha/ID
  hace estable el cursor. Límites, filtros, cursor inválido e IDs de otro docente
  se validan o aíslan; la GUI permite cargar la página siguiente. El listado conserva
  campos necesarios para la operación manual y omite mapas OMR, claves y artefactos.
- **AC-020:** Dos POST concurrentes con el mismo `clientRequestId` y plantilla crean
  un solo `ExamenGenerado` y responden con el mismo ID; el reintento posterior recupera
  ese registro. Reusar la clave desde otro docente o para otra plantilla devuelve 409
  sin revelar el recurso ni insertar otro examen. Sin clave, la GUI conserva el
  comportamiento vigente. El cliente SDK rechaza clave ausente/malformada y no reintenta
  automáticamente escrituras.
- **AC-021:** La lista de paquetes devuelve solo los lotes propios consolidados,
  soporta filtro por plantilla y cursor sin repetir IDs, rechaza límites/cursores
  inválidos y no revela nombre/ruta local del archivo. El SDK pagina todas las
  entradas y la GUI manual ya puede representar los mismos paquetes agrupando sus
  exámenes por `loteId`.
- **AC-022:** Con más evidencias que el límite, páginas filtradas cubren cada ID propio
  exactamente una vez, respetan el orden estable, rechazan límite/cursor inválidos y
  no devuelven registros de otro docente. El sobre previo `evidencias` se mantiene y
  se agrega 
extCursor` nullable para compatibilidad.
- **AC-023:** Un docente crea y consulta su política; otro docente recibe 404. Cambiar
  parámetros crea una versión nueva, no modifica la anterior; asignar esa versión al
  periodo cambia efectivamente el resumen calculado y la auditoría identifica la
  política/version. Reusar `clientRequestId` con el mismo payload es idempotente y
  con otro payload produce 409. Alta, versionado y archivo dejan un evento append-only
  paginado con actor, motivo, hash y snapshots antes/después; repetir una clave/payload
  no duplica evento y reutilizarla con otro payload produce 409. Archivar conserva la
  historia y bloquea su asignación futura. La GUI puede seleccionar, editar/versionar,
  archivar y continuar consultando las mismas políticas.
- **AC-024:** Una evidencia manual puede editarse solo con su `updatedAt` vigente;
  una versión atrasada recibe 409. Edición, archivo y restauración aparecen en detalle
  y auditoría con actor/motivo. Archivar la saca del resumen de evaluación y restaurarla
  vuelve a incluirla. Las operaciones sobre Classroom o evidencia ajena se rechazan;
  la GUI refleja el mismo estado. El esquema existente recibe campos por migración
  SQLite no destructiva.
- **AC-025:** Repetir una generación de lote conserva el mismo `loteId` y solo recupera
  o reanuda el payload compatible; una plantilla, versión o cohorte distinta debe usar
  otro ID. El listado/detalle no presenta edición en sitio ni baja del PDF consolidado;
  las referencias OMR, entregas y exámenes del lote anterior siguen disponibles. El gap
  de archivo/restauración aparece explícitamente en `RESOURCE_LIFECYCLE.md` y `AGENTS.md`.
- **AC-026:** Crear otro temario en un periodo ocupado devuelve 409 y conserva el original.
  Actualizar con `expectedUpdatedAt` vigente preserva estado/notas de nodos coincidentes,
  audita antes/después y motivo; versión atrasada devuelve 409. Quitar un nodo con
  historial o eliminar un temario con nodos trabajados devuelve 409. La baja de un
  temario vacío requiere confirmación, versión y motivo, y su evento sigue consultable
  por el mismo docente; otro docente recibe 404 para detalle y auditoría. El cliente
  pagina el historial sin repetir eventos y la GUI
  actualiza usando esos mismos contratos. PDF manual se recibe como multipart en
  `/temarios/desde-pdf`.
- **AC-027:** El guard de ciclo de vida compara los modelos Prisma con la columna de
  modelos del inventario: ningún modelo queda sin clasificación ni se acepta un nombre
  obsoleto. El guard se ejecuta junto con la sincronización OpenAPI en
  
pm run api:contract:check`.
- **AC-028:** Un docente autorizado puede archivar un paquete mediante API, verlo en
  la GUI/API de archivados y restaurarlo tras validar integridad para descargar el mismo
  PDF. Repetir la misma acción con la misma clave no agrega eventos ni duplica cambios;
  reutilizarla con otra acción/lote produce conflicto. La operación conserva relaciones
  de entregas, notas y OMR y la GUI usa el mismo backend/persistencia.
- **AC-029:** Crear, actualizar y archivar un tema por API produce una sola mutación
  transaccional con evento de auditoría before/after. Repetir el mismo
  `clientRequestId` con payload idéntico devuelve el resultado previo sin duplicar
  efectos ni eventos; reutilizarlo con otra acción o payload devuelve 409. La lista
  de auditoría pagina por cursor y está aislada por docente/tema. La GUI presenta el
  mismo estado y conserva la clave si una respuesta de mutación queda incierta.
- **AC-030:** La verificación de cobertura documenta por separado: (a) el componente
  `global` manual de 0–10 por alumno, con referencia al examen fuente disponible en
  ambas interfaces; (b) la sincronización Classroom usando solo `assignedGrade`, su
  mapeo explícito a C3 y lectura de las mismas evidencias desde API y GUI; (c) el
  bono único con prioridad Global/C3, P2 y P1, con evaluación continua antes que
  examen dentro de cada corte; el preview devuelve los seis destinos de asignación y
  la GUI muestra los importes no nulos antes de confirmar. El preview no modifica calificaciones ni evidencias,
  todo guardado requiere un `clientRequestId` UUID (su ausencia se rechaza en API), y las actualizaciones requieren
  además la versión vigente. Repetir la clave con payload idéntico devuelve el resultado original sin incrementar
  versión ni duplicar auditoría; reutilizarla con otro payload devuelve 409. La escritura requiere confirmación
  explícita; y (d)
  la lectura posterior a la ejecución en la lista académica y su exportación. La
  vista previa, cálculo de final ponderado y fórmulas del XLSX se verifican en
  pruebas focales. La inspección de la lista institucional vigente y la ejecución
  productiva continúan como validación separada. Todo faltante se identifica como
  gap y no se presenta como capacidad implementada.
- **AC-031:** En la calificación OMR, una respuesta `sin_marca` o `doble_marca`
  no resuelta conserva `opcion: null`, cuenta como incorrecta tanto en la GUI como
  en la API y no puede elevar los aciertos manuales enviados por el cliente. La GUI
  conserva el estado de revisión al guardar. Una doble marca solo puede calificarse
  como opción única si la evidencia ya fue resuelta explícitamente antes de
  calificar; de otro modo sigue sin opción y cuenta incorrecta.
- **AC-032:** La API rechaza el tipo extraordinario sin una lista no vacía de
  alumnos únicos, inactivos o fuera del periodo de la plantilla, sin crear
  exámenes. Una solicitud válida genera exactamente un examen extraordinario por
  alumno elegido; el reintento idempotente valida la misma cohorte. La calificación
  conserva la nota extraordinaria y no escribe campos ni agregados ordinarios.
- **AC-017:** La API permite listar entregas con filtros y cursor, consultar
  una entrega propia por ID, rechazar IDs ajenos como 404 y rechazar cursores o
  parámetros inválidos. La respuesta no expone el correo del alumno; las
  mutaciones siguen usando vincular/deshacer y dejan historial.
- **AC-018:** El SDK intercambia una credencial Google no vacía por la sesión API
  mediante `/autenticacion/google`, conserva el token devuelto en memoria y devuelve
  el perfil docente. La validación local evita solicitudes con credenciales inválidas;
  ni la credencial ni el token se escriben en logs o almacenamiento persistente.

- **AC-032:** La API permite consultar, reemplazar y retirar la portada de una
  materia propia; rechaza MIME falso, formatos no admitidos, archivos mayores a
  20 MiB y más de 20 MP. El listado no devuelve el BLOB. La GUI previsualiza,
  guarda y administra la imagen, muestra fallback cuando falta y permite reintentar
  una carga fallida sin duplicar la materia.

## Matriz de Trazabilidad

Los archivos enlazados son cobertura actual o puntos de ampliación; su presencia no
implica que ya satisfagan todos los criterios nuevos.

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 / AC-001 | Contratos/versionado de rutas API | `apps/backend/tests/integracion/versionadoApiV2Contratos.test.ts` | Pendiente de ampliar |
| REQ-002 / AC-002 | Estado autenticado de sesión, permisos efectivos, lease, periodo y Classroom | `apps/backend/tests/preflight.test.ts`; `apps/backend/tests/rutasSalud.test.ts` | Implementado y validado en foco; salud de servicio sigue disponible por `/api/salud/ready`; conectividad Classroom requiere comprobación separada |
| REQ-003 / AC-007 | Sesión bearer, refresh y rechazo sin sesión | `apps/backend/tests/integracion/autenticacionSesion.test.ts` | Pendiente de ampliar |
| REQ-003 / AC-018 | Inicio de sesión Google por cliente API sin persistir secretos | `scripts/tests/evaluapro-client.test.mjs`; `apps/backend/src/modulos/modulo_autenticacion/rutasAutenticacion.ts` | Validado en SDK; ruta preexistente |
| REQ-004 / AC-002 | Resolución por ID en Classroom y protección de selección | `apps/backend/tests/integracion/classroom.v2.test.ts` | Pendiente de ampliar |
| REQ-005 / AC-003 | Preview y ejecución de importación Classroom | `apps/backend/tests/integracion/classroom.v2.test.ts` | Pendiente de ampliar |
| REQ-006 / AC-004 | Reintento sin duplicados en importación/calificación | `apps/backend/tests/calificacion.persistencia.test.ts` | Pendiente de ampliar |
| REQ-007 / AC-002 | Banco/taxonomía y operaciones API de reactivos | `apps/backend/tests/bancoPreguntas.controlador.test.ts` | Pendiente de ampliar |
| REQ-016 / AC-012 | Listado paginado, detalle vigente, historial de importación, aislamiento e idempotencia concurrente de publicación de reactivos canónicos | `apps/backend/tests/integracion/reactivosIngesta.test.ts`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/api/check-openapi-contract.mjs` | Suite de ingesta 15/15; SDK 40/40; typecheck, ESLint y contrato/lifecycle 73/73 validados. Historial usa cursores estables; publicación concurrente/secuencial no duplica versión legada. Auditoría CRUD global pendiente |
| REQ-017 / AC-013 | Idempotencia multipart, resolución manual, paquete/manifiesto y original | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `scripts/tests/evaluapro-client.test.mjs` | Implementado y validado en foco |
| REQ-018 / AC-014 | Listado paginado/filtros de jobs OMR con aislamiento de docente | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts`; `apps/frontend/tests/plantillas.omrResumen.test.ts`; `scripts/tests/evaluapro-client.test.mjs` | API/SDK validados en foco. La GUI ahora sincroniza el resumen con el detalle vigente al abrir o actualizar un job; prueba focal 2/2 y build docente completo aprobados. GUI local 4173 y los espejos del build tienen el mismo SHA-256 de árbol; la lectura OMR en GUI muestra el mismo estado/detalle que el job API. |
| REQ-006 / AC-015 | Idempotencia de calificación con UUID y conflicto de payload | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts`; `scripts/tests/evaluapro-client.test.mjs` | Idempotencia validada; consultas/revisión protegida disponibles en cliente; paridad GUI pendiente |
| REQ-020 / AC-018 | Códigos de acceso redactados, generación idempotente, expiración local y correspondencia GUI | `apps/backend/tests/integracion/codigosAccesoApi.test.ts`; `apps/backend/tests/integracion/publicacionCodigoAccesoActivo.test.ts`; `apps/backend/tests/sincronizacion.test.ts`; `apps/frontend/tests/seccionPublicar.test.tsx`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/api/check-openapi-contract.mjs` | En validación de foco; revocación remota pendiente |
| REQ-021 / AC-019 | Paginación estable/filtros de exámenes generados, resumen redactado, cliente y GUI manual | `apps/backend/tests/integracion/examenesGeneradosPaginacionApi.test.ts`; `apps/backend/tests/integracion/archivarExamenGenerado.test.ts`; `apps/frontend/tests/seccionEntrega.test.tsx`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/api/check-openapi-contract.mjs` | Validado en foco; auditoría CRUD general pendiente |
| REQ-022 / AC-020 | Reintento idempotente de generación individual preservando compatibilidad GUI | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/api/check-openapi-contract.mjs` | Validado en foco; auditoría CRUD general pendiente |
| REQ-023 / AC-021 | Lista paginada de paquetes consolidados y correspondencia con historial GUI | `apps/backend/tests/integracion/examenesLotesApi.test.ts`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/api/check-openapi-contract.mjs` | Validado en foco; auditoría CRUD general pendiente |
| REQ-027 / AC-025 | Inmutabilidad del lote y recuperación con el mismo ID | `apps/backend/tests/integracion/examenesRetention.test.ts`; `apps/backend/tests/integracion/examenesLotesApi.test.ts` | Implementado; incompatibilidad cubierta por el contrato de recuperación |
| REQ-030 / AC-028 | Archivo/restauración atómica, idempotente y auditable del artefacto PDF con paridad GUI | `apps/backend/tests/integracion/examenesLotesApi.test.ts`; `scripts/tests/evaluapro-client.test.mjs`; `apps/frontend/tests/plantillasHistorialLotes.archivo.test.tsx`; `scripts/tests/migrate-examen-lotes-ciclo-vida-sqlite.test.mjs` | Backend/SDK/migración y representación GUI/paginación validados en foco |
| REQ-033 / AC-032 | Generación y calificación aparte de extraordinarios asignados a alumnos seleccionados | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts`; `apps/frontend/tests/plantillas.refactor.test.tsx`; `scripts/tests/migrate-examen-tipo-examen-sqlite.test.mjs` | Implementado; validación focal |
| REQ-031 / AC-029 | CRUD transaccional, idempotente y auditable de temas del banco con paridad GUI | `apps/backend/tests/integracion/temasBancoLifecycle.test.ts`; `apps/backend/tests/bancoPreguntas.controlador.test.ts`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/tests/migrate-temas-banco-auditoria-sqlite.test.mjs`; `apps/frontend/tests/bancoGestionTemas.test.tsx` | Backend/SDK/migración/controlador validados; typecheck API/GUI validado; GUI mantiene clave de reintento |
| REQ-028 / AC-026 | CRUD seguro de temarios, auditoría y carga PDF multipart en paridad con GUI | `apps/backend/tests/integracion/temario.pdf.test.ts`; `apps/frontend/tests/seccionTemarios.test.tsx`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/tests/migrate-temarios-auditoria-sqlite.test.mjs` | Implementado; validación focalizada pendiente de cierre final |
| REQ-029 / AC-027 | Todos los modelos Prisma clasificados en la matriz de ciclos de vida | `scripts/tests/api-resource-lifecycle.test.mjs`; `scripts/api/check-resource-lifecycle.mjs` | Implementado; guard integrado a `api:contract:check` |
| REQ-024 / AC-022 | Paginación de evidencias de evaluación con filtros y aislamiento del docente | `apps/backend/tests/integracion/evaluacionesEvidenciasPaginacionApi.test.ts`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/api/check-openapi-contract.mjs` | Validado en foco; auditoría CRUD general pendiente |
| REQ-025 / AC-023 | CRUD docente de políticas versionadas, auditoría y efecto en cálculo | `apps/backend/tests/integracion/evaluaciones.modulo.test.ts`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/tests/migrate-politicas-calificacion-auditoria-sqlite.test.mjs`; `scripts/api/check-openapi-contract.mjs`; `apps/frontend/tests/seccionEvaluaciones.test.tsx` | Backend 8/8, frontend 9/9, SDK+migración 41/41, typecheck, ESLint y contrato/lifecycle 73/73 validados; la auditoría CRUD general de los demás recursos sigue abierta |
| REQ-026 / AC-024 | CRUD auditable de evidencia manual, archivo/restauración y paridad GUI | `apps/backend/tests/integracion/evaluacionesEvidenciasPaginacionApi.test.ts`; `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/tests/migrate-evidencias-evaluacion-sqlite.test.mjs` | Validado en foco; auditoría CRUD general pendiente |
| REQ-019 / AC-017 | Lista/detalle paginado de entregas, privacidad e aislamiento por docente | `apps/backend/tests/integracion/entregasApiLifecycle.test.ts`; `scripts/tests/evaluapro-client.test.mjs`; `scripts/api/check-openapi-contract.mjs` | Validado en foco; auditoría CRUD global pendiente |
| REQ-015 / AC-016 | Lectura individual/aislamiento de alumnos, plantillas y temas de banco | `apps/backend/tests/integracion/alumnosEdicion.test.ts`; `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts`; `apps/backend/tests/integracion/temasBancoLifecycle.test.ts`; `apps/frontend/tests/bancoGestionTemas.test.tsx` | API/GUI validadas en foco; confirmación de mutaciones del SDK cubierta por `scripts/tests/evaluapro-client.test.mjs`; auditoría CRUD global pendiente |
| REQ-007 / AC-002 | Preview/CRUD y generación de plantillas PDF | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts`; `apps/frontend/tests/plantillas.mutacionIdempotente.test.ts`; `scripts/tests/migrate-plantillas-auditoria-sqlite.test.mjs` | Alta/edición/archivo/borrado son transaccionales, idempotentes y auditables; SDK y GUI conservan/reutilizan UUID; prueba focal cubre rollback, reintentos, conflicto de payload, cursores y papelera. Ampliar auditoría CRUD del resto de recursos |
| REQ-008 / AC-005 | Ingreso y clasificación de archivos/hojas de examen | `apps/backend/tests/integracion/qrEscaneoOmr.test.ts` | Pendiente de ampliar |
| REQ-009 / AC-002 | Prevalidación, excepciones y finalización OMR | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Pendiente de ampliar |
| REQ-008 / AC-005 | Paridad de ingesta PDF multipágina, comparación de referencia y revisión en GUI/API | `docs/specs/SPEC-071_ingesta_clasificacion_lotes_omr.spec.md`; `apps/backend/tests/integracion/omrJobsWorkflow.test.ts`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `apps/frontend/tests/plantillas.omrResumen.test.ts`; `scripts/tests/evaluapro-client.test.mjs` | Carga/revisión con rutas, UI y SDK presentes; pruebas focales disponibles. El job CamScanner productivo completó 48/48 y conserva el original; las 48 páginas quedaron en revisión por `OMR_QR_NO_VALIDO_O_FUERA_DE_LOTE`, con 0 clasificadas/aceptadas y sin notas escritas. Por tanto, el recorrido GUI/API existe y se ejecutó, pero el cotejo real QR, clasificación correcta del lote y validación de límites de memoria/páginas siguen sin aprobar (SPEC-071). |
| REQ-009 / AC-004 | QR, vínculo de hoja y calificación OMR | `apps/backend/tests/integracion/qrEscaneoOmr.test.ts` | Pendiente de ampliar |
| REQ-010 / AC-006 | Reglas de lista académica y estados de calificación | `apps/backend/tests/integracion/listaAcademicaContratos.test.ts`; `apps/backend/tests/listaFisicaParcial2.persistencia.test.ts`; `scripts/tests/migrate-calificaciones-lista-idempotencia-sqlite.test.mjs`; `scripts/tests/evaluapro-client.test.mjs` | Lectura y captura manual versionada/idempotente disponibles por API; validación focalizada |
| REQ-011 / AC-007 | Correspondencia entre persistencia API y vista GUI | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx`; `apps/backend/tests/listaFisicaParcial2.persistencia.test.ts` | Pruebas de componente cubren la misma ruta, lectura tras guardar y reconciliación cuando se pierde la respuesta; runtime GUI instalado sigue pendiente |
| REQ-012 / AC-008 | Envelope de errores y validación estricta | `apps/backend/tests/contrato/validaciones.test.ts` | Pendiente de ampliar |
| REQ-013 / AC-009 | Sanitización de contrato, ejemplos y logs | `apps/backend/tests/configuracion.produccion.test.ts` | Pendiente de ampliar |
| REQ-001 / AC-010 | Inventario de todas las rutas, permisos y validadores backend | `scripts/api/generate-openapi.mjs`; `scripts/api/check-openapi-contract.mjs` | Validado en checkout el 2026-09-28: 235 rutas y 270 operaciones con IDs/parámetros consistentes; `api:contract:check` aprueba |
| REQ-014 / AC-010 | Acciones CRUD/ciclo de vida existentes por recursos API | `scripts/api/openapi.json`; `scripts/api/check-resource-lifecycle.mjs`; suites de cada módulo | Validadas las 71 declaraciones de ciclo de vida Prisma; la auditoría global de correspondencia GUI/API y límites funcionales sigue abierta |
| REQ-006 / AC-004 | Cliente de plantillas y recuperación de lote con `loteId` persistente | `scripts/tests/evaluapro-client.test.mjs`; `apps/backend/tests/integracion/examenesRetention.test.ts`; `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Reintento con el mismo `loteId` y cuerpo devuelve los mismos exámenes sin duplicar filas; cubrir incompatibilidad de cuerpo en prueba adicional |
| REQ-015 / AC-011 | Confirmación del SDK para mutaciones docentes y acceso API a operaciones de examen sin navegador | `scripts/tests/evaluapro-client.test.mjs` | Temarios/asistencia y CRUD de plantillas requieren confirmación antes de enviar; generación/archivo/regeneración de exámenes también requiere confirmación, y folio/PDF se consultan por wrappers API sin cambiar HTTP/GUI |
| REQ-015 / AC-011 | Matriz de brechas CRUD y límites de mutación | `scripts/api/CRUD_CATALOG.md`; `scripts/api/RESOURCE_LIFECYCLE.md`; `scripts/tests/evaluapro-client.test.mjs` | Helpers de periodos, alumnos/asistencia, temarios, temas, plantillas y exámenes validados; auditoría CRUD global sigue abierta |
| REQ-032 / AC-030 | Global manual, Classroom continuo C3, bono con prioridad y lectura de la lista | `SPEC-046_google_classroom_sync.spec.md`; `SPEC-059_consulta_calificaciones_por_alumno.spec.md`; `apps/frontend/src/apps/app_docente/SeccionEvaluaciones.tsx`; `apps/frontend/src/apps/app_docente/ClassroomEnCalificaciones.tsx`; `apps/frontend/src/apps/app_docente/ConsultaCalificaciones.tsx`; `apps/backend/src/modulos/modulo_evaluaciones/rutasEvaluaciones.ts`; `apps/backend/src/modulos/modulo_evaluaciones/validacionesEvaluaciones.ts`; `apps/backend/src/modulos/modulo_evaluaciones/controladorEvaluaciones.ts`; `apps/backend/src/modulos/modulo_integraciones_classroom/validacionesClassroom.ts`; `apps/backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts`; `apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts`; `apps/backend/src/modulos/modulo_analiticas/servicioBonoExtracurricular.ts`; `apps/backend/src/modulos/modulo_analiticas/servicioExportacionXlsxCalificaciones.ts`; `apps/frontend/tests/classroomEnCalificaciones.mapeoCortes.test.tsx`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx`; `apps/frontend/tests/seccionEvaluaciones.test.tsx`; `apps/backend/tests/integracion/classroom.v2.test.ts`; `apps/backend/tests/integracion/evaluaciones.modulo.test.ts`; `apps/backend/tests/integracion/listaAcademicaContratos.test.ts`; `apps/backend/tests/bonoExtracurricular.test.ts`; `apps/backend/tests/analiticas.xlsx.sv.contract.test.ts`; `scripts/api/evaluapro-client.mjs`; `scripts/tests/evaluapro-client.test.mjs` | Evidencia del checkout: backend 4 archivos/21 pruebas, GUI 3 archivos/14 pruebas y SDK API 35/35 aprobados en revisión previa. Auditoría y actualización de los libros OneDrive el 2026-09-29: 4 filas DDAW y 12 BI tienen Global/continua; la revisión de las dos actividades de Classroom y el cálculo independiente coinciden en las 16 filas; cero parciales sobre 10. Los cinco bonos de BI (0.5, 0.5, 1, 1, 1) coinciden con la imagen fuente y la cascada Continua Global→Examen Global→Continua P2→Examen P2→Continua P1→Examen P1; suma aplicada 4.0. Se agregó una columna de bono con fórmula por alumno y se completaron las fórmulas de columnas calculadas que no estaban extendidas a todas las filas. Los archivos reemplazaron sus originales después de crear respaldo; hashes de las copias OneDrive coinciden con los artefactos auditados. Las calificaciones escritas manualmente en los libros no se sincronizaron por la API de EvaluaPro. Siguen pendientes el cotejo integral marcas↔clave del lote y la revisión de este resultado dentro de la GUI instalada con los libros vigentes. |
| REQ-009 / AC-031 | Blancos y dobles marcas no resueltas cuentan incorrectas en GUI y API, conservando el estado enviado | `apps/frontend/tests/seccionCalificar.test.tsx`; `apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts`; `apps/backend/tests/omr.estado-respuesta.test.ts` | GUI OMR/calificación 8/8 y SDK API 35/35 aprobados previamente; `omrJobsWorkflow.test.ts` 8/8 en la revisión anterior; integración de calificación API 2/2 actual para `sin_marca` y `doble_marca`, ambas con `opcion: null`, cero aciertos y estado preservado |
| REQ-009 / AC-013, REQ-017 / AC-005 | Revisión manual de marcas dudosas y soporte explícito para X/palomitas | `docs/specs/SPEC-062_omr_calibracion_y_plantilla_movil.spec.md`; `output/qa/omr-mark-shapes-20260928/manifest.json`; `apps/backend/tests/omr.estado-respuesta.test.ts`; `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`; `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Corrección manual está presente en UI/API. El artefacto QA aporta 6 ejemplos reales de X y 2 ambiguos, pero no ejemplos de palomita ni evaluación del motor; reconocimiento automático continúa pendiente. |

| REQ-033 / AC-032 | Portada binaria con permisos, límite, normalización y paridad API/GUI | `SPEC-073_portada_materia_api_gui.spec.md`; `apps/backend/tests/integracion/periodosPortada.test.ts`; `apps/frontend/tests/seccionPeriodos.portada.test.tsx`; `scripts/api/check-openapi-contract.mjs` | API 5/5, GUI 3/3, OpenAPI y paridad de listado/fallback verificados en foco |

## Análisis de cobertura del flujo de listas

La siguiente matriz describe el código inspeccionado al 2026-09-28. «Disponible» indica
que existe una operación identificable, no que se haya ejecutado con datos de
producción ni validado el recorrido extremo a extremo.

| Proceso | GUI actual | API actual | Resultado y brecha |
| --- | --- | --- | --- |
| Capturar nota total manual del Global en lista física | `Calificaciones > Resultados > detalle del alumno` permite capturar `Exámen Global` en la escala 0–5, preservando el puntaje manual total sin inventar desglose teórico/práctico. | `POST /analiticas/lista-academica/calificaciones` persiste `Exámen Global` con validación 0–5, versión, auditoría e idempotencia; `GET /analiticas/lista-academica` proyecta la versión y calcula el tercer parcial con continua. | La GUI y API comparten la captura manual y la lista conserva su escala física. No depende del motor OMR ni de componentes teórico/prácticos. Pruebas cubren el tope y la proyección; falta comprobarla contra cada lista institucional vigente. La calificación por reactivo del examen generado es otro flujo (`POST /calificaciones/calificar`). |
| Importar calificaciones Classroom para continua | `Classroom` administra conexión y estado; `Calificaciones > Classroom` consulta cursos, vincula alumnos, asigna cada actividad publicada a P1/P2/P3, previsualiza y confirma. Esa pantalla no crea actividades ni duplica entregas. | La API v2 ofrece consulta, preview y ejecución con `corte` 1–3. La lista agrega actividades P3 por puntos y genera sus campos en XLSX. | La integración prueba persistencia del corte 3, proyección a la API de lista y el XLSX tiene prueba focalizada para AT–AV. El 2026-09-29 se cotejaron en la vista autenticada las actividades Global de ERP de BI y Proyecto Full Stack de DDAW contra las 16 filas de los libros; los valores de continua de C3 coinciden. La vista Classroom ahora no muestra el flujo duplicado de importación; la revisión completa de todas las actividades y permisos de Classroom sigue pendiente. |
| Mostrar/revisar las evidencias Classroom en la materia | `ClassroomEnCalificaciones` muestra evidencias de solo lectura, permite resolver el vínculo de cuenta y abre la actividad original mediante el `alternateLink` de Google Classroom con URL validada. | `GET /evaluaciones/evidencias` pagina y filtra por periodo/alumno y preserva `metadata.alternateLink`; el SDK `listarEvidenciasEvaluacion` consume la misma respuesta. | El contrato API y la GUI cubren la lectura y el enlace externo seguro sin duplicar entregas; permanece pendiente validar con Classroom real la navegación/permiso del docente y la vista de cálculo continuo por corte. La corrección de nota fuente permanece en Classroom. |
| Escribir manualmente nota en columnas de lista | La consulta por alumno captura Global 0–5 y componentes físicos de P2; el bono se solicita una vez y se confirma tras previsualización. | `GET /analiticas/lista-academica` y `POST /analiticas/lista-academica/calificaciones` admiten `Exámen Global`, `Practica 2do Parcial`, `Exámen 2do Parcial` y `Bono extracurricular`, con escalas, versión, auditoría e idempotencia correspondientes. | La captura agregada Global preserva el dato manual de lista sin simular subcomponentes. La correspondencia con los libros institucionales vigentes de BI y DDAW aún requiere escritura y lectura de verificación en la GUI/API. |
| Aplicar bono extracurricular con prioridad Global/C3 → P2 → P1 | La consulta de calificaciones presenta una columna y flujo de vista previa/confirmación para un alumno. | `POST /analiticas/lista-academica/bono/preview` no muta; `POST /analiticas/lista-academica/calificaciones` persiste `Bono extracurricular` con control de versión, auditoría e idempotencia. El SDK ofrece preview y guardado con confirmación. | Implementación y contratos focales presentes en el checkout; prueba de integración verifica preview sin escritura y reintento idempotente; prueba XLSX verifica la columna BB y fórmulas de cascada. Falta revisión contra listas institucionales vigentes, inspección en la app instalada y validación docente de reglas de notas fuente. |
| Confirmar resultado final en listas/exportaciones | `ConsultaCalificaciones` muestra Global, continua, total P3, bono aplicado y finales por alumno. | `GET /analiticas/lista-academica` devuelve la proyección; el generador XLSX coloca la columna única BB y fórmulas de asignación/cierre. | Los libros institucionales vigentes se verificaron y actualizaron el 2026-09-29 con respaldo. Las fórmulas calculadas se extendieron a cada fila: BI 12/12 y DDAW 4/4. El recálculo posterior confirmó cero errores de fórmula y ningún parcial ni final base 10 por encima de 10. Se probó en copias temporales que el bono respeta el tope y que un cambio de examen propaga al parcial y al final. Sigue pendiente revisar los libros vigentes dentro de la GUI instalada. |
| Ingresar, cotejar y clasificar varios PDF contra el lote OMR de referencia | `PlantillasOmrWorkflow` acepta varios PDF para el examen generado, muestra progreso, páginas/paquetes, previsualiza páginas de origen, descarga originales y permite resolver excepciones. Desde `Calificaciones → Revisión y captura`, el botón «Procesar PDFs de un lote generado» abre `Diseño de Exámenes → Historial de lotes`, donde está ese flujo. PDF e imágenes siguen jobs separados. | `POST /omr/ingestas` recibe hasta 10 PDF multipart (120 MiB por archivo); GET de job, originales/manifiesto/paquetes y PNG de cada página fuente; POST de resolución por página. El SDK ofrece wrappers para carga, lectura, vista previa, descarga y resolución confirmada. | En producción, el job CamScanner de 48 páginas terminó, conservó el original y mostró página fuente/referencia en GUI; al abrir el job, la GUI presenta el mismo resumen que la API: `completed`, 48/48, 48 en revisión. El motor no validó ningún QR (`OMR_QR_NO_VALIDO_O_FUERA_DE_LOTE` en las 48 páginas), por lo que aún no hay clasificación por alumno ni coincidencia con referencia probada para ese escaneo. No se escribieron notas. Los límites extremos de páginas/memoria siguen pendientes (SPEC-071). |
| Leer marcas no circulares, X/palomita, blanco o múltiples marcas y revisar manualmente | La mesa OMR muestra por reactivo el estado, opción OMR, flags y las tres candidatas principales; el selector permite corregir la respuesta con motivo. Para ingestas PDF, el panel permite abrir la página fuente y la página exacta de referencia en paralelo antes de resolver. | Los detalles de `/omr/jobs/:jobId` y `/omr/ingestas/:jobId` conservan el mismo estado, opción OMR, flags y hasta tres candidatas; las rutas de resolución guardan la decisión manual sin borrar la evidencia original. Las rutas autenticadas exponen la imagen fuente y el PDF de referencia validado, y el SDK las ofrece a la GUI. | La revisión visual página–referencia y la corrección manual están implementadas y cubiertas por pruebas focalizadas de GUI/API (`SPEC-071`, AC-010/011). Sigue pendiente validar reconocimiento automático en páginas completas del lote con etiquetas adjudicadas de X/palomita, tachaduras, dobles y blancos; no se afirma reconocimiento confirmado de esas formas. |

**Conclusión de cobertura:** no se necesita una spec transversal nueva. `SPEC-070` ya
define la automatización API-first y el flujo de Global/continua/bono/listas; `SPEC-046`
cubre sincronización Classroom, `SPEC-059` la consulta y proyección física de notas,
`SPEC-071` la ingesta/clasificación PDF y `SPEC-042`/`SPEC-062` la plantilla y lectura
OMR. La inspección de GUI, rutas y SDK confirma que Global manual, Classroom con
mapeo/preview/ejecución, consulta/exportación de lista, ingesta de varios PDF y revisión
manual de excepciones tienen superficies identificables en GUI y API. Para el flujo de
Global/continua/bono, REQ-032, SPEC-046 y SPEC-059 ya definen las responsabilidades y
contratos; el checkout contiene superficies de GUI/API y pruebas focales para captura,
preview sin escritura, guardado idempotente, prioridad continua→examen en cada corte,
cascada Global/C3→P2→P1 y exportación con una sola columna enlazada por fórmulas. No se
necesita una nueva spec transversal. El 2026-09-28 se verificó que ambas instalaciones
locales sirven el bundle actual, usan Prisma Client 7.10.0 y responden en GUI/API; la base
de producción pasó `integrity_check` tras migraciones aditivas con respaldo. El 2026-09-29
se cotejaron y actualizaron los libros institucionales de BI y DDAW, con respaldos y
verificación de hashes, fórmulas, recálculo y topes. La verificación en la GUI instalada y
el cotejo integral de marcas↔clave del lote siguen pendientes. SPEC-071 tiene una ejecución
productiva de 48 páginas, pero el cotejo QR/clasificación quedó sin aprobar y los límites de
páginas/memoria siguen pendientes. SPEC-062 debe precisar marcas
tipo X/palomita; hasta medirlas contra imágenes etiquetadas, no se debe afirmar que el
motor las reconoce automáticamente.

## Implementación por fases aprobada

1. **Contrato y descubrimiento:** inventario OpenAPI de operaciones existentes,
   documentación de autenticación, errores, límites, IDs y ejemplos; preflight de
   versión, permisos, lease y dependencias sin PII.
2. **Cliente sin navegador:** cliente HTTP delgado sin dependencias de producción,
   bearer protegido por entorno/entrada segura, polling/reanudación y operaciones
   preview/confirmación; sin credenciales en argv, repositorio o logs.
3. **Cierre de ciclo y paridad:** completar operaciones faltantes/idempotencia,
   ejecutar flujos de banco, generación, OMR y calificación por API, y verificar
   lectura por contratos que consume la GUI con fixtures aislados.
4. **Auditoría CRUD recurso por recurso:** mantener una matriz de cada recurso de
   dominio, comprobar lectura/alta/modificación/baja lógica o acción especializada
   en API y GUI, e implementar brechas seguras mediante los servicios existentes.
   Los modelos internos append-only, auxiliares, históricos o externos se clasifican
   como no editables con el motivo de integridad correspondiente.

La fuente OpenAPI se mantendrá como artefacto documentado y un verificador
comprobará rutas/métodos críticos contra el router y ejemplos. El cliente no
duplicará lógica de dominio. Esta aprobación autoriza implementación local y
pruebas aisladas; no autoriza usar datos reales, publicar notas, sincronizar
Classroom, imprimir físicamente, instalar, reiniciar servicios ni publicar cambios.
Para el despliegue local del 2026-09-28, el usuario autorizó explícitamente sincronizar
los bundles GUI/API, reiniciar 4173/4000 y aplicar solo migraciones SQLite aditivas con
respaldo; esa autorización específica no modifica los límites generales anteriores.
