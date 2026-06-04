# Estabilizacion: Fallos Y Aprendizajes

Ledger acumulativo de patrones detectados durante la estabilizacion de
`stabilization/v1.0`. Registrar resumen verificable; no volcar logs crudos ni
secretos.

| Fecha | Falla | Clasificacion | Causa raiz | Correccion | Prueba o preflight | Prevencion |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05-21 | `ai:serena:policy:status` marcaba capa global no lista aun con `serena.exe` configurado | Tooling Codex | Regex de `command` no aceptaba ruta Windows a `serena.exe`; faltaba hook global | Verificador cubierto con prueba y hooks repo/global alineados | `node --test scripts/tests/ai-serena-policy-status.test.mjs`; `npm run ai:serena:policy:status -- --json` | Probar parsing de configuracion con rutas Windows antes de endurecer politica |
| 2026-05-21 | Referencia visual externa no aceptaba el desglose inicial de nueve paginas | Bloqueo externo | La herramienta externa disponible imponia limites de paginas por archivo nuevo | El contrato visual se consolida en repo: `docs/DESIGN.md`, `docs/UX_QUALITY_CRITERIA.md`, matriz GUI y screenshots Playwright | Creacion de guia externa descartada; se prioriza evidencia local reproducible | Diseñar pantallas por grupos logicos y validar en runtime antes de aceptar una referencia visual |
| 2026-05-21 | E2E VM de Installer Hub no puede relanzarse desde esta sesion aun con `Test-WSMan EVALPRO-E2E` respondiendo | Entorno QA | La sesion no tiene acceso Hyper-V ni permisos para agregar `EVALPRO-E2E` a `TrustedHosts`; WinRM HTTP sin confianza no abre sesion remota | Mantener E2E VM clasificado como parcial y conservar ruta reproducible para ejecucion elevada/HTTPS | `Get-VM EvaluaPro-E2E-Win11`; `Get-Item WSMan:\localhost\Client\TrustedHosts`; `Set-Item WSMan:\localhost\Client\TrustedHosts`; `Test-WSMan EVALPRO-E2E` | Preflight VM debe distinguir conectividad WinRM de autorizacion Hyper-V/TrustedHosts antes de iniciar ciclo release-like |
| 2026-05-21 | `test:gui:responsive:e2e:ci` abortaba antes de clicks por falta de `chrome-headless-shell.exe` | Entorno QA | Playwright estaba instalado en `node_modules`, pero faltaba el browser Chromium/Headless Shell que usa el runner | Browser reparado con instalacion de Chromium y `env-doctor` endurecido para detectar el faltante | `npx playwright install chromium`; `node --test scripts/tests/env-doctor.test.mjs`; `npm run env:doctor:windows`; `npm run test:gui:responsive:e2e:ci` | Tratar browser Playwright como prerequisito de QA GUI, no como detalle implicito del paquete npm |
| 2026-05-21 | El build del bundle docente caia si `test:backend:ci` activaba fallback `threads` | Harness | `omr.tv3.porFolioValidation.test.ts` usaba `process.chdir()` aunque ya pasaba rutas absolutas; Vitest workers no soportan esa mutacion | Fixture sin `chdir`, compatible con el fallback declarado por el gate backend | `npm -C apps/backend run test -- --pool=threads tests/omr.tv3.porFolioValidation.test.ts` | Todo fallback de pool debe ejecutar fixtures sin mutar cwd global |

## Regla De Uso

1. Clasificar cada fallo como producto, harness, entorno, UX/flujo,
   rendimiento o bloqueo externo.
2. Agregar causa solo cuando este verificada; si falta evidencia, registrar el
   siguiente probe en vez de inventarla.
3. Asociar cada correccion con una prueba, preflight o criterio de bloqueo.
4. Actualizar handoff, baseline e inventario cuando cambie el estado operativo.
