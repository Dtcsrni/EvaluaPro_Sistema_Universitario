# apps/frontend

Frontend de **Sistema EvaluaPro (EP)** (React + Vite) con dos destinos:
- **Docente**: operación/gestión, generación, sincronización.
- **Alumno**: consulta de resultados.

Estado: MVP en Beta. Ver criterios de versión estable en `../../docs/VERSIONADO.md`.

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

Docs recomendadas:
- `../../docs/GUIA_FORMULARIOS.md`
- `../../docs/FLUJO_EXAMEN.md`
