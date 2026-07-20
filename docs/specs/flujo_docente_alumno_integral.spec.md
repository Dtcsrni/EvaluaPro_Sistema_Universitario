---
id: SPEC-FLUJO-DOCENTE-ALUMNO-INTEGRAL
titulo: Journey integral docente-alumno y cobertura funcional
version: 1.0.0
fecha: 2026-07-16
autor: Codex / Agente IA
modulo: flujo_integral_docente_alumno
estado: draft
---

# SPEC-FLUJO-DOCENTE-ALUMNO-INTEGRAL: Journey integral docente-alumno y cobertura funcional

## Contexto

EvaluaPro ya dispone de módulos docentes, backend de evaluación, OMR, publicación
al portal alumno e Installer Hub nativo. La cobertura actual está distribuida entre
pruebas unitarias, integración, contratos y smoke tests. Esta especificación fija
un journey funcional completo y separa la validación de journey, módulo, contrato
técnico y evidencia visual.

Alcance inicial: flavor `docente-local`, edición comunitaria y comercial, operación
en México, instituciones públicas/privadas y docentes independientes.

## Journey canónico

1. Descargar y verificar instalador.
2. Instalar/remediar prerequisitos desde Installer Hub.
3. Registrar cuenta, aceptar privacidad y configurar edición/licencia.
4. Preparar periodo, materia, grupo y alumnos.
5. Hidratar curso existente opcionalmente desde XLSX/DOCX.
6. Diseñar banco, plantilla, reglas y evaluación.
7. Generar, descargar e imprimir examen con folio/QR.
8. Registrar entrega y derecho a examen.
9. Capturar, validar y analizar OMR.
10. Revisar excepciones y evidencia de baja confianza.
11. Calcular, revisar, corregir y cerrar calificación.
12. Generar calificación global y reportes.
13. Publicar resultados en portal alumno.
14. Alumno ingresa, consulta resultado y descarga PDF.
15. Cerrar curso, conservar evidencia, respaldar, restaurar o actualizar.

## Requisitos Funcionales

- **REQ-001:** El sistema debe permitir ejecutar el journey canónico sin depender de
  tabs concretos; cada paso debe exponer estado, prerequisito, acción y resultado.
- **REQ-002:** Installer Hub debe verificar firma Authenticode, SHA-256 y CRC32
  auxiliar antes de ejecutar un bundle descargado.
- **REQ-003:** La instalación debe detectar prerequisitos, remediar con autorización
  UAC, registrar evidencia y dejar API, web, dashboard y shortcuts operativos.
- **REQ-004:** Repair, update, rollback y uninstall deben ser idempotentes, auditables
  y conservar datos conforme a la política elegida.
- **REQ-005:** El docente debe poder crear o hidratar un periodo, importar alumnos de
  forma idempotente y conservar procedencia de archivos/evidencias.
- **REQ-006:** El diseño de evaluación debe versionar banco, plantilla, clave, reglas
  y artefactos generados.
- **REQ-007:** Cada examen generado debe tener folio, QR, versión de plantilla y
  manifiesto de integridad verificable.
- **REQ-008:** OMR debe validar calidad antes de analizar y clasificar cada página
  como confiable, revisión requerida o inválida.
- **REQ-009:** Toda calificación automática debe ser recalculada y validada por
  backend; el cliente nunca es autoridad del puntaje.
- **REQ-010:** Baja confianza, alteración o inconsistencia debe enviar evidencia a
  cuarentena protegida sin eliminación automática.
- **REQ-011:** El docente debe poder revisar, corregir y justificar una calificación;
  el sistema debe conservar resultado automático y resultado final.
- **REQ-012:** La publicación debe ser idempotente, reintentable y no duplicar alumnos,
  calificaciones, PDFs ni códigos de acceso.
- **REQ-013:** El alumno solo debe consultar sus resultados autorizados y descargar
  PDFs publicados para su identidad/código.
- **REQ-014:** La cuenta comunitaria no requiere licencia comercial; la comercial
  requiere licencia firmada, TOTP, vencimiento, gracia de 3 días y degradación no
  destructiva a comunidad.
- **REQ-015:** Los datos académicos deben permanecer bajo control del docente o
  institución; EvaluaPro no los almacena en cloud por defecto.
