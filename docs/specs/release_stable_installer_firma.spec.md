---
id: SPEC-RELEASE-STABLE-INSTALLER-FIRMA
titulo: Gate estable exige instaladores firmados
version: 1.5.0
fecha: 2026-10-28
autor: Codex / Agente IA
modulo: release
estado: approved
---

# SPEC-RELEASE-STABLE-INSTALLER-FIRMA: Gate estable exige instaladores firmados

## Contexto
Una promocion estable para usuarios finales de Windows no debe aprobarse si los artefactos del instalador se generaron sin firma Authenticode, con version incorrecta o con una Bootstrapper Application Burn embebida obsoleta. Para la autofirma autorizada, CI agrega temporalmente el certificado publico al almacen `CurrentUser\\Root` del runner efimero, verifica `Status = Valid` y retira esa confianza al terminar. El release debe publicar el certificado CER, su SHA-256 y las instrucciones de confianza manual. Esto no implica confianza predeterminada de Windows y App Control puede seguir bloqueando la ejecucion.

## Requisitos Funcionales
- **REQ-001:** `release:validate:stable` debe validar que el manifest estable contenga únicamente el flavor `docente-local`.
- **REQ-002:** `release:validate:stable` debe fallar si cualquier artefacto del manifest tiene `signed` distinto de `true`; para una autofirma, `signed=true` solo se registra despues de importar temporalmente el certificado exacto al almacen de raices CurrentUser del runner efimero y volver a verificar `Status = Valid`.
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
- **REQ-014:** El manifiesto QA debe registrar el commit candidato y la fecha de generación. `release:validate:stable` debe rechazar un commit distinto al `HEAD` evaluado, un manifiesto de más de 24 horas y cualquier artefacto requerido ausente, con tamaño/fecha que no correspondan al archivo, con fecha inválida/futura o con más de 24 horas de antigüedad.
- **REQ-015:** El manifiesto QA debe registrar si el árbol de fuentes estaba limpio al terminar `qa:full`; se excluyen únicamente los reportes QA y salidas de dataset/depuración generadas por las pruebas. `release:validate:stable` debe rechazar evidencia creada con cambios de fuente pendientes o sin commit.
- **REQ-016:** El gate estable debe consumir un artefacto de instalador inmutable de una ejecución identificada por `run_id`, ligado al SHA candidato de `main`. La evidencia de release se registra en un commit posterior que solo modifica `docs/release/evidencias/<version>/`; debe referir el SHA candidato sin autoincluir su propio SHA. Solo se inicia publicación después de Go y no se depende de una tag o release pública para decidir.
- **REQ-017:** El manifiesto del instalador, la evidencia QA, la evidencia de release y la decisión del gate deben identificar el mismo SHA candidato, aunque el commit de evidencia sea posterior.
- **REQ-018:** La validación y publicación estable de esta versión solo considera `docente-local`; no debe incluir ni requerir artefactos SaaS.
- **REQ-019:** La firma de release debe ser local y no contactar un servicio TSA externo. El workflow debe activar `EVALUAPRO_SIGN_LOCAL_ONLY=1` y el script debe fallar si recibe una URL TSA para un release. Al no usar sello de tiempo, la vigencia de validación de la firma queda limitada por la vigencia del certificado firmante.
- **REQ-020:** El release debe incluir el certificado público del firmante, su SHA-256 y una guía de confianza manual. No debe instalar confianza automáticamente en el equipo destino; la guía debe advertir que SmartScreen puede mostrar alertas, App Control puede bloquear la ejecución y, sin TSA, la firma deja de validar al vencer el certificado.

