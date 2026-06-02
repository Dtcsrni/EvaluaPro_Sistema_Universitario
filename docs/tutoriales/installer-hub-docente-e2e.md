# Tutorial visual E2E Installer Hub docente-local

Este tutorial se genera desde la evidencia real de VM. Muestra el flujo completo install, repair, Docker stable, dashboard y uninstall.

## 1. Preparar
- Confirmar flavor `docente-local`, modo y ruta.
- Mantener configuracion avanzada colapsada salvo soporte.
- Ejecutar `run-e2e-launcher.ps1 -DryRun` antes del ciclo real si se opera desde host.
- Confirmar `powershell-direct-e2e-launch.json` con `acceptsCredentialParameter=true`.
- Ejecutar el launcher real con `-Credential` y `-QaPassSecureString`; no guardar passwords en archivos, logs ni handoffs.

## 2. Revisar
- Ejecutar prerequisitos.
- Continuar solo si el Hub queda listo o documenta remediacion/reinicio.

## 3. Ejecutar
- Instalar, reparar o desinstalar desde el boton primario.
- No cerrar la ventana mientras exista operacion busy.

## 4. Estado estable Docker
- `mongo_local`, `api_docente_prod` y `web_docente_prod` deben estar `running` y `healthy`.
- API: `http://127.0.0.1:4000/api/salud` debe responder 200.
- Web docente: `http://127.0.0.1:4173` debe responder 200.
- Dashboard: `/api/status` debe estar `healthy` o `degraded`, nunca `failed`.
- Update smoke: `/api/update/status` debe responder y guardarse como `manifest/update-status.json`.

## 5. Evidencia
- Reporte JSON: `report.json`.
- Docker: `docker/`.
- Logs: `logs/`.
- Manifiestos: `manifest/`.
- Procesos: `processes/`.

## Capturas

### wpf-install-01-splash-deteccion

![](./screenshots/wpf-install-01-splash-deteccion.png)
