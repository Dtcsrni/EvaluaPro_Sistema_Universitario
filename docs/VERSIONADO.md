# Versionado (alpha / beta / estable)

Este repo usa SemVer ($MAJOR.MINOR.PATCH) con canales mediante pre-release.

## Definición de canales

- **Alpha**: versiones `0.y.z` (o `x.y.z-alpha.n`) para cambios rápidos y potencialmente incompatibles.
- **Beta**: versiones `x.y.z-beta.n` cuando el API/UX está casi estable pero puede haber ajustes.
- **Estable**: versiones `>= 1.0.0` sin sufijo pre-release.

Recomendación práctica:

- Mientras la base evoluciona fuerte, mantener `0.y.z`.
- Cuando el contrato principal (API docente + portal + frontend) esté consolidado, mover a `1.0.0-beta.1`.
- Promover a `1.0.0` cuando:
  - `npm run test:ci` esté verde
  - docs (incluyendo `npm run docs:check`) esté verde
  - no haya cambios breaking pendientes

## Criterio de estabilidad operativa (MVP Beta)

En este proyecto, la **versión estable más reciente** es la última que cumple **todas** las suites y checks
críticos, aunque el número SemVer siga en `0.x` o con sufijo beta. Para considerar estable:

- `npm run test:ci` (backend, reintentos, harness estricto).
- `npm run test:portal` y `npm run test:frontend`.
- `npm run routes:check` (guardarrail de rutas y contratos).
- `npm run docs:check` y `npm run diagramas:check`.

La versión **MVP** se mantiene en **Beta** hasta que se complete y valide automáticamente el primer ciclo
docente/alumno (materia → plantilla → generación → vinculación → escaneo → calificación → sincronización).

## Workflow recomendado

1) Actualiza `CHANGELOG.md` con lo que cambió.
2) Ejecuta `npm run test:ci`.
3) Crea tag de release (manual) y publica artefactos según tu pipeline.

Notas:

- En monorepos, este repo usa una **versión única** en la raíz para representar el estado del sistema.
- Si en el futuro necesitas versionar apps por separado, se puede migrar a versionado por paquete (p.ej. Changesets).
