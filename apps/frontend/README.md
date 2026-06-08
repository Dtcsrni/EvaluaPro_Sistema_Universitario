# apps/frontend

Frontend de **Sistema EvaluaPro (EP)** (React + Vite) con dos destinos:
- **Docente**: operación/gestión, generación, sincronización.
- **Alumno**: consulta de resultados.

Estado: MVP en Beta (`1.0.0-beta.0`). Ver criterios de versión estable en `../../docs/VERSIONADO.md`.

## Desarrollo
Desde la raíz:
- `npm run dev:frontend`

Directo aquí:
- `npm --prefix apps/frontend run dev`

## PWA / Service Worker
- Manifests: `public/manifest-docente.webmanifest` y `public/manifest-alumno.webmanifest`.
- Service Worker: `public/portal-sw.js`.

## Pruebas
- `npm --prefix apps/frontend run test`
- Gate UX contractual (desde raiz): `npm run test:ux-quality:ci`
- Regresion visual (desde raiz): `npm run test:ux-visual:ci`

Docs recomendadas:
- `../../docs/GUIA_FORMULARIOS.md`
- `../../docs/FLUJO_EXAMEN.md`

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica de UX web docente/alumno.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-06-08.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
