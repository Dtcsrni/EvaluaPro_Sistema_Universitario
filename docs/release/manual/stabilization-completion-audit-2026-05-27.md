# Auditoria De Completitud De Estabilizacion

Fecha: 2026-05-27

Objetivo auditado: verificar si la estabilizacion esta completa, revisar pantalla por pantalla la GUI y mejorar UX/UI con contrato repo-local sin dependencia externa de diseno.

## Veredicto

Estado: `partial`

El carril local/no destructivo queda validado con evidencia actual. El cierre release-like no esta completo porque falta ejecutar el E2E real mutante del Installer Hub en VM limpia: `install`, `repair`, `update smoke` y `uninstall`.

## Requisitos Y Evidencia

| Requisito | Estado | Evidencia autoritativa |
| --- | --- | --- |
| Eliminar dependencia activa de herramienta externa de diseno | Cumplido | Busqueda repo-local activa sin referencias a la guia externa removida, excluyendo handoffs historicos y builds generados |
| Contrato UX/UI repo-local vigente | Cumplido | `docs/DESIGN.md`, `docs/UX_QUALITY_CRITERIA.md`, `npm run docs:check` |
| Matriz pantalla/componente/estado/viewport | Cumplido | `docs/release/manual/gui-screen-matrix-2026-05-27.md`, `reports/qa/latest/gui-screen-matrix.json`, `npm run test:gui:screen-matrix` |
| Evidencia visual por pantalla frontend | Cumplido | screenshots `reports/qa/latest/gui-*.png`; el gate `test:gui:screen-matrix` exige existencia, no vacio, no duplicados y tamano minimo de PNG |
| GUI docente operativa por pantallas principales | Cumplido | `npm run test:gui:responsive:e2e:ci` recorre acceso y pantallas docente en desktop/mobile |
| Portal alumno con acceso y resultados reales | Cumplido | `tests/gui-responsive/responsive-alumno.spec.ts` usa token/API mock, recarga resultados y captura login/resultados |
| Admin negocio con dashboard y Tenants | Cumplido | `tests/gui-responsive/responsive-admin.spec.ts` captura dashboard y navega a Tenants antes de evidencia |
| Simplicidad/elegancia funcional en CSS base | Cumplido | `npm run test:gui:design-contract` bloquea decoracion radial, tracking negativo y radios excesivos |
| Accesibilidad basica y controles sin solape | Cumplido local | `test:gui:responsive:e2e:ci` valida nombres accesibles, overflow y solapes materiales en frontend |
| Dashboard local | Cumplido local | `npm run test:dashboard:repair`, `npm run test:dashboard:ui`, `npm run test:update` |
| Installer Hub contrato y UI no destructiva | Cumplido local | `npm run test:installer-hub:contract`, `npm run test:installer-hub:ui`, `npm run test:wix:policy` |
| Preflight no destructivo de VM | Cumplido como diagnostico | `npm run installer:hub:vm-readiness` genera `reports/qa/latest/installer-hub-vm-readiness.json`; ultimo resultado elevado `ok=true` |
| Lanzador elevado seguro del E2E VM | Cumplido como preparacion | `npm run installer:hub:e2e:elevated` abre UAC, define snapshot, ejecuta readiness y se detiene si no esta dentro de `EVALPRO-E2E` |
| Guarda anti-host del E2E mutante | Cumplido como seguridad | `scripts/tests/installer-hub-e2e-docente.ps1` exige `COMPUTERNAME=EVALPRO-E2E` antes de instalar/reparar/desinstalar |
| Gates base AGENTS locales | Cumplido local | `npm run lint`, `npm run typecheck`, y gates registrados en `docs/ENGINEERING_BASELINE.md` |
| E2E VM release-like Installer Hub | Pendiente | Runner `scripts/tests/installer-hub-e2e-docente.ps1` requiere `-IUnderstandThisMutatesVm`, VM limpia y `EVALUAPRO_E2E_VM_SNAPSHOT`; no hay evidencia actual de ciclo completo |

## Readiness VM Actual

- `Test-WSMan EVALPRO-E2E`: responde.
- `TrustedHosts`: contiene `EVALPRO-E2E`.
- `Get-VM EvaluaPro-E2E-Win11`: pasa en ventana elevada; VM `Running`, `MemoryAssigned=3221225472`.
- `EVALUAPRO_E2E_VM_SNAPSHOT`: definido como `pre-evaluapro-installer-e2e` dentro del lanzador elevado.
- Reporte actual: `reports/qa/latest/installer-hub-vm-readiness.json` con `ok=true`.
- Relanzamiento elevado 2026-05-31: tras liberar memoria host con `wsl --shutdown`, el lanzador arranca la VM, espera WinRM y se detiene de forma segura en host.
- Ruta PowerShell Direct preparada: `scripts/ci/run-e2e-in-vm.ps1` valida `COMPUTERNAME=EVALPRO-E2E`, define `EVALUAPRO_E2E_VM_SNAPSHOT` y ya no llama el preflight Hyper-V desde dentro de la VM.
- La ruta PowerShell Direct tambien valida `C:\EvaluaPro`, existencia del runner y escribe `reports/qa/latest/powershell-direct-e2e-launch.json` antes de lanzar el E2E mutante.
- `scripts/ci/run-e2e-launcher.ps1 -DryRun` valida readiness sin pedir credenciales; salida actual confirma `readinessGeneratedAt=2026-05-31T14:28:56.0192680-06:00`.
- `scripts/ci/run-e2e-launcher.ps1` acepta `-Credential` y `-QaPassSecureString` para ejecucion no interactiva desde una sesion segura ya preparada; no persiste secretos.
- Transcript actual: `reports/qa/latest/installer-hub-e2e-elevated-transcript.txt`; confirma `Readiness OK` y detencion segura porque el runner mutante debe ejecutarse dentro de `EVALPRO-E2E`.
- WinRM remoting con `Invoke-Command -ComputerName EVALPRO-E2E` falla por autenticacion Negotiate `0x8009030e`.
- PowerShell Direct con `Invoke-Command -VMName EvaluaPro-E2E-Win11` requiere `-Credential`.

## Criterio De Cierre

No declarar `complete` hasta que exista evidencia actual del runner real con:

- VM limpia o snapshot `pre-evaluapro-installer-e2e` confirmado.
- `install` completo.
- `repair` completo.
- `update smoke` con `manifest/update-status.json`.
- `uninstall` completo.
- Logs, screenshots y `report.json` copiados al directorio de evidencia.

## Comando Pendiente

Ejecutar solo en VM desechable y shell con permisos Hyper-V:

```powershell
npm run installer:hub:vm-readiness
npm run installer:hub:e2e:elevated
$env:EVALUAPRO_E2E_VM_SNAPSHOT = 'pre-evaluapro-installer-e2e'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-e2e-docente.ps1 -IUnderstandThisMutatesVm
```

El ultimo comando debe ejecutarse dentro de la VM `EVALPRO-E2E`, no en el host `TEZKATLI`.