- **REQ-016:** Backups locales deben incluir manifiesto, SHA-256 y cifrado opcional
  ligado al perfil Windows; migración usa clave/QR separado y de uso único.
- **REQ-017:** Imágenes OMR se conservan por curso activo + 35 días; después el
  sistema pregunta si se eliminan, conservan o exportan, salvo investigación activa.
- **REQ-018:** El journey debe generar evidencia JSON, logs, manifiestos y capturas
  visuales por paso crítico.
- **REQ-019:** El empaquetado nativo debe separar la versión semver informativa de
  las versiones numéricas requeridas por .NET; ningún identificador de desarrollo
  o prerelease puede producir una `AssemblyVersion` o `FileVersion` inválida.
- **REQ-020:** Cada artefacto descargable del flavor docente debe publicar CRC32
  como checksum auxiliar y validarlo junto con SHA-256 antes de ejecutar el Hub.
- **REQ-021:** El payload nativo Windows debe excluir herramientas de build, cachés,
  engines Prisma multiplataforma y runtimes WASM no utilizados, conservando el
  cliente Prisma SQLite/Windows requerido por la aplicación.
- **REQ-022:** El baseline de distribución debe medir por separado payload MSI
  (máximo 130 MB) y Bundle autocontenido Hub + runtime (máximo 200 MB).
- **REQ-023:** El Bundle docente debe incluir Node.js embebido de la versión mayor
  soportada (24 o superior); el fallback de instalación nunca debe descargar una
  versión incompatible.
- **REQ-024:** La limpieza de instalaciones históricas debe ejecutar primero los
  desinstaladores registrados con timeout acotado por paquete; si un proceso se
  bloquea, debe cancelar su árbol, registrar el resultado y continuar sin dejar
  la sesión E2E congelada. La verificación posterior debe confirmar ausencia de
  registros EvaluaPro y procesos residuales.
- **REQ-025:** Cada espera interactiva del E2E del Installer Hub debe tener un
  límite duro y registrar la última fase observable; la espera del estado final
  no debe exceder 10 minutos por operación y, al vencer, debe cancelar el árbol
  del Hub/MSI y generar diagnóstico para impedir ejecuciones congeladas.
- **REQ-026:** Cada helper PowerShell invocado por el Hub debe tener un timeout
  por operación; al vencer, el Hub debe cancelar el árbol completo del proceso,
  conservar correlación, stdout/stderr y rutas de request/response, y terminar en
  un estado de error diagnosticable sin bloquear la interfaz.
- **REQ-027:** El staging del instalador debe tener una ruta de descubrimiento
  acotada y cancelable; si Git no responde dentro del límite, el fallback no debe
  recorrer cachés, `node_modules` ni salidas generadas, y el build debe terminar o
  cancelar su árbol sin quedar congelado.
- **REQ-028:** El supervisor del runtime nativo debe distinguir arranque lento de
  fallo: después de iniciar API/web debe esperar salud por una ventana acotada de
  90 segundos antes de reparar o reiniciar, sin superar ese límite ni generar
  ciclos de reinicio por una comprobación prematura.
- **REQ-029:** El dashboard debe iniciar el runtime nativo con `spawn` directo del
  Node embebido y sus argumentos separados; no debe envolverlo en `cmd.exe /c`,
  para conservar PID/árbol, stdout/stderr y código de salida verificables.
- **REQ-030:** El E2E no debe iniciar una operación Burn mientras exista una
  transacción `msiexec` activa, ni forzar el cierre del Hub durante una operación.
  Debe esperar de forma acotada a que el botón de cierre esté habilitado y el
  proceso termine. Si el Hub queda persistente después de reportar un estado final,
  debe intentar cierre normal y detener únicamente su árbol, registrando la
  evidencia, antes de pasar a repair o uninstall; nunca se permite matar el Hub
  mientras Burn siga ejecutando una operación.
