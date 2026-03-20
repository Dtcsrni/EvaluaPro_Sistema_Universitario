# Evidencia Release Windows - Repair Smoke y Validacion Activa

Fecha: `2026-03-20`
Version objetivo: `1.0.0-beta.1`

## Objetivo
- Validar aceptacion release Windows para `install/repair/launcher/Hub`.
- Cubrir dos niveles de evidencia:
  - smoke agresivo y aislado en `InstallDir` temporal
  - smoke no destructivo sobre la instalacion activa del equipo

## Alcance validado
- `scripts/installer-hub/InstallerHub.ps1`
- `scripts/launcher-broker.ps1`
- `scripts/launcher-dashboard.mjs`
- `scripts/create-shortcuts.ps1`
- `scripts/generate-installation-manifest.ps1`
- `logs/installation.manifest.json`

## Smoke aislado y agresivo
- Suite: `scripts/tests/windows-release-smoke.test.mjs`
- Modo: headless con `-InstallDir` temporal
- Estrategia:
  - instalacion temporal `docente-local`
  - release local simulada con MSI fixture verificado por hash
  - accion de producto simulada via copia controlada desde el repo
  - dano fuerte y reproducible:
    - borrado/corrupcion de `logs/installation.manifest.json`
    - borrado de shortcuts
    - dano no destructivo de wrappers/broker
    - inconsistencia intencional entre `update-config.json`, flavor y archivos criticos
- Resultado esperado/observado:
  - `repair` reclasifica la instalacion como reparable
  - regenera manifiesto y shortcuts
  - recompone archivos operativos
  - termina en `ok`

## Smoke activo no destructivo
- Suite: `scripts/tests/windows-release-smoke.test.mjs`
- Validaciones sobre esta instalacion:
  - `verify-installation`
  - `regenerate-shortcuts`
  - `open-dashboard`
  - lectura de `logs/installation.manifest.json`
  - consulta de `bootstrap.meta.base/api/status`
  - `npm run status`
- Resultado esperado/observado:
  - shortcuts oficiales presentes:
    - `EvaluaPro - Dev`
    - `EvaluaPro - Prod`
    - `EvaluaPro - Hub`
  - broker mantiene singleton por instalacion
  - `Prod` no marca `healthy` sin salud docente real
  - Hub y dashboard comparten estado operativo consistente

## Gates y contratos ejecutados
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:frontend:ci` ✅
- `npm run test:coverage:ci` ✅
- `npm run test:tdd:enforcement:ci` ✅
- `npm run test:backend:ci` ✅
- `npm run test:portal:ci` ✅
- `npm run perf:check` ✅
- `npm run pipeline:contract:check` ✅
- `npm run test:installer-hub:contract` ✅
- `npm run test:dashboard:repair` ✅
- `npm run test:dashboard:ui` ✅
- `node --test scripts/tests/windows-release-smoke.test.mjs` ✅

## Artefactos y rutas verificadas
- manifiesto: `logs/installation.manifest.json`
- bootstrap states: `logs/bootstrap-state-*.json`
- licencia portable local: `C:\ProgramData\EvaluaPro\security\portable-license.epl`
- llaves publicas locales: `C:\ProgramData\EvaluaPro\security\portable-license-public-keys.json`

## Conclusiones
- La aceptacion Windows de `repair` queda validada con dano agresivo en entorno temporal aislado.
- La instalacion activa del equipo pasa la validacion no destructiva de Hub, broker, dashboard, shortcuts y salud real.
- El siguiente tramo puede enfocarse en evidencia formal de promocion estable o rollback checklist sin reabrir arquitectura de launcher/repair.
