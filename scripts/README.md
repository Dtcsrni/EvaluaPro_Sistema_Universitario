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
- UI principal: `installer-hub/InstallerHub.ps1`
- Modulos:
  - `installer-hub/modules/ReleaseResolver.psm1`
  - `installer-hub/modules/PrereqDetector.psm1`
  - `installer-hub/modules/PrereqInstaller.psm1`
  - `installer-hub/modules/ProductInstaller.psm1`
  - `installer-hub/modules/PostInstallVerifier.psm1`
- Manifiesto de prerequisitos:
  - `../config/installer-prereqs.manifest.json`
- Build de bootstrapper EXE:
  - `npm run installer:hub:build`
- Contratos release (hash + manifiesto):
  - `npm run installer:hashes`
- Signing gate opcional:
  - `npm run installer:sign`

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
- Varios scripts asumen Docker Desktop iniciado.
- Ver README principal para el flujo completo: `../README.md`.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Automatizaciones de operacion, QA, release y cumplimiento.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
