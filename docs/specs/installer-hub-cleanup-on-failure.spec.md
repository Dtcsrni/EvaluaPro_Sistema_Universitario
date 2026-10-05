---
id: SPEC-INSTALLER-ROLLBACK-CLEANUP
titulo: Limpieza y Rollback Automatico ante Fallos de Instalacion
version: 1.4.2
fecha: 2026-10-05
autor: Codex / Agente IA
modulo: modulo_installer_windows
estado: approved
---

# SPEC-INSTALLER-ROLLBACK-CLEANUP: Limpieza y Rollback Automatico ante Fallos de Instalacion

## Contexto
Si el proceso de instalacion de EvaluaPro se interrumpe, cancela o falla en cualquiera de sus etapas, el sistema debe quedar limpio.

## Requisitos Funcionales
- REQ-001: En caso de error fatal se invoca Invoke-RollbackOnFailure.
- REQ-002: La creación o reconciliación de accesos directos es degradable; un fallo debe registrarse y permitir terminar si el payload, configuración operativa, runtime SQLite y manifiesto de actualización son válidos.
- REQ-003: Si el paso de accesos directos falla o no deja el manifiesto de instalación, el helper debe generarlo de forma independiente. Si tampoco puede generarlo, la instalación falla con diagnóstico y rollback seguro.
- REQ-004: El helper informa en el log de Burn las etapas del post-install; al vencer el timeout, registra las últimas líneas disponibles de stdout y stderr antes del rollback.
- REQ-005: El post-install docente usa exclusivamente el runtime Node incluido en el payload, valida que sea Node.js 24.x y falla con diagnóstico inmediato si falta o no es válido. No descarga runtimes durante la instalación.
- REQ-006: El pipeline Windows ejecuta install, repair, dashboard, verificación de actualización y uninstall con el bundle que se publicará; conserva el reporte E2E y bloquea la publicación ante cualquier falla.
- REQ-007: La expansión del payload nativo evita una segunda copia completa del árbol y usa el extractor ZIP nativo de Windows cuando está disponible, conservando validación y staging temporal.
- REQ-008: El runner E2E captura stdout/stderr del ciclo de datos dummy y limita su duración, para que un error de fixture quede en el reporte y no se pierda por el manejo de procesos nativos de PowerShell.
- REQ-009: El workflow E2E instala bajo un directorio `EvaluaPro-QA-Isolated-*` en LOCALAPPDATA y fuerza la versión baseline y la candidata a usar la SQLite de esa raíz, para que runtime, marcador de upgrade y limpieza del fixture compartan la misma base aislada.
- REQ-010: Si Windows PowerShell no expone ExitCode aunque el proceso haya terminado, el runner acepta el ciclo dummy solo cuando su JSON demuestra cuenta, 3 materias, 3 alumnos, verificación y limpieza completa; la limpieza confirma por SQLite que ya no existen la cuenta ni las filas creadas por ese ciclo.
- REQ-011: El runner E2E selecciona opciones del ComboBox usando los nombres accesibles exactos definidos por la interfaz y aplica SelectionItemPattern o teclado; nunca invoca un TextBlock descriptivo que coincida por nombre.
- REQ-012: Antes de ejecutar una operación, el runner verifica que la acción primaria accesible coincida con el modo solicitado; ante discrepancia, detiene la E2E sin ejecutar una operación distinta.
- REQ-013: El E2E de actualización instala en una ruta QA aislada la versión estable anterior desde el asset y sidecar oficiales, valida su SHA-256, escribe un marcador no productivo en su SQLite, aplica el bundle candidato y verifica que la versión registrada avanzó y que el marcador sobrevivió; elimina el marcador al finalizar.
- REQ-014: Antes de instalar, el runner rechaza cualquier SQLite ya existente en `ProgramData\EvaluaPro\data\evaluapro.db`. Si el baseline oficial v1.2.3 crea esa SQLite en un host limpio, el runner mueve el archivo y sus sidecars a la raíz QA de `LOCALAPPDATA` y actualiza el `.env` antes de iniciar backend, dashboard o datos dummy.
- REQ-015: El runner restaura o retira el perfil operativo global que haya cambiado durante su instalación QA y conserva tutorial, capturas y logs dentro de `ReportDir`; un fallo de E2E no modifica la documentación del checkout.
- REQ-016: La reconciliación opcional de accesos directos tiene un límite de 90 segundos, captura salida acotada y nunca bloquea el payload funcional, SQLite ni el manifiesto del actualizador; si se excede, queda registrada como degradación.
- REQ-017: La prueba de upgrade conserva y valida el bundle oficial v1.2.3 por SHA-256, extrae el payload MSI con WiX y lo identifica por la firma OLE Compound File aunque Burn le asigne un nombre opaco, comprueba que la instalación registrada sea 1.2.3 y usa esa instalación junto con una SQLite QA aislada como baseline antes de instalar el bundle candidato.

