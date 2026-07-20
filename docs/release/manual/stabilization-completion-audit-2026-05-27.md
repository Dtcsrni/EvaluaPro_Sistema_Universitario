# Auditoría de completitud de estabilización

Fecha de actualización: 2026-07-15

## Veredicto

Estado: `partial`

La validación UX/UI y los contratos del Installer Hub están cubiertos localmente. El cierre release-like requiere ejecutar en esta PC el E2E mutativo completo: `install`, `repair`, `update smoke` y `uninstall`, con cuentas, tres materias y tres alumnos dummy.

## Requisitos y evidencia

Comandos de validación local: `npm run test:gui:screen-matrix`, `npm run test:gui:design-contract`, `npm run test:gui:responsive:e2e:ci`, `npm run test:installer-hub:contract`, `npm run test:installer-hub:ui`, `npm run test:dashboard:repair` y `npm run test:dashboard:ui`.

| Requisito | Estado | Evidencia |
| --- | --- | --- |
| Contrato UX/UI repo-local | Cumplido | `docs/DESIGN.md`, `docs/UX_QUALITY_CRITERIA.md`, contratos y matriz responsive |
| UX/UI docente interactiva | Cumplido local | `npm run test:gui:responsive:e2e:docente` |
| Installer Hub contrato y UI | Cumplido local | `npm run test:installer-hub:contract`, `npm run test:installer-hub:ui` |
| Runtime nativo y footprint | Cumplido | `npm run installer:docente:baseline:enforce` |
| E2E local del Installer Hub | Pendiente de ejecución | `npm run installer:hub:e2e:local` |
| Datos dummy aislados | Pendiente de ejecución/verificación | 1 cuenta docente, 3 materias y 3 alumnos requeridos |
| Gates base | Cumplido local | lint, typecheck, SDD y CI remoto |

## Criterio de cierre

No declarar `complete` hasta que el runner local genere `report.json` con resultados OK para:

- instalación y firma/hash;
- cuenta docente dummy y cuenta alumno dummy;
- tres materias dummy;
- tres alumnos dummy;
- navegación y persistencia del ciclo docente;
- dashboard, status y update smoke;
- repair y uninstall;
- logs y screenshots locales.

## Comando canónico

```powershell
npm run installer:hub:e2e:local # usa -IUnderstandThisMutatesPc
```

El flujo no requiere VM, Hyper-V, WinRM, snapshots ni credenciales remotas.
