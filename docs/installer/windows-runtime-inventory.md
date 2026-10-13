# Inventario de scripting Windows en EvaluaPro

Fecha de revisión: 2026-10-12. Alcance: instalación pública `docente-local` y procesos iniciados al abrir su app/Hub. El inventario distingue lo que se empaqueta para el docente de las herramientas de build y los flavors heredados.

| Superficie | Estado en `docente-local` | Evidencia / motivo |
| --- | --- | --- |
| Accesos directos de la app y el Hub | Sustituido por ejecutables nativos | `packaging/wix/Fragments/Shortcuts.wxs` inicia `EvaluaPro.exe`; el Hub pasa `--installer-hub`. |
| Reconciliación de accesos al arrancar la app | Eliminada | El AppHost ya no ejecuta `create-shortcuts.ps1`; WiX/MSI es el dueño de crear y actualizar accesos. |
| Detección, post instalación y limpieza tras desinstalación de Burn | Sustituido por .NET | `NativeInstallerHelper` se ejecuta como modo interno del mismo ejecutable firmado de la BA. Usa el contrato JSON con timeout, respuesta correlacionada y cancelación del árbol. |
| Scripts PowerShell/WSH en el MSI y payload docente | Excluidos | `AppFiles.wxs` ya no cosecha los módulos del helper y `New-DocentePayloadArchive` omite `.ps1`, `.psm1`, `.vbs` y `scripts/installer-burn`. |
| Actualización iniciada desde el Hub | Nativa; Burn conserva el cambio de instalación | El AppHost comprueba la release estable y solicita confirmación; después valida paquete y firma y lanza el bundle Burn firmado. |
| Construcción de MSI/bundle y tareas locales de empaquetado | Se conserva PowerShell | `scripts/build-msi.ps1` orquesta WiX, firma y tareas de Windows. Es tooling de desarrollo/CI, no se ejecuta al abrir la app ni se distribuye en el paquete docente. |
| Flavors distintos de `docente-local` y scripts de mantenimiento/QA | Se conserva con alcance separado | WiX conserva payloads/launchers PowerShell para ramas de flavor heredadas y automatización de pruebas que aún dependen de APIs/herramientas Windows. No forman parte de los accesos ni del paquete docente público. |

## Límites de la validación

- La compilación de la BA .NET y los contratos automatizados confirman estructura y build, no una instalación real.
- Antes de declarar migración completa falta ejecutar el build WiX del flavor público y smoke/E2E en Windows para instalación nueva, actualización desde launchers antiguos, reparación, cancelación y desinstalación con preservación de datos.
- La migración mantiene el MSI/Burn como orquestador. El helper prepara el payload docente ya contenido en el MSI y confirma el runtime después del `Apply`; no inicia una segunda elevación ni un servicio persistente.
