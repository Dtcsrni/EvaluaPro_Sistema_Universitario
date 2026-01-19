# apps/

Carpeta de aplicaciones del monorepo (workspaces).

Estado: MVP en Beta. La definición de versión estable está en `../docs/VERSIONADO.md`.

- `backend/`: API Docente Local (Express + TypeScript).
- `frontend/`: UI (React + Vite) para Docente y Alumno.
- `portal_alumno_cloud/`: API del Portal Alumno (solo lectura / cloud).

## Comandos útiles (desde la raíz)
- `npm run dev` (stack dev)
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run dev:portal`

Más detalles: ver el README principal en `../README.md` y la documentación en `../docs/`.
