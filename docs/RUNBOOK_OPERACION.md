# Runbook Operación (Local + Cloud mínimo)

## 1. Verificación rápida de salud
Backend:
- `GET /api/salud/live`
- `GET /api/salud/ready`
- `GET /api/salud/metrics`
- `GET /api/version`

Portal:
- `GET /api/portal/salud/live`
- `GET /api/portal/salud/ready`
- `GET /api/portal/metrics`
- `GET /api/portal/version`
- En `docente-local` se consideran verificaciones opcionales de integracion, no prerequisitos del stack minimo.

## 2. Síntoma: API no responde
1. Revisar contenedores/proceso:
- `docker compose ps`
2. Verificar logs:
- backend/portal en formato JSON con `requestId`.
3. Comprobar readiness:
- Si `ready` da 503, validar conectividad MongoDB.
- Campo estandar: `dependencies.mongodb` (`status`, `ready`, `state`, `description`).

### Arranque estable local (Windows)
1. Ejecutar acceso directo:
- `EvaluaPro - Prod`
2. Comportamiento esperado:
- inicia dashboard/tray
- si stack prod no esta activo, ejecuta `stack:prod`
- si la app ya estaba instalada, upgrade in-place conservando atajos operativos
3. Verificacion:
- backend: `GET /api/salud/live`
- frontend docente disponible en `http://localhost:4173`
- MongoDB local accesible por el stack Docker

### Reparar instalacion desde Dashboard
1. Abrir pestaña `Configuración`.
2. Ejecutar `Diagnosticar ahora`.
3. Si aparece `Requiere reparación`, ejecutar `Reparar instalación`.
4. Revisar progreso por pasos y la sección `Acciones manuales`.
5. Confirmar salud final:
- `GET /api/salud/live`
- disponibilidad de `web_docente_prod`

Alcance de la reparación v1:
- no destructiva (no borra datos ni volúmenes),
- recompila portal si falta `dist/index.js` solo cuando una validacion de integracion lo requiere,
- recrea accesos directos,
- reinicia/recupera el stack docente minimo.

### Instalador (MSI/WiX) - experiencia esperada
- textos de instalacion con indicaciones de prerrequisitos.
- barra de progreso real por fase (checks previos + compilacion MSI + bundle EXE) al generar distribuible.
- validacion de prerequisitos no autoconfigurables:
  - runtime Docker compatible (`WSL2 + Docker Engine` o `Docker Desktop`)
  - en `docente-local`, `Node 24` host en Windows + runtime Node embebido local saludable
  - `Node 24` dentro de la distro `WSL2` solo cuando el runtime activo sea `WSL2 + Docker Engine`

### Instalador docente desde cero (Installer Hub)
1. Descargar `EvaluaPro-InstallerHub-docente-local.exe` desde la release estable.
2. Ejecutar el bundle Burn y aceptar UAC cuando lo solicite.
3. Flujo esperado:
   - apertura estable de la BA `WPF .NET 8`,
   - deteccion automatica de modo (`install` / `repair` / `uninstall`),
   - analisis de requisitos del equipo,
   - prerequisitos visibles (runtime Node embebido local + runtime Docker compatible para stack docente minimo),
   - si se elige `WSL2 + Docker Engine` y falta `WSL2`/Docker Engine/Node 24 en la distro objetivo, emision de guía local de bootstrap y remediacion semiautomatica para completar el runtime soportado,
   - chain `MSI` controlado por Burn,
   - helper post-install para `.env`, `update-config.json`, verificacion final y blindaje local de licencia.
   - no existe ya una variante soportada `PowerShell WinForms`; el bundle Burn es la unica entrada valida.
   - el stack minimo del flavor es `mongo_local + api_docente_prod + web_docente_prod`; portal local no requerido.
   - `Node.js 24` host en Windows forma parte del prerequisito obligatorio y se remedia automaticamente dentro del flujo del Hub.
4. Criterio de integridad:
   - `EvaluaPro-release-manifest.json` y los `.sha256` publicados coinciden con los artefactos locales.
5. Desinstalacion:
   - por defecto conserva datos,
   - opcion de limpieza total disponible solo en modo `uninstall`.

Si el instalador se genera localmente en este equipo, la ruta recomendada es:
- `C:\Users\evega\EvaluaPro_Sistema_Universitario\dist\installer\EvaluaPro-InstallerHub-docente-local.exe`

## 3. Síntoma: incremento de errores 5xx
1. Revisar métrica de errores y latencia p95.
2. Filtrar logs por `level=error` y `requestId`.
3. Verificar últimas modificaciones desplegadas.

## 4. Síntoma: problemas de autenticación
1. Confirmar variables:
- `JWT_SECRETO`
- `PORTAL_API_KEY`
- `PORTAL_ALUMNO_API_KEY`
2. Revisar expiración y sincronización horaria.

