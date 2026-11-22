# WiX Packaging (MSI)

Empaquetado Windows del único perfil soportado: `docente-local`.

## Componentes

- `Product.wxs`: MSI per-user para Windows.
- `Bundle.wxs`: bundle público de WiX Burn.
- `BurnBootstrapperApp/`: interfaz WPF .NET del Installer Hub.
- `Fragments/`: archivos y accesos directos instalados.

El runtime distribuido usa Node embebido, API local y SQLite. No requiere MongoDB,
Docker ni WSL. Los paquetes de contenedor y el flavor SaaS heredado fueron retirados.

## Requisitos de build

- Windows.
- Node.js 24+ para build y empaquetado.
- WiX Toolset 7 estable y licencia `wix7` aceptada explícitamente.
- .NET SDK requerido por el host y el bootstrapper.

## Build

Desde la raíz del repositorio:

```powershell
npm run installer:hub:build
```

El comando construye únicamente `docente-local` y produce el MSI, bundle y manifiesto
en `dist/installer/`. El script no modifica la instalación activa; el E2E real del
instalador es una tarea local separada y requiere `-IUnderstandThisMutatesPc`.

## CI

- `.github/workflows/ci-installer-windows.yml` compila el bundle y ejecuta sus gates de
  build, huella, smoke GUI y antivirus.
- Las E2E de instalación deben ejecutarse localmente con el bundle candidato exacto.

Los accesos directos de `docente-local` usan `EvaluaPro.exe`, que aloja la ventana,
la bandeja y los servicios locales. Los scripts de launcher heredados no son parte
del paquete distribuido.
