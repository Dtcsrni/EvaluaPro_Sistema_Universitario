---
id: SPEC-100
titulo: Solicitud versionada para preparar baseline de upgrade en E2E
version: 1.0.0
fecha: 2026-10-14
autor: Codex
modulo: installer_hub_e2e
estado: approved
---

## Contexto

El workflow de Windows construye el bundle docente y ejecuta la E2E completa de upgrade desde el MSI oficial v1.2.3. La preparación del baseline instala correctamente ese MSI y después invoca `InstallerBurnHelper.ps1 -Mode post-install` con un JSON de payload legado. El contrato vigente permite el formato legado solo para `detect-prereqs`; mutaciones como `post-install` exigen el sobre versionado v1. El workflow, por tanto, se detiene antes de la E2E de actualización del bundle candidato, aun cuando la política de seguridad del helper es correcta.

El cambio se limita al harness de prueba. Debe construir una solicitud v1 válida manteniendo el mismo payload aislado y continuar exigiendo la respuesta exitosa del helper. No se relajará el contrato ni se permitirá una mutación legada.

## Requisitos Funcionales

- **REQ-100-01:** La preparación del baseline oficial v1.2.3 debe emitir un sobre `request-envelope-v1` con `schemaVersion=1`, `operationId` UUID, `command=post-install`, `issuedAtUtc` y `expiresAtUtc` UTC válidos y un `payload` objeto que contenga la configuración actualmente requerida para el baseline.
- **REQ-100-02:** La solicitud debe cumplir la ventana de vigencia máxima del contrato, conservar el directorio QA aislado, la ruta de datos prevista, la configuración docente-local y la redacción de secretos ya existente.
- **REQ-100-03:** La prueba de contrato debe detectar la regresión concreta: una solicitud de baseline sin el sobre v1, con comando distinto, estructura incorrecta o vencimiento inválido no puede considerarse válida. El contrato general debe seguir rechazando mutaciones legadas.
- **REQ-100-04:** Ante respuesta ausente, error del helper o fallo en la validación del contrato, el E2E debe fallar explícitamente y conservar diagnósticos sanitizados. Si la preparación es correcta, debe continuar a la actualización del bundle candidato, verificar instalación y persistencia de datos del baseline, y generar la evidencia visual ya prevista por el flujo completo.

## Criterios de Aceptación

- El sobre producido por el runner pasa la validación canónica de `request-envelope-v1.schema.json` y la validación temporal de Installer Hub.
- La ruta de datos y el directorio de instalación del baseline permanecen aislados bajo el target QA; no se usan ubicaciones activas del usuario.
- El contrato sigue rechazando el payload legado para `post-install` y no se modifica para hacer pasar la prueba.
- La prueba de regresión falla si el runner elimina los metadatos requeridos del sobre o deja de usar `payload`.
- El workflow `CI Installer Windows` completa el upgrade desde baseline v1.2.3 hasta el bundle candidato 1.2.8, verifica datos antes/después y almacena reportes y capturas de la E2E.
- Antes de considerar 1.2.8 estable, se revisan visualmente las capturas de la instalación/actualización y de las pantallas docentes generadas por la matriz GUI responsive. Un resultado de CI verde por sí solo no satisface esta revisión.
- No se etiqueta ni publica 1.2.8 hasta que los checks generales, instalador, gate estable y E2E de assets públicos pasen sobre los SHA correspondientes.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-100-01 | El runner construye el sobre v1 de la solicitud baseline `post-install` | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente de aprobación |
| REQ-100-02 | El payload mantiene la configuración y ubicación QA del baseline | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente de aprobación |
| REQ-100-03 | Se protege el contrato canónico contra mutaciones legadas y sobres inválidos | `scripts/tests/installer-hub-contract.test.mjs` | Pendiente de aprobación |
| REQ-100-04 | El workflow ejecuta upgrade, verifica persistencia y publica evidencia visual | `.github/workflows/ci-installer-windows.yml` | Pendiente de aprobación |
