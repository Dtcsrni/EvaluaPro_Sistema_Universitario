# Tech stack
- Raiz requiere Node `>=24` y npm workspaces.
- Backend: Node.js 24, TypeScript, Express, Prisma ORM sobre SQLite embebido nativo (offline-first); módulos por dominio bajo `apps/backend/src/modulos`. Motor OMR por visión computacional TV3/TV4.
- Frontend: React 18 + Vite + TailwindCSS en `apps/frontend`; sistema Bento Elevation y Glassmorphism Prismatic Sapphire; selector de destino por `VITE_APP_DESTINO`.
- Portal alumno cloud: TypeScript API/read-model en `apps/portal_alumno_cloud` con sincronización batch (`schemaVersion: 3`).
- Runtime local nativo Windows: Installer Hub WiX Toolset v5 Burn + BA WPF .NET 8 para distribución Windows autónoma sin servicios externos.
- Tests principales por app con Vitest; scripts de gates y automatización de gobernanza en `scripts/`.