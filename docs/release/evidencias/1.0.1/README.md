# Evidencia estable 1.0.1

Paquete auditable del corte `1.0.1`, publicado como patch release sobre `1.0.0`.

## Alcance

- Merge de preparacion docente para curso iniciado y examen global con insumos externos.
- Correccion de CI extendido para generar Prisma Client antes de ejecutar suites que importan backend.
- Validacion post-merge de `CI Checks` en `main` con Core y Extended en verde.

## Evidencia principal

- `manifest.json`
- `timeline.md`
- `metrics_snapshot.txt`
- `integridad_sha256.json`
- `rollback_readiness.json`
- `RELEASE_NOTES.md`

## Validacion

- `npm run release:check:evidence -- --version=1.0.1`
- `npm run test:release:policy`
