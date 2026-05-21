# Tutorial visual E2E Installer Hub docente-local

Este documento describe el tutorial que genera la validacion real del Installer Hub en una VM limpia. La version final de cada ejecucion queda en `reports/qa/installer-hub-e2e-docente/<timestamp>/tutorial.md` con capturas reales.

## Preparar

Confirma que la VM esta en snapshot `pre-evaluapro-installer-e2e`, que el bundle `docente-local` coincide con su SHA256 y que no existe instalacion previa de EvaluaPro.

En el Hub, revisa flavor, modo, ruta de instalacion y accesos. Mantén la configuracion avanzada colapsada salvo que soporte indique lo contrario.

## Revisar

Ejecuta la revision de prerequisitos. El flujo solo debe continuar si los requisitos quedan en estado listo o si el Hub muestra remediacion/reinicio con evidencia clara.

## Ejecutar

Usa el boton primario del modo activo: Instalar, Reparar o Desinstalar. No cierres la ventana mientras el Hub indique una operacion en progreso.

## Docker stable

Despues de instalar, el runner levanta el stack productivo:

```powershell
docker compose --profile prod up --build -d mongo_local api_docente_prod web_docente_prod
```

Estado estable esperado:

- `mongo_local`, `api_docente_prod` y `web_docente_prod` en `running`.
- Healthchecks en `healthy`.
- API `http://127.0.0.1:4000/api/salud` responde 200.
- Web docente `http://127.0.0.1:4173` responde 200.
- Dashboard `/api/status` queda `healthy` o `degraded`, nunca `failed`.

## Resultado y evidencia

La ejecucion genera:

- `report.json`: resultado estructurado.
- `screenshots/`: capturas WPF, dashboard y web docente.
- `docker/`: `docker-ps.json`, `docker-inspect.json`, logs y healthchecks.
- `logs/`: logs Burn/MSI/helper exportados.
- `manifest/`: manifiesto de instalacion y update config.
- `processes/`: snapshots antes/despues/error.

## Uninstall estandar

La desinstalacion debe retirar producto, accesos y entradas ARP. Solo pueden permanecer datos, licencia, logs y backups documentados en `docs/DESIGN.md`.
