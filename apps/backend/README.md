# apps/backend

API Docente Local de **Sistema EvaluaPro (EP)**.

## Stack
- Node.js + TypeScript
- Express
- MongoDB (Mongoose)

## Desarrollo
Desde la raíz del repo:
- `npm run dev:backend`

Directo en esta app:
- `npm --prefix apps/backend run dev`

## Pruebas
- `npm --prefix apps/backend run test`

## Configuración
Variables relevantes (ver lista completa en `../../docs/AUTO_ENV.md`):
- `MONGODB_URI`
- `PUERTO_API` / `PORT`
- `JWT_SECRETO`

Docs recomendadas:
- `../../docs/ARQUITECTURA.md`
- `../../docs/SEGURIDAD.md`
- `../../docs/PRUEBAS.md`
