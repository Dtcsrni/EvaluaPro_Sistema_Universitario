# Handoff IA - Revisión visual OMR por página

- `sessionId`: `omr-page-preview-2026-09-28`
- `status`: `draft`
- `generatedAt`: `2026-09-28T23:14:41Z`
- `validationProfile`: `quick`

## Solicitud y objetivo

Continuar el objetivo activo de paridad GUI/API. Se añadió una vista PNG de la página
fuente de una ingesta OMR para que el docente pueda contrastar el original con el estado,
las marcas candidatas y la resolución manual desde EvaluaPro.

## Cambios

- API docente autenticada: `GET /omr/ingestas/{jobId}/paginas/{pageIndex}/preview`.
- El servidor limita la consulta al docente dueño del job, verifica el hash del PDF,
  rasteriza solo una página y responde PNG `private, no-store`.
- `PlantillasOmrWorkflow` permite solicitar y mostrar la página de origen con texto
  alternativo; el cliente API expone el PNG como binario.
- SPEC-071 REQ-012/AC-010 y la matriz de paridad de SPEC-070 documentan la capacidad.

## Validación

- `npm -C apps/frontend run test -- --run tests/plantillasOmrWorkflow.test.tsx`: 3/3.
- `node --test scripts/tests/evaluapro-client.test.mjs`: 34/34.
- `npm -C apps/backend run test -- --run tests/integracion/omrJobsWorkflow.test.ts`: 6/6.
- API contract, backend/frontend typecheck, frontend lint, `npm run sdd:audit`,
  `npm run guard:wcag` y `npm -C apps/frontend run build:docente`: correctos.
- La primera integración ejecutada junto con otras suites tuvo una falla OCR del pie;
  el caso aislado y la integración serial completa pasaron después.

## Pendiente

- La GUI empaquetada activa y el backend de producción aún sirven la versión previa.
  No se instalaron cambios: el checkout tiene 293 archivos rastreados modificados además
  de untracked, por lo que falta separar y auditar el candidato antes de promoverlo.
- Falta vista lado a lado de la página generada de referencia, comparación real del lote
  CamScanner y la matriz completa GUI/API del objetivo mayor.
- No se escribieron calificaciones ni se tocó la base de producción.

## Siguiente paso

Seguir cerrando brechas verificables GUI/API de SPEC-070 y SPEC-071. Antes de sincronizar
el candidato al runtime instalado, separar los cambios de esta tarea de los restantes y
validar el paquete/backend que usan la aplicación empaquetada.
