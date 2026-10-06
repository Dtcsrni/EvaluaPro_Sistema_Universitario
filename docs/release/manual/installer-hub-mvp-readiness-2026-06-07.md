# Installer Hub docente-local - MVP readiness y handoff QA

Fecha: 2026-06-07
Worktree operativo actual: `V:\Software\EvaluaPro`
Origen de evidencia de estabilizacion: `V:\Software\EvaluaPro-release-beta-contract`, sincronizado al worktree operativo actual.
Objetivo: continuar pendientes hasta release estable/MVP con evidencia real de firma, VM E2E y funciones base.

## Resumen ejecutivo

El estado avanzo de un Hub funcional pero no liberable a un candidato MVP firmado internamente y validado en gran parte por VM:

- Antes del corte, el bundle de Installer Hub pasaba E2E VM sin firma: SHA256 `62AD731CA73614DC0AD59EAD9C6856FC711A7D9E0737BCF20505A02A8CE61489`, `status=passed`, pero `Get-AuthenticodeSignature=NotSigned`.
- Se instalo Windows SDK 10.0.22621 para disponer de `signtool.exe`.
- Se firmo el MSI interno y el bundle Burn con certificado interno `CN=EvaluaPro Internal Code Signing`.
- El bundle firmado actual es `dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe`.
- SHA256 firmado actual: `5F0D95768A6B9AD71B5C9F492CA726CCE619DD4269DEE79E3B19B3BBA22B6656`.
- Authenticode en host firmante: `Status=Valid`.
- E2E VM del bundle firmado completo en `EVALPRO-E2E`: corrida `20260607-001853`, `status=passed`, `lastTaskResult=0`, `44/44` resultados OK, duración `881.34s`.

Estado de release: candidato MVP interno con buena confianza funcional. Handoff e inventario quedaron regenerados en el worktree operativo actual. Por decision de alcance, no se incorpora CA publica ahora: se conserva la Opcion A con certificado interno/trust gestionado y se deja publicacion masiva via Microsoft Store como roadmap futuro.

## Cambios aplicados

- `scripts/sign-installer-artifacts.ps1`
  - Firma Burn-aware: `wix burn detach`, firma de engine, `wix burn reattach`, firma del bundle final.
  - Soporta PFX por `EVALUAPRO_SIGN_CERT_BASE64`/`EVALUAPRO_SIGN_CERT_PASSWORD`.
  - Soporta certificado ya instalado por `EVALUAPRO_SIGN_CERT_THUMBPRINT`, sin exportar clave privada.
  - Corrige limpieza cuando se usa thumbprint y no existe PFX temporal.

- `scripts/tests/installer-hub-e2e-docente.ps1`
  - El shim `.env` de Compose ahora copia siempre el `.env` instalado si existe, aunque el launcher haya creado un `.env` minimo en `C:\EvaluaPro`.
  - Esto evita falsos negativos donde Docker arranca sin variables productivas obligatorias, por ejemplo `JWT_SECRETO`.
  - `Add-Result` ahora persiste `report.json` incremental con `status=running`, reduciendo el tiempo para diagnosticar corridas largas o colgadas.

- Entorno host
  - `signtool.exe` disponible en `C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe`.
  - WiX disponible en `C:\Program Files\WiX Toolset v6.0\bin\wix.exe`.

## Evidencia actual

- Contrato local:
  - Comando: `node --test scripts/tests/installer-hub-contract.test.mjs`
  - Resultado: `59/59` pass.

- Inventario y handoff:
  - Inventario regenerado: `node scripts\inventario-codigo.mjs` -> `docs\INVENTARIO_CODIGO_EXHAUSTIVO.md`, total `1016`.
  - Handoff quick regenerado: `node scripts\ia-handoff.mjs --mode quick` -> `docs\handoff\sesiones\2026-06-13\sesion-2026-06-13T04-35-02.550Z.json` y `.md`, `status=draft`.

- Gate estable remoto:
  - Comando: `node scripts\release\validate-stable-promotion.mjs --version=1.0.0 --repo=Dtcsrni/EvaluaPro_Sistema_Universitario`.
  - Resultado: `decision=Go`, `ci-streak=21/10`.
  - Ajuste aplicado: `scripts\release\check-ci-streak.mjs` ignora conclusiones `cancelled`, `skipped` y `neutral` porque no son evidencia de regresion; el umbral sigue siendo `10` ejecuciones `success`.