- **REQ-031:** El MSI docente debe ser autoconsistente antes de publicarse: cada
  stream CAB referenciado por la tabla Media debe estar embebido y contener todos
  los archivos asignados. El authoring debe usar componentes explícitos para el
  bootstrap operativo y un único archivo de payload versionado; no debe cosechar
  recursivamente el repositorio. El build debe comprobarlo mediante una instalación
  MSI aislada, silenciosa y acotada, seguida de verificación del payload y
  desinstalación; un error MSI 1334, 1603 u otra divergencia de CAB bloquea la
  generación del Bundle.
  En desinstalación, el Hub debe invocar el helper con el modo operativo real
  (`uninstall`), propagar explícitamente la decisión de exportar datos y
  verificar que el directorio de instalación desaparece tras reintentos
  acotados. La ruta de datos debe derivarse de la instalación activa, no de una
  ruta global fija. El esquema SQL generado para SQLite debe conservar solo
  sentencias SQL válidas y excluir avisos de consola, incluso cuando la salida
  de Prisma sea recodificada por PowerShell.
- **REQ-032:** El indicador de tiempo restante del Hub debe usar una estimación
  con ventana móvil y suavizado, derivada solo de avance real de Burn. Debe
  mostrar una banda conservadora, actualizarse sin saltos regresivos ante
  muestras atípicas y declarar explícitamente `calculando` o `verificando` cuando
  no exista progreso determinista; nunca debe presentar una cuenta fija como si
  fuera una predicción fiable.
- **REQ-033:** El MSI docente solo debe instalar bootstrap operativo explícito y
  `evaluapro-native-dist.zip`. El ZIP debe contener el payload de ejecución ya
  podado; documentación, metadatos de repositorio, código fuente, pruebas,
  reportes y datos de prueba deben excluirse. La expansión debe ocurrir en una
  carpeta temporal validada, comprobar archivos críticos y reemplazar el runtime
  mediante una operación acotada; nunca debe ejecutar parcialmente un ZIP
  incompleto. Las dependencias resueltas durante el build deben recibir la misma
  poda antes del empaquetado. La creación de CAB debe ser determinista; si el
  payload supera el tamaño trivial, el build debe priorizar integridad sobre
  paralelismo no verificable.
  Si el usuario solicita respaldo al desinstalar, se debe crear un paquete
  comprimido en la ubicación prevista, incluyendo la base académica y datos
  operativos del directorio efectivo antes de retirar los binarios.

## Requisitos no funcionales

- **RNF-001:** Interfaces web objetivo WCAG 2.2 AA; Hub WPF debe ser operable por
  teclado, con foco, nombres de automatización y resolución mínima soportada.
- **RNF-002:** Operación docente local debe tolerar ausencia de red después del
  registro/licencia aplicable.
- **RNF-003:** Publicación, sincronización, backups y restauración deben ser
  reintentables sin duplicación.
- **RNF-004:** Errores críticos deben ser accionables, no silenciosos, y conservar
  correlación por request/run ID.
- **RNF-005:** Métricas OMR deben incluir precisión, recall, falsos positivos,
  falsos negativos y porcentaje enviado a revisión.
- **RNF-006:** Datos personales, secretos y contenido académico no deben aparecer en
  telemetría externa ni logs no restringidos.
- **RNF-007:** El sistema debe evitar N+1 en publicación, Classroom, listados y
  resolución de alumnos; debe usar índices y cargas por lote.
- **RNF-008:** Actualizaciones deben crear backup, migrar de forma versionada,
  verificar health y restaurar automáticamente ante fallo crítico.
- **RNF-009:** Toda eliminación de evidencia debe ser explícita, auditable y bloquearse
  si existe investigación o disputa abierta.
- **RNF-010:** Compatibilidad mínima: Windows soportado por el runtime nativo, Node 24
  embebido, SQLite local y navegador soportado por la matriz E2E.

## Criterios de Aceptación

- **AC-001:** Existe una matriz ejecutable que relaciona cada paso con módulo, ruta,
  componente, prueba, evidencia y estado `implemented|partial|missing`.
- **AC-002:** El E2E visual recorre instalación, reparación, ejecución nativa,
  actualización, desinstalación, journey docente y portal alumno.
- **AC-003:** Un bundle corrupto, sin firma o con CRC/SHA inválido no se ejecuta.
- **AC-004:** Un payload OMR de baja confianza no puede cerrar calificación sin revisión.
- **AC-005:** Un intento de publicar dos veces produce un único estado publicado.
- **AC-006:** Un alumno no puede consultar resultados de otro alumno.
- **AC-007:** Una actualización fallida deja evidencia, restaura estado operativo y no
  pierde datos.
