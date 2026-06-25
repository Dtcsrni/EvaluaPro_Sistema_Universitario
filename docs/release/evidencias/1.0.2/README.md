# Evidencia estable 1.0.2

Patch release de publicacion estable posterior a `1.0.1`.

## Alcance

- Repara el gate estable que fallaba por falta de `GH_TOKEN` para GitHub CLI.
- Repara el empaquetado Docker del backend copiando el schema Prisma antes del build.
- Mantiene el alcance funcional de `1.0.1`: preparacion de curso iniciado, examen global y CI extendido con Prisma.

## Validacion local previa

- `node --test scripts/tests/ci-workflow-contract.test.mjs`
- `docker build -f apps/backend/Dockerfile -t evaluapro-backend:release-gate-smoke .`
