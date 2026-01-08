# MERN minimal starter

Proyecto base MERN con API Express + MongoDB y frontend React + Vite. El repo
esta organizado como un monorepo de npm workspaces.

## Arquitectura
- `backend/`: API Express en TypeScript. Expone `/api/health` y conecta a Mongo.
- `frontend/`: UI React con Vite y TypeScript. Consulta la salud de la API.
- `scripts/`: utilidades de consola para verificar estado del stack.
- `docker-compose.yml`: orquesta Mongo, API y Web en contenedores.
- `client/` y `server/`: copias de `frontend/` y `backend/` (no usadas por los
  scripts del monorepo). Mantener sincronizadas o eliminar si no se usan.

## Requisitos
- Node.js 18+
- npm 9+
- Docker (opcional para MongoDB local)

## Configuracion
1) Crea `.env` con los valores necesarios (no hay `.env.example`).
2) Instala dependencias en el monorepo:
   ```bash
   npm install
   ```
3) Contenedores (Mongo + API + Web):
   ```bash
   docker compose up --build
   ```
   - Web: http://localhost:4173
   - API: http://localhost:4000/api/health

## Variables de entorno
- `PORT`: puerto de la API (default 4000).
- `MONGODB_URI`: URI de MongoDB. Si no esta definido, la API no conecta.
- `VITE_API_BASE_URL`: base URL de la API para el frontend (default
  `http://localhost:4000/api`).
- `WEB_URL`: usado por `scripts/dashboard.mjs` para verificar la web.

## Scripts principales (raiz)
- Desarrollo full-stack: `npm run dev`
- Solo API: `npm run dev:backend`
- Solo web: `npm run dev:frontend`
- Lint: `npm run lint`
- Build: `npm run build`
- Produccion API: `npm start`
- Estado de servicios: `npm run status`

## API de ejemplo
- GET `/api/health` devuelve `{ status, uptime, db }`.

## Documentacion adicional
- Mapa de archivos y descripcion: `docs/FILES.md`
