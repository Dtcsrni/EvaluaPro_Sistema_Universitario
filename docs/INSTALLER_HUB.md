# Installer Hub (Windows)

Bootstrapper online para instalacion desde cero de EvaluaPro en entornos docentes Windows.

## Objetivo
- Ejecutar instalacion, reparacion o desinstalacion desde una GUI guiada.
- Verificar y autoinstalar prerequisitos (Node.js y Docker Desktop) desde fuentes oficiales.
- Descargar la release objetivo y validar integridad criptografica (`SHA-256`).
- Ejecutar MSI con `msiexec` y validar estado final de modulos criticos.
- Dejar trazabilidad en logs por sesion para soporte tecnico.

## Flujo funcional
1. Elevacion UAC y validacion inicial.
2. Splash introductorio y seleccion guiada.
3. Deteccion de modo:
   - `install`
   - `repair`
   - `uninstall`
4. Analisis de requisitos de equipo (SO, arquitectura, red, disco, prerequisitos).
5. Instalacion silenciosa de prerequisitos faltantes.
6. Resolucion de release y descarga de `EvaluaPro.msi`.
7. Verificacion de hash con `EvaluaPro.msi.sha256`.
8. Ejecucion de `msiexec` segun modo.
9. Configuracion operativa obligatoria (escritura de `.env` con variables criticas de backend/portal, recuperacion de contrasena y OAuth).
10. Verificacion post-instalacion.
11. Blindaje local de licencia:
   - almacenamiento cifrado de token con DPAPI (`LocalMachine`)
   - baseline de integridad local (hash SHA-256 + MAC)
   - activacion opcional contra `/api/comercial-publico/licencias/activar`
11. Pantalla de cierre con acciones (abrir dashboard, ver logs, reintentar).

## Estructura y componentes
- Entry UI:
  - `scripts/installer-hub/InstallerHub.ps1`
- Modulos:
  - `scripts/installer-hub/modules/ReleaseResolver.psm1`
  - `scripts/installer-hub/modules/PrereqDetector.psm1`
  - `scripts/installer-hub/modules/PrereqInstaller.psm1`
  - `scripts/installer-hub/modules/ProductInstaller.psm1`
  - `scripts/installer-hub/modules/OperationalConfig.psm1`
  - `scripts/installer-hub/modules/PostInstallVerifier.psm1`
  - `scripts/installer-hub/modules/LicenseClientSecurity.psm1`

## Contratos de release
Assets esperados en GitHub Release:
- `EvaluaPro-saas-completo.msi`
- `EvaluaPro-saas-completo.msi.sha256`
- `EvaluaPro-saas-completo-Setup.exe`
- `EvaluaPro-saas-completo-Setup.exe.sha256`
- `EvaluaPro-InstallerHub-saas-completo.exe`
- `EvaluaPro-InstallerHub-saas-completo.exe.sha256`
- `EvaluaPro-docente-local.msi`
- `EvaluaPro-docente-local.msi.sha256`
- `EvaluaPro-docente-local-Setup.exe`
- `EvaluaPro-docente-local-Setup.exe.sha256`
- `EvaluaPro-InstallerHub-docente-local.exe`
- `EvaluaPro-InstallerHub-docente-local.exe.sha256`
- `EvaluaPro-release-manifest.json`

Manifest de prerequisitos versionado:
- `config/installer-prereqs.manifest.json`

Manifest de release generado:
- `dist/installer/EvaluaPro-release-manifest.json`
- campos minimos: `version`, `channel`, `msiUrl`, `msiSha256Url`, `publishedAt`
- campos extendidos piloto: `build.version`, `build.commit`, `artifacts[]` (`name`, `sha256`, `signed`), `deployment.target`

## Build local
```powershell
npm run installer:hub:build
npm run installer:hashes
npm run installer:sign
```

Tras `npm run installer:hub:build`, el repo deja un manifiesto local con rutas absolutas en:
- `dist/installer/installer-local-paths.json`

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
2. instalacion de WiX CLI
3. gates de contrato (`test:wix:policy`, `test:installer-hub:contract`)
4. build MSI + bundle
5. build Installer Hub
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
- `40`: validacion post-instalacion fallida.
- `50`: blindaje local de licencia/integridad fallido.

## Manejo de fallos y casos limite
- Sin internet: bloqueo temprano y opcion de reintento.
- Asset o API no disponible: reintentos controlados y mensaje accionable.
- Hash invalido: aborta y purga artefacto descargado.
- MSI con codigo no-cero: mapeo a mensaje entendible + log tecnico.
- Uninstall sin instalacion previa: salida idempotente en exito.
- Limpieza total: requiere confirmacion explicita.

## Operacion recomendada para soporte
1. Revisar logs de sesion Installer Hub.
2. Verificar versiones y hashes de los assets descargados.
3. Correlacionar codigo de salida con el modulo fallido.
4. Ejecutar reparacion antes de desinstalacion en incidentes no destructivos.