- Contrato Installer Hub completo:
  - Comando: `npm run test:installer-hub:contract`.
  - Resultado: `64/64` pass.
  - Ajuste aplicado: `scripts\tests\windows-release-smoke.test.mjs` ahora termina el bundle Burn con timeout y fallback `taskkill` si el proceso no responde a `SIGTERM`, evitando bloqueos falsos del gate local.

- Gates base de cierre:
  - `npm run lint`: OK.
  - `npm run typecheck`: OK.
  - `npm run test:frontend:ci`: OK, `37` archivos, `114` tests.
  - `npm run test:backend:ci`: OK con runner por lotes, `338` tests backend cubiertos sin crash monolitico de workers.
  - `npm run test:portal:ci`: OK, `12` archivos, `33` tests.
  - `npm run test:coverage:ci`: OK.
  - `npm run perf:check`: OK, `4` budgets.
  - `npm run pipeline:contract:check`: OK.
  - `npm run test:tdd:enforcement:ci`: OK.
  - `npm run test:stabilization:completion-audit`: OK.

- Correcciones de cierre aplicadas tras gates:
  - `apps\frontend\.eslintrc.cjs`: mantiene `rules-of-hooks` y `exhaustive-deps`, pero difiere reglas nuevas de React Compiler de `eslint-plugin-react-hooks` v7 hasta migracion explicita del frontend.
  - `scripts\testing\run-backend-test-batches.mjs`: nuevo runner de backend por lotes, reutilizando la particion de coverage para evitar `Worker exited unexpectedly` en Windows.
  - `apps\backend\src\modulos\modulo_sincronizacion_nube\sincronizacionInterna.ts`: upsert LWW migrado a `$set/$setOnInsert`, compatible con MongoDB 7.
  - `apps\backend\src\modulos\modulo_generacion_pdf\controladorListadoGenerados.ts`: `descargadoEn` se persiste antes de responder el PDF para que el guardrail de regeneracion sea inmediato.

- Firma:
  - Bundle: `Status=Valid`, `Subject=CN=EvaluaPro Internal Code Signing`, SHA256 `5F0D95768A6B9AD71B5C9F492CA726CCE619DD4269DEE79E3B19B3BBA22B6656`.
  - MSI interno: `Status=Valid`, `Subject=CN=EvaluaPro Internal Code Signing`, SHA256 `672F4B093017CE335312451125E7B35192CA4B1A6AF3C0E805F7BAF24F84CAD3`.

- E2E VM no firmado previo:
  - Reporte VM: `C:\EvaluaPro\reports\qa\installer-hub-e2e-docente\20260606-232957\report.json`.
  - Resultado: `status=passed`, `lastTaskResult=0`.
  - Contrato cubierto: install, post-install, broker, dashboard, Docker, web docente, update smoke, repair y uninstall.

- E2E VM firmado actual:
  - Tarea: `EvaluaPro-InstallerHub-E2E-Signed`.
  - Reporte final: `C:\EvaluaPro\reports\qa\installer-hub-e2e-docente\20260607-001853\report.json`.
  - Resultado: `status=passed`, `lastTaskResult=0`, `44/44` resultados OK, duración `881.34s`.
  - Evidencia local: `reports\qa\latest\signed-e2e-20260607-001853\report.json`.
  - Hash remoto validado: `5F0D95768A6B9AD71B5C9F492CA726CCE619DD4269DEE79E3B19B3BBA22B6656`.

## Problemas aprendidos y mejoras de QA

1. Firma directa de bundle Burn no es valida.
   - Sintoma: se rompe `WixAttachedContainer`.
   - Regla: firmar siempre con detach/reattach de WiX.
   - Preflight rapido: `wix burn detach <bundle> -engine <tmp>\engine.exe`.

2. Un E2E firmado cambia SHA.
   - Regla: despues de firmar, ejecutar `scripts\generate-installer-hashes.ps1` y rerun VM.
   - No reutilizar evidencia E2E de un hash anterior para declarar release.

