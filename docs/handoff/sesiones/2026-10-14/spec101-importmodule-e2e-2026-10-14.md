# Handoff IA - Iteración E2E SPEC-101

- traceSchemaVersion: 1.0.0
- sessionId: spec101-importmodule-e2e-2026-10-14
- parentSessionId: spec101-installer-report-acl-2026-10-14
- status: draft
- generatedAt: 2026-10-14T18:32:04Z
- validationProfile: full

## Objetivo
- Estabilizar el E2E de upgrade v1.2.3 → 1.2.8 antes de considerar 1.2.8 lista para release.
- Revisar visualmente la interfaz del Installer Hub desde las capturas reales del E2E.

## Hallazgo y corrección
- El run #647 verificó correctamente el baseline oficial 1.2.3, pero el runner terminó antes de instalar: `Import-Module -LiteralPath` no es un parámetro admitido por Windows PowerShell 5.1.
- Cambié la importación a `Import-Module -Name`, corregí el contrato que esperaba la sintaxis inválida y añadí prueba que importa el módulo mediante Windows PowerShell real. La prueba usa `-ExecutionPolicy Bypass` únicamente en el proceso hijo, sin cambiar la política de la máquina.
- Actualicé SPEC-101 con REQ-005.

## Validación ejecutada
- `node --test scripts/tests/installer-upgrade-e2e-contract.test.mjs`: 20/20 aprobadas.
- `npm run test:installer-hub:contract`: 147 aprobadas, 13 omitidas, 0 fallos.
- `npm run pipeline:contract:check`: 42/42.
- `npm run sdd:audit`: exitoso.
- `npm run ci:policy:audit`: exitoso.

## Pendiente
- Commit, push y CI de la corrección.
- Repetir el workflow manual desde `main`, `source_sha` igual al `HEAD` y `release_tag` vacío.
- Revisar el reporte, capturas visuales de los seis estados UI, dashboard/runtime y pasos de upgrade/repair/uninstall.
- No crear tag ni publicar release durante esta validación.

## Artefacto
- [Run #647 fallido antes de crear evidencia](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/runs/38613620986)