## Criterios de Aceptación
- **AC-001 (REQ-001):** Un manifest con exactamente `docente-local` y artefactos con cadena Authenticode confiable permite aprobar el check de instalador; la inclusión de otro flavor produce No-Go.
- **AC-002 (REQ-002):** Un manifest con `signed:false` produce `No-Go`; un archivo firmado con autofirma solo pasa despues de que el runner efimero confie temporalmente el certificado exacto y `Get-AuthenticodeSignature` devuelva `Valid`.
- **AC-003 (REQ-003):** El resultado del check `installer-multi-flavor` contiene un mensaje accionable sobre artefactos no firmados.
- **AC-004 (REQ-004):** `sign-installer-artifacts.ps1` invoca `generate-installer-hashes.ps1` despues de completar la firma.
- **AC-005 (REQ-005):** Un manifest con artefactos firmados pero sin `path` verificable produce `No-Go`.
- **AC-006 (REQ-006):** El smoke local escribe evidencia bajo una version separada `1.1.0-local.0`, registra `entorno=local-smoke` y conserva `1.1.0` como gate humano productivo independiente.
- **AC-007 (REQ-007):** Una promocion stable sin JSON Classroom real validable produce `No-Go` en el check `classroom-e2e-evidence`.
- **AC-008 (REQ-008):** `scripts/assert-installer-hub-bundle.ps1` extrae el bundle con WiX y valida metadata del bundle externo y del BA embebido.
- **AC-009 (REQ-009):** Un manifest firmado pero generado para otra version produce `No-Go` en `installer-multi-flavor`.
- **AC-010 (REQ-010):** `ci-installer-windows.yml` usa `make_latest:false` y `release-stable-gate.yml` ejecuta `gh release edit ... --latest` solo despues del gate.
- **AC-011 (REQ-011):** `Invoke-WixBuildProcess` respeta `EVALUAPRO_WIX_PROCESS_TIMEOUT_SECONDS` y falla con mensaje accionable si WiX excede el tiempo permitido.
- **AC-012 (REQ-012):** Una ejecucion con `--version=1.1.1` y evidencia `manifest.json` de `1.0.0` produce `No-Go` en `release-evidence`.
- **AC-013 (REQ-013):** El contrato del Hub falla si aparecen `AdvancedConfigExpander`, `Configuración avanzada`, `Mongo URI`, `MongoDB` o controles XAML legacy de configuracion avanzada.
- **AC-014 (REQ-014):** Pruebas antirregresión demuestran No-Go para manifiesto/artefacto QA obsoleto, commit distinto, tamaño o fecha manipulados; un manifiesto fresco con metadatos concordantes y commit actual conserva Go.
- **AC-015 (REQ-015):** La prueba demuestra No-Go ante cambios de fuente pendientes y confirma que las rutas de salida QA/dataset no invalidan un árbol de fuentes limpio.
- **AC-016 (REQ-016):** El contrato exige `source_sha` y `candidate_run_id`, descarga el artefacto por `run_id`, valida que los cambios posteriores a ese SHA sean solo evidencia versionada y no consulta releases/tags antes de validar; después de Go despacha el pipeline de release que conserva el draft hasta que aprueban la E2E draft y la E2E del asset público descargado.
- **AC-017 (REQ-017):** Un `build.commit` distinto al SHA candidato produce No-Go.
- **AC-018 (REQ-018):** El contrato del workflow y del validador rechaza sabores distintos de `docente-local`.
- **AC-019 (REQ-019):** El workflow configura firma local explícita; un release falla ante URL TSA o falta de modo local, y el script no aplica un TSA externo por defecto. La documentación informa que la validación sin sello de tiempo depende de que el certificado firmante siga vigente.
- **AC-020 (REQ-020):** El borrador del release incluye CER, sidecar SHA-256 y `FIRMA-LEEME.md`; las E2E de borrador y asset público verifican el certificado y solo agregan confianza temporal a `CurrentUser\Root` del runner efímero, con limpieza posterior. La guía no afirma confianza automática ni cambia políticas del host.

## Procedimiento operativo

1. Con el commit candidato ya integrado en `main`, ejecutar manualmente `CI Installer Windows` desde `main`, indicando ese SHA completo en `source_sha`; esperar a que la ejecución finalice correctamente y copiar su `run_id`.
2. Registrar en un commit posterior solo `docs/release/evidencias/<version>/` con su `manifest.json` apuntando al SHA candidato; no modificar código, versión ni workflows después del build candidato.
3. Ejecutar `Release Stable Gate` desde ese nuevo HEAD de `main`, indicando el SHA de código candidato y el `run_id` de su build. El gate confirma que ese run fue exitoso, de `main`, del workflow de instalador, y que el artefacto y toda evidencia corresponden al SHA candidato.
4. Con Go, el workflow despacha `CI Installer Windows` para construir desde el SHA candidato y crear un release draft. Solo después de pasar la E2E del asset draft se hace público; luego se descarga la URL pública, se verifica hash y se repite la E2E completa. Si falla o se interrumpe alguna verificación, el release permanece o vuelve a borrador y no se marca Latest.
5. El artefacto candidato se conserva 90 días. No seleccionar otro run ni sustituirlo por archivos locales.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Manifest contiene únicamente docente-local | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-002 | Rechazo de artefactos no firmados o con cadena Authenticode no confiable | scripts/tests/release-stable-promotion.test.mjs; scripts/tests/installer-hub-contract.test.mjs | En validación CI |
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
| REQ-014 | QA fresco, íntegro y ligado al commit candidato | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-015 | QA solo desde árbol de fuentes limpio | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-016 | Artefacto inmutable ligado al SHA, evidencia en commit posterior y publicación tras doble E2E | scripts/tests/ci-workflow-contract.test.mjs | En validación CI |
| REQ-017 | Release manifest y evidencia versionada ligados al mismo SHA | scripts/tests/release-stable-promotion.test.mjs | En validación CI |
| REQ-018 | Publicación docente-local sin flavor SaaS | scripts/tests/ci-workflow-contract.test.mjs | En validación CI |
| REQ-019 | Firma local de release sin servicio TSA externo | scripts/tests/installer-hub-contract.test.mjs | En validación CI |
| REQ-020 | Publicación y confianza manual explícita de la autofirma, sin alterar App Control | scripts/tests/installer-hub-contract.test.mjs; scripts/tests/ci-workflow-contract.test.mjs | En validación CI |