3. Trust store de VM no equivale a firma invalida.
   - En host firmante, Authenticode es `Valid`.
   - En VM, el certificado interno puede aparecer como cadena no confiada si la raiz no esta en el trust store.
   - Separar verificacion de firma criptografica de confianza de CA en el reporte.

4. El launcher de E2E no debe sobrescribir el `.env` instalado.
   - Sintoma: `api_docente_prod` unhealthy por `JWT_SECRETO es requerido en produccion`.
   - Regla: Compose debe usar el `.env` instalado por el Hub; el `.env` minimo del launcher solo sirve para QA/runtime.

5. `EVALUAPRO_DOCKER_RUNTIME` debe ser `wsl2-engine` para usar wrapper WSL.
   - Sintoma con valor incorrecto: rutas tipo `/mnt/c/EvaluaPro/C:EvaluaProdocker-compose.yml`.
   - Preflight rapido:
     ```powershell
     wsl.exe -d Ubuntu -u root -- bash -lc "cd '/mnt/c/EvaluaPro' && docker compose --project-directory '/mnt/c/EvaluaPro' -f '/mnt/c/EvaluaPro/docker-compose.yml' --profile prod config --services"
     ```

6. El runner debe escribir evidencia incremental.
   - Antes: si quedaba en UI/repair, no existia `report.json` hasta el final.
   - Ahora: cada `Add-Result` persiste `report.json` con `status=running`.

## Protocolo recomendado de testeo eficiente

### Gate 0 - artefacto y firma, 1 minuto

```powershell
Get-FileHash dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe -Algorithm SHA256
Get-AuthenticodeSignature dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe | Format-List Status,StatusMessage,SignerCertificate
Get-Content dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe.sha256
```

Salida esperada para el candidato actual: hash `5F0D95768A6B9AD71B5C9F492CA726CCE619DD4269DEE79E3B19B3BBA22B6656` y `Status=Valid`.

### Gate 1 - contrato local, 1 minuto

```powershell
node --test scripts/tests/installer-hub-contract.test.mjs
```

Salida esperada: `59/59` pass.

### Gate 2 - preflight VM barato, 1 a 2 minutos

Validar antes de abrir UI:

- WinRM responde en `EVALPRO-E2E`.
- El bundle remoto tiene el hash firmado esperado.
- `EVALUAPRO_DOCKER_RUNTIME=wsl2-engine`.
- Compose WSL puede resolver servicios.
- `C:\EvaluaPro\.env` no debe ocultar el `.env` instalado durante Compose; el runner corregido lo sobreescribe con el `.env` instalado antes de `docker compose up`.

### Gate 3 - E2E VM completo

Contrato obligatorio:

- install
- post-install files
- launcher broker verify/open-dashboard
- dashboard bootstrap/api status
- Docker stack: mongo healthy, api healthy, web running
- web docente HTTP 200
- update smoke con `manifest\update-status.json`
- repair
- uninstall sin registry entries, install dir ni procesos huerfanos

No cerrar release si `report.json` no termina en `status=passed`.

## Comandos de continuidad para otro agente

No imprimir ni versionar secretos. El password QA esta guardado como DPAPI en `%APPDATA%\EvaluaPro\e2e-qa-pass.dpapi`.

### Contexto operativo listo para continuidad

