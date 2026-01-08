# Mapa de archivos

Este documento describe cada archivo del repositorio. Los archivos generados
por herramientas estan marcados para no editar manualmente.

## Raiz
- `.gitignore`: reglas de archivos ignorados por Git.
- `docker-compose.yml`: orquestacion de Mongo, API y Web.
- `package.json`: scripts y workspaces del monorepo.
- `package-lock.json`: lockfile generado por npm (no editar a mano).
- `README.md`: guia principal de uso y arquitectura.
- `scripts/dashboard.mjs`: verificacion rapida de API y Web desde consola.

## backend/
- `backend/.eslintrc.cjs`: reglas ESLint para el backend.
- `backend/Dockerfile`: imagen Docker de la API (build + runtime).
- `backend/package.json`: dependencias y scripts de la API.
- `backend/tsconfig.json`: configuracion TypeScript de la API.
- `backend/src/index.ts`: punto de entrada del servidor Express.
- `backend/src/routes/health.ts`: endpoint de salud `/api/health`.

## frontend/
- `frontend/.eslintrc.cjs`: reglas ESLint para el frontend.
- `frontend/Dockerfile`: build y runtime del frontend estatico.
- `frontend/index.html`: documento HTML base para Vite.
- `frontend/package.json`: dependencias y scripts de la UI.
- `frontend/tsconfig.json`: configuracion TS para React.
- `frontend/tsconfig.node.json`: configuracion TS para tooling (Vite).
- `frontend/vite.config.ts`: configuracion de Vite.
- `frontend/src/App.tsx`: componente principal de la UI.
- `frontend/src/main.tsx`: bootstrap de React.
- `frontend/src/styles.css`: estilos globales.

## server/ (copia de backend)
- `server/.eslintrc.cjs`: reglas ESLint para el servidor (copia).
- `server/Dockerfile`: Dockerfile del servidor (copia).
- `server/package.json`: dependencias y scripts (copia).
- `server/tsconfig.json`: configuracion TS (copia).
- `server/src/index.ts`: entrada del servidor (copia).
- `server/src/routes/health.ts`: endpoint de salud (copia).

## client/ (copia de frontend)
- `client/.eslintrc.cjs`: reglas ESLint (copia).
- `client/Dockerfile`: Dockerfile del cliente (copia).
- `client/index.html`: HTML base (copia).
- `client/package.json`: dependencias y scripts (copia).
- `client/tsconfig.json`: configuracion TS (copia).
- `client/tsconfig.node.json`: configuracion TS para tooling (copia).
- `client/tsconfig.tsbuildinfo`: generado por TypeScript (no editar).
- `client/vite.config.ts`: configuracion Vite (copia).
- `client/src/App.tsx`: componente principal (copia).
- `client/src/main.tsx`: bootstrap React (copia).
- `client/src/styles.css`: estilos globales (copia).
