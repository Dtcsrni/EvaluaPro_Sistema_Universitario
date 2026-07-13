# Tutorial visual E2E Installer Hub docente-local

Este tutorial se genera desde la evidencia real de VM. Muestra el flujo completo install, repair, Plataforma docente nativa, dashboard y uninstall.

## 1. Preparar
- Confirmar flavor `docente-local`, modo y ruta.
- El Hub docente no expone configuracion avanzada legacy.
- Ejecutar `run-e2e-launcher.ps1 -DryRun` antes del ciclo real si se opera desde host.
- Confirmar `powershell-direct-e2e-launch.json` con `acceptsCredentialParameter=true`.
- Ejecutar el launcher real con `-Credential` y `-QaPassSecureString`; no guardar passwords en archivos, logs ni handoffs.

## 2. Revisar
- Ejecutar prerequisitos.
- Continuar solo si el Hub queda listo o documenta remediacion/reinicio.

## 3. Ejecutar
- Instalar, reparar o desinstalar desde el boton primario.
- No cerrar la ventana mientras exista operacion busy.

## 4. Plataforma docente nativa
- El launcher nativo debe mantener Node/API y Web docente en ejecucion.
- API: `http://127.0.0.1:4000/api/salud` debe responder 200.
- Web docente: `http://127.0.0.1:4173` debe responder 200.
- Dashboard: `/api/status` debe estar `healthy` o `degraded`, nunca `failed`.
- Update smoke: `/api/update/status` debe responder y guardarse como `manifest/update-status.json`.

## 5. Evidencia
- Reporte JSON: `report.json`.
- Runtime nativo: `native/`.
- Logs: `logs/`.
- Manifiestos: `manifest/`.
- Procesos: `processes/`.

## Capturas

### wpf-install-01-splash-deteccion

![](./screenshots/wpf-install-01-splash-deteccion.png)

### wpf-install-02-preparar

![](./screenshots/wpf-install-02-preparar.png)

### wpf-install-03-revisar

![](./screenshots/wpf-install-03-revisar.png)

### wpf-install-04-ejecutar-1040x760

![](./screenshots/wpf-install-04-ejecutar-1040x760.png)

### wpf-install-05-ejecutar-980x700

![](./screenshots/wpf-install-05-ejecutar-980x700.png)

### wpf-install-06-resultado

![](./screenshots/wpf-install-06-resultado.png)

