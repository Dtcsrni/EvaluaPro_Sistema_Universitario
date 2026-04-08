# Despliegue

## Estrategia general
- Operacion docente local recomendada con Docker Compose.
- En Windows, el runtime por defecto es `WSL2 + Docker Engine`; `Docker Desktop` se mantiene como compatibilidad opcional.
- Portal alumno desacoplado para despliegue cloud.

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

## Produccion local (ensayo)
```bash
npm run stack:prod
```

Portal prod local (sin watch, solo laboratorio o validacion puntual):
```bash
npm run portal:prod
```

Notas:
- `portal:prod` compila `apps/portal_alumno_cloud` solo si falta `dist/index.js`.
- Los accesos directos `EvaluaPro - Dev` y `EvaluaPro - Prod` aplican arranque estricto.
- Para `docente-local`, el camino feliz es `prod local` sobre `WSL2 + Docker` con salud de `mongo_local + api_docente_prod + web_docente_prod`.
- El portal alumno se considera integracion externa/cloud y no bloquea la UI docente local.

## Servicios locales tipicos
- `docente-local`: `mongo_local`, `api_docente_prod`, `web_docente_prod`
- `mongo_express_local`: solo soporte/diagnostico mediante profile `support`
- `portal_alumno_cloud`: no forma parte del stack obligatorio del flavor docente local

## Portal alumno cloud
App objetivo: `apps/portal_alumno_cloud`.

Recomendaciones:
1. Build de imagen Docker del portal.
2. Deploy a servicio administrado (ej. Cloud Run).
3. Configurar variables de entorno y API key.
4. Restringir CORS a origenes esperados.
5. Programar limpieza/retencion segun politica.

## Variables clave
Backend docente:
- `MONGODB_URI`
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
- `MONGODB_URI`
- `PORTAL_API_KEY`
- `CODIGO_ACCESO_HORAS`
- `CORS_ORIGENES`
- `CORREO_MODULO_ACTIVO` (`0`/`1`)
- `NOTIFICACIONES_WEBHOOK_URL` (obligatoria si `CORREO_MODULO_ACTIVO=1`)
- `NOTIFICACIONES_WEBHOOK_TOKEN` (obligatoria si `CORREO_MODULO_ACTIVO=1`)

Fail-fast en produccion:
- Backend docente exige `MONGODB_URI`, `JWT_SECRETO`, `PORTAL_ALUMNO_URL`, `PORTAL_ALUMNO_API_KEY`, `CORS_ORIGENES`.
- Portal cloud exige `MONGODB_URI`, `PORTAL_API_KEY`, `CORS_ORIGENES` y rechaza `CORS_ORIGENES=*`.
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
Get-AuthenticodeSignature .\dist\installer\EvaluaPro-InstallerHub-docente-local.exe
Get-AuthenticodeSignature .\dist\installer\_internal\EvaluaPro-docente-local.msi
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
- `dist/installer/EvaluaPro-InstallerHub-saas-completo.exe`
- `dist/installer/EvaluaPro-InstallerHub-saas-completo.exe.sha256`
- `dist/installer/EvaluaPro-InstallerHub-docente-local.exe`
- `dist/installer/EvaluaPro-InstallerHub-docente-local.exe.sha256`
- `dist/installer/EvaluaPro-release-manifest.json`
- `dist/installer/SIGNING-NOT-PRODUCTION.txt` (solo cuando no se firma)
- `dist/installer/_internal/EvaluaPro-saas-completo.msi`
- `dist/installer/_internal/EvaluaPro-saas-completo.msi.sha256`
- `dist/installer/_internal/EvaluaPro-docente-local.msi`
- `dist/installer/_internal/EvaluaPro-docente-local.msi.sha256`
- `dist/installer/_internal/*.wixpdb`
- `dist/installer/_internal/burn-bootstrapper-app/`
- `dist/installer/_internal/installer-local-paths.json`

Contrato operativo del bootstrapper Windows:
- `EvaluaPro-InstallerHub-<flavor>.exe` es el entrypoint publico oficial.
- se genera desde `WiX Burn` con BA personalizada `WPF .NET 8`.
- el helper `scripts/installer-burn/InstallerBurnHelper.ps1` conserva configuracion operativa, bootstrap de `WSL2` (`Docker Engine + Node 24` para `docente-local`), verificacion y blindaje de licencia.
- el legado `scripts/installer-hub/InstallerHub.ps1` fue retirado y no debe invocarse.

Prerequisitos de instalacion:
- runtime Docker compatible:
  - `WSL2 + Docker Engine` (default)
  - `Docker Desktop` (compatibilidad)
- `docente-local`:
  - runtime Node embebido local en Windows para launcher/dashboard/tray
  - `Node 24` provisionado dentro de la distro objetivo de `WSL2`
- `saas-completo`:
  - puede mantener temporalmente dependencia de `Node.js 24+` en host hasta migrar a runtime embebido
- WiX Toolset v6.0.x estable (solo para generar instalador)
- Extension BA WiX 6: resuelta automaticamente por `build-msi.ps1` (`WixToolset.Bal.wixext`).

CI de instalador Windows:
- Workflow: `.github/workflows/ci-installer-windows.yml`.
- Trigger: tags `v*` y `workflow_dispatch`.
- Valida `test:wix:policy` + `test:installer-hub:contract`.
- Publica la BA `.NET 8`, compila MSI + bundle Burn (`-SkipStabilityChecks -IncludeBundle`), ejecuta smoke del `.exe` publico, genera hashes/manifiesto y ejecuta signing gate opcional.
- En tags `v*` publica automáticamente assets en GitHub Releases:
  - `EvaluaPro-InstallerHub-saas-completo.exe`, `EvaluaPro-InstallerHub-saas-completo.exe.sha256`
  - `EvaluaPro-InstallerHub-docente-local.exe`, `EvaluaPro-InstallerHub-docente-local.exe.sha256`
  - `EvaluaPro-release-manifest.json`
  - `antivirus-scan-report.txt`

Ruta operativa local recomendada para este equipo:
- `dist/installer/EvaluaPro-InstallerHub-docente-local.exe`

Autoconfiguracion durante uso:
- shortcuts Dev/Prod instalados automaticamente.
- acceso directo Prod intenta iniciar el stack minimo requerido por flavor; en `docente-local` no exige `portal`.
- instalacion/actualizacion crea accesos directos automaticamente.
- escritorio habilitado por defecto (`InstallDesktopShortcuts=1`).
- menu inicio agrega accesos operativos: Abrir Dashboard, Reiniciar Stack, Detener Todo, Reparar Entorno.

Regenerar accesos directos locales (repo + escritorio + menu inicio):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Force
```

No autoconfigurable por instalador:
- provisionamiento completo del runtime Docker fuera del bootstrap guiado.
- credenciales/secretos de entorno de produccion real.

Para `docente-local`:
- Windows ya no depende de `Node` global para operar launcher/dashboard/tray.
- `logs/installation.manifest.json` publica `runtime.embeddedNode` y `runtime.wsl` como contrato operativo local.

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
