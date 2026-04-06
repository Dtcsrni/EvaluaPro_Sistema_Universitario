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
- Regenerar el icono canónico del instalador cuando cambie branding:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/icons/generate-installer-canonical-icon.ps1`
- Regenerar el hero oficial del instalador cuando falte o cambie el branding:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/icons/generate-official-hero.ps1`

## Nota
- Este README fue generado automáticamente como base; ampliar con decisiones de diseño específicas del módulo cuando aplique.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Automatizaciones de operacion, QA, release y cumplimiento.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
