# Handoff: VM E2E Readiness

- traceSchemaVersion: 1.0.0
- sessionId: sesion-2026-05-27-e2e-vm-readiness
- generatedAt: 2026-05-27T19:11:55-06:00
- status: draft

## Resumen

Ejecuté el preflight no destructivo para la VM `EvaluaPro-E2E-Win11` usando `npm run installer:hub:vm-readiness` desde el host. El resultado es `ok: false` — hay dos cheques fallidos que impiden ejecutar el runner mutante desde esta shell.

## Evidencia (reports/qa/latest/installer-hub-vm-readiness.json)

```
{
    "ok":  false,
    "generatedAt":  "2026-05-27T19:11:55.8055359-06:00",
    "vmName":  "EvaluaPro-E2E-Win11",
    "computerName":  "EVALPRO-E2E",
    "expectedSnapshotName":  "pre-evaluapro-installer-e2e",
    "checks":  [
                   {"id":"snapshot.env","ok":false,"detail":"EVALUAPRO_E2E_VM_SNAPSHOT=; expected=pre-evaluapro-installer-e2e"},
                   {"id":"winrm.trusted-hosts","ok":true,"detail":"TrustedHosts=EVALPRO-E2E"},
                   {"id":"winrm.wsman","ok":true,"detail":"Test-WSMan EVALPRO-E2E responde"},
                   {"id":"hyperv.get-vm","ok":false,"detail":"No dispone del permiso necesario para completar esta tarea."}
               ],
    "nextCommand":  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-e2e-docente.ps1 -IUnderstandThisMutatesVm"
}
```

## Problemas detectados

- `snapshot.env` no definido: se espera `EVALUAPRO_E2E_VM_SNAPSHOT=pre-evaluapro-installer-e2e`. El runner mutante exige snapshot previo.
- `hyperv.get-vm` falla por permisos Hyper-V en la shell actual (no elevada). Esto impide operaciones `Get-VM` / `Restart-VM` desde esta sesión.

## Pasos recomendados para ejecutar E2E mutante (dentro de la VM o desde host elevado)

1. En el host que controla Hyper-V (ejecutar PowerShell elevada):

```powershell
$env:EVALUAPRO_E2E_VM_SNAPSHOT = 'pre-evaluapro-installer-e2e'
npm run installer:hub:vm-readiness
```

2. Si el preflight queda `ok=true` y TrustedHosts/WinRM están correctos, ejecutar con UAC elevada el lanzador seguro (desde host):

```powershell
npm run installer:hub:e2e:elevated
# Esto abrirá UAC y solo continuará si el preflight pasa. El paso final ejecuta:
# powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-e2e-docente.ps1 -IUnderstandThisMutatesVm
```

3. Alternativa (ejecutar *dentro* de la VM `EVALPRO-E2E`):

```powershell
# Abrir PowerShell como Administrador dentro de la VM
$env:EVALUAPRO_E2E_VM_SNAPSHOT = 'pre-evaluapro-installer-e2e'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-e2e-docente.ps1 -IUnderstandThisMutatesVm
```

4. Recolectar los artefactos generados por el runner y copiarlos al host (paths de evidencia ya estándar):

- `reports/qa/installer-hub-e2e-docente/<run-id>/report.json`
- `reports/qa/installer-hub-e2e-docente/<run-id>/bootstrap-state-<run>.json`
- `launcher-broker.log`, `dashboard.lock.json`, `manifest/update-status.json` (si corresponde)

## Notas finales

Desde la shell actual no se pueden completar los pasos mutantes: falta definir `EVALUAPRO_E2E_VM_SNAPSHOT` y elevar permisos Hyper-V. El handoff deja la instrucción clara para el operador que vaya a ejecutar el runner real.
