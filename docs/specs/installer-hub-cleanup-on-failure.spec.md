# SPEC-INSTALLER-ROLLBACK-CLEANUP: Limpieza y Rollback Automático ante Fallos de Instalación

## 1. Contexto y Problema
Si el proceso de instalación de EvaluaPro se interrumpe, cancela o falla en cualquiera de sus etapas (MSI, extracción de payload, configuración nativa o post-install helper), el sistema debe quedar en un estado completamente limpio, sin carpetas huérfanas, sin accesos directos rotos, sin tareas incompletas y sin registros que induzcan falsamente al modo "Reparar".

## 2. Requerimientos Funcionales
1. **Rollback en Helper Post-Install (`InstallerBurnHelper.ps1`)**:
   - En caso de error fatal (`catch` en `Invoke-PostInstall`), se debe invocar `Invoke-RollbackOnFailure`.
   - Si no existe un `installation.manifest.json` completo y exitoso, se deben retirar todos los archivos y subdirectorios creados durante la instalación fallida, preservando únicamente la base de datos previa (`data/`) si existía.
2. **Rollback en Bootstrapper Application (`EvaluaProBootstrapperApplication.cs`)**:
   - `FinalizeFailure` debe ejecutar `RollbackFailureResidues` cuando la operación actual sea `install`.
   - Si el manifiesto de instalación no existe, se limpian los residuos creados en el directorio objetivo.
3. **Ausencia de Estado Huérfano**:
   - Una instalación no completada no debe dejar el sistema en un estado que muestre el modo "Reparar" al reiniciar el instalador.

## 3. Criterios de Aceptación
- Fallos en post-install no dejan archivos huérfanos en `$targetDir`.
- Contrato de pruebas `npm run test:installer-hub:contract` pasa al 100%.
