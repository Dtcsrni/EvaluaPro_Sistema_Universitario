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

## Hallazgos Reproducidos

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
