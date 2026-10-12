---
id: SPEC-083
titulo: Ciclo de vida resiliente de la API docente local
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: arquitectura-backend
estado: approved
---

## Contexto

SPEC-079, SPEC-080 y SPEC-082 definen contratos de dominio, composición y compatibilidad de los 21 módulos backend. El host sigue siendo un único proceso local que controla el servidor HTTP y la conexión SQLite/Prisma. La inspección encontró dos brechas de ciclo de vida: `iniciarApiDocenteLocal` ejecuta `conectar()` fuera de su bloque de recuperación, por lo que no intenta liberar recursos si la conexión falla parcialmente; `cerrarApiDocenteLocal` espera indefinidamente a que termine `server.close`, sin una política de drenado ni límite. El endpoint `/salud/ready` comprueba SQLite, pero no distingue que el host está apagándose.

La mejora establece al host como propietario explícito del ciclo de vida, con readiness que deja de admitir trabajo durante el cierre, drenado limitado y limpieza de persistencia en rutas de fallo. Conserva el monolito modular, las rutas públicas existentes y la semántica de `/api/salud` usada por el Installer Hub.

## Requisitos Funcionales

- REQ-001: El host administra estados `starting`, `ready`, `draining` y `stopped` por instancia de API; los módulos no controlan el servidor ni desconectan la base de datos.
- REQ-002: La API no escucha hasta completar la conexión de persistencia y la creación de la aplicación. Si la conexión, la composición de la aplicación o `listen` falla, el host intenta desconectar persistencia una sola vez, conserva el error original y registra cualquier error secundario de limpieza.
- REQ-003: Al iniciar cierre, el host marca la instancia `draining` antes de dejar de aceptar conexiones nuevas. `/salud/ready` responde HTTP 503 y reporta la instancia como no lista mientras está `draining` o `stopped`; `/salud/live` conserva su semántica de liveness y `/salud` conserva el contrato actual.
- REQ-004: El cierre permite completar solicitudes activas hasta un límite configurable y validado entre 0 y 2 147 483 647 milisegundos; el valor predeterminado es 90 segundos mediante `EVALUAPRO_API_SHUTDOWN_TIMEOUT_MS`. Si vence, el host termina las conexiones HTTP remanentes y completa la desconexión de persistencia.
- REQ-005: Llamadas repetidas o concurrentes al cierre comparten la misma operación y no cierran el servidor ni desconectan persistencia más de una vez.
- REQ-006: Tanto el cierre normal como el forzado dejan el estado final en `stopped`; si falla el cierre HTTP, la limpieza de persistencia sigue ejecutándose y los errores conservan contexto diagnóstico sin secretos.
- REQ-007: Los cambios conservan rutas, métodos, permisos, orden de montaje, payloads existentes de salud y comportamiento de persistencia fuera de la ventana de cierre.

## Criterios de Aceptación

- Una falla durante conexión, creación de aplicación o `listen` impide que la API quede escuchando e intenta liberar persistencia exactamente una vez sin reemplazar el error primario.
- Durante drenado, una consulta a readiness devuelve 503 con estado `draining`; al volver a `ready`, devuelve 200; la liveness continúa respondiendo según su contrato.
- Una solicitud activa que finaliza dentro del límite permite el cierre ordenado y desconecta persistencia una vez.
- Una solicitud que excede el límite causa el cierre forzado de conexiones restantes, finaliza el servidor, desconecta persistencia una vez y deja estado `stopped`.
- Dos llamadas concurrentes al cierre reutilizan una promesa de finalización y no duplican efectos.
- El timeout acepta valores positivos finitos y rechaza valores inválidos; las pruebas usan un límite corto inyectado sin depender de esperas largas.
- `GET /api/salud` conserva HTTP 200 y payload compatible requerido por Installer Hub; `/api/salud/ready` y `/api/salud/live` conservan sus contratos cuando la instancia está lista.
- La suite de backend y los checks de arquitectura modular pasan; no se agregan dependencias de runtime ni se cambia el ciclo de escritura SQLite.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-003 | Estado de host reflejado por readiness y liveness | `apps/backend/tests/rutasSalud.test.ts` | Implementado |
| REQ-002 | Fallos de conexión, composición y escucha liberan persistencia y preservan el error original | `apps/backend/tests/arranqueApiDocenteLocal.test.ts` | Implementado |
| REQ-004, REQ-006 | Drenado ordenado, timeout y limpieza final después del cierre forzado | `apps/backend/tests/arranqueApiDocenteLocal.test.ts` | Implementado |
| REQ-005 | Cierres concurrentes no duplican la desconexión | `apps/backend/tests/arranqueApiDocenteLocal.test.ts` | Implementado |
| REQ-007 | Contrato público de salud, rutas y montaje sin cambios | `apps/backend/tests/rutasSalud.test.ts` | Implementado |

## Riesgos y decisiones

- El cierre forzado puede terminar una solicitud aún activa; por eso solo ocurre al vencer el límite configurable y readiness pasa a 503 antes del drenado.
- El timeout predeterminado aprobado es de 90 segundos y se puede ajustar mediante `EVALUAPRO_API_SHUTDOWN_TIMEOUT_MS`.
- El máximo coincide con el límite de temporizador soportado por Node.js para evitar que un valor excesivo se convierta silenciosamente en un vencimiento inmediato.
- Los fallos simulados deben probar limpieza de recursos sin escribir en la base de datos docente de producción.
