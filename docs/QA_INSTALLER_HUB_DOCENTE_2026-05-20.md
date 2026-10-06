# QA Installer Hub docente-local - 2026-05-20

Estado de validacion parcial para cerrar el ciclo real del Installer Hub `docente-local`.
Este reporte no declara E2E completo: registra resultados confirmados, bloqueos reproducidos y correcciones a despejar.

## Alcance

- Host: TEZKATLI para build, contratos y QA UI no destructiva.
- VM: `EvaluaPro-E2E-Win11` para validacion real install/repair/uninstall.
- Flavor: `docente-local`.
- Runtime objetivo del flavor: `WSL2 + Docker Engine`, sin dependencia de `Docker Desktop` en ruta feliz.

## Evidencia Disponible

- QA UI local:
  - `reports/qa/installer-hub-ui/installer-hub-ui-automation-report.json`
  - `reports/qa/installer-hub-ui/installer-hub-ui-automation.log`
  - capturas `01-splash.png` a `07-min-980x700.png` en la misma carpeta.
- Auditoria VM y sincronizacion:
  - `C:\Auditoria_Tezkatli\EvaluaPro-vm-bootstrap-20260519-233347\vm-sync-artifacts-and-rerun-e2e.report.json`
  - `C:\Auditoria_Tezkatli\EvaluaPro-vm-bootstrap-20260519-233347\inspect-e2e-deep.report.json`
  - `C:\Auditoria_Tezkatli\EvaluaPro-vm-bootstrap-20260519-233347\probe-vm-helper-responses.report.json`
