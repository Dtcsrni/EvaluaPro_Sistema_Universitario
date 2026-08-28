# Evidencia Release Windows - Repair Smoke y Validación Activa

Fecha: `2026-08-28`
Versión objetivo: `1.1.1` (Primera versión estable reconocida)

## Objetivo
- Validar aceptación release Windows para `install/repair/launcher/Hub`.
- Cubrir dos niveles de evidencia:
  - smoke agresivo y aislado en `InstallDir` temporal
  - smoke no destructivo sobre la instalación activa del equipo

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
  - instalación temporal `docente-local`
  - release local simulada con MSI fixture verificado por hash
  - acción de producto simulada vía copia controlada desde el repo
  - daño fuerte y reproducible:
    - borrado/corrupción de `logs/installation.manifest.json`
    - borrado de shortcuts
    - daño no destructivo de wrappers/broker
    - inconsistencia intencional entre `update-config.json`, flavor y archivos críticos
- Resultado esperado/observado:
  - `repair` reclasifica la instalación como reparable
  - regenera manifiesto y shortcuts
  - recompone archivos operativos
  - termina en `ok`

## Smoke activo no destructivo
- Suite: `scripts/tests/windows-release-smoke.test.mjs`
- Validaciones sobre esta instalación:
  - `verify-installation`
  - `regenerate-shortcuts`
  - `open-dashboard`
  - lectura de `logs/installation.manifest.json`
  - consulta de `bootstrap.meta.base/api/status`
  - `npm run status`
- Resultado esperado/observado:
  - shortcuts oficiales presentes:
    - `EvaluaPro`
    - `EvaluaPro - Hub`
  - broker mantiene singleton por instalación
  - Hub y dashboard comparten estado operativo consistente

## Gates y contratos ejecutados
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:frontend:ci` ✅
- `npm run test:coverage:ci` ✅
- `npm run test:backend:ci` ✅
- `npm run test:installer-hub:contract` ✅
- `npm run qa:clean-architecture:strict` ✅
