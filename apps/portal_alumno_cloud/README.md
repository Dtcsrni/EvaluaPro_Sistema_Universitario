# apps/portal_alumno_cloud

API del **Portal Alumno** (enfoque cloud / solo lectura) para **Sistema EvaluaPro (EP)**.

Estado: MVP en Beta (`1.0.0-beta.0`). Ver criterios de versión estable en `../../docs/VERSIONADO.md`.

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

## Endpoints académicos (TV3 ready)
- `GET /api/portal/perfil`
- `GET /api/portal/materias`
- `GET /api/portal/agenda`
- `GET /api/portal/avisos`
- `GET /api/portal/historial`

Sincronización:
- `POST /api/portal/sincronizar` soporta `schemaVersion: 3` (compat transitoria con `2`).

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica del portal cloud de consulta del alumno.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-06-08.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