## Criterios de Aceptación
- Fallos en post-install no dejan archivos huerfanos.
- El fallo exclusivo de accesos directos no desinstala el MSI; la respuesta del helper conserva `ok=true`, `degraded=true` y un warning legible.
- La instalación continúa siendo bloqueante ante errores de payload, configuración operativa, SQLite, runtime requerido o manifiesto de actualización.
- Cada etapa crítica del post-install queda identificable en el log aunque una etapa posterior quede bloqueada.
- La instalación docente no requiere acceso a nodejs.org; un paquete sin `runtime/node/node.exe` se rechaza con un error explícito.
- El release de Windows no publica el bundle hasta que el ciclo E2E completo del artefacto final termina correctamente.
- La extracción valida los archivos requeridos antes de mover el staging al destino y no copia de nuevo el árbol completo de dependencias.
- El ciclo dummy termina en 180 segundos como máximo y conserva stdout/stderr por separado, incluido el caso de fallo.
- El bundle E2E configura y prepara SQLite dentro del directorio aislado del runner, nunca en la base compartida de `ProgramData`; el baseline v1.2.3 recibe la misma ruta mediante su configuración de instalación.
- Un ExitCode nulo nunca basta por sí solo para declarar éxito del ciclo dummy; se requiere toda la evidencia estructurada de creación, verificación y limpieza. La limpieza local se limita a la SQLite real bajo `LOCALAPPDATA`, opera sobre los IDs/correos/nombres de la corrida y confirma cero residuos; sus conteos no dependen de si la API borró los registros primero.
- La opción de desinstalación se busca por su nombre accesible completo (`Desinstalar (con respaldo)`) y la acción primaria debe confirmar el modo antes de ejecutar.
- Si la interfaz conserva otra operación (por ejemplo, Reparar al solicitar Desinstalar), el runner falla antes de iniciar la transacción MSI/Burn.
- La prueba de upgrade usa el bundle oficial v1.2.3 con SHA-256 `644984c84fc05c4ec1f3804bda9d20666d229f7bab23caeb3a9c767179c82913`, comprueba el instalador antes de ejecutarlo, instala el candidato sobre esa misma ruta, requiere una `DisplayVersion` mayor y verifica el marcador en la SQLite declarada por el `.env` instalado; el marcador es temporal y se limpia en `finally`.
- El workflow Windows descarga EXE y sidecar desde la URL oficial del tag, valida su integridad antes de pasar el baseline al E2E y conserva reporte que distinga baseline, upgrade y persistencia.
- Si la SQLite de ProgramData existía antes del E2E, no se inicia el instalador. En un host QA limpio, la SQLite nueva de v1.2.3 y sus archivos WAL/journal pasan a LOCALAPPDATA antes de iniciar servicios; una base compartida nunca se mueve ni se abre para la prueba.
- Al terminar, el perfil operativo vuelve a sus bytes previos si todavía apunta a la ruta QA de la ejecución. Los tutoriales y capturas quedan bajo `ReportDir`; las corridas fallidas no escriben `docs/tutoriales`.
- La reconciliación opcional se termina antes de 90 segundos; su timeout o error queda como warning degradado, y el manifiesto crítico de actualización aún se genera y valida.
- El MSI baseline proviene del EXE oficial descargado y verificado; el runner encuentra el MSI por firma binaria aunque Burn lo extraiga como `a0`; la fixture no depende del helper GUI antiguo de v1.2.3.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Rollback automático y limpieza ante fallos | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-002 | Fallo de accesos directos degrada sin desinstalar el MSI | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
| REQ-003 | Manifiesto de instalación independiente para actualización | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
| REQ-004 | Trazas por etapa y salida retenida ante timeout | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-005 | Runtime Node autocontenido y validado sin descarga de red | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-006 | E2E completa obligatoria del bundle de release y conservación de evidencia | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-007 | Extracción ZIP rápida con publicación desde staging sin duplicar escrituras | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-008 | Ciclo dummy con timeout y stdout/stderr capturados en el artefacto E2E | `scripts/tests/installer-hub-contract.test.mjs` | En validación |
| REQ-009 | Workflow E2E y helper comparten SQLite confinada bajo LOCALAPPDATA | `scripts/tests/installer-hub-lifecycle-contract.test.mjs`, `scripts/tests/installer-hub-contract.test.mjs` | En validación |
| REQ-010 | Fallback estricto por ExitCode nulo con evidencia estructurada del ciclo dummy | `scripts/tests/installer-hub-contract.test.mjs` | En validación |
| REQ-011 | Selección segura del modo E2E mediante patrón de selección o teclado | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-012 | Confirmación de acción primaria y resumen de impacto antes de iniciar la operación | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | En validación |
| REQ-013 | Upgrade real v1.2.3 → candidato con integridad oficial y persistencia SQLite | `scripts/tests/installer-upgrade-e2e-contract.test.mjs`, `scripts/tests/installer-hub-e2e-docente.ps1`, `.github/workflows/ci-installer-windows.yml` | Implementación local; E2E Windows pendiente |
| REQ-014 | Rechazo de SQLite preexistente y aislamiento de la SQLite baseline recién creada | `scripts/tests/installer-upgrade-e2e-contract.test.mjs`, `scripts/tests/installer-hub-e2e-docente.ps1` | Implementación local; E2E Windows pendiente |
| REQ-015 | Restauración del perfil operativo y retención de evidencia dentro del reporte | `scripts/tests/installer-upgrade-e2e-contract.test.mjs`, `scripts/tests/installer-hub-e2e-docente.ps1` | Implementación local; E2E Windows pendiente |
| REQ-016 | Timeout y degradación de reconciliación opcional de accesos | `scripts/tests/installer-hub-contract.test.mjs` | Contrato aprobado; E2E Windows pendiente |
| REQ-017 | Upgrade desde MSI extraído del bundle oficial v1.2.3 | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Contrato aprobado; E2E Windows pendiente |
