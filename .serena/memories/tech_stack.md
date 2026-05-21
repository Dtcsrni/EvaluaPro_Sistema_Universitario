# Tech stack
- Raiz requiere Node `>=24` y npm workspaces.
- Backend: TypeScript, Express, Mongoose/MongoDB; modulos por dominio bajo `apps/backend/src/modulos`.
- Frontend: React + Vite en `apps/frontend`; selector de destino por `VITE_APP_DESTINO`.
- Portal alumno cloud: TypeScript API/read-model separado en `apps/portal_alumno_cloud`.
- Runtime local recomendado Windows: Docker Compose sobre `WSL2 + Docker Engine`; Installer Hub WiX Burn + BA WPF .NET 8 para distribucion Windows.
- Tests principales por app con Vitest; scripts de gates y automatizacion viven en `scripts/`.