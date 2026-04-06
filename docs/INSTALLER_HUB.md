# Installer Hub (Windows)

Bootstrapper oficial de Windows para instalacion, reparacion y desinstalacion de EvaluaPro.
La superficie publica ahora es `WiX Burn + Bootstrapper Application WPF .NET 8 + helper PowerShell headless`.

## Objetivo
- Ejecutar instalacion, reparacion o desinstalacion desde una GUI guiada.
- Verificar y preparar prerequisitos de Windows con `WSL2 + Docker Engine` como default y `Docker Desktop` como compatibilidad opcional.
- Encadenar el `MSI` por medio de `Burn` con elevacion, cache, repair/uninstall y logging nativos.
- Ejecutar configuracion operativa, activacion de licencia y validacion final con helper controlado bajo contrato JSON.
- Dejar trazabilidad en logs por sesion para soporte tecnico.

## Flujo funcional
1. Elevacion UAC administrada por `WiX Burn`.
2. Apertura de la BA `WPF .NET 8` y seleccion guiada.
3. Deteccion de modo:
   - `install`
   - `repair`
   - `uninstall`
4. Analisis de requisitos de equipo desde helper Burn (`detect-prereqs`) con estado visual de:
   - SO/arquitectura/disco/red
   - `Node.js`
   - runtime Docker compatible
5. Planificacion y ejecucion del chain MSI por Burn.
6. Configuracion operativa obligatoria en helper post-install (`post-install`).
7. Verificacion post-instalacion.
8. Blindaje local de licencia:
   - almacenamiento cifrado de token con DPAPI (`LocalMachine`)
   - baseline de integridad local (hash SHA-256 + MAC)
   - activacion opcional contra `/api/comercial-publico/licencias/activar`
9. Pantalla de cierre con acciones (ver logs, reintentar, cerrar).

## Estructura y componentes
- Bundle publico:
  - `packaging/wix/Bundle.wxs`
- Bootstrapper Application:
  - `packaging/wix/BurnBootstrapperApp/EvaluaPro.BurnBootstrapperApp.csproj`
  - `packaging/wix/BurnBootstrapperApp/EvaluaProBootstrapperApplication.cs`
  - `packaging/wix/BurnBootstrapperApp/MainWindow.xaml`
- Helper headless:
  - `scripts/installer-burn/InstallerBurnHelper.ps1`
- Modulos:
  - `scripts/installer-hub/modules/PrereqDetector.psm1`
  - `scripts/installer-hub/modules/Common.psm1`
  - `scripts/installer-hub/modules/OperationalConfig.psm1`
  - `scripts/installer-hub/modules/PostInstallVerifier.psm1`
  - `scripts/installer-hub/modules/LicenseClientSecurity.psm1`

## Contratos de release
Assets publicos esperados en GitHub Release:
- `EvaluaPro-InstallerHub-saas-completo.exe`
- `EvaluaPro-InstallerHub-saas-completo.exe.sha256`
- `EvaluaPro-InstallerHub-docente-local.exe`
- `EvaluaPro-InstallerHub-docente-local.exe.sha256`
- `EvaluaPro-release-manifest.json`

Artefactos internos de build:
- `dist/installer/_internal/EvaluaPro-<flavor>.msi`
- `dist/installer/_internal/EvaluaPro-<flavor>.msi.sha256`
- `dist/installer/_internal/*.wixpdb`
- `dist/installer/_internal/burn-bootstrapper-app/` como publish temporal de la BA durante el build.

Manifest de prerequisitos versionado:
- `config/installer-prereqs.manifest.json`

Manifest de release generado:
- `dist/installer/EvaluaPro-release-manifest.json`
- campos minimos: `version`, `channel`, `assetName`, `sha256AssetName`, `publishedAt`
- campos extendidos piloto: `build.version`, `build.commit`, `artifacts[]` (`name`, `sha256`, `signed`), `deployment.target`

## Build local
```powershell
npm run installer:hub:build
npm run installer:hashes
npm run installer:sign
```

`npm run installer:hub:build`:
- publica la BA `WPF .NET 8`,
- compila `MSI + Bundle Burn` por flavor,
- genera el entrypoint publico `EvaluaPro-InstallerHub-<flavor>.exe`.

Tras `npm run installer:hub:build`, el repo deja un manifiesto local con rutas absolutas en:
- `dist/installer/_internal/installer-local-paths.json`

En este repo/equipo, el ejecutable recomendado para instalacion docente local queda en:
- `dist/installer/EvaluaPro-InstallerHub-docente-local.exe`

## Configuracion operativa obligatoria en instalacion
- El Hub detecta automaticamente valores existentes desde `.env` previo (si existe) y los precarga en la UI.
- Si falta configuracion critica, el flujo falla en `configuracion_operativa` (fail-fast) y no permite dejar instalacion incompleta.
- Defaults estandar recomendados (si no hay config previa):
  - `MONGODB_URI=mongodb://mongo_local:27017/evaluapro`
  - `NODE_ENV=production`
  - `PUERTO_API=4000`
  - `PUERTO_PORTAL=4518`
  - `CORS_ORIGENES=http://localhost:4173,http://127.0.0.1:4173`
  - `PORTAL_ALUMNO_URL=https://portal-alumno.example.edu` (debe ajustarse a URL real)
  - `PORTAL_ALUMNO_API_KEY` y `PORTAL_API_KEY`: si faltan, se autogenera una clave compartida.
  - `update.channel=stable`, `requireSha256=true`.
