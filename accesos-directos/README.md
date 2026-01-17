# accesos-directos/

Accesos directos (Windows) para abrir **Sistema EvaluaPro (EP)** en modo dev/prod.

- Este folder se llena/actualiza con `../scripts/create-shortcuts.ps1`.
- Los `.lnk` se pueden mover al Escritorio o anclar a Inicio.

Si no aparecen o el icono no se actualiza, vuelve a generar:
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1`
