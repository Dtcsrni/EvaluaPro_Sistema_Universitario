# Despliegue

## Estado actual y estrategia
EvaluaPro se encuentra en desarrollo y QA local (`0.0.0-dev`). El camino
principal del flavor `docente-local` es una aplicación nativa para Windows:
API local, SQLite/Prisma, frontend docente y runtime Node embebido.

- La operación docente se ejecuta directamente en la PC.
- El portal alumno conserva su despliegue desacoplado para escenarios cloud.
- Docker y WSL2 pertenecen a entornos auxiliares o a otros flavors; no forman
  parte del camino operativo docente actual.

## Desarrollo local
Levantar stack base:
```bash
npm run stack:dev
```

Alternativa separada:
```bash
npm run dev:backend
npm run dev:frontend
npm run dev:frontend:alumno
npm run dev:portal
```

## Operación local de ensayo
```bash
npm run stack:prod
```

Portal local de ensayo (modo estable, destinado a laboratorio o validación puntual):
```bash
npm run portal:prod
```

Notas:
- `portal:prod` compila `apps/portal_alumno_cloud` solo si falta `dist/index.js`.
- Los accesos directos `EvaluaPro - Dev` y `EvaluaPro - Prod` aplican arranque estricto.
- Para `docente-local`, el camino feliz es `prod local` sobre Windows con salud
  de la API local, SQLite/Prisma, frontend docente y runtime embebido.
- El portal alumno se considera integracion externa/cloud y no bloquea la UI docente local.

## Servicios locales típicos
- `docente-local`: API local, SQLite/Prisma, frontend docente y runtime Node embebido.
- `portal_alumno_cloud`: componente separado para escenarios de consulta y despliegue cloud.

## Portal alumno cloud
App objetivo: `apps/portal_alumno_cloud`.

Recomendaciones:
1. Build de imagen Docker del portal.
2. Deploy a servicio administrado (ej. Cloud Run).
3. Configurar variables de entorno y API key.
4. Restringir CORS a origenes esperados.
5. Programar limpieza/retencion segun politica.

## Variables clave
Backend docente local:
- `JWT_SECRETO`
- `NODE_ENV`
- `PUERTO_API`
- `PUERTO_PORTAL`
- `PORTAL_ALUMNO_URL`
- `PORTAL_ALUMNO_API_KEY`
- `PASSWORD_RESET_ENABLED` (`0`/`1`)
- `PASSWORD_RESET_TOKEN_MINUTES`
- `PASSWORD_RESET_URL_BASE`
- `GOOGLE_OAUTH_CLIENT_ID` (si se habilita login Google)
- `REQUIRE_GOOGLE_OAUTH` (`0`/`1`, exige claves Google/Classroom cuando esta en `1`)
- `GOOGLE_CLASSROOM_CLIENT_ID` (si se habilita Classroom)
- `GOOGLE_CLASSROOM_CLIENT_SECRET` (si se habilita Classroom)
- `GOOGLE_CLASSROOM_REDIRECT_URI` (si se habilita Classroom)
- `LICENCIA_ACCOUNT_EMAIL` (cuando se exige activacion de licencia)

Portal cloud:
- `PORTAL_API_KEY`
- `CODIGO_ACCESO_HORAS`
- `CORS_ORIGENES`
- `CORREO_MODULO_ACTIVO` (`0`/`1`)
- `NOTIFICACIONES_WEBHOOK_URL` (obligatoria si `CORREO_MODULO_ACTIVO=1`)
- `NOTIFICACIONES_WEBHOOK_TOKEN` (obligatoria si `CORREO_MODULO_ACTIVO=1`)

Validación de configuración en producción:
- Backend docente exige `JWT_SECRETO`, `PORTAL_ALUMNO_URL`, `PORTAL_ALUMNO_API_KEY` y `CORS_ORIGENES` cuando se habilita integración de portal.
- Portal cloud exige `PORTAL_API_KEY`, `CORS_ORIGENES` y rechaza `CORS_ORIGENES=*`.
- Si `CORREO_MODULO_ACTIVO=1`, backend exige `NOTIFICACIONES_WEBHOOK_URL` y `NOTIFICACIONES_WEBHOOK_TOKEN`.

Frontend alumno/docente (build separado):
- `VITE_APP_DESTINO` (`alumno` | `docente`)
- `VITE_PORTAL_BASE_URL`

Referencia completa: `docs/AUTO_ENV.md`.

## Distribuible estable Windows (MSI/WiX)
Estructura:
- `packaging/wix/Product.wxs`
- `packaging/wix/Bundle.wxs`
- `packaging/wix/Fragments/*`

Build local:
```powershell
npm run msi:build
```