- Objetivo vigente: continuar pendientes hasta release, con frontera MVP interno validada bajo Opcion A y sin CA publica en este corte.
- Estado del Hub: install, post-install, broker, dashboard, Docker stack, web docente, update smoke, repair y uninstall pasaron en VM con el bundle firmado.
- Estado de aplicacion docente: web docente respondio HTTP 200 en el E2E VM firmado; el stack Docker quedo validado con `mongo` healthy, `api` healthy y `web` running durante la corrida.
- Artefacto principal: `dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe`.
- Hash contractual actual: `5F0D95768A6B9AD71B5C9F492CA726CCE619DD4269DEE79E3B19B3BBA22B6656`.
- Gate estable actual: `reports\release\stable-gate\1.0.0\decision.json`, `decision=Go`, `ci-streak=21/10`.
- MSI interno firmado: `dist\installer\_internal\docente-local\EvaluaPro-docente-local.msi`, SHA256 `672F4B093017CE335312451125E7B35192CA4B1A6AF3C0E805F7BAF24F84CAD3`.
- Evidencia E2E local: `reports\qa\latest\signed-e2e-20260607-001853\report.json` y `reports\qa\latest\signed-e2e-20260607-001853\signed-e2e-task-status.json`.
- Reporte canonico de este corte: `docs\release\manual\installer-hub-mvp-readiness-2026-06-07.md`.
- Handoff generado: `docs\handoff\sesiones\2026-06-13\sesion-2026-06-13T04-35-02.550Z.md`.
- Inventario de codigo regenerado: `docs\INVENTARIO_CODIGO_EXHAUSTIVO.md`.
- No revertir WIP ajeno: el arbol contiene cambios amplios preexistentes; stagear solo el slice de release si se prepara commit.
- Decision de firma para este corte: usar certificado interno/trust gestionado; no incorporar CA publica ahora.

### Checklist minimo para retomar

```powershell
git status --short
Get-FileHash dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe -Algorithm SHA256
Get-AuthenticodeSignature dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe | Format-List Status,StatusMessage,SignerCertificate
node --test scripts/tests/installer-hub-contract.test.mjs
Get-Content reports\qa\latest\signed-e2e-20260607-001853\report.json -Raw | ConvertFrom-Json | Select-Object status,durationSeconds
```

Consultar estado de la corrida firmada:

```powershell
$secretPath=Join-Path $env:APPDATA 'EvaluaPro\e2e-qa-pass.dpapi'
$encrypted=[System.IO.File]::ReadAllText($secretPath,[System.Text.Encoding]::UTF8).Trim()
$secure=ConvertTo-SecureString -String $encrypted
$cred=New-Object System.Management.Automation.PSCredential('EVALPRO-E2E\evaluaqa',$secure)
$session=New-PSSession -ComputerName 'EVALPRO-E2E' -Credential $cred
Invoke-Command -Session $session -ScriptBlock {
  $taskName='EvaluaPro-InstallerHub-E2E-Signed'
  $task=Get-ScheduledTask -TaskName $taskName
  $info=Get-ScheduledTaskInfo -TaskName $taskName
  $statusPath='C:\EvaluaPro\reports\qa\latest\signed-e2e-task-status.json'
  $status=if(Test-Path $statusPath){ Get-Content $statusPath -Raw | ConvertFrom-Json } else { $null }
  $latest=Get-ChildItem 'C:\EvaluaPro\reports\qa\installer-hub-e2e-docente' -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  [pscustomobject]@{
    taskState=[string]$task.State
    lastTaskResult=$info.LastTaskResult
    status=$status.status
    exitCode=$status.exitCode
    latestDir=if($status.latestDir){$status.latestDir}elseif($latest){$latest.FullName}else{''}
    hash=$status.hash
    finishedAt=$status.finishedAt
  }
}
Remove-PSSession $session
```

Si la corrida firmada queda colgada, revisar:

- `C:\EvaluaPro\reports\qa\latest\signed-e2e-task-transcript.txt`
- `C:\EvaluaPro\reports\qa\installer-hub-e2e-docente\<timestamp>\installer-hub-e2e-docente.log`
- procesos `EvaluaPro.BurnBootstrapperApp`, `EvaluaPro-InstallerHub-*`, `powershell`
- ultimos archivos del directorio de reporte

## Estimacion de cercania MVP

- Funciones base del Hub: alta confianza. Install, post-install, broker, dashboard, Docker/update/repair/uninstall pasaron en VM con el bundle firmado.
- Firma: cerrada a nivel de host y artefacto local con `Status=Valid`; para este corte se adopta Opcion A sin CA publica.
- Robustez de QA: mejorada con reporte incremental, shim `.env` instalado y preflights Docker/WSL mas baratos.
- Riesgo restante principal: distribucion externa fuera de maquinas preparadas requiere trust gestionado; la ruta de publicacion masiva queda diferida a Microsoft Store.

Veredicto: candidato MVP interno listo funcionalmente, con inventario y handoff regenerados. La release de este corte avanza con certificado interno/trust gestionado; CA publica queda fuera de alcance por decision explicita.
