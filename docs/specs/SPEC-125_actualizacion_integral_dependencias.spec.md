---
id: SPEC-125
titulo: Actualizacion integral de dependencias del monorepo
version: 1.0.0
fecha: 2026-10-23
autor: Codex
modulo: devops_dependencias
estado: approved
---

## Contexto

El monorepo contiene tres workspaces npm y archivos de bloqueo separados. El usuario autorizo actualizar todas las dependencias declaradas, incluidas versiones mayores. Se requiere alinear manifiestos y lockfiles, resolver incompatibilidades detectadas y comprobar los contratos de build, lint, tipos y pruebas.

## Requisitos Funcionales

- REQ-001: Inventariar dependencias directas en raiz y workspaces y actualizar cada rango a la version estable mas reciente disponible cuando sea compatible con los contratos del proyecto.
- REQ-002: Actualizar las dependencias transitivas resolubles y los lockfiles de raiz y de workspaces, sin dejar instalaciones inconsistentes.
- REQ-003: Adaptar configuracion o codigo solo ante incompatibilidades reproducibles causadas por una actualizacion.
- REQ-004: Mantener requisitos de runtime e instalador compatibles y documentar paquetes bloqueados por incompatibilidad demostrada.

Se posponen dos cambios que romperian contratos vigentes: TypeScript 7 queda fuera del rango `>=4.8.4 <6.1.0` de `@typescript-eslint/parser@8.72.0`, y ESLint 10 queda fuera del rango hasta ESLint 9 de `eslint-plugin-jsx-a11y@6.10.2`. Prisma 8 solo esta publicado como RC en el tag `latest`; se conserva la version estable 7.10.1. `@types/node` 26 se actualiza en los cuatro manifests y se valida bajo el runtime Node 24 del producto.

## Criterios de Aceptación

- Los manifiestos y lockfiles representan la misma resolucion instalada y no hay actualizaciones compatibles pendientes en el inventario final.
- `npm ci` completa en la raiz y en cada instalacion independiente aplicable.
- Lint, typecheck, builds y suites definidas en la matriz se ejecutan y sus fallos se reportan sin ocultar deuda preexistente.
- Los cambios preexistentes del flujo Classroom se conservan.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Comprueba las versiones minimas y el gestor de paquetes admitido | `scripts/tests/dependency-toolchain-policy.test.mjs` | Validado: 5/5 |
| REQ-002 | Comprueba contratos de instalador/runtime afectados por dependencias | `scripts/tests/runtime-env.test.mjs` | Validado: incluido en CI |
| REQ-003 | Ejecuta suites de workspace y valida compatibilidad de APIs | `apps/backend/tests/configuracion.produccion.test.ts` | Validado: suite backend CI |
| REQ-003 | Verifica generación ZIP, integridad fuente y errores del nuevo `archiver` | `apps/backend/tests/omrDatasetExport.test.ts` | Validado: suite backend CI |
| REQ-004 | Comprueba requisitos de runtime e instalador docente | `scripts/tests/native-startup.contract.test.mjs` | Validado: contrato de instalador |

## Validacion local 2026-10-23

- `npm ci` de raiz y `npm update --all` con npm 12.2.1: lock consistente, 1,123 paquetes auditados y 0 vulnerabilidades.
- `npm ci --offline` en copias temporales independientes: backend 572, frontend 353 y portal 279 paquetes; los tres completaron.
- `npm run lint`, `npm run typecheck` y `npm run build`: codigo de salida 0. La suite CI de backend, portal y frontend completó; portal 32/32 y frontend 431/431.
- `npm run test:toolchain:policy`: 5/5; `npm run pipeline:contract:check`: 77/77; `npm run test:security:policy`: 5/5.
- `npm run test:release:policy`: 69/69 al ejecutarse fuera del sandbox. `npm run test:installer-hub:contract`: 165 aprobados, 13 omisiones esperadas y 0 fallos.
- `npm run ci:policy:audit`: codigo de salida 0 antes del ultimo ajuste documental; falta repetir tras sincronizar la documentación de gates.
- Consulta vigente `npm outdated --workspaces --depth=0`: `current == wanted` para las dependencias directas salvo versiones mayores no compatibles o no estables. ESLint 10 en frontend está bloqueado por el peer máximo 9 de `eslint-plugin-jsx-a11y@6.10.2`; TypeScript 7 por el peer `<6.1.0` de `@typescript-eslint/parser@8.72.0`; Prisma 8 aparece únicamente como `8.0.0-rc.27`, por lo que se conserva Prisma 7.10.1 estable. El npm `update --all` posterior no encontró más actualizaciones aplicables.
- La verificación de npm registry fue exitosa fuera del sandbox. `npm outdated --all` incluye diferencias transitivas fijadas por sus consumidores; por eso se usó `--workspaces --depth=0` para decidir si quedan dependencias directas actualizables.
- El gate del instalador y las suites locales no sustituyen la promoción: no hay aún commit candidato limpio, CI remoto, evidencia E2E real Classroom ni E2E del instalador descargado/actualización.
