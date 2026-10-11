---
id: SPEC-080
titulo: Superficie publica y compatibilidad SemVer entre modulos
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: arquitectura_backend
estado: implemented
---

## Contexto

SPEC-079 estableció entradas públicas, rangos de versiones, dependencias, propiedad de modelos y detección de ciclos. La auditoría del verificador encontró que el campo `entry` solo se comprobaba por existencia, los imports se clasificaban por texto relativo y el rango SemVer aceptaba una implementación parcial. Además, una versión declarada podía conservarse aunque cambiara la superficie TypeScript pública, y el reporte incluye `generatedAt`, por lo que no es reproducible byte a byte.

La integración sigue siendo un monolito modular local con una sola base SQLite/Prisma. Esta especificación refuerza la compatibilidad de APIs entre módulos sin separar despliegues ni cambiar contratos HTTP.

## Requisitos Funcionales

- REQ-001: Cada descriptor debe apuntar exactamente al `index.ts` público de su directorio. El archivo debe existir; todo import entre módulos debe resolver mediante el `index.ts` registrado, usando el resolver y opciones del `apps/backend/tsconfig.json`.
- REQ-002: El análisis debe incluir imports, reexports, imports dinámicos con módulo literal e import types. Los imports dinámicos no literales dentro de módulos se rechazan porque impiden verificar el límite de dependencia. Ninguna referencia entre módulos puede resolver a un archivo privado.
- REQ-003: El parser de versiones acepta SemVer 2.0.0 válido y el subconjunto de rangos exactos, caret, tilde y comparadores conjuntivos que usa el registro; compara prerelease conforme a SemVer e ignora build metadata en precedencia. Sintaxis no soportada se rechaza explícitamente.
- REQ-004: Cada módulo registra un historial append-only de superficies públicas TypeScript asociado a sus versiones de contrato. La superficie se obtiene con TypeScript Compiler API desde la entrada pública e incluye nombre y firma normalizada de cada export.
- REQ-005: La superficie actual debe coincidir con el snapshot de la versión actual. Eliminar o cambiar una exportación requiere incrementar la versión mayor; agregar exportaciones requiere incrementar minor o major. Cambios solo internos no requieren nueva versión de contrato.
- REQ-006: En CI de PR, los snapshots históricos existentes deben permanecer intactos y en el mismo orden; los cambios de API se agregan como una nueva entrada histórica, nunca reescribiendo el baseline.
- REQ-007: El reporte de contratos es determinista y contiene módulos, aristas ordenadas del grafo, consumidores transitivos por módulo, propietarios de persistencia y errores, sin timestamp ni contenido de código/datos operativos.
- REQ-008: Mantener propiedad única de los modelos Prisma, migraciones centrales `expand-migrate-contract`, rutas/autorización actuales, cero ciclos y los gates backend/portal completos existentes.

## Criterios de Aceptación

- Los 21 módulos resuelven su entrada canónica y sus referencias actuales mediante el resolver TypeScript real; una ruta relativa o alias hacia un archivo privado falla.
- Los casos de import estático, reexport, import type, import dinámico literal y rechazo de import dinámico no literal están cubiertos.
- SemVer prueba versiones inválidas, build metadata, prerelease, límites inclusivos/exclusivos, caret de major cero, tilde y rechazo de rangos malformados.
- Las superficies actuales de los 21 módulos coinciden con el historial 1.0.0. Tests demuestran que un cambio de firma/remoción sin major y una adición sin minor fallan; una actualización válida pasa.
- Un PR no puede reescribir ni retirar snapshots de `origin/<base>`.
- Dos ejecuciones sobre el mismo árbol producen el mismo reporte estructural; el grafo real conserva 39 aristas, cero ciclos y consumidores transitivos completos.
- Pasan los tests del verificador, `qa:module-contracts:check`, clean architecture, lint, typecheck, CI backend/portal y las auditorías SDD/pipeline.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Entrada registrada idéntica al índice público real | `scripts/tests/module-contract-check.test.mjs` | Verificado: mismatch rechazado; 21 entradas válidas |
| REQ-002 | Resolución TypeScript completa y rechazo de acceso privado | `scripts/tests/module-contract-check.test.mjs` | Verificado: import relativo, alias privado y dinámico no literal |
| REQ-003 | Precedencia y rangos SemVer conformes con la gramática soportada | `scripts/tests/module-contract-check.test.mjs` | Verificado: límites, prerelease, build, cero mayor y rangos inválidos |
| REQ-004 | Snapshot TypeScript determinista por módulo | `scripts/tests/module-contract-check.test.mjs` | Verificado: 21 snapshots generados desde TypeScript Compiler API |
| REQ-005 | Reglas de bump mayor/minor según diferencia de superficie | `scripts/tests/module-contract-check.test.mjs` | Verificado: removido/cambiado exige major; aditivo exige minor |
| REQ-006 | Historial de snapshots preservado contra baseline Git | `scripts/tests/module-contract-check.test.mjs` | Verificado: mutación/remoción rechazada; append permitido |
| REQ-007 | Grafo y cierre transitivo deterministas | `scripts/tests/module-contract-check.test.mjs` | Verificado: 39 aristas y reporte byte a byte estable |
| REQ-008 | Migración central y gates de integración se conservan | `scripts/tests/module-contract-check.test.mjs` y suites CI | Verificado localmente: 76 propietarios únicos, SQLite y `expand-migrate-contract` |

## Evidencia de validación

- Local: `npm run test:module-contracts` (18/18), `npm run qa:module-contracts:check` (21 módulos, 39 dependencias, 76 modelos), `npm run lint`, `npm run typecheck`, `npm run test:frontend:ci` (406/406), `npm run test:backend:ci` (todos los lotes), `npm run test:portal:ci` (32/32), `npm run ci:policy:audit`, `npm run pipeline:contract:check` (41/41), `npm run api:contract:check` y `npm run sdd:audit`.
- CI del PR #184: los siete workflows concluyeron `success`; pasaron el chequeo contractual, documentación, instalador Windows y CodeQL. Los workflows backend/portal aplicaron la selección por archivos afectados.
- Límites de validación local: `npm run test:coverage:ci` terminó con código 1 tras tres timeouts de 480000 ms en `backend-root-31` y `backend-integracion-n-z-03`, sin registrar fallos de aserción en sus salidas; `npm run perf:check` no inició mediciones porque la configuración requiere `JWT_SECRETO` en producción y no está definido en el entorno.
