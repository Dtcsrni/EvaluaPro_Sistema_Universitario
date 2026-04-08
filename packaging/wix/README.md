# WiX Packaging (MSI)

Empaquetado Windows para primera version estable distribuible.
Responsable: `I.S.C. Erick Renato Vega Ceron`.

## Estructura
- `Product.wxs`: MSI principal (`EvaluaPro.msi`).
- `Bundle.wxs`: bundle publico por flavor (`EvaluaPro-InstallerHub-<flavor>.exe`) basado en WiX Burn.
- `BurnBootstrapperApp/`: Bootstrapper Application personalizada en `WPF .NET 8`.
- `Fragments/AppFiles.wxs`: archivos instalados.
- `Fragments/Shortcuts.wxs`: accesos directos Dev/Prod.
- `Fragments/Cleanup.wxs`: limpieza de logs/menu en uninstall.

## Requisitos
- WiX Toolset v6.0.x estable (`wix` en PATH).
- Node.js 24+ para tareas de build/empaquetado en host.
- Runtime Docker compatible para Windows:
  - WSL2 + Docker Engine (default).
  - Docker Desktop (compatibilidad opcional).
- Para `docente-local` instalado:
  - Windows usa runtime Node embebido privado del producto.
  - `WSL2` debe quedar con `Docker Engine + Node 24`.
- Para compilar bundle, el script resuelve automaticamente la extension BA de WiX 6 (`WixToolset.Bal.wixext` / `WixToolset.BootstrapperApplications.wixext.dll`).

## Build
Desde la raiz:

```powershell
npm run msi:build
```

El build MSI ejecuta checks de estabilidad antes de empaquetar.

`npm run msi:build`:
- siempre compila `EvaluaPro.msi`.
- compila el bundle Burn publico solo si se habilita bundle:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-msi.ps1 -IncludeBundle`
  - o `EVALUAPRO_BUILD_BUNDLE=1`.

Build oficial del entrypoint Windows:

```powershell
npm run installer:hub:build
```

Ese comando publica la BA `WPF .NET 8`, valida icono canónico multi-size y genera:
- `EvaluaPro-InstallerHub-saas-completo.exe`
- `EvaluaPro-InstallerHub-docente-local.exe`

Politica operativa:
- `EvaluaPro-InstallerHub-<flavor>.exe` es la fuente publica oficial de instalacion Windows.
- el MSI sigue siendo el payload principal del bundle y puede conservarse como artefacto tecnico interno.

Artefactos tecnicos esperados:
- `dist/installer/_internal/EvaluaPro-saas-completo.msi`
- `dist/installer/_internal/EvaluaPro-docente-local.msi`
- `dist/installer/_internal/*.wixpdb`
- `dist/installer/_internal/burn-bootstrapper-app/`

## CI Windows
- Workflow: `.github/workflows/ci-installer-windows.yml`.
- Se ejecuta en `main`, `tags v*` y manual.
- Publica BA `.NET 8`, compila MSI + bundle Burn (`-SkipStabilityChecks -IncludeBundle`) y publica artefactos.

## Notas
- El acceso directo **Prod** ejecuta:
  - `launcher-tray-hidden.vbs prod 4519`
- El acceso directo **Dev** ejecuta:
  - `launcher-tray-hidden.vbs dev 4519`
- Instalacion/actualizacion:
  - genera automaticamente accesos directos de menu inicio.
  - por defecto tambien genera accesos directos en escritorio (`InstallDesktopShortcuts=1`).
  - por defecto tambien mantiene accesos en menu inicio (`InstallStartMenuShortcuts=1`).
  - los overrides MSI siguen existiendo para automatizacion interna, pero no forman parte del flujo soportado a usuario final.
- El instalador aplica upgrade in-place si detecta una version previa.
- La instalacion es per-machine y solicita elevacion (UAC) al inicio.
- El instalador valida prerequisitos no autoconfigurables:
  - runtime Docker compatible (`WSL2 + Docker Engine` o `Docker Desktop`)
  - para `docente-local`, runtime Node embebido local valido y `Node 24` dentro de la distro `WSL2`
  - para `saas-completo`, `Node.js 24+` host mientras ese flavor no migre a runtime embebido
- La BA personalizada orquesta:
  - deteccion de prerequisitos,
  - `install|repair|uninstall`,
  - chain MSI manejado por Burn,
  - helper post-install para `.env`, `update-config.json`, bootstrap WSL2, verificacion y blindaje local de licencia.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia local del modulo/carpeta dentro del monorepo.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
