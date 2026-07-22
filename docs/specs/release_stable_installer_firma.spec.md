---
id: SPEC-RELEASE-STABLE-INSTALLER-FIRMA
titulo: Gate estable exige instaladores firmados
version: 1.0.0
fecha: 2026-06-27
autor: Codex / Agente IA
modulo: release
estado: implemented
---

# SPEC-RELEASE-STABLE-INSTALLER-FIRMA: Gate estable exige instaladores firmados

## Contexto
Una promocion estable para usuarios finales de Windows no debe aprobarse si los artefactos del instalador se generaron sin firma de codigo, con version incorrecta o con una Bootstrapper Application Burn embebida obsoleta. El manifest release ya registra `signed`; el gate estable debe tratar cualquier artefacto no firmado, stale o versionado contra otra release como No-Go para evitar publicar instaladores no confiables o visualmente inconsistentes.

## Requisitos Funcionales
- **REQ-001:** `release:validate:stable` debe validar que el manifest de instalador contenga los flavors requeridos `saas-completo` y `docente-local`.
- **REQ-002:** `release:validate:stable` debe fallar si cualquier artefacto del manifest tiene `signed` distinto de `true`.
- **REQ-003:** El detalle del check debe indicar que hay artefactos sin firma cuando aplique.
- **REQ-004:** El flujo `installer:sign` debe regenerar hashes y manifest despues de firmar, porque la firma cambia los binarios.
- **REQ-005:** `release:validate:stable` debe fallar si un artefacto del manifest no contiene `name`, `path` y `sha256`.
- **REQ-006:** Debe existir un smoke local reproducible para validar el gate de flujo docente mayo-junio sin sobrescribir la evidencia productiva `1.1.0` ni declararse como entorno productivo.
- **REQ-007:** `release:validate:stable` debe fallar si no existe evidencia externa real de Google Classroom validada por `release:check:classroom-e2e`.
- **REQ-008:** El build Burn debe fallar si el bundle publico contiene `EvaluaPro.BurnBootstrapperApp.exe` embebido con `FileVersion` o `ProductVersion` distinta de la version objetivo.
- **REQ-009:** `release:validate:stable` debe fallar si `EvaluaPro-release-manifest.json` tiene `version`, `build.version` o nombres de Hub versionados que no corresponden a la version objetivo.
- **REQ-010:** Un workflow de build de instalador no debe marcar un release estable como `Latest`; solo el workflow de gate estable puede hacerlo despues de aprobar `release:validate:stable`.
- **REQ-011:** Los procesos WiX del build deben tener timeout interno y limpiar procesos hijos para evitar builds colgados que dejen artefactos parciales.
- **REQ-012:** `release:validate:stable` debe fallar si `docs/release/evidencias/<version>/manifest.json` no corresponde a la version objetivo.
- **REQ-013:** El Installer Hub WPF no debe exponer configuracion avanzada legacy ni campos tecnicos de Mongo/puertos/CORS/licencia en la UI de usuario final; el flujo `docente-local` debe usar defaults internos verificables.

## Criterios de Aceptación
- **AC-001 (REQ-001):** Un manifest completo con flavors requeridos y artefactos firmados permite aprobar el check de instalador.
- **AC-002 (REQ-002):** Un manifest con `signed:false` en cualquier artefacto produce `No-Go`.
- **AC-003 (REQ-003):** El resultado del check `installer-multi-flavor` contiene un mensaje accionable sobre artefactos no firmados.
- **AC-004 (REQ-004):** `sign-installer-artifacts.ps1` invoca `generate-installer-hashes.ps1` despues de completar la firma.
- **AC-005 (REQ-005):** Un manifest con artefactos firmados pero sin `path` verificable produce `No-Go`.
- **AC-006 (REQ-006):** El smoke local escribe evidencia bajo una version separada `1.1.0-local.0`, registra `entorno=local-smoke` y conserva `1.1.0` como gate humano productivo independiente.
- **AC-007 (REQ-007):** Una promocion stable sin JSON Classroom real validable produce `No-Go` en el check `classroom-e2e-evidence`.
- **AC-008 (REQ-008):** `scripts/assert-installer-hub-bundle.ps1` extrae el bundle con WiX y valida metadata del bundle externo y del BA embebido.
- **AC-009 (REQ-009):** Un manifest firmado pero generado para otra version produce `No-Go` en `installer-multi-flavor`.
- **AC-010 (REQ-010):** `ci-installer-windows.yml` usa `make_latest:false` y `release-stable-gate.yml` ejecuta `gh release edit ... --latest` solo despues del gate.
- **AC-011 (REQ-011):** `Invoke-WixBuildProcess` respeta `EVALUAPRO_WIX_PROCESS_TIMEOUT_SECONDS`, supervisa el proceso sin quedar bloqueado en `WaitForExit`, limpia descendientes y falla con mensaje accionable incluyendo stdout/stderr si WiX excede el tiempo permitido.
- **AC-012:** Los workflows de release ejecutan el gate de footprint docente mediante el script explícito `scripts/installer-docente-baseline.mjs --json --enforce`, sin depender de que npm resuelva un alias de script.
- **AC-012 (REQ-012):** Una ejecucion con `--version=1.1.1` y evidencia `manifest.json` de `1.0.0` produce `No-Go` en `release-evidence`.
- **AC-013 (REQ-013):** El contrato del Hub falla si aparecen `AdvancedConfigExpander`, `Configuración avanzada`, `Mongo URI`, `MongoDB` o controles XAML legacy de configuracion avanzada.
- **AC-014 (REQ-014):** El workflow respalda el servidor estático antes del build frontend, genera en `$RUNNER_TEMP` un smoke que lo ejecuta con `EVALUAPRO_STATIC_ROOT` y valida HTTP 200 en `/` con HTML SPA antes de empaquetar.
- **AC-015 (REQ-015):** El servidor estático docente se respalda inmediatamente después del checkout, antes de instalaciones o limpiezas que puedan retirar scripts auxiliares.
- **AC-016 (REQ-016):** En `workflow_dispatch`, el job de publicación hace checkout explícito de `inputs.head_sha`, sin sustituirlo por una salida ambigua del gate.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Manifest multi-flavor completo | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-002 | Rechazo de artefactos no firmados | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-003 | Mensaje de No-Go por firma faltante | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-004 | Hashes y manifest regenerados despues de firma | scripts/tests/installer-hub-contract.test.mjs | Completado |
| REQ-005 | Artefactos firmados requieren path y sha256 | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-006 | Smoke local separado para flujo docente mayo-junio | scripts/release/prod-flow-local-smoke.mjs | Completado |
| REQ-007 | Stable requiere evidencia Classroom real | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-008 | Bundle Burn valida BA embebido contra version objetivo | scripts/tests/installer-hub-contract.test.mjs | Completado |
| REQ-009 | Manifest release no acepta version stale | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-010 | Latest solo se marca despues del gate estable | scripts/tests/installer-hub-contract.test.mjs | Completado |
| REQ-011 | WiX no puede quedar colgado indefinidamente | scripts/tests/installer-hub-contract.test.mjs | Completado |
| REQ-012 | Evidencia release debe coincidir con version objetivo | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-013 | Hub no expone configuracion avanzada legacy | scripts/tests/installer-hub-contract.test.mjs | Completado |