- **AC-008:** Una imagen en cuarentena permanece protegida mientras exista investigación.
- **AC-009:** La evidencia visual incluye estado inicial, acción, resultado y error
  accionable en cada pantalla crítica.
- **AC-010:** Un build con versión `0.0.0-dev` y uno con versión prerelease válida
  publica la Bootstrapper Application sin error de MSBuild, conserva la versión
  informativa y genera versiones de archivo numéricas válidas.
- **AC-011:** El E2E visual del ciclo académico debe arrancar el runtime nativo
  docente-local (API y web) mediante su configuración de Playwright; no puede
  depender de un servidor ya iniciado ni terminar en `ERR_CONNECTION_REFUSED`.
- **AC-012:** El E2E visual del journey académico debe recorrer en la interfaz
  docente las vistas de banco/plantilla, generación y descarga de examen,
  entrega, evaluaciones, calificaciones/revisión y publicación; cada etapa debe
  capturar estado inicial, acción y resultado verificable. El procesamiento OMR
  debe usar un artefacto real generado por la aplicación o un piloto real, nunca
  una respuesta simulada embebida en el test.
- **AC-013:** El E2E nativo del flavor docente debe levantar un portal alumno local
  aislado, con base SQLite temporal y API key de prueba, para comprobar publicación
  y generación de código desde la UI contra el adaptador real; no se permite
  sustituirlo por interceptación HTTP del navegador.
- **AC-014:** Los controles docentes deben impedir acciones terminales repetibles
  del workflow OMR y validar en la propia UI los rangos admitidos por una evidencia
  manual (calificación 0–10, ponderación 0–10), manteniendo el contrato estricto
  del backend.
- **AC-015:** La calificación manual iniciada desde un examen entregado debe usar
  la clave autoritativa persistida en el examen generado, conservar el orden de
  preguntas/opciones de su variante y mostrar un error accionable si la clave está
  incompleta; no debe depender de reconstrucciones frágiles desde un banco que
  pueda haber cambiado posteriormente.
- **AC-016:** Las pruebas visuales que comparten el runtime nativo y la SQLite
  aislada deben ejecutarse serializadas; una ejecución concurrente no puede
  corromper el estado, mezclar sesiones ni producir falsos fallos.
- **AC-017:** La consulta de un encuadre aún no inicializado debe representarse
  como estado vacío esperado en la UI, sin mostrar un error de disponibilidad;
  después de publicar resultados, la aplicación alumno debe permitir ingresar
  con el código y matrícula autorizados, mostrar el folio publicado y abrir su
  detalle sin exponer resultados de otra identidad.
- **AC-018:** Un código de acceso válido combinado con una matrícula distinta
  de la autorizada debe rechazarse sin emitir sesión, sin revelar si existe la
  otra identidad y sin consumir el código; el alumno autorizado debe poder
  ingresar inmediatamente después y recibir únicamente sus resultados.
- **AC-019:** Desde la pantalla de calificaciones el docente debe poder
  seleccionar una materia y descargar el reporte de calificaciones en CSV o
  XLSX; la UI debe indicar progreso, éxito o error, y no iniciar una descarga
  si no existe materia seleccionable o sesión válida.
- **AC-020:** La exportación XLSX debe localizar su plantilla tanto en el
  runtime de desarrollo como en el payload nativo empaquetado; si el recurso
  falta debe devolver un error diagnosticable, sin producir un HTTP 500 opaco
  ni dejar un archivo parcial.
- **AC-021:** La licencia comercial debe conservar su último estado válido
  localmente, advertir antes del vencimiento, permitir operación offline durante
  un grace period configurable de al menos 90 días y degradar de forma
  determinista a las funciones comunitarias al agotarlo; la versión comunitaria
  no debe intentar validar licencia.
- **AC-022:** Los respaldos académicos exportados por la aplicación deben estar
  comprimidos y cifrados autenticadamente, vinculados a la cuenta propietaria
  sin contraseña adicional, rechazar alteraciones antes de restaurar y verificar
  que la restauración sea legible y consistente.
- **AC-023:** El empaquetado nativo/MSI debe ejecutar cada gate con un timeout
  explícito, informar el paso activo y terminar únicamente el árbol de procesos
  de esa corrida cuando se exceda el límite, evitando esperas indefinidas y
  dejando un error reproducible.
