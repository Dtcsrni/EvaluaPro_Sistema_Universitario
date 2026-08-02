---
id: SPEC-DOCENTE-RELEASE-SMOKE
titulo: Release smoke del flavor docente nativo
version: 1.0.0
fecha: 2026-07-14
autor: Codex
modulo: installer_hub_docente
estado: approved
---

## Contexto

El flavor `docente-local` debe instalar un runtime nativo ligero y verificable. El smoke y el E2E de release se ejecutan directamente en la PC Windows de QA; no dependen de VM, Hyper-V, WinRM, snapshots ni credenciales remotas.

## Requisitos Funcionales

- REQ-001: El smoke debe verificar que `docente-local` declara `native-node-sqlite` como runtime objetivo.
- REQ-002: El smoke debe comprobar manifest, shortcuts y control plane sin depender de Docker/WSL2.
- REQ-003: El smoke debe conservar una expectativa explícita de estado operativo para detectar regresiones de bundle.
- REQ-004: La UX docente debe respetar el contrato visual de radios contenidos y matriz canónica de pantallas.
- REQ-005: El E2E local debe crear cuentas dummy, tres materias y tres alumnos, y recorrer el ciclo docente completo con datos aislados y eliminables.
- REQ-006: El Installer Hub debe iniciar con una ventana de 1280×820, exigir como mínimo una pantalla de 1280×720 y recomendar 1920×1080.
- REQ-007: El post-install debe elevarse únicamente cuando la ruta objetivo esté protegida por Windows; para rutas de usuario debe operar sin UAC. Si la elevación requerida es rechazada, el resultado debe ser `ok=false` con error accionable. El E2E debe esperar la presencia completa del payload canónico antes de invocar el broker.
- REQ-008: La UX/UI debe usar tipografía local-first legible, soporte de texto enriquecido semántico y glassmorphism degradable con contraste y foco accesibles; ningún estado crítico puede depender solo de transparencia, color o una fuente remota.
- REQ-009: El Hub debe presentar una introducción navegable con logo, versión y carrusel accesible de funciones; debe mostrar licencia y privacidad como documentos identificables por separado, exigir aceptación explícita de ambos y registrar versión/fecha de aceptación en la sesión.

## Criterios de Aceptación

- El test `windows-release-smoke` pasa contra el bundle docente generado por `origin/main`.
- Ninguna aserción del smoke docente exige `wsl2-docker-minimal`.
- La validación mantiene cobertura de manifest, runtime embebido, shortcuts y `/api/status`.
- El contrato visual y la matriz de pantallas pasan sin radios oversized ni pantallas omitidas.
- El runner local produce evidencia de las cuentas, materias y alumnos dummy y valida install, operación, navegación, persistencia y uninstall.

### REQ-016 - Legibilidad completa sobre superficies de vidrio

Todo texto operativo visible del Hub debe conservar contraste suficiente sobre
cada estado de superficie, incluido vidrio oscuro, éxito, advertencia, error,
bitácora y tarjetas de la línea de tareas. El cuerpo secundario dinámico debe
usar como mínimo 12 px, interlineado de 18 px, color claro y ajuste de línea;
no puede depender de un gris oscuro ni de `NoWrap` para comunicar evidencia.
Los índices y etiquetas compactas no deben bajar de 12 px. El criterio aplica
a la ventana completa, no solo a la pantalla inicial.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Runtime nativo docente | `scripts/tests/windows-release-smoke.test.mjs` | Completado |
| REQ-002 | Integridad del bundle y control plane | `scripts/tests/windows-release-smoke.test.mjs` | Completado |
| REQ-003 | Smoke activo y límite de footprint | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
| REQ-004 | Contrato visual y matriz UX/UI | `scripts/tests/gui-design-contract.test.mjs` | Completado |
| REQ-005 | Ciclo docente local con datos dummy | `scripts/tests/seed-docente-dummy.mjs` | Implementado; pendiente de ejecución local |
| REQ-006 | Resolución mínima y ventana legible | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-007 | Elevación condicional y payload post-install | `scripts/tests/installer-hub-contract.test.mjs`, `scripts/tests/installer-hub-e2e-docente.ps1` | Implementado; pendiente de E2E local |
| REQ-008 | Tipografía, marca y superficies accesibles | `docs/DESIGN.md`, `apps/frontend/src/styles.css` | Implementado; pendiente de validación visual |
| REQ-009 | Intro, carrusel y aceptación auditable | `packaging/wix/BurnBootstrapperApp/MainWindow.xaml`, `MainWindow.xaml.cs` | En implementación |
| REQ-016 | Legibilidad de textos y estados dinámicos | `scripts/tests/installer-hub-contract.test.mjs`, `MainWindow.xaml.cs` | Implementado |

### REQ-017 - Arranque nativo compatible con Node 24 en Windows

El launcher del flavor `docente-local` debe iniciar sus procesos Node mediante
una estrategia compatible con Windows y Node 24. La ejecución de `npm.cmd` no
puede depender de `spawn` directo sin shell, porque esa combinación devuelve
`EINVAL` antes de crear API o frontend. El launcher debe conservar captura de
stdout/stderr, cierre del árbol de procesos y diagnóstico accionable.
### REQ-010 - Cierre acotado del runner E2E local

