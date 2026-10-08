# accesos-directos/

Accesos directos (Windows) para abrir **Sistema EvaluaPro (EP)** en modo dev/prod.

- Este folder se llena/actualiza con `../scripts/create-shortcuts.ps1` durante la instalación o reparación.
- Los `.lnk` se generan localmente con rutas absolutas a la instalación activa; no se versionan ni se empaquetan desde Git.
- Los wrappers validan modo/acción/puerto (lista permitida + rango 1..65535) antes de invocar PowerShell.
- Regeneración recomendada (incluye instalación local, Desktop + Menú Inicio):
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -OutputDir accesos-directos -SyncRepoOutput -Force`
- Accesos incluidos por defecto:
  - `EvaluaPro - Dev`
  - `EvaluaPro - Prod`
  - `EvaluaPro - Abrir Dashboard`
  - `EvaluaPro - Reiniciar Stack`
  - `EvaluaPro - Detener Todo`
  - `EvaluaPro - Reparar Entorno`

Si no aparecen o el icono no se actualiza, vuelve a generar el acceso desde la instalación activa; no copies `.lnk` desde otro equipo.
