---
id: SPEC-139
titulo: Aislamiento del payload nativo durante actualizaciones del Installer Hub
version: 1.3.0
fecha: 2026-10-30
autor: Ingeniería / Codex
modulo: installer_hub
estado: approved
---

## Contexto

En una actualización local de EvaluaPro, el MSI reportó éxito, pero el helper post-install no encontró el payload tras procesar Burn el bundle relacionado anterior. La instalación quedó sin ejecutable ni frontend y los directorios de datos permanecieron. El registro confirma además que el bundle fallido 1.2.11 quedó registrado; al relanzarlo, Burn lo detectó como relacionado de la misma versión y el guard bloquea su Apply. La recuperación requiere una versión de Hub superior y un archivo temporal distinto para cada combinación de versión de app y Hub. También debe conservar los bundles relacionados durante instalar/reparar: sus helpers de desinstalación limpian el directorio compartido y pueden borrar el payload nuevo antes de que el helper candidato lo consuma.

## Requisitos Funcionales

- **REQ-001:** Cada combinación de versiones de app y Hub instala el archivo temporal de payload con un nombre único y determinista; una actualización anterior no puede quitar ni reemplazar el archivo de la versión candidata.
- **REQ-002:** El helper post-install solo acepta y consume el payload correspondiente a las versiones de app y Hub con que se compiló el Installer Hub; conserva validación de ruta, enlace simbólico, extracción segura y transacción existente.
- **REQ-003:** El proceso de build verifica que el MSI contenga el nombre de payload versionado esperado y que su contenido incluya los artefactos docentes obligatorios.
- **REQ-004:** La ruta de actualización desde una instalación MSI y bundle relacionados de versión anterior termina con ejecutable, backend, frontend, runtime y manifiesto candidatos presentes; el flujo conserva datos y configuración fuera del alcance del reemplazo.
- **REQ-005:** Si el MSI o la limpieza relacionada falla, el Hub comunica el fallo real y conserva la evidencia de diagnóstico; no declara éxito sin verificar el payload instalado.
- **REQ-006:** La recuperación de un bundle 1.2.11 ya registrado usa una versión de Hub mayor, conserva la versión de app 1.2.10 y deja que Burn actualice la identidad anterior sin colisionar el archivo temporal.
- **REQ-007:** Si el usuario selecciona reparar y Burn detecta un bundle relacionado de la misma versión, permite la reparación y conserva dicho bundle como `Present`; las instalaciones nuevas o actualizaciones de misma versión continúan bloqueadas antes de Apply.
- **REQ-008:** Durante instalar o reparar, Burn conserva como `Present` todos los bundles relacionados que de otro modo retiraría; así evita ejecutar sus helpers de limpieza del directorio compartido antes de completar el helper de payload candidato. Una desinstalación explícita conserva su flujo habitual.
- **REQ-009:** Si se abre un Installer Hub anterior al bundle relacionado instalado, la detección comunica las dos versiones y bloquea instalar/reparar antes de `Apply`; indica abrir el Hub más reciente. La desinstalación conserva su flujo explícito.

## Criterios de Aceptación

- La prueba contractual enfocada falla ante regresión al nombre compartido y comprueba la correspondencia entre versión, MSI y helper.
- La validación E2E de actualización demuestra que el payload candidato sigue disponible después de retirar el bundle anterior y que el helper completa la instalación.
- La compilación del Installer Hub y el empaquetado del MSI docente terminan correctamente.
- El bundle de recuperación es posterior a 1.2.11 y el nombre del payload combina las versiones de app y Hub.
- La instalación local de recuperación verifica archivos, manifiesto, versión y salud de UI/API sin abrir ni modificar la base de datos.
- Un Hub anterior nunca intenta ejecutar el MSI contra un bundle relacionado de mayor versión; la interfaz bloquea la acción y presenta instrucciones de recuperación antes de iniciar Burn `Apply`.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Nombre app-Hub versionado y selección exacta del payload | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Prueba focalizada aprobada; build validó nombre y contenido |
| REQ-003 | MSI contiene payload versionado íntegro | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` y extracción administrativa durante build | Validado localmente |
| REQ-004, REQ-006 | Upgrade de MSI y bundle previos conserva payload candidato hasta completar el helper | `scripts/tests/installer-hub-e2e-docente.ps1` | E2E aislado pendiente; instalación candidata local verificada |
| REQ-005 | Fallo explícito con evidencia y sin falso éxito | `scripts/tests/installer-upgrade-e2e-contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | Contrato local aprobado; E2E pendiente |
| REQ-007 | Reparación de misma versión conserva el bundle relacionado hasta terminar | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Contrato aprobado; reparación runtime app 1.2.10 / Hub 1.2.13 completada |
| REQ-008 | Instalar/reparar preserva bundles relacionados antes de cualquier helper de limpieza | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Contrato, instalación y reparación runtime aprobados |
| REQ-009 | Un bundle antiguo se bloquea antes de Apply con versiones y acción recomendada | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Implementado; contrato focal y build WPF pasan; bundle/runtime nuevos pendientes |

## Evidencia de Validación Local

