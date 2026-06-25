# scripts/

Herramientas de operación local (principalmente Windows) para **Sistema EvaluaPro (EP)**.

## Dashboard
- UI: `dashboard.html`
- SW: `dashboard-sw.js`
- Launcher: `launcher-dashboard.mjs`
- Variable de gracia de salud en arranque: `DASHBOARD_HEALTH_WARMUP_MS` (ms, recomendado 60000 en Windows)
- Reparacion desde Configuracion:
  - diagnostico: `GET /api/repair/status`
  - iniciar reparacion: `POST /api/repair/run`
  - progreso: `GET /api/repair/progress`
  - alcance v1 no destructivo: build portal si falta, recrear accesos directos y recuperar stack/portal.

## Installer Hub (Windows)
- Bundle publico: `../packaging/wix/Bundle.wxs`
- BA personalizada: `../packaging/wix/BurnBootstrapperApp/`
- Helper headless: `installer-burn/InstallerBurnHelper.ps1`
- Modulos:
  - `installer-burn/modules/Common.psm1`
  - `installer-burn/modules/PrereqDetector.psm1`
  - `installer-burn/modules/PrereqInstaller.psm1`
  - `installer-burn/modules/OperationalConfig.psm1`
  - `installer-burn/modules/PostInstallVerifier.psm1`
  - `installer-burn/modules/LicenseClientSecurity.psm1`
- Manifiesto de prerequisitos:
  - `../config/installer-prereqs.manifest.json`
- Build de bootstrapper EXE:
  - `npm run installer:hub:build`
- Contratos release (hash + manifiesto):
  - `npm run installer:hashes`
- Signing gate opcional:
  - `npm run installer:sign`

Arquitectura vigente:
- `WiX Burn` maneja `UAC`, cache, chain `MSI`, `repair` y `uninstall`.
- La BA `WPF .NET 8` presenta prerequisitos, modo y progreso.
- El helper PowerShell aplica configuracion operativa, bootstrap de `WSL2` (`Docker Engine + Node 24` para `docente-local`), verificacion final y blindaje local de licencia.
- El legado `PowerShell WinForms` fue retirado; no queda un `InstallerHub.ps1` soportado.
- Para `docente-local`, Windows usa `runtime/node/node.exe` como runtime embebido privado del producto y exige `Node 24` host con remediacion automatica durante la instalacion.

## Limpieza de registros viejos
- Script: `cleanup-old-evaluapro-registry.ps1`
- Uso:
  - `powershell -ExecutionPolicy Bypass -File scripts/cleanup-old-evaluapro-registry.ps1`
- Comportamiento:
  - relanza con UAC si no corre como administrador,
  - exporta respaldo `.reg` antes de borrar,
  - elimina solo claves `Uninstall` con `DisplayName = EvaluaPro` o `EvaluaPro Installer Hub`.

## Env Doctor (WSL2 + Windows)
- Script: `env-doctor.mjs`
- Comandos:
  - `npm run env:doctor:wsl`
  - `npm run env:doctor:windows`
  - `npm run env:doctor`
- Comportamiento:
  - `fail-fast` (codigo de salida `1`) ante faltantes criticos.
  - salida estable con resumen humano + bloque JSON (`ok`, `target`, `checks`, `failures`, `warnings`).
- Reglas:
  - `env:doctor:wsl` exige Linux sobre WSL2, `node>=24`, `npm`, Chromium + Headless Shell de Playwright, Docker CLI + daemon y `docker compose`.
  - `env:doctor:windows` exige host `win32`, `node>=24`, `npm`, Chromium + Headless Shell de Playwright, Docker CLI + daemon y `wsl --status` accesible.
  - `env:doctor` selecciona target segun plataforma (`win32 => windows`, resto => wsl).

Matriz de uso rapido:
- Desarrollo diario en WSL2: `npm run env:doctor:wsl`
- Build/smoke de instalador en PowerShell Windows: `npm run env:doctor:windows`
- Diagnostico automatico segun host actual: `npm run env:doctor`
- Usuario final `docente-local`: no se espera ejecutar `env:doctor`; el Installer Hub prepara `WSL2 + Docker + Node 24` y usa runtime Node embebido local para launcher/dashboard/tray.

