---
id: SPEC-085
titulo: Reintentos seguros de operaciones API en flujos docentes
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: cliente-api-docente
estado: draft
---

## Contexto

`crearClienteJsonBase` aplica la misma política automática de reintentos a solicitudes `GET`, `POST`, `PUT` y `DELETE`. Un error de transporte puede ocurrir después de que el servidor haya confirmado una mutación, y una respuesta `502`, `503`, `504` o `429` tampoco demuestra que la mutación no se ejecutó. El cliente puede repetir solicitudes de creación sin contrato de idempotencia; `POST /asistencias/sesiones` crea una fila nueva por solicitud y actualmente no recibe un identificador idempotente. El resultado puede ser duplicación o una interfaz que informe fallo aunque la operación sí se guardó.

El cliente debe conservar la recuperación de lecturas sin volver implícitamente a ejecutar escrituras. Los flujos que necesiten reintentar mutaciones deben usar una clave estable cuyo servidor persista y reproduzca la respuesta de la operación original.

## Requisitos Funcionales

- REQ-001: El cliente reintenta automáticamente solicitudes `GET` ante errores de red o estados transitorios dentro de la política configurada.
- REQ-002: El cliente no reintenta automáticamente `POST`, `PUT` ni `DELETE` ante errores de transporte o respuestas transitorias salvo que la operación se declare reintentable y proporcione una clave idempotente estable.
- REQ-003: Cada intento reintentado de una mutación conserva la misma clave idempotente y payload; el backend devuelve el resultado previo sin duplicar efectos cuando esa clave ya fue procesada.
- REQ-004: Una respuesta incierta de mutación comunica que no se confirmó el resultado y conserva la clave necesaria para que el usuario o flujo consulte/recupere la operación original.
- REQ-005: La renovación de sesión ante HTTP 401 conserva el contrato actual y no activa reintentos adicionales de mutación que no tengan clave idempotente.
- REQ-006: El comportamiento de los flujos existentes que ya incluyen claves de solicitud permanece compatible; las operaciones sin soporte de idempotencia pasan a un solo intento automático.

## Criterios de Aceptación

- Un `GET` con `503` y luego `200` se reintenta como hoy.
- Un `POST` sin clave con fallo de red o `503` ejecuta un solo intento y reporta el resultado como no confirmado cuando corresponda.
- Un `POST` idempotente que falla tras completar en servidor y se reintenta con la misma clave produce un único registro y recupera la respuesta original.
- Una operación con clave nueva produce un efecto independiente; claves de usuarios o sesiones distintas no colisionan.
- La renovación tras `401` sigue reintentando la misma petición una vez con el token renovado y conserva el límite de intentos configurado.
- Las pruebas de sesión de asistencia y al menos un flujo existente con `clientRequestId` comprueban ausencia de duplicados bajo reenvío.
- Las solicitudes `GET` y los contratos del cliente frontend pasan lint, typecheck y pruebas focalizadas.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-005 | Política de reintento por método y renovación 401 | `apps/frontend/tests/clienteComun.test.ts` | Pendiente de aprobación |
| REQ-003, REQ-004 | Clave estable y resultado incierto de mutación | `apps/frontend/tests/clienteComun.test.ts` | Pendiente de aprobación |
| REQ-003, REQ-006 | Idempotencia del flujo de asistencia | `apps/backend/tests/integracion/asistencia.reglas.test.ts` | Pendiente de aprobación |
| REQ-006 | Reenvío de flujo existente con clientRequestId | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts` | Pendiente de aprobación |

## Riesgos y decisiones

- Desactivar reintentos automáticos de escrituras que no tengan clave puede hacer visible al usuario un fallo de red en operaciones que sí alcanzaron el servidor; por eso la respuesta debe indicar resultado incierto y habilitar recuperación segura.
- No debe habilitarse el reintento idempotente en una ruta hasta que el backend garantice persistencia y replay del resultado bajo concurrencia.
- No se debe inferir éxito ni fallo definitivo solo por la desconexión del cliente después de enviar una mutación.
