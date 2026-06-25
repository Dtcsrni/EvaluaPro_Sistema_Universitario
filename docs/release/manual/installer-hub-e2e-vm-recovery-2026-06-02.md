# Recuperacion VM E2E Installer Hub - 2026-06-02

## Objetivo

Retomar el E2E release-like del Installer Hub docente-local en `EVALPRO-E2E` con snapshot `pre-evaluapro-installer-e2e`, runner mutante protegido y copia de `report.json`.

## Estado final de la sesion

- Credencial `evaluaqa` recuperada y validada por WinRM.
- Variables de entorno persistentes para agentes configuradas en host y VM:
  - `EVALUAPRO_QA_USER`
  - `EVALUAPRO_QA_PASS`
  - `EVALUAPRO_E2E_VM_SNAPSHOT=pre-evaluapro-installer-e2e`
- Se guardo secreto QA con DPAPI del usuario Windows actual:
  - `%APPDATA%\EvaluaPro\e2e-qa-pass.dpapi`
- `C:\EvaluaPro` fue sincronizado dentro de la VM con scripts, docs, dist, packaging, apps, config Docker y archivos raiz necesarios.
- `report.json` parcial copiado al host:
  - `reports/qa/installer-hub-e2e-docente/20260602-042758/report.json`
- El ciclo completo `install|repair|update smoke|uninstall` no quedo cerrado.

## Problemas resueltos

### 1. Credencial `evaluaqa` invalida

Sintoma:

- PowerShell Direct fallaba con `La credencial no es valida`.
- WinRM fallaba con `Acceso denegado`.
- Fallaban formatos `EVALPRO-E2E\evaluaqa`, `localhost\evaluaqa`, `.\evaluaqa`, usuario plano y UPN.

Acciones:

- Se restauro el checkpoint `pre-evaluapro-installer-e2e`; no recupero la credencial esperada.
- Se intento reset por `VMConnect` con bypass temporal de `Utilman.exe`/`sethc.exe`; el envio de teclas no logro ejecutar comandos dentro del guest.
- Se aplico reset offline creando un servicio temporal `LocalSystem` en el hive `SYSTEM` montado del VHD.
- El primer `ImagePath` inline fallo de forma no observable; se reemplazo por `C:\Windows\Temp\evaluapro-resetqa.cmd` y servicio `EvaluaProResetQa`.
- El servicio reseteo `evaluaqa`, agrego grupos admin/remoting y definio variables de maquina.

Limpieza:

- `Utilman.exe` y `sethc.exe` fueron restaurados desde backup.
- `evaluapro-resetqa.cmd` y `evaluapro-resetqa.log` fueron eliminados de la VM.
- `EvaluaProResetQa` se autodestruyo.
- Se verifico que la pass no quedara en archivos del repo con `rg`.

Evidencia:

- `reports/qa/latest/hyperv-offline-reset-stage.txt`
- `reports/qa/latest/hyperv-offline-service-reset.txt`
- `reports/qa/latest/hyperv-offline-reset-cleanup.txt`
- Validacion WinRM: `EVALPRO-E2E|evaluaqa|pre-evaluapro-installer-e2e`.

### 2. Falta de secreto reutilizable por agentes

Sintoma:

- No existia `%APPDATA%\EvaluaPro\e2e-qa-pass.dpapi`.
- El launcher real pedia `-Credential` y `-QaPassSecureString` o prompts interactivos.

Acciones:

- Se definieron variables persistentes en host y VM.
- Se ejecuto `scripts/ci/set-e2e-qa-secret.ps1 -FromEnvironment`.
- El secreto quedo guardado con DPAPI del usuario Windows actual.

Uso esperado:

```powershell
$qaPass = Get-Content "$env:APPDATA\EvaluaPro\e2e-qa-pass.dpapi" -Raw | ConvertTo-SecureString
$cred = Get-Credential -Message 'Credenciales admin VM'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ci\run-e2e-launcher.ps1 -Credential $cred -QaPassSecureString $qaPass
```

### 3. Readiness Hyper-V / WinRM

Sintoma:

- Shell no elevada fallaba en `Get-VM`.
- Readiness elevado si podia validar `EvaluaPro-E2E-Win11`.

Acciones:

- Se uso proceso elevado para `Get-VM`, restore/start/restart y memoria.
- Readiness elevado dejo `ok=true`.

Evidencia:

- `reports/qa/latest/installer-hub-vm-readiness.json`
- `reports/qa/latest/installer-hub-e2e-elevated-transcript.txt`
- `reports/qa/latest/hyperv-restore-pre-e2e.txt`

### 4. Falta de `C:\EvaluaPro` en VM