## Configuracion automatica OAuth + Classroom
- Script: `configurar-oauth-classroom.ps1`
- Uso rapido:
  - `pwsh -File scripts/configurar-oauth-classroom.ps1 -GoogleOauthClientId "<id>" -GoogleClassroomClientId "<id>" -GoogleClassroomClientSecret "<secret>" -GoogleClassroomRedirectUri "http://localhost:4000/api/integraciones/classroom/oauth/callback" -AlsoSetViteGoogleClientId`
- El script:
  - actualiza/crea variables en `.env` sin borrar comentarios,
  - garantiza `CLASSROOM_TOKEN_CIPHER_KEY` valida (base64 de 32 bytes),
  - ajusta `REQUIRE_GOOGLE_OAUTH` (por defecto `1`, o `0` con `-DisableRequireGoogleOAuth`).

## Accesos directos / bandeja
- Generación de accesos: `create-shortcuts.ps1`
- Operaciones por acceso directo: `shortcut-ops.ps1`
- Wrapper oculto para operaciones: `shortcut-op-hidden.vbs`
- Launcher oculto: `launcher-dashboard-hidden.vbs`
- Tray (NotifyIcon): `launcher-tray.ps1`
- Política:
  - los accesos directos solo deben instalarse o restaurarse desde Installer Hub;
  - dashboard, broker y reparación no deben regenerarlos automáticamente.

## Ejecutables rápidos
- `launch-dev.cmd`
- `launch-prod.cmd`

## Mantenimiento de recursos (disco/RAM/Docker)
- Script principal: `ops-maintenance.ps1`
- Modos:
  - `report`: solo diagnostico.
  - `weekly`: limpieza preventiva.
  - `monthly`: limpieza profunda (incluye volumenes huérfanos y recursos no usados).
- Comandos npm:
  - `npm run ops:maintenance:report`
  - `npm run ops:maintenance:weekly`
  - `npm run ops:maintenance:monthly`

## Higiene del workspace
- Script: `workspace-hygiene.mjs`
- Comandos:
  - `npm run workspace:hygiene`
  - `npm run workspace:hygiene:strict`
- Uso:
  - reporta buckets regenerables (`dist`, `reports`, `logs`, `test-results`, datasets OMR) y temporales de raíz,
  - detecta archivos versionados donde debería haber solo artefactos regenerables,
  - en modo estricto falla para que CI o mantenimiento local detecten mezcla indebida de outputs.

## Tareas programadas de Windows
- Instalador de tareas: `install-maintenance-tasks.ps1`
- Comando npm:
  - `npm run ops:maintenance:tasks:install`
- Tareas creadas:
  - `EvaluaPro-Mantenimiento-Semanal`
  - `EvaluaPro-Mantenimiento-Mensual`

## Aislamiento de datos (dev/prod/test)
- Datos de archivos backend separados por entorno:
  - `apps/backend/data/examenes_dev`
  - `apps/backend/data/examenes_prod`
  - `apps/backend/data/examenes_test`
- Bases de datos Mongo recomendadas por entorno:
  - `MONGODB_URI_DEV` -> `evaluapro_dev`
  - `MONGODB_URI_PROD` -> `evaluapro_prod`
  - `MONGODB_URI_TEST` -> `evaluapro_test`
- Rutas de datos configurables por entorno:
  - `BACKEND_DATA_DIR_DEV`
  - `BACKEND_DATA_DIR_PROD`
- Guard obligatorio de separación:
  - `npm run ops:guard:separation`
  - Se ejecuta automáticamente antes de `stack:dev`, `stack:prod`, `stack:dev:full`, `stack:prod:full`, `dev:portal` y `portal:prod`.

## Handoff IA (continuidad de sesiones)
- Script: `ia-handoff.mjs`
- Comandos:
  - `npm run ia:handoff:quick`
  - `npm run ia:handoff:full`