- Evidencia E2E copiada de intentos previos:
  - `C:\Auditoria_Tezkatli\EvaluaPro-vm-bootstrap-20260519-233347\latest-e2e-evidence\`

## Pruebas Confirmadas

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| `npm run test:wix:policy` | OK | 3/3 pruebas en verde el 2026-05-20 |
| `npm run test:update` | OK | 10/10 pruebas en verde el 2026-05-20 |
| `npm run test:installer-hub:contract` | OK tras correcciones | 44/44 pruebas en verde; incluye smoke GUI y smoke activo |
| `node --test scripts/tests/windows-release-smoke.test.mjs` | OK tras correccion | 4/4 pruebas en verde |
| `npm run test:installer-hub:ui` | OK | reporte JSON, log y capturas del wizard |
| `scripts/build-msi.ps1 -SkipStabilityChecks -IncludeBundle -Flavor docente-local` | OK | bundle reconstruido y hashes regenerados |

Bundle usado en la ultima corrida relanzada a VM:

- `dist/installer/docente-local/EvaluaPro-InstallerHub-docente-local-v1.0.0.exe`
- SHA256: `7F0E99D0B02F6057BCC2A11A3261C9D5D70C65F9513BB88B1EB1687BECA8B68A`

## Intentos E2E Reales En VM

| Fase | Estado |
| --- | --- |
| Sync artefactos a VM | OK con PowerShell elevado |
| Hash del bundle en VM | OK; coincide con el artefacto sincronizado |
| UI Hub real abre en VM | OK |
| Deteccion de prerequisitos | Parcial; se corrigieron bloqueos por probes nativos sin timeout |
| Install real | Pendiente de cierre |
| Repair real | Pendiente |
| Stack Docker estable | Pendiente |
| Dashboard/healthchecks | Pendiente |
| Uninstall/residuos | Pendiente |

Ultimo estado observado antes de este corte:

- Tarea VM `EvaluaPro-InstallerHub-E2E-Real` seguia en ejecucion.
- Bundle VM activo: hash `7F0E99D0...B68A`.
- Helper Burn seguia en fase de prerequisitos/remediacion.
- No existe aun reporte E2E final que permita declarar install/repair/uninstall reales como aprobados.

## Rerun de estabilizacion 2026-05-21

- Checkout activo: `V:\Software\EvaluaPro` en rama `stabilization/v1.0`.
- Bundle docente reconstruido con `scripts/build-msi.ps1 -IncludeBundle -Flavor docente-local`.
- SHA256 nuevo: `7C03A834B68FAA07D9EB0C1321D4B0BF812362A13A16F4F147C5535781290007`.
- Validacion local confirmada:
  - `node --test scripts/tests/installer-hub-contract.test.mjs scripts/tests/installer-flavor-diff-resolver.test.mjs`: `43/43`.
  - `node --test scripts/tests/windows-release-smoke.test.mjs`: `4/4`.
  - `npm run test:wix:policy`: `3/3`.
  - `npm run test:update`: `10/10`.
  - `npm run test:installer-hub:ui`: UIAutomation local en verde.
- El runner externo de sync VM se ajusto para leer artefactos desde el checkout activo en vez del checkout `main` antiguo.
- El rerun VM no inicio desde esta sesion:
  - PowerShell Direct fallo con `Acceso denegado` al abrir sesion Hyper-V sin elevacion host.
  - WinRM responde en `EVALPRO-E2E`, pero la copia remota con credencial workgroup queda bloqueada hasta configurar `TrustedHosts` o HTTPS.
- Estado: continua `partial`; falta sincronizar el bundle actual, ejecutar tarea `EvaluaPro-InstallerHub-E2E-Real` y leer `report.json` final.

## Cierre local/no destructivo 2026-05-25

- Host: `TEZKATLI`, checkout `V:\Software\EvaluaPro`, rama `stabilization/v1.0`.
- Docker Desktop se levanto para la sesion y `npm run env:doctor:windows` queda `ok=true` con Docker `29.4.0`, Compose `v5.1.2`, WSL2 `docker-desktop` running y Playwright Chromium disponible.
- `npm run installer:docente:baseline` confirma bundle `dist/installer/docente-local/EvaluaPro-InstallerHub-docente-local-v1.0.0.exe` existente con `74,921,037` bytes y contrato `wsl2-docker-minimal`.
- Gates E2E/no destructivos en verde:
  - `npm run test:e2e:journeys:ci`: `3/3`.
  - `npm run test:gui:responsive:e2e:ci`: docente `4/4`, alumno `4/4`, admin `3/3`.
  - `npm run test:installer-hub:contract`: `47/47`.
  - `npm run test:installer-hub:ui`: reporte `reports/qa/installer-hub-ui/installer-hub-ui-automation-report.json`.
  - `npm run qa:evidence:quick`: dataset prod-like, docente-alumno, global grade, evaluaciones, PDF, UX visual y manifest QA en verde.
- El runner real `scripts/tests/installer-hub-e2e-docente.ps1` queda listo para `install|repair|update smoke|uninstall`; el smoke de update consulta `/api/update/status` y guarda `manifest/update-status.json`.
- E2E VM real no ejecutado en esta shell:
  - `Get-VM -Name EvaluaPro-E2E-Win11` falla por permisos Hyper-V no elevados.
  - `Test-WSMan EVALPRO-E2E` responde por HTTP, pero `TrustedHosts` esta vacio.
  - `Test-WSMan EVALPRO-E2E -UseSSL` falla; no hay ruta HTTPS confirmada.
  - `EVALUAPRO_E2E_VM_SNAPSHOT` no esta definido.
- Estado: local/no destructivo cerrado; aceptacion release-like sigue `partial` hasta ejecutar en VM limpia el runner mutante y leer `report.json`.

## Continuacion Hub 2026-05-26

- Se detecto una deriva entre documentacion y artefacto: el runner prometia `manifest/update-status.json`, pero `Export-JsonArtifact('update-status.json')` lo enviaba a la raiz del reporte.
- Correccion aplicada:
  - `scripts/tests/installer-hub-e2e-docente.ps1` enruta `update-status` a `manifest/`.
  - `scripts/tests/installer-hub-contract.test.mjs` agrega regresion para exigir `$Name -match 'manifest|config|update-status'`.
- Validacion local/no destructiva:
  - parser PowerShell del runner: `parse=ok`.
  - prueba roja previa confirmada sobre el contrato del runner.
  - `npm run test:installer-hub:contract`: `47/47`.
  - `npm run test:update`: `10/10`.
  - `npm run test:wix:policy`: `3/3`.
  - `npm run env:doctor:windows`: `ok=true`.
  - `npm run installer:docente:baseline`: bundle `74,921,037` bytes, contrato `wsl2-docker-minimal`.
- Estado: aceptacion release-like continua `partial`; falta ejecutar el runner real en VM limpia y revisar `report.json`.

## Continuacion VM real 2026-05-26

- Se pidio elevacion UAC en host y se habilito la ruta WinRM workgroup con `TrustedHosts=EVALPRO-E2E`.
- Se sincronizo y ejecuto la tarea `EvaluaPro-InstallerHub-E2E-Real` en la VM.
- Hallazgo despejado: el Hub lanzaba `wsl --install -d Ubuntu` aunque la distro ya existia, dejando procesos WSL colgados cuando HTTP externo estaba inestable. `PrereqInstaller.psm1` ahora omite ese paso si `wsl -l -q` ya contiene la distro objetivo.
- El runner real ahora registra `restart-required` al detectar `RestartNowButton` habilitado y cierra con `report.json`, en vez de esperar indefinidamente a `NextButton`.
- Bundle reconstruido y usado en VM:
  - `dist/installer/docente-local/EvaluaPro-InstallerHub-docente-local-v1.0.0.exe`
  - SHA256: `6E0F683CB67BC5B14477942091300D722143E8BDDCF7FDC32E1D50CE465BFA0E`
  - bytes: `74,922,233`
- Evidencia copiada:
  - remoto VM: `C:\work\EvaluaPro_Sistema_Universitario\reports\qa\installer-hub-e2e-docente\20260526-010718`
  - host: `C:\Auditoria_Tezkatli\EvaluaPro-vm-bootstrap-20260519-233347\latest-e2e-evidence\20260526-010718`
- Resultado VM actual: `failed` controlado en `install/restart-required`.
  - Preflight OK: snapshot, SHA256, instalacion previa `entries=0`, espacio libre y PowerShell.
  - Pendiente real: completar estrategia de resume post-reinicio para que la aceptacion llegue a `install|repair|update smoke|uninstall`.

## Continuacion VM real - bloqueo siguiente 2026-05-26

- Se corrigio el detector WSL:
  - `wsl.exe` ya se ejecuta con `ProcessStartInfo` y timeout sin archivos temporales, evitando el fallo observado con salida NUL/UTF-16.
  - `Ubuntu` queda reconocido como distro de usuario.
  - un shim Docker que devuelve texto de error ya no cuenta como daemon listo si no entrega una version real.
- Se corrigio el bootstrap WSL2:
  - `userDistros='Ubuntu'` ya no se indexa como string (`U`); los comandos ahora usan `wsl -d Ubuntu`.
  - `curl` descarga a `/tmp/evaluapro-get-docker.sh` y solo ejecuta `sh` si la descarga fue exitosa.
  - comandos host con exit code no cero se registran como `failed`, no como `executed`.
- Bundle VM usado:
  - SHA256: `6A7D972BA8FDCEC6E92DC2FE3BFBD9B6A277B265546147E3517B23CB1A92F5B5`
  - bytes: `74,921,261`
- Evidencia copiada:
  - `C:\Auditoria_Tezkatli\EvaluaPro-vm-bootstrap-20260519-233347\latest-e2e-evidence\20260526-041719-blocker`
- Resultado VM actual: `partial` con bloqueo operativo externo al repo:
  - `wsl -d Ubuntu -u root -- sh -lc "curl -fsSL https://get.docker.com -o /tmp/evaluapro-get-docker.sh && sh /tmp/evaluapro-get-docker.sh"` falla con exit code `35` (`Recv failure: Connection reset by peer`).
  - `wsl -d Ubuntu -u root -- sh -lc "docker version"` falla con exit code `1`.
  - El Hub ya reporta `Auto-bootstrap ejecutado: 1 pasos OK, 2 pasos fallidos, 0 pasos pendientes`.
  - No se declara aceptacion completa hasta resolver provisioning/red de Docker Engine dentro de Ubuntu y completar `install|repair|update smoke|uninstall`.

## Hallazgos Reproducidos

## Continuacion VM real - avance y bloqueo open-dashboard 2026-05-26

- Se despejo el bloqueo de provisioning Docker en `Ubuntu` con instalacion offline de paquetes oficiales/dependencias:
  - `docker version`: server `29.5.2`.
  - `docker compose version`: `v5.1.4`.
  - `node -v` en WSL: `v24.15.0`.
- El Hub detecta prerequisitos listos en VM: `runtime=ok (wsl2-engine)`, `Node.js WSL2=24.x`.
- Correcciones aplicadas al flujo:
  - timeout WSL tolerante para arranque frio.
  - override QA de internet y runtime Node desde host para VM con HTTP externo inestable.
  - shortcuts generados en el perfil real `evaluaqa`.
  - carga explicita de DPAPI para blindaje de licencia.
  - runner E2E sin fallo por `state.timeout` ausente y con aceptacion de `post-install.response.json` filtrada por timestamp.
  - broker invocado preservando rutas con espacios.
- Ultimo E2E VM copiado:
  - `C:\Auditoria_Tezkatli\EvaluaPro-vm-bootstrap-20260519-233347\latest-e2e-evidence\20260526-061439-blocker-open-dashboard\20260526-070818`
  - Bundle hash usado en esa evidencia: `91D6571D76C9CD40FC08BC228D15C7D15314D443D76F7B334EC6D77EB4540588`.
- Bundle reconstruido despues del fix de quoting del broker:
  - SHA256: `7730DEE828E839C9F506F806B8334F7E380762499D8F2D7A3FB0B514323FB644`
  - bytes: `74,924,659`
- Resultado confirmado:
  - `install` real: OK.
  - `post-install`: OK.
  - verificacion de archivos instalados: OK.
  - `verify-installation`: OK.
  - bloqueo vigente: `open-dashboard` falla con `exit=1`; `bootstrap-state` reporta `Dashboard no respondio en el tiempo esperado`.
- Limitacion operativa: al reproducir `open-dashboard`, la VM queda bajo presion de memoria/pagefile (`0x800705AF`, `The paging file is too small`). Esta shell no puede ejecutar `Restart-VM` por permisos Hyper-V, por lo que la siguiente accion requiere reiniciar/aumentar memoria o pagefile de la VM antes de continuar.

Estado: `partial`; no declarar aceptacion release-like hasta completar `install|repair|update smoke|uninstall`.

## Continuacion Hub - proceso y UX/UI 2026-05-26

- Mejoras aplicadas antes del siguiente rerun VM:
  - `scripts/tests/installer-hub-e2e-docente.ps1` exporta `preflight-memory.json` y agrega gate `memory-pagefile` para detenerse antes de degradar WinRM/CLR cuando falta memoria o pagefile.
  - `Invoke-InstalledBroker` captura stdout/stderr por accion y copia diagnosticos del broker instalado (`launcher-broker.log`, `dashboard.lock.json`, `bootstrap-state-<run>.json`).
  - `packaging/wix/BurnBootstrapperApp/MainWindow.xaml` deja visible evidencia tecnica en Resultado con la ruta `%ProgramData%\EvaluaPro\installer-hub\logs` y elimina el tooltip generico `Detalle por requisito`.
- Bundle docente vigente:
  - SHA256: `688BB1F872AAC7CE252D72F4082F43E0D52983B96647A61492E69277934BAE53`
  - bytes: `74,924,283`
- Validacion local ejecutada:
  - `npm run test:installer-hub:contract`: `60/60`.
  - `dotnet publish packaging\wix\BurnBootstrapperApp\EvaluaPro.BurnBootstrapperApp.csproj -c Release -r win-x64 --self-contained true`: OK.
  - `scripts/build-msi.ps1 -SkipStabilityChecks -IncludeBundle -Flavor docente-local`: OK.
  - `scripts/tests/installer-hub-ui-lifecycle.ps1`: `passed`, capturas regeneradas en `reports/qa/installer-hub-ui/`.
  - `npm run installer:docente:baseline`: OK, contrato `wsl2-docker-minimal`.
  - `git diff --check`: sin errores, solo avisos CRLF/LF.
- Estado: `partial`; la siguiente corrida VM debe empezar por reinicio/aumento de pagefile o memoria de `EVALPRO-E2E` y sincronizacion del bundle con hash vigente.

## Optimizacion Runtime Minimo 2026-05-27

- `docente-local` queda blindado como runtime minimo:
  - ruta feliz: `WSL2 + Ubuntu + Docker Engine`;
  - Docker Desktop solo compatibilidad manual con `EVALUAPRO_DOCKER_RUNTIME=desktop`;
  - servicios prod requeridos: `mongo_local`, `api_docente_prod`, `web_docente_prod`.
- Cambios de proceso:
  - Compose prod usa imagenes GHCR por defecto y arranca con `--no-build`.
  - Build local queda como fallback tecnico en `docker-compose.prod-build.yml`.
  - Runner E2E guarda `runtime-audit-before.json`, `runtime-audit-after.json`, `docker-images.json` y `docker-context.json`.
  - Runner E2E falla si detecta `desktop-linux` sin override manual o servicios Compose fuera del set docente minimo.
- Bundle docente vigente:
  - SHA256: `04825F89C6CDE239270EA0F12A8B36493E4049DB30E87B4F8D4DDB150732205F`
  - bytes: `74,926,273`
- Validacion local:
  - `docker compose --profile prod config --services`: `mongo_local`, `api_docente_prod`, `web_docente_prod`.
  - `npm run test:installer-hub:contract`: `63/63`.
  - `npm run installer:docente:baseline`: OK; evidencia que el host actual sigue con contexto `desktop-linux` roto, por lo que no es cierre VM.

### H1. Probes `docker` y `wsl.exe` podian bloquear deteccion

- Sintoma: helper `detect-prereqs` quedaba retenido durante validacion real.
- Causa: llamadas nativas sin timeout duro.
- Correccion aplicada:
  - `scripts/installer-burn/modules/PrereqDetector.psm1` usa wrapper con timeout para `docker` y `wsl.exe`.
- Estado: despejado por contrato y por observacion de nuevas solicitudes `detect-prereqs` sin congelamiento indefinido.

### H2. Sync VM mezclaba modulos nuevos y viejos

- Sintoma: bundle sincronizado podia usar logica distinta a los modulos copiados al checkout VM.
- Causa: el runner de sync copiaba solo `PrereqDetector.psm1`.
- Correccion aplicada fuera del repo en auditoria host:
  - `vm-sync-artifacts-and-rerun-e2e.ps1` copia todos los `scripts/installer-burn/modules/*.psm1`.
  - el reporte de sync publica hashes por modulo.
- Estado: despejado para las nuevas corridas.

### H3. Docker Desktop instalado pero no sano en VM

- Evidencia: `docker version` y `docker info` respondieron `500 Internal Server Error` contra `dockerDesktopLinuxEngine`.
- Impacto: la VM no puede declararse estable por esa ruta de compatibilidad.
- Decision vigente:
  - `docente-local` debe priorizar `WSL2 + Docker Engine`.
  - Docker Desktop no forma parte de la ruta feliz ni debe retrasar el bootstrap WSL2 cuando su daemon no responde.
- Correccion aplicada:
  - helper Burn fija preferencia `wsl2-engine` para `docente-local` salvo override explicito `desktop`;
  - detector trata Docker Desktop no sano como bootstrap WSL2 bajo esa preferencia;
  - contrato `docente-local prioriza WSL2 si Docker Desktop existe pero daemon no responde` queda en verde.
- Estado: fix de codigo despejado; falta rerun VM con bundle reconstruido.

### H4. Smoke activo podia dejar dashboard listeners no responsivos

- Sintoma: bootstrap quedaba `degraded`, pero el test no obtenia `/api/status` responsive.
- Causa: listeners `launcher-dashboard` colgados retenian puertos de control plane.
- Correccion aplicada:
  - `scripts/launcher-broker.ps1` cierra listeners `launcher-dashboard` no responsivos antes de iniciar otra instancia.
  - `scripts/tests/windows-release-smoke.test.mjs` espera readiness con ventana coherente con el broker.
- Estado: despejado por `windows-release-smoke` y `test:installer-hub:contract`.

## Correcciones A Ejecutar Antes Del Siguiente Cierre E2E

1. Rehacer build del bundle `docente-local` con prioridad WSL2 ya corregida.
2. Rerun VM desde sync elevado con hash nuevo.
3. No declarar estable hasta completar:
   - install real;
   - `docker compose --profile prod` con `mongo_local`, `api_docente_prod`, `web_docente_prod` sanos;
   - dashboard `/api/status` en `healthy|degraded`, nunca `failed`;
   - repair real;
   - uninstall estandar y verificacion de residuos permitidos.

## Criterio De Cierre

La validacion quedara completa solo cuando el reporte E2E VM incluya:

- `report.json` final sin fallos bloqueantes;
- logs Burn/MSI/helper;
- hashes y manifiesto usados;
- capturas WPF y dashboard;
- procesos antes/despues;
- evidencia de install, repair, update smoke y uninstall;
- clasificacion de residuos post-uninstall contra documentacion vigente.