El runner E2E del flavor `docente-local` debe registrar el estado final y cerrar
Hub/Burn/MSI con un timeout acotado. Un proceso residual no puede bloquear la
prueba indefinidamente: debe registrarse como evidencia y detenerse de forma
controlada antes de continuar con la validación del payload.

### REQ-011 - Correlación única de operaciones del helper

Cada invocación del helper de detección, configuración, reparación o
desinstalación debe usar archivos de solicitud y respuesta con un identificador
único. Operaciones concurrentes o dos invocaciones dentro del mismo segundo no
pueden sobrescribir evidencia ni consumir la respuesta de otra operación.

### REQ-012 - Modos de lifecycle alcanzables

El helper nativo debe aceptar y enrutar explícitamente `detect-prereqs`,
`post-install`, `update` y `uninstall`. Ningún modo implementado puede quedar
fuera de su contrato de parámetros; si una operación no puede ejecutarse, debe
devolver un envelope JSON accionable y no terminar silenciosamente.

### REQ-013 - Bitácora nativa sin fallo de carga XAML

El control de expansión de la bitácora técnica debe usar únicamente recursos
WPF compatibles con el cargador nativo del Hub. Debe mostrar encabezado y
texto con contraste accesible, conservar foco/teclado y no provocar errores de
`ResourceDictionary.DeferrableContent` al iniciar el ejecutable.

El fallo fatal debe dejar una traza completa (`Exception.ToString`) en una
ruta temporal local para que el E2E y soporte puedan identificar la causa sin
exponer secretos ni depender de una consola visible.

### REQ-014 - Resolución robusta de ventana en E2E

El runner debe localizar el Hub por UI Automation semántica y, cuando Burn
separe el proceso de lanzamiento del BA, usar también el `MainWindowHandle`
del proceso `EvaluaPro.BurnBootstrapperApp`. La detección debe tolerar la
carrera de creación entre ambos procesos sin declarar un falso negativo.

### REQ-015 - Evidencia visual y estado de broker resilientes

La captura visual debe intentar `CopyFromScreen` y disponer de fallback
`PrintWindow` para escritorios sin DC válido. Las acciones del broker deben
considerarse exitosas únicamente con código cero o con un estado JSON reciente
`healthy`, registrando explícitamente cuando se usa esa evidencia alternativa.

### REQ-018 - Payload ejecutable completo antes de broker

El E2E no puede declarar instalación útil solo por presencia de `package.json`,
scripts y runtime. Antes de invocar el broker debe verificar el artefacto
ejecutable del backend (`apps/backend/dist/index.js`) y el build docente del
frontend (`apps/frontend/dist-docente/index.html`). Si falta cualquiera, la
prueba debe fallar con ruta exacta y no intentar abrir un dashboard inválido.

### REQ-019 - Superficie visual alta, legible y con movimiento controlado

La ventana inicial del Hub debe abrir con altura suficiente para mostrar el
flujo completo sin recortes (`Height=1020`, `MinHeight=720`). Las tarjetas de
contenido claro deben usar texto explícitamente oscuro y contrastado. La barra
de progreso debe tener una animación sutil durante una operación activa,
detenerse al finalizar y respetar la preferencia de animaciones del sistema.

### REQ-020 - Preflight de elevación por destino real

El E2E docente-local debe distinguir una instalación per-machine antigua de la
ruta nativa que se va a probar. Una entrada ajena se registra como evidencia y
advertencia, pero no debe forzar UAC ni bloquear la prueba. Solo se exige
elevación cuando la ruta objetivo coincide con una instalación per-machine que
será modificada o desinstalada.

### REQ-021 - Runtime nativo autocontenido y ligero

El flavor docente-local no debe depender de `npm`, Vite, Docker, VM ni
dependencias de desarrollo en tiempo de ejecución. El launcher debe ejecutar
el backend compilado con el Node embebido y servir el build docente mediante un
servidor HTTP estático nativo, con fallback SPA y protección contra traversal.
El payload solo debe instalar dependencias de producción del backend.

### REQ-022 - Profundidad visual perceptible

Las tarjetas y paneles críticos del Hub deben conservar profundidad visual
perceptible en tema oscuro y claro: sombra externa suficiente, borde de realce
y superficies diferenciadas. El estado no puede depender únicamente de
transparencia o color.

### REQ-023 - Cierre verificable y accionable

La pantalla final de una instalación exitosa debe mostrar el nombre EvaluaPro,
el logo oficial en tamaño discreto, una verificación de integridad local
(CRC32 y huella SHA-256 de archivos críticos), confirmación, agradecimiento,
primeros pasos y acciones visibles para iniciar EvaluaPro o cerrar el Hub.

### REQ-024 - Base local preparada antes del primer uso

El post-install del flavor docente-local debe aplicar el esquema Prisma
SQLite empaquetado sobre la base local antes de iniciar la API. Si la
preparación falla, debe devolver error explícito y no reportar instalación lista.

