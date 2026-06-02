## Política operativa: cambios que pueden reiniciar Host o VM

Propósito
- Evitar reinicios accidentales del host o de VMs que interrumpan trabajo crítico.

Alcance
- Cualquier script o comando en el repo que ejecute acciones que requieran reinicio (`Enable-WindowsOptionalFeature`, instalaciones de sistema, actualizaciones de features) o que puedan mutar una VM de pruebas (snapshots/restore/start/stop) debe cumplir esta política.

Requisitos mínimos
1. Confirmación explícita: cualquier script que pueda reiniciar debe pedir confirmación interactiva y requerir la palabra `CONFIRM` o el flag `-Force` para proceder en modo no interactivo.
2. Preflight de procesos: listar procesos con mayor consumo CPU/mem y mostrar advertencia si hay procesos con actividad reciente (ej. >1% CPU o archivos abiertos en carpetas de trabajo). El operador debe revisar y confirmar.
3. Snapshot / Checkpoint: antes de tocar una VM se debe crear un snapshot (`Checkpoint-VM`) o documentar el punto de retorno en caso de host. El script debe crear el checkpoint automáticamente si aplica.
4. Ventana de mantenimiento / Notificación: si el host es compartido, notificar a los interesados (por ejemplo, abrir un ticket o escribir en `reports/ops/operations.log`) antes de proceder.
5. Dry-run y registro: todo script debe soportar `-WhatIf`/`-DryRun` y registrar la acción en `reports/ops/` con timestamp, usuario y comando ejecutado.
6. Distinción Host vs VM: los scripts deben requerir explícitamente `-Target Host|VM` o detectar el contexto. Si el cambio es para la VM, ejecutar los cambios dentro de la VM, no en el host.

Checklist para operadores
- Ejecutar en modo `-WhatIf` o `-DryRun` primero.
- Verificar que existe checkpoint `pre-...` y, si no, crearla.
- Confirmar que no hay tareas críticas en ejecución (builds, tests, back-ups).
- Ejecutar con `-Force` sólo si se aceptó la interrupción.

Documentación adicional
- Scripts seguros recomendados: `scripts/safe-enable-wsl2.ps1` (usa la política anterior).
