# apps/portal_alumno_cloud

API del **Portal Alumno** (enfoque cloud / solo lectura) para **Sistema EvaluaPro (EP)**.

## Desarrollo
Desde la raíz:
- `npm run dev:portal`

Directo aquí:
- `npm --prefix apps/portal_alumno_cloud run dev`

## Pruebas
- `npm --prefix apps/portal_alumno_cloud run test`

## Configuración
Variables relevantes (ver lista completa en `../../docs/AUTO_ENV.md`):
- `PUERTO_PORTAL`
- `MONGODB_URI` (si aplica a tu despliegue)
- `PORTAL_API_KEY`

Docs recomendadas:
- `../../docs/DESPLIEGUE.md`
- `../../docs/SEGURIDAD.md`
