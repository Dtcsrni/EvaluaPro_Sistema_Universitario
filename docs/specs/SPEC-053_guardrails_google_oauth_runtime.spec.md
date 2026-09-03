---
id: SPEC-053
titulo: Guardrails de configuracion y runtime para Google OAuth y Classroom
version: 1.0.0
fecha: 2026-09-01
autor: EvaluaPro Team
modulo: autenticacion, integraciones_classroom, instalador_burn
estado: implemented
---

## Contexto

La correccion `434b8a14` resolvio el diagnostico de `origin_mismatch` en la interfaz de inicio de sesion con Google. Una regresion posterior demostro que la configuracion efectiva del runtime instalado podia divergir del `.env` fuente: el instalador reescribia variables OAuth ausentes como vacias y no verificaba la llave de cifrado de Classroom.

## Objetivo

Impedir que una instalacion o reparacion degrade silenciosamente Google OAuth o Google Classroom, manteniendo la separacion entre el client ID de login, la configuracion Classroom y el client ID de build del frontend.

## Requisitos Funcionales

- **REQ-001:** Una reparacion conserva valores OAuth existentes cuando la solicitud no los proporciona.
- **REQ-002:** `REQUIRE_GOOGLE_OAUTH=1` exige un `GOOGLE_OAUTH_CLIENT_ID` no vacio; no debe inferir que Classroom esta configurado.
- **REQ-003:** `CLASSROOM_ENABLED=1` exige client ID, client secret, redirect URI y `CLASSROOM_TOKEN_CIPHER_KEY` validos.
- **REQ-004:** La llave Classroom debe ser Base64 canonico de exactamente 32 bytes y la redirect URI debe ser HTTP/HTTPS.
- **REQ-005:** El verificador post-instalacion debe validar valores y formato, no solo la existencia de nombres.
- **REQ-006:** El doctor de runtime debe ejecutarse contra el `.env` instalado antes de declarar exitosa una instalacion o reparacion.
- **REQ-007:** Los contratos de preservacion, fail-fast y matriz de capacidades deben ejecutarse en CI y no permanecer omitidos con `test.skip`.
- **REQ-008:** `GOOGLE_CLASSROOM_CLIENT_ID` nunca debe derivarse de `GOOGLE_OAUTH_CLIENT_ID`; si Classroom esta deshabilitado, sus rutas no deben crear clientes OAuth aunque existan credenciales residuales.
- **REQ-009:** Cuando Google OAuth es obligatorio, `VITE_GOOGLE_CLIENT_ID` debe coincidir con `GOOGLE_OAUTH_CLIENT_ID` para evitar que frontend y backend acepten audiencias distintas.
- **REQ-010:** El launcher instalado debe cargar los valores no vacios del `.env` aunque el proceso padre herede variables vacias.

## Criterios de Aceptación

1. Repair sin campos OAuth mantiene los fingerprints de los valores existentes y no imprime secretos.
2. Configuracion requerida incompleta detiene la operacion antes de iniciar servicios y devuelve un diagnostico accionable.
3. Configuracion opcional ausente queda explicitamente deshabilitada y la UI conserva el fallback local sin emitir un 503 por configuracion.
4. Un build con Google requerido falla si no contiene `VITE_GOOGLE_CLIENT_ID`.
5. Un smoke instalado verifica capacidades backend y visibilidad del flujo Google en la UI.
6. La evidencia distingue pruebas con mocks de validacion externa real de Google.
7. Una configuracion con client ID de login solamente no habilita ni inicializa Classroom.
8. Un build con client IDs frontend/backend distintos falla de forma determinista.

## Matriz de Trazabilidad

| ID | Evidencia prevista |
| --- | --- |
| REQ-001 | `scripts/tests/installer-hub-contract.test.mjs` |
| REQ-002 a REQ-005 | `scripts/tests/installer-hub-contract.test.mjs` y `PostInstallVerifier.psm1` |
| REQ-006 | `scripts/classroom-doctor.mjs` contra el runtime instalado |
| REQ-007 | Gate de release/CI y ausencia de skips para estos contratos |
| REQ-008 | `apps/backend/src/configuracion.ts`, `servicioClassroomGoogle.test.ts` y `configuracion.produccion.test.ts` |
| REQ-009 | `apps/frontend/vite.config.ts` y `apps/frontend/tests/vite.config.test.ts` |
| REQ-010 | `scripts/runtime-env.mjs`, `scripts/start-docente-native.mjs` y `scripts/tests/runtime-env.test.mjs` |

## Riesgos y limites

La validacion local no prueba por si sola la autorizacion contra Google Cloud. El smoke externo real requiere credenciales, redirect URI registrada y evidencia manual reproducible sin exponer secretos.
