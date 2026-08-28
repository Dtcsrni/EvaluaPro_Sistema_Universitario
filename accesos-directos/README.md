# accesos-directos/

Accesos directos (Windows) para abrir **Sistema EvaluaPro (EP)** en modo dev/prod.

- Este folder se llena/actualiza con `../scripts/create-shortcuts.ps1`.
- Los `.lnk` se generan con rutas absolutas a wrappers para evitar fallos por directorio de trabajo.
- Los wrappers validan modo/acción/puerto (lista permitida + rango 1..65535) antes de invocar PowerShell.
- Regeneración recomendada (incluye Desktop + Menú Inicio):
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Force`
- Accesos incluidos por defecto:
  - `EvaluaPro - Dev`
  - `EvaluaPro - Prod`
  - `EvaluaPro - Abrir Dashboard`
  - `EvaluaPro - Reiniciar Stack`
  - `EvaluaPro - Detener Todo`
  - `EvaluaPro - Reparar Entorno`

Si no aparecen o el icono no se actualiza, vuelve a generar:
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Force`

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia local del modulo/carpeta dentro del monorepo.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-08-28.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
