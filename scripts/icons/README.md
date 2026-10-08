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
- Este módulo solo genera activos `.ico`/PNG. No crea, modifica ni elimina accesos `.lnk`.
- La fuente única de verdad de accesos es `../../config/shortcuts-manifest.json` y el único escritor es `../create-shortcuts.ps1`.
- La reparación se ejecuta con `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Force`; el script falla cerrado si falta el host nativo o alguna dependencia.
- Regenerar el icono canónico del instalador cuando cambie branding:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/icons/generate-installer-canonical-icon.ps1`
- Regenerar el hero oficial del instalador cuando falte o cambie el branding:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/icons/generate-official-hero.ps1`

## Nota
- Este README fue generado automáticamente como base; ampliar con decisiones de diseño específicas del módulo cuando aplique.