- **AC-024:** El helper instalado del Hub debe cargar y exportar todas las
  funciones operativas que consume, incluida la normalización de booleanos,
  antes de ejecutar la configuración o el arranque del runtime docente.
- **AC-025:** El post-install no debe arrancar una instancia concurrente del
  dashboard en un puerto fijo; debe dejar la configuración lista y permitir que
  el broker lo inicie bajo demanda en el puerto solicitado, evitando carreras
  entre la tarea de fondo y la primera apertura del usuario.
- **AC-026:** La verificación E2E del primer arranque nativo debe respetar una
  ventana acotada de arranque en frío de hasta 240 segundos, coherente con los
  timeouts internos del broker, y fallar dejando diagnóstico si no publica
  `/api/status`.
- **AC-027:** El broker debe tolerar la transición breve entre el arranque del
  servidor dashboard y la salud de API/Web mediante reintentos acotados, sin
  marcar error final mientras el endpoint siga dentro de su ventana de arranque.
- **AC-028:** El runner de cobertura backend debe imponer timeout por lote
  configurable y finalizar el árbol de procesos en Windows; un lote agotado
  debe devolver código 124, registrar su nombre y permitir reintentos limitados
  sin dejar procesos huérfanos. Puede ejecutar como máximo dos lotes
  independientes en paralelo, conservando blobs, logs y directorios de
  cobertura aislados por lote.
- **AC-029:** Cuando el flavor comercial quede activado, el post-install debe
  registrar una tarea periódica de heartbeat que solo use configuración no
  secreta y el token protegido localmente; debe reintentar sin bloquear el
  arranque, conservar el último estado válido durante el grace period y
  eliminarse durante la desinstalación. El flavor comunitario debe omitir
  completamente la tarea y cualquier validación online.
- **AC-030:** La evidencia visual generada por las pruebas debe escribirse de
  forma atómica y con reintentos acotados ante locks transitorios de Windows,
  sin convertir un fallo de persistencia del reporte en un falso fallo del
  comportamiento probado.
- **AC-031:** El carrusel de funciones del Installer Hub debe comunicar el
  beneficio concreto de cada función con títulos y descripciones legibles,
  suficientemente grandes para la ventana principal y consistentes entre el
  encabezado y la introducción, manteniendo navegación por teclado y el
  indicador de posición.
- **AC-032:** El bootstrap SQLite del post-install debe ser idempotente para
  instalaciones nuevas, reparación y actualización: si la base ya existe no
  debe fallar por tablas o índices existentes ni perder datos; debe crear solo
  objetos ausentes y dejar un error diagnóstico si el esquema es incompatible.
- **AC-033:** Las superficies principales del Installer Hub deben conservar
  transparencia visible tipo vidrio: el fondo cromático debe permanecer
  perceptible a través de tarjetas y paneles, con bordes y reflejos sutiles;
  texto, controles y estados críticos deben conservar contraste legible.
- **AC-034:** El fallback de staging del build MSI debe excluir artefactos de
  desarrollo, reportes, binarios y directorios generados antes de enumerar el
  repositorio completo, para terminar de forma acotada y no incluir contenido
  no ejecutable en el instalador.
- **AC-035:** La firma del bundle debe poder ejecutarse en modo local/interno,
  sin timestamp remoto; Authenticode debe reportar una firma local válida.
- **AC-036:** El Installer Hub debe usar una superficie de vidrio continua, sin
  bandas opacas que rompan la composición; la trama y figuras decorativas deben
  ser sutiles, no interferir con la lectura y conservar contraste en botones,
  estados y texto deshabilitado.
- **AC-037:** El árbol de dependencias JavaScript debe mantenerse reproducible
  mediante `package-lock.json`; cada actualización debe ejecutar auditoría de
  producción y desarrollo, eliminar vulnerabilidades altas/críticas conocidas y
  documentar explícitamente cualquier excepción causada por una dependencia
  transitiva sin actualización compatible.

## Matriz de Trazabilidad