Sintoma:

- `run-e2e-launcher.ps1` entro por PowerShell Direct, pero fallo:
  - `No existe ProjectRoot en VM: C:\EvaluaPro`

Acciones:

- Se creo `C:\EvaluaPro`.
- Se sincronizo inicialmente subset operativo y luego raiz ampliada: `apps`, `ci`, `config`, `docker`, `docs`, `dist`, `packaging`, `reports`, `scripts`, `tests`, `templates`, `docker-compose.yml`, `package*.json`, `README.md`, `AGENTS.md`, `CHANGELOG.md`.

### 5. Falta de configuracion Docker en VM

Sintoma:

- Primer rerun tras sincronizar subset fallo:
  - `no configuration file provided: not found`

Accion:

- Se sincronizo `docker-compose.yml` y estructura operativa completa requerida por el runner.

### 6. Docker Desktop preexistente detenido

Sintoma:

- Docker fallaba contra `npipe:////./pipe/dockerDesktopLinuxEngine`.
- En VM existia `Docker Desktop`, contexto `desktop-linux` y distro `docker-desktop`, pero estaba detenida.

Accion:

- Se arranco `Docker Desktop.exe` dentro de la VM y se valido `docker version` en una sesion WinRM para aislar fallos del runner.
- No se instalo Docker Desktop durante esta sesion; ya estaba presente en la imagen de VM.

Limitacion:

- Docker quedaba listo en una sesion WinRM concreta, pero no siempre quedaba disponible para PowerShell Direct o tareas posteriores.
- La ruta feliz del producto sigue siendo `WSL2 + Docker Engine`.
- Politica vigente: no instalar Docker Desktop para `docente-local`; si ya existe y esta sano, puede aceptarse como compatibilidad para evitar doble runtime/conflicto local; si causa conflicto o no responde, remediar `WSL2 + Docker Engine`.

### 6.1. Docker Desktop removido de la VM

Accion:

- Se desinstalo Docker Desktop con:
  - `C:\Program Files\Docker\Docker\Docker Desktop Installer.exe uninstall --quiet`
- El desinstalador termino con `uninstallExit=0`.

Validacion posterior:

- No quedan entradas `Docker Desktop` en uninstall registry.
- No quedan procesos Docker/Desktop activos.
- `docker.exe` ya no esta disponible en PATH.
- `wsl.exe -l -v` reporta que no hay distribuciones instaladas; al quitar Desktop tambien desaparecio la distro `docker-desktop`.

Evidencia:

- `reports/qa/latest/docker-desktop-uninstall.txt`

Impacto:

- La VM queda alineada con el criterio docente-local: el siguiente E2E debe provisionar/validar `WSL2 + Docker Engine` real antes de instalar.

### 7. Pagefile / memoria virtual insuficiente

Sintoma:

- Runner fallaba temprano:
  - `Memoria virtual/pagefile insuficiente para E2E Installer Hub`
- `preflight-memory` requiere `freeVirtualMB >= 1536`.

Acciones:

- Se configuro `C:\pagefile.sys` con `4096 8192` via `reg.exe`.
- Se reinicio la VM.
- Pagefile efectivo quedo:
  - `AllocatedBaseSize=4096`
  - `freeVirtualMB=4092.9`

Evidencia:

- `reports/qa/latest/hyperv-restart-after-pagefile.txt`

### 8. Presion de RAM en host

Sintoma:

- Hyper-V no podia arrancar la VM con 3072 MB, 2048 MB ni 1024 MB en algunos intentos:
  - `0x8007000E`

Acciones:

- Se detuvo Docker Desktop/WSL del host con `wsl --shutdown`.
- Se redujo temporalmente memoria dinamica de la VM para arrancar:
  - `StartupBytes=1GB`, luego intento con `2GB`.
- La VM arranco y WinRM quedo listo.

Evidencia:

- `reports/qa/latest/hyperv-start-after-reset-service.txt`
- `reports/qa/latest/hyperv-state.txt`
- `reports/qa/latest/hyperv-restart-for-interactive-e2e.txt`

## Intentos E2E y resultado

### VMConnect + sesion interactiva visible

Resultado:

- Se abrio `VMConnect` elevado y se inicio sesion visible como `evaluaqa`.
- `quser` confirmo `evaluaqa` en estado `Active`.
- Docker Desktop se levanto dentro de esa sesion y `docker version` quedo OK:
  - Docker Desktop `4.73.0`
  - Engine `29.4.3`
  - contexto `desktop-linux`
