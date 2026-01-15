# Instrucciones para agentes (Copilot)

## Panorama del monorepo
- Apps:
	- `apps/backend/`: API docente local (Express + MongoDB) con monolito modular.
	- `apps/frontend/`: React + Vite. Selecciona app docente/alumno via `VITE_APP_DESTINO`.
	- `apps/portal_alumno_cloud/`: API portal alumno (solo lectura + sync), pensada para Cloud Run.
- Docs clave: `docs/ARQUITECTURA.md`, `docs/ARQUITECTURA_C4.md`, `docs/FLUJO_EXAMEN.md`.

## Workflows (comandos reales)
- Requisitos: Node >= 24 (workspaces npm).
- Dev full stack: `npm run dev` (Docker: mongo+api; Vite: 5173).
- Solo API (Docker): `npm run dev:backend`.
- Solo frontend: `npm run dev:frontend`.
- Portal cloud local: `npm run dev:portal`.
- Estado rápido: `npm run status` (script `scripts/dashboard.mjs`).
- Windows: `scripts/launch-dev.cmd` / `scripts/launch-prod.cmd` usan `scripts/launcher-dashboard.mjs`.

## Convenciones del proyecto (no genéricas)
- Nombres (rutas/variables/modulos): espanol mexicano + `camelCase`.
- Estructura backend:
	- Rutas se registran centralmente en `apps/backend/src/rutas.ts`.
	- Auth docente: todo excepto `/salud` y `/autenticacion/*` requiere JWT (middleware `requerirDocente`).
	- Validacion de payload: `validarCuerpo(esquemaZod)` (ver `apps/backend/src/compartido/validaciones/validar.ts`).
	- Errores controlados: lanzar `ErrorAplicacion` para responder `{ error: { codigo, mensaje, detalles? } }` (ver `apps/backend/src/compartido/errores/*`).
- Portal alumno:
	- Prefijo fijo: `/api/portal` (ver `apps/portal_alumno_cloud/src/app.ts`).
	- Sync/limpieza protegidos por API key en header `x-api-key` (`PORTAL_API_KEY`).
	- Sesion alumno usa token Bearer con hash en DB (ver `apps/portal_alumno_cloud/src/servicios/middlewareSesion.ts`).

## Integraciones y datos
- Mongo via Mongoose; si `MONGODB_URI` no existe, el backend omite conexion (ver `apps/backend/src/infraestructura/baseDatos/mongoose.ts`).
- PDFs locales se guardan en `apps/backend/data/examenes/` (no versionar artefactos).
- Sync local -> cloud usa `PORTAL_ALUMNO_URL` + `PORTAL_ALUMNO_API_KEY`.

## Pruebas
- Vitest en las 3 apps (ver `apps/*/vitest.config.ts`), con `tests/setup.ts`.
- Backend/portal usan Mongo en memoria para integracion (ver `apps/**/tests/utils/mongo.ts`).
- Ejecutar:
	- Backend: `npm run test` o `npm run test:backend`
	- Portal: `npm run test:portal`
	- Frontend: `npm run test:frontend`

## Criterios al cambiar codigo
- Al agregar endpoints del backend: crear router/validador/controlador y registrar en `apps/backend/src/rutas.ts` en la seccion correcta (antes o despues de `requerirDocente`).
- Evitar dependencias nuevas salvo necesidad clara (ya existen: zod, mongoose, pdf-lib, sharp, jsqr).