| Journey | Implementación actual | Evidencia/prueba existente | Estado |
| --- | --- | --- | --- |
| Installer Hub install/repair/update/uninstall | `scripts/tests/installer-hub-e2e-docente.ps1` | `installer-hub-contract`, `installer-hub-lifecycle-contract`, `Resilient27–29` visual | `implemented` |
| Firma/SHA-256/release manifest | `scripts/generate-installer-release-manifest.ps1` | SHA/CRC y manifest verdes; firma interna pendiente de clave privada | `partial` |
| CRC32 de descarga | sidecar `.crc32`, manifest y preflight del runner | `installer-hub-e2e-docente.ps1` | `implemented` |
| Runtime docente nativo | launcher/broker + bundle docente; poda de payload en build | `windows-release-smoke`, runner Hub | `implemented` |
| Navegación docente por módulos | `AppDocente.tsx` y secciones | `appDocente.*`, GUI responsive | `partial` |
| Periodos/materias/alumnos | módulos de alumnos/periodos | integración de alumnos/periodos | `implemented` |
| Hidratación XLSX/DOCX | módulo de hidratación | `hidratacionCursos.test.ts`, specs existentes | `implemented` |
| Banco/plantillas/evaluaciones | módulos banco, plantillas y evaluaciones | pruebas frontend/backend correspondientes | `partial` |
| Generación PDF/QR | generación PDF y QR | `pdfImpresionContrato`, `qrEscaneoOmr` | `implemented` |
| OMR y revisión | workflow OMR + UI de revisión | `omrV1Workflow`, `omr.*`, `escaneo.refactor` | `partial` |
| Calificación autoritativa | `calificarExamen` backend | `calificacion*`, flujos parcial/global | `implemented` |
| Cuarentena/retención de imágenes | evidencia OMR parcial | no hay journey completo de política | `missing` |
| Reportes/exportaciones | analíticas CSV/DOCX/XLSX y acciones visibles en calificaciones | `journey-docente-integral.spec.ts` con descargas CSV/XLSX reales | `implemented` |
| Publicación portal | `publicarResultadosUseCase` | `flujoDocenteAlumnoProduccionLikeE2E` | `implemented` |
| Flujo visual alumno | portal/app alumno | `journey-docente-integral.spec.ts` + pruebas de portal y responsive | `implemented` |
| Licencia comunitaria/comercial | contratos parciales del Hub | contratos Hub; falta journey comercial | `missing` |
| Backup cifrado/restauración | exportación/sincronización existente | pruebas de sincronización | `partial` |
| Versionado semver/.NET del Hub | normalización pendiente en `build-msi.ps1` | `test:wix:bundle` | `partial` |
| Payload MSI mínimo y autoconsistente | exclusiones de authoring WiX + extracción administrativa | `installer-hub-lifecycle-contract` | `partial` |
| Ciclo académico visual nativo | registro, materia y alumno mediante Playwright contra API/web nativos | `tests/gui-responsive/ciclo-completo.spec.ts` con `playwright.ciclo.config.cjs` | `implemented` |
| Journey académico visual integral | banco/plantilla, examen/PDF, entrega, evaluaciones, revisión/calificación y publicación desde la UI docente | `tests/gui-responsive/journey-docente-integral.spec.ts` repetido 3/3 | `implemented` |
| Portal local para publicación visual | API portal real, SQLite temporal, publicación/código por UI y consulta alumno desde frontend aislado | `scripts/start-docente-native.mjs`, `apps/portal_alumno_cloud/src/index.ts`, `journey-docente-integral.spec.ts` | `implemented` |

## Riesgos y decisiones pendientes

1. Formalizar CRC32 como checksum auxiliar de distribución, sin tratarlo como control
   criptográfico.
2. Crear contrato de licencia offline firmado antes de implementar UI comercial.
3. Definir almacenamiento local, cifrado DPAPI y migración de claves.
4. Resolver carga por lote de capturas OMR durante publicación.
5. Crear contrato de cuarentena, investigación y retención de imágenes.
6. Completar pruebas comerciales de licencia, backup cifrado/restauración y actualización con rollback.
7. `exceljs@4.4.0` conserva `uuid@8.3.2` como dependencia transitiva; npm no ofrece
   actualización compatible y solo propone degradar ExcelJS a 3.4.0. El uso actual
   de exportación debe limitarse a UUID v4 y esta excepción debe revisarse al
   actualizar ExcelJS o sustituir el motor XLSX.