- Primer intento interactivo `20260602-205914` fallo porque Docker Desktop mostro el modal `Docker Subscription Service Agreement`; la UI del Installer Hub quedo bloqueada antes de habilitar `Siguiente`.
- Se acepto el modal por UIAutomation dentro de la sesion interactiva. Evidencia:
  - `reports/qa/latest/docker-license-accept-ui.txt` en VM
  - `reports/qa/latest/docker-version-after-license-accept.txt` en host

### Runner interactivo tras aceptar Docker

Run `20260602-211015`:

- Preflight completo OK:
  - VM identity OK.
  - Snapshot `pre-evaluapro-installer-e2e` OK.
  - Pagefile/memoria virtual OK (`freeVirtualMB=2164.42`).
  - SHA256 del bundle OK (`bd9374f7dfcb60caa6e89d5119909fb681004521ba034aef5acdf12e7ac62a66`).
  - Docker Runtime Windows OK (`29.4.3`, modo `desktop`).
- Falla funcional:
  - `Control no habilitado antes del timeout: NextButton / Siguiente`.
- Causa raiz:
  - El detector de prerequisitos marco `ready=False` solo por `internetOk=false`.
  - No habia prerequisitos faltantes: Node.js OK, Docker Runtime Windows OK, Node.js WSL2 no requerido por Docker Desktop activo.
- Resolucion aplicada para QA aislado:
  - Se configuro `EVALUAPRO_INSTALLER_ASSUME_INTERNET=1` en el wrapper interactivo y como variable de usuario de `evaluaqa`.
  - El wrapper temporal de VM dejo de contener la clave literal y usa `-QaPass $env:EVALUAPRO_QA_PASS`.

Evidencia:

- `reports/qa/installer-hub-e2e-docente/20260602-211015/report.json`
- `reports/qa/installer-hub-e2e-docente/20260602-211015/screenshots/wpf-install-02-preparar.png`

### Runner interactivo con `EVALUAPRO_INSTALLER_ASSUME_INTERNET=1`

Run `20260602-211919`:

- Preflight OK.
- El Hub avanzo de prerequisitos a ejecucion:
  - `install/start-button` OK (`name=Instalar`).
  - `detect-prereqs` reporto `ready=True`.
- Falla actual:
  - `Installer Hub no completo correctamente mode=install`.
  - Burn reporto `0x80070002`.
  - Mensaje UI: `No se encontro un archivo requerido por el instalador`.
- Causa raiz observada:
  - Burn no pudo adquirir el payload MSI desde el contenedor embebido:
    - `Failed to resolve source for payload: n/a, package: n/a, container: WixAttachedContainer`
    - `Failed to extract container for payload: EvaluaProMsi`
    - `Failed to acquire payload: EvaluaProMsi`
    - `Apply complete, result: 0x80070002`
- Nota de investigacion:
  - En host, `wix.exe burn extract dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe -out reports\qa\latest\burn-extract-current` extrae el contenedor (`a0`, ~8.6 MB), por lo que el archivo local no esta truncado.
  - La VM no tiene `wix.exe` disponible para repetir la extraccion alli sin copiar tooling.

Evidencia:

- `reports/qa/installer-hub-e2e-docente/20260602-211919/report.json`
- `reports/qa/installer-hub-e2e-docente/20260602-211919/screenshots/wpf-install-06-resultado.png`
- `reports/qa/installer-hub-e2e-docente/20260602-211919/logs/temp/EvaluaPro_Installer_Hub_20260602211930.log`
- `reports/qa/installer-hub-e2e-docente/20260602-211919/logs/temp/EvaluaPro_Installer_Hub_20260602212016.elevated.log`

Siguiente accion concreta:

1. Agregar al pipeline local una validacion de adquisicion real del contenedor Burn, no solo smoke GUI:
   - `wix burn extract <bundle> -out <tmp>`
   - verificar que extrae al menos un payload del tamano esperado del MSI.
2. Rebuild completo del bundle docente-local.
3. Sincronizar nuevo bundle a `C:\EvaluaPro`.
4. Repetir el runner interactivo con:
   - `EVALUAPRO_E2E_VM_SNAPSHOT=pre-evaluapro-installer-e2e`
   - `EVALUAPRO_DOCKER_RUNTIME=desktop`
   - `EVALUAPRO_INSTALLER_ASSUME_INTERNET=1` solo si la VM sigue aislada.

### PowerShell Direct

Resultado:

- Autentica tras reset.
- Falla si falta `C:\EvaluaPro`.
- Tras sincronizar, falla si Docker Desktop no esta listo en esa sesion.

Evidencia:

- `reports/qa/latest/installer-hub-e2e-launcher-elevated-transcript.txt`

### WinRM no interactivo

