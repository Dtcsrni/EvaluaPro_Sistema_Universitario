# icons

Scripts operativos y de automatización del monorepo.

Ruta: `scripts/icons`.

## Archivos clave
- `dashboard-dev.ico`
- `dashboard-hub-app.ico`
- `dashboard-hub.ico`
- `installer-canonical.ico`
- `dashboard-prod.ico`
- `dashboard-open.ico`
- `dashboard-restart.ico`
- `dashboard-stop.ico`
- `dashboard-repair.ico`
- `tray-error.ico`
- `tray-info.ico`
- `tray-ok.ico`
- `tray-warn.ico`

## Reglas de mantenimiento
- Mantener cambios pequeños y trazables con pruebas/validación asociada.
- Actualizar documentación relacionada cuando cambie el comportamiento observable.
- Este módulo genera los activos `.ico`/PNG. El host de `docente-local` incrusta `dashboard-prod.ico` dentro de `EvaluaPro.exe`; los accesos de escritorio y Hub toman ese recurso del ejecutable, sin depender de archivos laterales ni rutas de caché.
- El manifiesto `../../config/shortcuts-manifest.json` conserva nombres e iconos para los flavors heredados; `docente-local` resuelve la instalación canónica desde `logs/installation.manifest.json`.
- El host reconcilia enlaces incorrectos al iniciar y el botón del perfil vuelve a escribir los `.lnk` de forma atómica y pide a Explorer actualizar cada elemento. Los iconos se leen del recurso embebido de `EvaluaPro.exe`, por lo que la regeneración no crea ni administra archivos `.ico` separados. No usa PowerShell ni Windows Script Host en este flujo.
- Regenerar el icono canónico del instalador cuando cambie branding:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/icons/generate-installer-canonical-icon.ps1`
- Regenerar el hero oficial del instalador cuando falte o cambie el branding:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/icons/generate-official-hero.ps1`

## Nota
- Este README fue generado automáticamente como base; ampliar con decisiones de diseño específicas del módulo cuando aplique.