Build local de bundle EXE (ademas del MSI):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-msi.ps1 -IncludeBundle
```

Build local del Installer Hub oficial (bundle Burn + BA WPF):
```powershell
npm run installer:hub:build
```

Generar contratos de release (hashes + manifiesto):
```powershell
npm run installer:hashes
```

Signing gate opcional (si hay certificado en variables de entorno):
```powershell
npm run installer:sign
```

Firma interna (sin costo, para despliegue controlado):
```powershell
npm run installer:sign:internal:init
```
- Genera `dist/signing-internal/evaluapro-internal-signing.pfx` y `.cer`.
- Genera `dist/signing-internal/github-secrets.internal-signing.env` con variables para GitHub Actions.

Confiar certificado interno en equipo(s) piloto:
```powershell
npm run installer:sign:internal:trust
```

Publicar secretos en GitHub (manual):
- `EVALUAPRO_SIGN_CERT_BASE64`
- `EVALUAPRO_SIGN_CERT_PASSWORD`
- `EVALUAPRO_SIGN_TIMESTAMP_URL`

Verificar firma local:
```powershell
Get-AuthenticodeSignature .\dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v<version>.exe
Get-AuthenticodeSignature .\dist\installer\_internal\docente-local\EvaluaPro-docente-local.msi
```

Garantia de estabilidad para distribuible:
- `msi:build` ejecuta checks obligatorios antes de empaquetar:
  - `lint`
  - `typecheck`
  - `test:backend:ci`
  - `test:portal:ci`
  - `test:frontend:ci`
  - `qa:clean-architecture:check`
  - `pipeline:contract:check`
- si algun check falla, no se genera instalador.

Artefactos:
- `dist/installer/saas-completo/EvaluaPro-InstallerHub-saas-completo-v<version>.exe`
- `dist/installer/saas-completo/EvaluaPro-InstallerHub-saas-completo-v<version>.exe.sha256`
- `dist/installer/docente-local/EvaluaPro-InstallerHub-docente-local-v<version>.exe`
- `dist/installer/docente-local/EvaluaPro-InstallerHub-docente-local-v<version>.exe.sha256`
- `dist/installer/EvaluaPro-release-manifest.json`
- `dist/installer/SIGNING-NOT-PRODUCTION.txt` (solo cuando no se firma)
- `dist/installer/_internal/saas-completo/EvaluaPro-saas-completo.msi`
- `dist/installer/_internal/saas-completo/EvaluaPro-saas-completo.msi.sha256`
- `dist/installer/_internal/docente-local/EvaluaPro-docente-local.msi`
- `dist/installer/_internal/docente-local/EvaluaPro-docente-local.msi.sha256`
- `dist/installer/_internal/<flavor>/*.wixpdb`
- `dist/installer/_internal/burn-bootstrapper-app/`
- `dist/installer/_internal/installer-local-paths.json`

Contrato operativo del bootstrapper Windows:
- `EvaluaPro-InstallerHub-<flavor>-v<version>.exe` es el entrypoint publico oficial.
- se genera desde `WiX Burn` con BA personalizada `WPF .NET 8`.
- el helper `scripts/installer-burn/InstallerBurnHelper.ps1` conserva
  configuración operativa, verificación y blindaje de licencia para la ruta
  nativa de Windows.
- el legado `scripts/installer-hub/InstallerHub.ps1` fue retirado y no debe invocarse.

Prerequisitos de instalacion:
- `docente-local`:
  - Windows compatible y permisos de usuario para la instalación elegida
  - runtime Node embebido local para launcher, dashboard y tray
  - SQLite/Prisma incluido en el payload nativo
- `saas-completo`:
  - puede mantener temporalmente dependencia de `Node.js 24+` en host hasta migrar a runtime embebido
- WiX Toolset v6.0.x estable (solo para generar instalador)
- Extension BA WiX 6: resuelta automaticamente por `build-msi.ps1` (`WixToolset.Bal.wixext`).

CI de instalador Windows:
- Workflow: `.github/workflows/ci-installer-windows.yml`.
- Trigger: `workflow_dispatch` y tags con formato canónico conforme a
  `docs/TAGGING_POLICY.md`. El repositorio actual permanece en QA local y no
  publica releases automáticamente hasta superar las gates.
- Valida `test:wix:policy` + `test:installer-hub:contract`.
- Publica la BA `.NET 8`, compila MSI + bundle Burn (`-SkipStabilityChecks -IncludeBundle`), ejecuta smoke del `.exe` publico, genera hashes/manifiesto y ejecuta signing gate opcional.
- En una tag canónica aprobada publica automáticamente assets en GitHub Releases:
  - `EvaluaPro-InstallerHub-saas-completo-v<version>.exe`, `EvaluaPro-InstallerHub-saas-completo-v<version>.exe.sha256`
  - `EvaluaPro-InstallerHub-docente-local-v<version>.exe`, `EvaluaPro-InstallerHub-docente-local-v<version>.exe.sha256`
  - `EvaluaPro-release-manifest.json`
  - `antivirus-scan-report.txt`

Ruta operativa local recomendada para este equipo:
- `dist/installer/docente-local/EvaluaPro-InstallerHub-docente-local-v<version>.exe`

Autoconfiguracion durante uso:
- shortcuts Dev/Prod instalados automaticamente.
- acceso directo Prod intenta iniciar el stack minimo requerido por flavor; en `docente-local` no exige `portal`.
- instalacion/actualizacion crea accesos directos automaticamente.
- escritorio habilitado por defecto (`InstallDesktopShortcuts=1`).
- menu inicio agrega accesos operativos: Abrir Dashboard, Reiniciar Stack, Detener Todo, Reparar Entorno.

Accesos directos:
- solo Installer Hub debe instalarlos o restaurarlos;
- el dashboard y el broker no deben regenerarlos por fuera de ese flujo.

Fuera del alcance del instalador:
- credenciales y secretos de un entorno productivo real

Para `docente-local`:
- Windows ya no depende de `Node` global para operar launcher/dashboard/tray.
- `logs/installation.manifest.json` publica `runtime.embeddedNode` como contrato operativo local.

## Operacion y verificacion
- Estado rapido:
```bash
npm run status
```
- Smoke diario piloto (local + cloud):
```bash
npm run ops:smoke:pilot -- --backend-base=http://localhost:4000/api --portal-base=https://<tu-portal>/api/portal
```
- Checks previos a liberar:
```bash
npm run test:ci
npm run docs:check
```

## Notas de retencion y respaldo
- Mantener respaldo local antes de purgas cloud.
- Si se sincronizan PDFs comprimidos, monitorear peso y politica de almacenamiento.
