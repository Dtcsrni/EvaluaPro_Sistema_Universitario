---
id: SPEC-110
titulo: Auditoria CI segura alineada a SQLite
version: 1.0.0
fecha: 2026-10-16
autor: Codex
modulo: ci_security_scan
estado: approved
---

## Contexto

La publicación de la corrección de `.github/workflows/ci.yml` fue rechazada por dos valores fallback con forma de token en el paso `security-scan`. La revisión local confirma que están en ese paso y se usan al ejecutar `npm run security:env:check`; no hay evidencia suficiente para tratarlos como marcadores inocuos. El chequeo estricto también exige `MONGODB_URI`, aunque la arquitectura vigente usa Prisma con SQLite: `apps/backend/prisma/schema.prisma` declara `provider = "sqlite"`, `prisma.config.mjs` configura `DATABASE_URL` y el runtime prioriza `BACKEND_DATABASE_URL` sobre `DATABASE_URL`.

Esta spec reemplaza la validación obsoleta de Mongo por una validación de URL SQLite. El paso de auditoría usará una ruta SQLite local sin credenciales y generará valores aleatorios efímeros para las variables requeridas por el validador. Los valores solo existirán en el proceso del runner durante ese paso y no se imprimirán, persistirán en el workspace ni se publicarán como artefacto.

## Requisitos Funcionales

- **REQ-001:** El paso `security-scan` no tendrá valores de credenciales literales ni expresiones que lean secretos del repositorio para las variables `JWT_SECRETO` y `PORTAL_ALUMNO_API_KEY`.
- **REQ-002:** El paso generará valores aleatorios no vacíos en tiempo de ejecución para satisfacer `npm run security:env:check`; su alcance se limitará al proceso de auditoría y no se guardarán en archivos, logs ni artefactos.
- **REQ-003:** La auditoría usará una URL local `file:` en `BACKEND_DATABASE_URL`, sin leer `MONGODB_URI` ni secretos de bases de datos.
- **REQ-004:** En modo estricto, `security-env-check.mjs` aceptará `BACKEND_DATABASE_URL` o `DATABASE_URL`, requerirá que la URL use el esquema `file:` de SQLite y rechazará el caso donde solo esté definida `MONGODB_URI`.
- **REQ-005:** Las pruebas de contrato del workflow comprobarán la ausencia de fallbacks tokenizados y referencias de secretos en `security-scan`, la generación efímera de las variables requeridas y la conservación de los comandos de auditoría.
- **REQ-006:** Las pruebas directas del validador cubrirán `BACKEND_DATABASE_URL`, `DATABASE_URL`, URL ausente, esquema incorrecto y la ausencia de dependencia en MongoDB.
- **REQ-007:** La corrección no modificará configuración de producción ni el conjunto de pruebas/umbrales de cobertura. El workflow debe parsear como YAML válido y pasar sus contratos antes de publicarse.

## Criterios de Aceptación

- No hay valores con apariencia de credencial ni referencias `${{ secrets.* }}` para las variables de prueba en el paso `security-scan`.
- Una prueba de contrato falla si reaparece una credencial literal, se leen secretos del repositorio o se elimina la generación efímera requerida.
- `security-env-check.mjs` valida SQLite mediante `BACKEND_DATABASE_URL` o `DATABASE_URL`, rechaza el esquema incorrecto y no requiere `MONGODB_URI`.
- `npm run security:env:check` pasa con las variables efímeras generadas en el runner sin imprimir sus valores.
- El YAML parsea correctamente y `node --test scripts/tests/ci-workflow-contract.test.mjs` pasa.
- `scripts/tests/security-env-check.test.mjs` pasa y se incluye en `npm run pipeline:contract:check`.
- El cambio se publica por la ruta autorizada solo después de aprobar esta spec; luego se verifican el SHA remoto y los gates CI asociados.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-003, REQ-005 | El paso security-scan no consume secretos ni contiene credenciales literales y usa SQLite local | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado; validación pendiente |
| REQ-002, REQ-004, REQ-006 | Generación efímera y validación estricta de URL SQLite con límites correctos | `scripts/tests/security-env-check.test.mjs` | Implementado; validación pendiente |
| REQ-007 | Workflow YAML válido y contratos integrales conservados | `scripts/tests/ci-workflow-contract.test.mjs`; `scripts/pipeline-contract-check.mjs` | Implementado; validación pendiente |