## 5. Smoke post-deploy mínimo
1. Autenticación docente.
2. Crear materia.
3. Crear alumno.
4. Generar examen.
5. Flujo de publicación/sincronización básico.

## 5.1 Smoke prod local (stack docente minimo)
1. `GET /api/salud/live` -> 200
2. `GET /api/metrics` -> 200
3. `GET /api/version` -> 200
4. `http://localhost:4173` responde para la UI docente

Si el portal forma parte de una validacion de integracion:
- ejecutar `npm run portal:prod`
- revisar logs de dashboard/tray para build/start de portal

Smoke automatizado sugerido:
- `npm run ops:smoke:pilot -- --backend-base=http://localhost:4000/api --portal-base=https://<tu-portal>/api/portal`

## 6. Escalamiento
- Si hay degradación sostenida (`ready` inestable + errores altos), activar rollback al último release estable.

## 7. Verificacion de integridad de lista academica (SHA-256)
1. Descargar:
- `lista-academica.csv`
- `lista-academica.docx`
- `lista-academica.manifest.json`
2. Calcular hash local SHA-256 de ambos archivos.
3. Comparar contra `archivos[].sha256` del manifiesto.
4. Si no coincide:
- no distribuir el archivo
- regenerar exportacion
- revisar logs por `requestId` y repetir validacion

## 8. Levantar observabilidad local en 5 minutos
1. Iniciar Prometheus con la configuracion versionada:
- `prometheus --config.file=ops/observabilidad/prometheus.yml`
2. Verificar targets:
- backend: `http://host.docker.internal:3000/api/metrics` (alias portable via `host-gateway` en Compose)
- portal: `http://host.docker.internal:3001/api/portal/metrics` (ajustar a IP/host local resoluble si Prometheus corre fuera del stack)
3. Importar dashboard base en Grafana:
- `ops/observabilidad/grafana/dashboard-evaluapro.json`
4. Confirmar reglas de alerta cargadas:
- `ops/observabilidad/alert.rules.yml`
5. Puertos sugeridos:
- Prometheus `9090`
- Grafana `3002`

## 9. Gate estable con docente humano en produccion
1. Confirmar prerequisitos:
- 10 corridas CI consecutivas verdes.
- checklist de rollback listo.
2. Ejecutar flujo humano completo con docente activo.
3. Generar evidencia automatizada:
- `npm run release:gate:prod-flow -- --version=<version> --periodo-id=<periodoId> --manual=docs/release/manual/prod-flow.json`
4. Verificar artefactos:
- `docs/release/evidencias/<version>/manifest.json`
- `docs/release/evidencias/<version>/timeline.md`
- `docs/release/evidencias/<version>/metrics_snapshot.txt`
- `docs/release/evidencias/<version>/integridad_sha256.json`
- `docs/release/evidencias/<version>/rollback_readiness.json`
5. Confirmar que la evidencia use:
- `version` técnica `1.0.0`
- `displayVersion` visible `1.0.0b`
6. Si el resultado del manifiesto es `fallo`, bloquear promocion y ejecutar rollback/correccion.

## 10. Validacion preproduccion automatizada (sin prueba humana)
1. Ejecutar:
- `npm run test:dataset-prodlike:ci`
- `npm run test:e2e:docente-alumno:ci`
- `npm run test:global-grade:ci`
- `npm run test:evaluaciones:policy:ci`
- `npm run test:evaluaciones:e2e:ci`
- `npm run test:pdf-print:ci`
- `npm run test:ux-visual:ci`
2. Consolidar evidencia:
- `npm run test:qa:manifest`
3. Verificar artefactos en `reports/qa/latest/`:
- `dataset-prodlike.json`
- `e2e-docente-alumno.json`
- `global-grade.json`
- `evaluaciones-policy.json`
- `evaluaciones-e2e.json`
- `pdf-print.json`
- `ux-visual.json`
- `manifest.json`
4. Regla Go/No-Go:
- Todos los comandos y artefactos OK: `GO beta`.
- Cualquier falla o artefacto faltante: `NO-GO`.

## 11. Preflight operativo para generacion de examenes globales
Objetivo: validar que una materia/curso en produccion tiene todas las precondiciones para generar examenes globales desde banco + plantillas.

Comando recomendado (sin mutar datos):
- `npm run release:preflight:global -- --api-base=<https://api-dominio/api> --token=<jwt_docente> --periodo-id=<periodoId> --modo=readonly`

Smoke opcional (muta datos de forma controlada: genera 1 examen y lo archiva):
- `npm run release:preflight:global -- --api-base=<https://api-dominio/api> --token=<jwt_docente> --periodo-id=<periodoId> --modo=smoke --alumno-id=<alumnoId>`

Salida verificable:
- `reports/qa/latest/preflight-global-prod.json`

Regla Go/No-Go:
- `GO`: estado `ok` y todos los checks en verde.
- `NO-GO`: cualquier check en `fallo` (periodo, alumnos, banco, plantillas globales, previsualizacion o smoke).