### REQ-025 - Datos docentes sin elevación innecesaria

La base SQLite del flavor docente-local debe residir en una carpeta de datos
del usuario (`%LOCALAPPDATA%`) con permisos de escritura normales. `ProgramData`
se reserva para evidencias compartidas y configuración que realmente requiera
protección; el primer uso docente no debe exigir UAC por escribir la base.

### REQ-026 - Estimación de tiempo restante

Cuando exista progreso determinable, el Hub debe estimar el tiempo restante a
partir de muestras recientes de avance y tiempo, suavizar fluctuaciones y
mostrar "calculando" durante la fase insuficiente o indeterminada. Nunca debe
presentar una precisión falsa ni bloquear la operación por no poder estimar.

### REQ-027 - Carrusel embebido informativo

El carrusel visible del Hub debe permanecer embebido en el encabezado, cambiar
automáticamente con pausa suficiente para lectura, permitir navegación manual,
usar iconografía descriptiva de alta resolución y ofrecer al menos 21 funciones
relevantes de EvaluaPro con textos breves, claros y accesibles.

La identidad oficial de EvaluaPro debe aparecer una sola vez en el encabezado
visible del Hub. Las tarjetas del carrusel no deben reutilizar el logo ni una
miniatura de marca; deben usar únicamente iconografía funcional para evitar
redundancia visual y conservar espacio para el contenido descriptivo. El logo
pequeño de la pantalla final de instalación queda permitido como cierre de
marca contextual.

El harness UIAutomation debe tratar una ventana no encontrada como un estado
diagnosticable: no puede invocar métodos sobre raíces nulas, debe conservar el
reporte y el log, y debe distinguir fallo de arranque del Hub de fallo de un
control concreto.

El staging no debe quedar bloqueado por una invocación de Git sin respuesta:
la enumeración de archivos versionados debe tener timeout y fallback acotado al
árbol permitido del payload, dejando una advertencia diagnóstica.

El MSI de `docente-local` debe ser `perUser` y escribir en
`%LOCALAPPDATA%`; los flavors institucionales pueden permanecer `perMachine`.
El E2E debe comprobar que una instalación docente limpia no solicite UAC para
la operación principal y que solo eleve actividades realmente privilegiadas.

El runner E2E puede inyectar `EVALUAPRO_QA_INSTALL_DIR` para aislar cada corrida
bajo `%LOCALAPPDATA%`; el Hub debe aceptar esa ruta solo para `docente-local` y
rechazar rutas fuera de ese árbol. La ruta normal del cliente sigue siendo
`%LOCALAPPDATA%\\EvaluaPro`.

El empaquetado debe ofrecer un modo de aislamiento exclusivo para QA local que
genere `UpgradeCode` y `BundleUpgradeCode` temporales por flavor. Ese modo no
puede usarse para publicar releases, pero permite probar `docente-local` en una
PC que conserve instalaciones per-machine antiguas sin provocar una migración
involuntaria ni elevar el Hub completo.

Los componentes MSI `perUser` tampoco pueden escribir marcadores de accesos o
limpieza en `HKLM`; el root de registro debe ser `HKCU` para `docente-local` y
`HKLM` solo para flavors `perMachine`.

### REQ-028 - Limpieza dummy confinada a la instalación QA

El ciclo de datos dummy debe limpiar únicamente la base SQLite de la instancia
QA instalada y nunca una base del repositorio o de otra instalación. La ruta
debe recibirse explícitamente desde el runner, validar que permanezca bajo
`%LOCALAPPDATA%` y registrar el modo de limpieza. Si el registro inicial falla,
el reporte debe conservar el endpoint, estado HTTP y diagnóstico sin afirmar
que el ciclo fue ejecutado.

### REQ-029 - Gate de payload docente completo

El build MSI de `docente-local` debe inspeccionar el MSI extraído y rechazarlo
si no contiene exactamente un bootstrap `scripts/prepare-docente-sqlite.mjs` y
un `apps/backend/dist/prisma/schema.sql`. Validar solo `package.json` no es
suficiente para permitir la publicación o el E2E.

### REQ-030 - Restricción de Dashboard en flavor docente-local

El Dashboard UI (`dashboard.html` / acción `open-dashboard`) no debe ser directamente
accesible para usuarios finales del flavor `docente-local`.

1. **Accesos directos**: El instalador de `docente-local` no debe crear el acceso directo de usuario "EvaluaPro - Abrir Dashboard". Los accesos directos principales deben dirigir a la Web Docente nativa (`http://127.0.0.1:4173`).
2. **Acceso al Dashboard**: En `docente-local`, la apertura del Dashboard UI queda restringida a modo depuración activo (`EVALUAPRO_DEBUG=1` o `-Debug`) Y autenticación administrativa (`step-up` o licencia comercial/administrativa activa).
3. **Redirección automática**: Si se solicita `open-dashboard` en `docente-local` sin credenciales de depuración/administrativas activas, el broker redirigirá automáticamente a la Web Docente nativa (`http://127.0.0.1:4173`).

