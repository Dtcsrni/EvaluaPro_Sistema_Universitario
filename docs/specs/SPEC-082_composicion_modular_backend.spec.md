---
id: SPEC-082
titulo: Superficie de composición del host para módulos backend
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: arquitectura_backend
estado: implemented
---

## Contexto

SPEC-079 y SPEC-080 versionan la API de dominio de los módulos, pero los puntos de composición del host quedan fuera del contrato: `apps/backend/src/rutas.ts` y `apps/backend/src/index.ts` importan routers y tareas de ciclo de vida mediante rutas privadas. Este acoplamiento hace que una reorganización interna del módulo rompa la aplicación sin una violación del gate modular.

El host necesita una superficie explícita, distinta de la API de dominio, que mantenga routers fuera de `index.ts`, preserve el orden de montaje/autorización y registre la compatibilidad de cada integración. El monolito modular, los endpoints y la persistencia existentes se conservan.

## Requisitos Funcionales

- REQ-001: Cada módulo integrado por el host expone un `composition.ts` con sus routers y tareas de ciclo de vida; `index.ts` conserva solo su API de dominio y no reexporta routers.
- REQ-002: El registro identifica la entrada de composición de cada módulo y guarda un historial SemVer append-only de sus exports, alineado con `contractVersion`.
- REQ-003: El gate resuelve los imports del composition root con el resolver TypeScript y rechaza imports a archivos privados de módulos. Los imports entre módulos conservan sus reglas actuales.
- REQ-004: La versión del host del registro coincide con `package.json`; el checker falla con un mensaje que identifica ambas versiones cuando divergen.
- REQ-005: El snapshotter agrega la superficie de composición al historial solo después del bump correspondiente; historial de dominio y composición no se reescribe.
- REQ-006: La composición no altera rutas, métodos, middleware, orden, permisos, tareas de inicio, almacenamiento ni comportamiento visible.

## Criterios de Aceptación

- Todo import de `apps/backend/src/rutas.ts` y `apps/backend/src/index.ts` a un módulo resuelve a su `composition.ts` registrado.
- Las 21 entradas de composición están versionadas; `index.ts` sigue libre de routers y se detectan los contratos privados modificados sin bump.
- Los tests rechazan un host desincronizado, una ruta de composición incorrecta, un import privado del host y la reescritura de historial.
- Pasan `test:module-contracts`, `qa:module-contracts:check`, `qa:clean-architecture:strict`, lint, typecheck, `api:contract:check`, tests backend y auditorías SDD/pipeline.
- La comparación de rutas antes/después confirma que paths, métodos, autenticación/autorización y orden de montaje no cambian.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Mantener routers fuera de la API de dominio y exponerlos por composición | `scripts/tests/module-contract-check.test.mjs` | Verificado: 21 módulos |
| REQ-002 | Validar entradas, exports, SemVer e historial append-only | `scripts/tests/module-contract-check.test.mjs` | Verificado: dos superficies versionadas por módulo |
| REQ-003 | Bloquear imports privados desde el host y servicios compartidos | `scripts/tests/module-contract-check.test.mjs` | Verificado |
| REQ-004 | Fallar cuando host y producto declaran versiones distintas | `scripts/tests/module-contract-check.test.mjs` | Verificado |
| REQ-005 | Agregar snapshots de composición sin alterar snapshots previos | `scripts/tests/module-contract-check.test.mjs` | Verificado: append-only e idempotencia |
| REQ-006 | Preservar contrato HTTP y ciclo de vida del backend | `apps/backend/tests/rutasSalud.test.ts` | Verificado: llamadas/order sin cambios; API y suites backend en verde |

## Evidencia de validación

- En verde local: `npm run test:module-contracts` (25/25), `npm run qa:module-contracts:check` (21 módulos, 39 dependencias, cero ciclos, 76 modelos), `npm run qa:clean-architecture:strict`, `npm run qa:module-contracts:snapshot`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:backend:ci` (58 lotes, salida 0), `npm run test:frontend:ci` (406/406), `npm run test:portal:ci` (32/32), `npm run api:contract:check`, `npm run docs:check`, `npm run sdd:audit`, `npm run pipeline:contract:check` y `npm run ci:policy:audit`.
- La comparación de `rutas.ts` y `index.ts` confirma que solo cambiaron imports; se conserva el orden de montaje, middleware, rutas y tareas de inicio.
- `docs/contracts/module-contracts.v2.json` conserva los snapshots anteriores y agrega versión `1.1.0` de APIs de dominio y composición para los 21 módulos.
