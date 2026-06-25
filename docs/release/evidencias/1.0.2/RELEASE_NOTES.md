# Notas de Release - EvaluaPro v1.0.2

EvaluaPro `1.0.2` es un patch release de publicacion. Mantiene el alcance funcional de `1.0.1` y corrige los gates disparados al crear el tag estable.

## Correcciones

- `Release Stable Gate` ahora expone `GH_TOKEN` para que `validate-stable-promotion.mjs` pueda consultar corridas con GitHub CLI dentro de Actions.
- `apps/backend/Dockerfile` copia `apps/backend/prisma` antes del build, permitiendo que `prisma generate` encuentre `schema.prisma`.
- Se agregan pruebas de contrato para cubrir ambos casos.

## Evidencia

- `node --test scripts/tests/ci-workflow-contract.test.mjs`: 15 pruebas en verde.
- `docker build -f apps/backend/Dockerfile -t evaluapro-backend:release-gate-smoke .`: exitoso localmente.

## Nota

`v1.0.1` no se reescribe. `v1.0.2` es el corte estable destinado a reemplazarlo como release recomendado.