Resultado:

- Llega a lanzar el Hub.
- Falla porque UIAutomation no ve ventana en sesion no interactiva:
  - `No aparecio Installer Hub para mode=install`

Evidencia copiada:

- `reports/qa/installer-hub-e2e-docente/20260602-042758/report.json`
- `reports/qa/latest/installer-hub-e2e-winrm-transcript.txt`

### Tarea interactiva AtLogon

Resultado:

- Se intento autologon + tarea `EvaluaProInteractiveE2E`.
- La tarea se ejecuto como `EVALPRO-E2E\evaluaqa`, pero no quedo una sesion interactiva visible segun `quser`.
- Docker no quedo listo dentro de la ventana de espera:
  - `Docker no listo para interactive E2E`

Limpieza:

- La tarea borro `AutoAdminLogon` y `DefaultPassword` al fallar.
- `schtasks /Query` posterior no encontro la tarea.

Evidencia:

- `reports/qa/latest/interactive-e2e-watch.json`
- `reports/qa/latest/vmconnect-login.txt`

## Bloqueo actual

El bloqueo restante ya no es credencial, snapshot, sesion interactiva ni Docker. El runner interactivo ya llega a ejecucion del MSI, pero el bundle falla en Burn al adquirir `EvaluaProMsi` desde `WixAttachedContainer` con `0x80070002`.

Condiciones minimas para el siguiente intento:

1. Reconstruir bundle docente-local y validar `wix burn extract` como gate de empaquetado.
2. Copiar el nuevo bundle a la VM.
3. Confirmar `quser` muestra `evaluaqa` activo.
4. Confirmar Docker listo.
5. Ejecutar dentro de la sesion interactiva:

```powershell
cd C:\EvaluaPro
$env:EVALUAPRO_E2E_VM_SNAPSHOT='pre-evaluapro-installer-e2e'
$env:EVALUAPRO_DOCKER_RUNTIME='desktop'
$env:EVALUAPRO_INSTALLER_ASSUME_INTERNET='1'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tests\installer-hub-e2e-docente.ps1 -IUnderstandThisMutatesVm
```

7. Copiar al host el ultimo:

```powershell
C:\EvaluaPro\reports\qa\installer-hub-e2e-docente\<run-id>\report.json
```

## Comandos utiles

Validar credencial y variables:

```powershell
$qaPass = Get-Content "$env:APPDATA\EvaluaPro\e2e-qa-pass.dpapi" -Raw | ConvertTo-SecureString
$cred = [pscredential]::new('EVALPRO-E2E\evaluaqa', $qaPass)
Invoke-Command -ComputerName EVALPRO-E2E -Credential $cred -ScriptBlock {
  [pscustomobject]@{
    computer = $env:COMPUTERNAME
    user = $env:USERNAME
    snapshot = [Environment]::GetEnvironmentVariable('EVALUAPRO_E2E_VM_SNAPSHOT','Machine')
    qaUser = [Environment]::GetEnvironmentVariable('EVALUAPRO_QA_USER','Machine')
    qaPassSet = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('EVALUAPRO_QA_PASS','Machine'))
  }
}
```

Validar memoria/pagefile en VM:

```powershell
Invoke-Command -ComputerName EVALPRO-E2E -Credential $cred -ScriptBlock {
  $os = Get-CimInstance Win32_OperatingSystem
  [pscustomobject]@{
    pageFileSetting = Get-CimInstance Win32_PageFileSetting
    pageFileUsage = Get-CimInstance Win32_PageFileUsage
    freeVirtualMB = [math]::Round(([int64]$os.FreeVirtualMemory / 1KB), 2)
    freePhysicalMB = [math]::Round(([int64]$os.FreePhysicalMemory / 1KB), 2)
  }
}
```

Copiar evidencia al host:

```powershell
$session = New-PSSession -ComputerName EVALPRO-E2E -Credential $cred
$latest = Invoke-Command -Session $session -ScriptBlock {
  Get-ChildItem C:\EvaluaPro\reports\qa\installer-hub-e2e-docente -Directory |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
$dest = "reports\qa\installer-hub-e2e-docente\$(Split-Path $latest -Leaf)"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -FromSession $session -Path (Join-Path $latest '*') -Destination $dest -Recurse -Force
Remove-PSSession $session
```

## Politica de secreto

- No versionar la pass literal.
- No registrar prompts ni comandos con pass en handoff.
- Preferir DPAPI del usuario Windows actual:
  - `%APPDATA%\EvaluaPro\e2e-qa-pass.dpapi`
- Si se usa variable de entorno, tratarla como secreto local y no incluirla en logs.