- 2026-10-29: build local app 1.2.10 / Hub 1.2.11 detectó en el equipo la misma versión registrada y bloqueada antes de Apply; ese paquete no se volvió a ejecutar.
- 2026-10-29: build app 1.2.10 / Hub 1.2.12 con SHA-256 `EA289F47B0FB257AA30A756F816449C6EB92B3D0841FFB7A91139A9F27B288DA`, sin firma digital, se ejecutó con aprobación del usuario. Burn instaló el MSI, pero al desinstalar el bundle relacionado anterior su helper limpió el payload candidato; la operación revirtió. Logs confirmaron el orden de eventos y los directorios de datos permanecieron presentes.
- 2026-10-29: causa raíz corregida en el plan Burn: durante instalar/reparar se conservan los bundles relacionados para impedir que sus helpers de desinstalación limpien el directorio compartido antes del consumo del payload. La recuperación siguiente usa app 1.2.10 / Hub 1.2.13 y payload versionado `evaluapro-native-dist-1.2.10-1.2.13.zip`.
- 2026-10-29: pruebas enfocadas del contrato de preservación, reparación, conflicto de versión, payload y contraste Hub: aprobadas (7 pruebas seleccionadas).
- 2026-10-29: build app 1.2.10 / Hub 1.2.13 completado; manifest verificado, payload ZIP 202.9 MB y extracción administrativa MSI íntegra. Bundle `EvaluaPro-InstallerHub-docente-local-v1.2.13.exe`, 276,896,973 bytes, SHA-256 `290FFC4A6B6C65B06D579F7BD6D7C71AFBB06C30E22A900359ADD39F466A218F`, sin firma digital.
- 2026-10-29: instalación local completada en `%LOCALAPPDATA%\EvaluaPro`. La UI reportó operación completada y CRC/SHA de cuatro archivos críticos verificados. El log `C:\ProgramData\EvaluaPro\installer-hub\logs\burn-20261029163751-36c4667af83341d1a47dda6b4d1ccec1\burn-bootstrapper.log` muestra bundle 1.2.12 solicitado `Absent` y conservado como `Present`, MSI completado y helper al 100%.
- 2026-10-29: comprobación posterior: `EvaluaPro.exe`, backend compilado y `apps\frontend\dist-docente\index.html` presentes; Hub 1.2.12 y 1.2.13 permanecen registrados. Frontend HTTP 200; API `/api/salud/live` = `ok`; `/api/salud/ready` = `ok`, host `ready`, SQLite `ready=True`. La GUI nativa abrió Materias. Ambos directorios de datos siguen presentes; no se abrieron ni modificaron archivos SQLite.
- 2026-10-29: se volvió a ejecutar el mismo bundle app 1.2.10 / Hub 1.2.13 y la UI detectó la instalación existente, seleccionó «Reparar» y confirmó que conserva cursos/base local. Con aprobación inmediata, MSI status 0 y helper post-install al 100%; el log registró el bundle 1.2.12 como `Present`. El Hub mostró resultado completado y se cerró al finalizar.
- 2026-10-29: validación posterior a la reparación: host, backend y frontend instalados; UI Materias volvió a abrir; frontend HTTP 200; API live/readiness `ok` con host `ready` y SQLite `ready=True`; ambos directorios de datos presentes; bundles 1.2.12 y 1.2.13 registrados. No se inspeccionó contenido SQLite.
- 2026-10-29: pruebas contractuales focalizadas de actualización/payload y reparación de misma versión aprobadas; E2E local de recuperación pendiente.
- No se consultó ni modificó el contenido de la base de datos.

## Integración en el worktree de GUI (2026-10-29)

- Integrados en este worktree los cambios aprobados de payload versionado y preservación de
  bundles relacionados. La reparación de la misma versión queda permitida; la instalación o
  actualización con bundle relacionado de versión idéntica sigue bloqueada antes de `Apply`.
- El plan conserva bundles relacionados durante `install` y `repair`, evitando que sus helpers
  de desinstalación borren el payload candidato; el uninstall explícito mantiene su flujo.
- Validación de este worktree: `node --test
  scripts/tests/installer-hub-lifecycle-contract.test.mjs
  scripts/tests/installer-upgrade-e2e-contract.test.mjs` (67/67 PASS), incluyendo nombre
  versionado, repair y preservación; contraste del selector WPF 1/1 PASS; build WPF Release
  PASS. `npm run sdd:audit` y `git diff --check` PASS.
- El E2E que modifica una instalación no se repitió. El comportamiento de instalación local y
  repair de app 1.2.10 / Hub 1.2.13 se conserva como evidencia de la integración aprobada
  anterior; la reproducción sobre el bundle generado desde este worktree queda pendiente.

## Rechazo preventivo de bundles antiguos (2026-10-30)

- La captura de Installer Hub `v1.2.10` muestra `0x80070666` tras ejecutar el MSI contra versiones
  relacionadas más recientes. El log de la sesión confirma `Action=Install`, bundles relacionados
  `1.2.12.0` y `1.2.13.0`, paquete MSI `Obsolete` y el HRESULT `0x80070666`.
- Causa: el guard existente solo bloqueaba una versión de Hub idéntica; el paquete antiguo podía
  llegar a `Apply`, donde Windows Installer rechazaba la instalación como downgrade.
- Cambio: la detección conserva la versión relacionada mayor, deshabilita instalar/reparar desde
  un Hub anterior y muestra qué Hub abrir. `OnPlanComplete` conserva un segundo guard antes de
  `Apply`; uninstall explícito sigue permitido.
- Validación: `node --test scripts/tests/installer-upgrade-e2e-contract.test.mjs` → 37/37 PASS;
  `dotnet build packaging/wix/BurnBootstrapperApp/EvaluaPro.BurnBootstrapperApp.csproj -c Release
  --no-restore` → PASS; `npm run sdd:audit` y `git diff --check` → PASS.
- La compilación reportó NU1900 al consultar NuGet por indisponibilidad de `api.nuget.org`; los
  paquetes ya restaurados permitieron compilar con cero errores. No se reintentó el bundle ni se
  modificó la instalación. La corrección solo estará disponible al generar e instalar un Hub nuevo;
  para reparar ahora, abrir el Hub instalado más reciente (1.2.13) y seleccionar Reparar.