- Input opcional:
  - `node scripts/ia-handoff.mjs --mode quick --input <archivo.json>`
- Salida:
  - `docs/handoff/sesiones/<YYYY-MM-DD>/<sesion>.json`
  - `docs/handoff/sesiones/<YYYY-MM-DD>/<sesion>.md`
- Contrato:
  - `docs/handoff/trace.schema.json`
  - `docs/handoff/CONTRATO_TRAZABILIDAD_IA.md`
- Validación:
  - `npm run test:ia:traceability`

## Politica repo-local de economia de tokens
- Guia: `../docs/POLITICA_ECONOMIA_TOKENS_CODEX.md`
- Selector local:
  - `npm run ai:model:pick -- --task "<descripcion>" [--budget low|balanced|high] [--mode auto|coding|reasoning|cheap] [--json]`
- Validacion local:
  - `npm run test:ai:model-router`
- Validacion Serena (integracion base):
  - `npm run ai:serena:status -- --json`
- Validacion Serena (politica repo + global):
  - `npm run ai:serena:policy:status -- --json`
 - Nota: ` .serena/project.yml` fue actualizado para incluir un conjunto recomendado de herramientas opcionales (sin habilitar ejecución de shell ni borrado automático de memorias). Si necesitas ajustar la lista, edita `.serena/project.yml` y luego re-ejecuta `npm run ai:serena:status -- --json`.
- Alcance:
  - optimiza el uso de Codex en VS Code;
  - no cambia el runtime, el contrato del sistema ni los gates de release.

## Comentarios autoexplicativos por archivo
- Script: `ia-docblocks.mjs`
- Comando:
  - `npm run ia:docblocks`
- Uso:
  - agrega cabeceras de contexto a archivos versionados comentables del repo (`ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `sh`, `ps1`, `cmd`) que no tengan cabecera inicial.

## Inventario de codigo por sesion
- Script: `inventario-codigo.mjs`
- Comando:
  - `npm run inventario:codigo`
- Salida:
  - `docs/INVENTARIO_CODIGO_EXHAUSTIVO.md`

## QA preproducción (dataset + e2e + PDF + UX)
- Scripts:
  - `testing/export-anon-fixture.mjs`
  - `testing/validate-anon-fixture.mjs`
  - `testing/import-anon-fixture.mjs`
  - `testing/generar-qa-manifest.mjs`
- Comandos:
  - `npm run test:dataset-prodlike:ci`
  - `npm run test:e2e:docente-alumno:ci`
  - `npm run test:global-grade:ci`
  - `npm run test:pdf-print:ci`
  - `npm run test:ux-visual:ci`
  - `npm run test:qa:manifest`
- Salidas:
  - `reports/qa/latest/*.json`

## Preflight de producción para examen global
- Script:
  - `release/preflight-global-prod.mjs`
- Comando:
  - `npm run release:preflight:global -- --api-base=<https://api-dominio/api> --token=<jwt_docente> --periodo-id=<periodoId> [--modo=readonly|smoke] [--alumno-id=<alumnoId>]`
- Uso:
  - `readonly` (default): valida precondiciones sin mutar datos.
  - `smoke`: genera 1 examen global y lo archiva para validar extremo a extremo.
- Salida:
  - `reports/qa/latest/preflight-global-prod.json`

## READMEs de carpetas (base)
- Script: `generar-readmes-carpetas.mjs`
- Comando:
  - `npm run docs:carpetas:generate`
- Uso:
  - crea `README.md` base en carpetas objetivo que aún no lo tengan.

Notas:
- Los scripts operativos validan `docker compose` y un runtime Docker compatible; `WSL2 + Docker Engine` es el modo por defecto y `Docker Desktop` queda como compatibilidad opcional.
- Para el Installer Hub, `EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL=1` habilita bootstrap semiautomatico de pasos host auto-ejecutables de WSL (sin eliminar pasos manuales restantes).
- Ver README principal para el flujo completo: `../README.md`.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Automatizaciones de operacion, QA, release y cumplimiento.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-06-23.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
