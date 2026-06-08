# apps/backend

API Docente Local de **Sistema EvaluaPro (EP)**.

Estado: MVP en Beta (`1.0.0-beta.0`). Ver criterios de versión estable en `../../docs/VERSIONADO.md`.

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

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica del backend docente y sus contratos API.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-06-08.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