- Variables cubiertas por instalador:
  - backend/portal: `MONGODB_URI`, `JWT_SECRETO`, `CORS_ORIGENES`, `PORTAL_ALUMNO_URL`, `PORTAL_ALUMNO_API_KEY`, `PORTAL_API_KEY`
  - entorno/stack local: `NODE_ENV`, `PUERTO_API`, `PUERTO_PORTAL`
  - recuperacion segura: `PASSWORD_RESET_ENABLED`, `PASSWORD_RESET_TOKEN_MINUTES`, `PASSWORD_RESET_URL_BASE`
  - OAuth/Google: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_CLASSROOM_CLIENT_ID`, `GOOGLE_CLASSROOM_CLIENT_SECRET`, `GOOGLE_CLASSROOM_REDIRECT_URI`, `REQUIRE_GOOGLE_OAUTH`
  - correo: `CORREO_MODULO_ACTIVO`, `NOTIFICACIONES_WEBHOOK_URL`, `NOTIFICACIONES_WEBHOOK_TOKEN`
  - licencia: `ApiComercialBaseUrl`, `TenantId`, `CodigoActivacion`, `RequireLicenseActivation`, `LICENCIA_ACCOUNT_EMAIL`
  - actualizaciones automaticas: `channel`, `owner`, `repo`, `assetName`, `sha256AssetName`, `requireSha256`, `feedUrl` en `config/update-config.json`

Activacion segura opcional al instalar (GUI o headless):
- `-ApiComercialBaseUrl`
- `-TenantId`
- `-CodigoActivacion`

Si se proporcionan `TenantId` y `CodigoActivacion`, el Hub activa licencia y guarda token cifrado con DPAPI.
Para cliente instalable macOS (cuando aplique), la estrategia equivalente es almacenamiento en Keychain del sistema.
Utilitario cross-platform de referencia: `scripts/comercial/secure-license-store.mjs` (DPAPI/Keychain).

## Pipeline CI Windows
Workflow: `.github/workflows/ci-installer-windows.yml`

Etapas principales:
1. `npm ci`
2. instalacion de `.NET SDK 8` y WiX CLI
3. gates de contrato (`test:wix:policy`, `test:installer-hub:contract`)
4. publish BA + build MSI + bundle Burn
5. smoke del ejecutable publico empaquetado
6. generacion de hashes y release manifest
7. signing gate opcional
8. publicacion de artefactos y release assets

Regla de publicacion:
- tags `v*` publican release assets.
- tags con `alpha`, `beta` o `rc` se marcan como `prerelease`.
- tags sin esos sufijos se marcan como release estable (`latest`).

## Exit codes (estandarizados)
- `0`: exito.
- `10`: prerequisitos no cumplidos tras intento.
- `20`: descarga o verificacion fallida.
- `30`: instalacion MSI fallida.
- `35`: configuracion operativa fallida.
- `40`: validacion post-instalacion fallida.
- `50`: blindaje local de licencia/integridad fallido.

## Manejo de fallos y casos limite
- Si falta runtime Docker compatible:
  - priorizar `WSL2 + Docker Engine`;
  - fallback permitido a `Docker Desktop`;
  - generar y seguir la guía local de bootstrap WSL2/Docker Engine emitida por el Hub;
  - validar siempre por CLI (`docker version`, `docker context`, `wsl --status`) y no por GUI.
- Sin internet: bloqueo temprano y opcion de reintento.
- Asset o API no disponible: reintentos controlados y mensaje accionable.
- Hash invalido: aborta y purga artefacto descargado.
- MSI con codigo no-cero: mapeo a mensaje entendible + log tecnico.
- Uninstall sin instalacion previa: salida idempotente en exito.
- Limpieza total: requiere confirmacion explicita.

## Flags de bootstrap runtime Docker
- `EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL=1`:
  - habilita bootstrap semiautomatico;
  - ejecuta solo pasos host marcados como `autoRunnable`;
  - siempre conserva guia local para pasos manuales restantes.
- `EVALUAPRO_INSTALLER_WSL_DISTRO=<distro>`:
  - fija distro objetivo para bootstrap cuando no hay distro de usuario detectada.
- Solo para pruebas/contrato:
  - `EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE`
  - `EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP`
  - `EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP`
  - `EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE_AFTER_BOOTSTRAP`
  - `EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE_AFTER_AUTO`

## Operacion recomendada para soporte
1. Revisar logs de sesion Installer Hub.
2. Verificar versiones y hashes de los assets descargados.
3. Correlacionar codigo de salida con el modulo fallido.
4. Ejecutar reparacion antes de desinstalacion en incidentes no destructivos.
